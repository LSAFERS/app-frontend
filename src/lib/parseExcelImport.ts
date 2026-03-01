/**
 * parseExcelImport.ts
 *
 * Parses a client data spreadsheet into ScenarioInputs.
 * Uses label-based lookup (case-insensitive) rather than fixed row numbers,
 * so inserted/deleted rows don't break the import.
 *
 * Layout assumption: label text is in column A or B, value is in column C.
 * Dates are read as Excel serial numbers and converted to YYYY-MM-DD.
 * Fund rows (G/F/C/S/I/L) appear twice (balances + allocations); the parser
 * disambiguates by tracking which section header was most recently seen.
 */

import * as XLSX from 'xlsx'
import type { ScenarioInputs } from '../components/ScenarioInputsTab'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type CellValue = string | number | boolean | null | undefined

interface RowEntry {
  rowIndex: number
  label: string        // normalized (trimmed, lowercase)
  rawLabel: string     // original text for diagnostics
  value: CellValue
  context: 'balance' | 'alloc' | 'none'  // section context at time of entry
}

// ---------------------------------------------------------------------------
// Value normalization helpers
// ---------------------------------------------------------------------------

function normalizeLabel(val: CellValue): string {
  if (val == null) return ''
  return String(val).trim().toLowerCase()
}

function stripMoney(val: CellValue): string {
  if (val == null) return ''
  if (typeof val === 'number') return String(val)
  const s = String(val).trim()
  // Remove $, commas, en-dash, em-dash, "—"
  const cleaned = s.replace(/[$,\u2013\u2014—]/g, '').trim()
  return cleaned === '' || cleaned === '-' ? '' : cleaned
}

function parseMoney(val: CellValue): string {
  const s = stripMoney(val)
  const n = parseFloat(s)
  if (isNaN(n)) return ''
  // Round to nearest cent, strip unnecessary trailing zeros
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}

// TSP allocation: spreadsheet stores as decimals (0.1724 = 17.24%).
// If the value is between 0 and 1 (exclusive), multiply by 100.
// If already > 1, treat as a whole-number percentage.
function parseAllocPct(val: CellValue): string {
  if (val == null) return ''
  if (typeof val === 'number') {
    if (val === 0) return '0'
    const pct = val > 0 && val <= 1 ? Math.round(val * 10000) / 100 : Math.round(val * 100) / 100
    return String(pct)
  }
  const s = String(val).replace('%', '').trim()
  const n = parseFloat(s)
  if (isNaN(n)) return ''
  const pct = n > 0 && n <= 1 ? Math.round(n * 10000) / 100 : Math.round(n * 100) / 100
  return String(pct)
}

function parseDate(val: CellValue): string {
  if (val == null) return ''
  // String date from cell formatted as text
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return ''
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      // toISOString gives UTC midnight; adjust for local timezone offset
      const offset = d.getTimezoneOffset() * 60000
      return new Date(d.getTime() + offset).toISOString().slice(0, 10)
    }
    return ''
  }
  // Excel serial number
  if (typeof val === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(val)
      if (parsed && parsed.y) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      }
    } catch {
      // ignore
    }
  }
  return ''
}

function parseSickLeave(val: CellValue): string {
  if (val == null) return ''
  const s = String(val).trim().toLowerCase()
  // "5 months" or "5 month" → convert to hours (OPM: 174 hrs/month)
  const monthMatch = s.match(/(\d+(?:\.\d+)?)\s*months?/)
  if (monthMatch) {
    return String(Math.round(parseFloat(monthMatch[1]) * 174))
  }
  // Plain number → hours
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? '' : String(n)
}

function mapSelect<T extends string>(val: CellValue, options: readonly T[], fallback: T): T {
  if (val == null) return fallback
  const s = String(val).trim()
  const found = options.find(o => o.toLowerCase() === s.toLowerCase())
  return found ?? fallback
}

function mapSurvivor(val: CellValue): '0' | '25' | '50' {
  if (val == null) return '0'
  // Handle decimal fractions (0.5 = 50%, 0.25 = 25%)
  if (typeof val === 'number') {
    if (val >= 0.45) return '50'
    if (val >= 0.2) return '25'
    return '0'
  }
  const s = String(val).replace('%', '').trim()
  if (s === '50' || s === '0.5') return '50'
  if (s === '25' || s === '0.25') return '25'
  return '0'
}

// ---------------------------------------------------------------------------
// Section-context detection keywords
// ---------------------------------------------------------------------------

const BALANCE_KEYWORDS = ['balance', 'by fund', 'fund balance', 'tsp balance', 'current balance']
const ALLOC_KEYWORDS   = ['allocation', 'contribution alloc', 'future allocation', 'fund alloc',
                          'future contribution', 'in percentages', 'contributions to each']

function isSectionHeader(label: string): boolean {
  return (
    BALANCE_KEYWORDS.some(k => label.includes(k)) ||
    ALLOC_KEYWORDS.some(k => label.includes(k))
  )
}

function labelContext(label: string): 'balance' | 'alloc' | null {
  if (BALANCE_KEYWORDS.some(k => label.includes(k))) return 'balance'
  if (ALLOC_KEYWORDS.some(k => label.includes(k))) return 'alloc'
  return null
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseExcelImport(file: File): Promise<Partial<ScenarioInputs>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

        // AOA = array of arrays; raw:true preserves serial numbers for dates
        const rows: CellValue[][] = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          raw: true,
          defval: null,
        })

        // ── Build ordered entry list ──────────────────────────────────────
        const entries: RowEntry[] = []
        let currentContext: 'balance' | 'alloc' | 'none' = 'none'

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          // Label from col A (index 0) or col B (index 1); value from col C (index 2)
          const colA = normalizeLabel(row[0])
          const colB = normalizeLabel(row[1])
          const label = colA || colB
          const rawLabel = String(row[0] ?? row[1] ?? '').trim()
          const value = row[2] ?? null

          if (!label) continue

          // Update context when we hit a section header
          if (isSectionHeader(label)) {
            const ctx = labelContext(label)
            if (ctx) currentContext = ctx
          }

          entries.push({ rowIndex: i, label, rawLabel, value, context: currentContext })
        }

        // ── Lookup helpers ────────────────────────────────────────────────

        // Exact match (use for unambiguous labels)
        function find(searchLabel: string): CellValue {
          const normalized = searchLabel.toLowerCase()
          return entries.find(e => e.label === normalized)?.value ?? null
        }

        // Partial match fallback (for labels that might have slight variations)
        function findPartial(searchLabel: string): CellValue {
          const normalized = searchLabel.toLowerCase()
          return entries.find(e => e.label.includes(normalized))?.value ?? null
        }

        // Fund lookup: label within the appropriate context.
        // Supports single-letter labels ('g','f','c','s','i') and
        // partial matches for multi-word labels like 'l funds, if any, which one'.
        function findFund(fundLabel: string, ctx: 'balance' | 'alloc'): CellValue {
          const normalized = fundLabel.toLowerCase()
          // Exact match in correct context first
          const ctxExact = entries.find(e => e.label === normalized && e.context === ctx)
          if (ctxExact) return ctxExact.value ?? null
          // Partial/startsWith match in correct context (handles 'l funds, if any...')
          const ctxPartial = entries.find(e => e.label.startsWith(normalized) && e.context === ctx)
          if (ctxPartial) return ctxPartial.value ?? null
          // Single occurrence anywhere → use it
          const allExact = entries.filter(e => e.label === normalized)
          if (allExact.length === 1) return allExact[0].value ?? null
          const allPartial = entries.filter(e => e.label.startsWith(normalized))
          if (allPartial.length === 1) return allPartial[0].value ?? null
          return null
        }

        // ── Build result ──────────────────────────────────────────────────
        const result: Partial<ScenarioInputs> = {
          // A: Key Information
          retirement_system:    mapSelect(find('fers or csrs'), ['FERS', 'CSRS'] as const, 'FERS'),
          special_provisions:   mapSelect(findPartial('special provision'), ['none', 'LEO', 'FF', 'ATC'] as const, 'none'),
          survivor_benefit:     mapSurvivor(findPartial('survivorship')),

          // B: Important Dates
          date_of_birth:        parseDate(find('date of birth')),
          retirement_scd:       parseDate(find('retirement scd')),
          // Handle common typo: 'Goal Retirment Date'
          goal_retirement_date: parseDate(findPartial('goal ret')),

          // C: LES General Info
          // 'Salary (as listed on the LES...)' — partial match on 'salary'
          current_salary:   parseMoney(findPartial('salary')),
          high_3_salary:    parseMoney(findPartial('high-3') ?? findPartial('high 3')),
          sick_leave_hours: parseSickLeave(findPartial('sick leave')),
          marital_status:   mapSelect(findPartial('marital status'), ['single', 'married'] as const, 'single'),

          // D: LES Deductions
          fehb_premium_biweekly:                 parseMoney(findPartial('fehb')),
          fegli_premium_biweekly:                parseMoney(findPartial('fegli bi-weekly')),
          fegli_code:                            String(findPartial('fegli code') ?? '').trim(),
          tsp_contribution_traditional_biweekly: parseMoney(findPartial('traditional tsp')),
          tsp_contribution_roth_biweekly:        parseMoney(findPartial('roth tsp')),

          // E: TSP Balances
          // Fund labels in spreadsheet are single letters: 'G', 'F', 'C', 'S', 'I'
          // L row label is 'L Funds, if any, which one'
          tsp_balance_total: parseMoney(findPartial('total tsp balance')),
          tsp_balance_roth:  parseMoney(findPartial('non-taxable roth')),
          tsp_fund_g:        parseMoney(findFund('g', 'balance')),
          tsp_fund_f:        parseMoney(findFund('f', 'balance')),
          tsp_fund_c:        parseMoney(findFund('c', 'balance')),
          tsp_fund_s:        parseMoney(findFund('s', 'balance')),
          tsp_fund_i:        parseMoney(findFund('i', 'balance')),
          tsp_fund_l:        parseMoney(findFund('l funds', 'balance')),

          // E: TSP Allocations — percentages stored as decimals in sheet (0.1724 = 17.24%)
          tsp_alloc_g_pct: parseAllocPct(findFund('g', 'alloc')),
          tsp_alloc_f_pct: parseAllocPct(findFund('f', 'alloc')),
          tsp_alloc_c_pct: parseAllocPct(findFund('c', 'alloc')),
          tsp_alloc_s_pct: parseAllocPct(findFund('s', 'alloc')),
          tsp_alloc_i_pct: parseAllocPct(findFund('i', 'alloc')),
          tsp_alloc_l_pct: parseAllocPct(findFund('l funds', 'alloc')),

          // F: Social Security — labels: 'Monthly benefit at 62/67/70'
          ss_benefit_62: parseMoney(findPartial('benefit at 62') ?? findPartial('monthly benefit at 62')),
          ss_benefit_67: parseMoney(findPartial('benefit at 67') ?? findPartial('monthly benefit at 67')),
          ss_benefit_70: parseMoney(findPartial('benefit at 70') ?? findPartial('monthly benefit at 70')),
        }

        // Remove empty-string values so they don't overwrite existing data
        for (const key of Object.keys(result) as (keyof ScenarioInputs)[]) {
          if (result[key] === '') delete result[key]
        }

        resolve(result)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse spreadsheet'))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}
