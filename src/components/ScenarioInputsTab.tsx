import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { parseExcelImport } from '../lib/parseExcelImport'

type Props = {
  clientId: string
  onGoToPreview: () => void
}

// All input fields for v1. Stored as a flat JSONB object in the DB.
// Dates are YYYY-MM-DD strings; numbers are stored as strings to avoid
// null vs 0 ambiguity in controlled inputs.
export type ScenarioInputs = {
  // A: Key Information
  retirement_system: 'FERS' | 'CSRS'
  special_provisions: 'none' | 'LEO' | 'FF' | 'ATC'
  survivor_benefit: '0' | '25' | '50'

  // B: Important Dates
  date_of_birth: string
  retirement_scd: string
  goal_retirement_date: string

  // C: LES General Info
  current_salary: string
  high_3_salary: string
  sick_leave_hours: string
  marital_status: 'single' | 'married'

  // D: LES Deductions
  fehb_premium_biweekly: string
  fegli_premium_biweekly: string
  fegli_code: string
  tsp_contribution_traditional_biweekly: string
  tsp_contribution_roth_biweekly: string

  // E: TSP Info — balances
  tsp_balance_total: string
  tsp_balance_roth: string
  tsp_fund_g: string
  tsp_fund_f: string
  tsp_fund_c: string
  tsp_fund_s: string
  tsp_fund_i: string
  tsp_fund_l: string
  tsp_fund_l_name: string

  // E: TSP Info — future contribution allocations (%)
  tsp_alloc_g_pct: string
  tsp_alloc_f_pct: string
  tsp_alloc_c_pct: string
  tsp_alloc_s_pct: string
  tsp_alloc_i_pct: string
  tsp_alloc_l_pct: string

  // F: Social Security
  ss_benefit_62: string
  ss_benefit_67: string
  ss_benefit_70: string

  // G: Assumptions
  inflation_rate: string
  tsp_growth_rate: string
  cola_rate: string
}

const DEFAULTS: ScenarioInputs = {
  retirement_system: 'FERS',
  special_provisions: 'none',
  survivor_benefit: '0',
  date_of_birth: '',
  retirement_scd: '',
  goal_retirement_date: '',
  current_salary: '',
  high_3_salary: '',
  sick_leave_hours: '',
  marital_status: 'single',
  fehb_premium_biweekly: '',
  fegli_premium_biweekly: '',
  fegli_code: '',
  tsp_contribution_traditional_biweekly: '',
  tsp_contribution_roth_biweekly: '',
  tsp_balance_total: '',
  tsp_balance_roth: '',
  tsp_fund_g: '',
  tsp_fund_f: '',
  tsp_fund_c: '',
  tsp_fund_s: '',
  tsp_fund_i: '',
  tsp_fund_l: '',
  tsp_fund_l_name: '',
  tsp_alloc_g_pct: '',
  tsp_alloc_f_pct: '',
  tsp_alloc_c_pct: '',
  tsp_alloc_s_pct: '',
  tsp_alloc_i_pct: '',
  tsp_alloc_l_pct: '',
  ss_benefit_62: '',
  ss_benefit_67: '',
  ss_benefit_70: '',
  inflation_rate: '2.5',
  tsp_growth_rate: '6.0',
  cola_rate: '2.0',
}

export function ScenarioInputsTab({ clientId, onGoToPreview }: Props) {
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')

  useEffect(() => {
    loadScenario()
  }, [clientId])

  async function loadScenario() {
    setLoading(true)
    try {
      const scenario = await api.scenario.get(clientId)
      if (scenario.inputs && Object.keys(scenario.inputs).length > 0) {
        setInputs({ ...DEFAULTS, ...(scenario.inputs as Partial<ScenarioInputs>) })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario')
    }
    setLoading(false)
  }

  function set(field: keyof ScenarioInputs, value: string) {
    setInputs((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await api.scenario.save(clientId, inputs as unknown as Record<string, unknown>)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
    setSaving(false)
  }

  async function handleGeneratePreview() {
    await handleSave()
    onGoToPreview()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('importing')
    setImportMessage('')
    try {
      const imported = await parseExcelImport(file)
      const fieldCount = Object.keys(imported).length
      setInputs(prev => ({ ...prev, ...imported }))
      setImportStatus('success')
      setImportMessage(`Imported ${fieldCount} fields — review and save.`)
      setSaved(false)
    } catch (err) {
      setImportStatus('error')
      setImportMessage(err instanceof Error ? err.message : 'Import failed')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Warn if TSP allocation %s don't add up to 100
  const allocTotal = ['tsp_alloc_g_pct', 'tsp_alloc_f_pct', 'tsp_alloc_c_pct',
    'tsp_alloc_s_pct', 'tsp_alloc_i_pct', 'tsp_alloc_l_pct']
    .reduce((sum, k) => sum + (parseFloat(inputs[k as keyof ScenarioInputs] as string) || 0), 0)
  const allocWarning = allocTotal > 0 && Math.abs(allocTotal - 100) > 0.01

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Import from Excel ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus === 'importing'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#1B3D8F] text-[#1B3D8F] rounded-full hover:bg-[#EEF2FF] transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {importStatus === 'importing' ? 'Importing…' : 'Import from Excel'}
        </button>
        {importStatus === 'success' && (
          <span className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            ✓ {importMessage}
          </span>
        )}
        {importStatus === 'error' && (
          <span className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            ✗ {importMessage}
          </span>
        )}
      </div>

      <div className="space-y-8">

        {/* ── Section A: Key Information ───────────────────────────────────── */}
        <Section label="A — Key Information">
          <div className="space-y-5">

            <div>
              <FieldLabel>Retirement System</FieldLabel>
              <div className="flex gap-5 mt-1.5">
                <Radio
                  checked={inputs.retirement_system === 'FERS'}
                  onChange={() => set('retirement_system', 'FERS')}
                  label="FERS"
                />
                <Radio
                  disabled
                  checked={false}
                  onChange={() => {}}
                  label="CSRS (not supported in v1)"
                  dimmed
                />
              </div>
            </div>

            <div>
              <FieldLabel>Special Provisions</FieldLabel>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1.5">
                {([['none', 'None'], ['LEO', 'Law Enforcement (LEO)'], ['FF', 'Firefighter'], ['ATC', 'Air Traffic Control']] as const).map(([val, label]) => (
                  <Radio
                    key={val}
                    checked={inputs.special_provisions === val}
                    onChange={() => set('special_provisions', val)}
                    label={label}
                  />
                ))}
              </div>
              {inputs.special_provisions !== 'none' && (
                <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  Special provision multiplier logic is not calculated in v1. Will be noted in the retirement preview.
                </p>
              )}
            </div>

            <div>
              <FieldLabel>Survivorship Election</FieldLabel>
              <div className="flex gap-5 mt-1.5">
                {([['0', 'None (0%)'], ['25', '25%'], ['50', '50%']] as const).map(([val, label]) => (
                  <Radio
                    key={val}
                    checked={inputs.survivor_benefit === val}
                    onChange={() => set('survivor_benefit', val)}
                    label={label}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section B: Important Dates ───────────────────────────────────── */}
        <Section label="B — Important Dates">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Date of Birth" type="date" value={inputs.date_of_birth}
              onChange={(v) => set('date_of_birth', v)} />
            <Field label="Retirement SCD" type="date" value={inputs.retirement_scd}
              onChange={(v) => set('retirement_scd', v)}
              helper="Service Computation Date from LES" />
            <Field label="Goal Retirement Date" type="date" value={inputs.goal_retirement_date}
              onChange={(v) => set('goal_retirement_date', v)} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Creditable service will be computed from SCD → Goal Retirement Date.
          </p>
        </Section>

        {/* ── Section C: LES General Info ──────────────────────────────────── */}
        <Section label="C — LES General Info">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Current Salary (Basic + Locality)" type="number"
                value={inputs.current_salary} onChange={(v) => set('current_salary', v)}
                placeholder="e.g. 95000" prefix="$" />
              <Field label="Estimated High-3 at Retirement" type="number"
                value={inputs.high_3_salary} onChange={(v) => set('high_3_salary', v)}
                placeholder="Optional — estimated if blank" prefix="$" />
            </div>
            <Field label="Sick Leave Hours Balance" type="number"
              value={inputs.sick_leave_hours} onChange={(v) => set('sick_leave_hours', v)}
              placeholder="e.g. 1200"
              helper="Converted to additional service credit at retirement" />
            <div>
              <FieldLabel>Marital Status</FieldLabel>
              <div className="flex gap-5 mt-1.5">
                {(['single', 'married'] as const).map((v) => (
                  <Radio key={v} checked={inputs.marital_status === v}
                    onChange={() => set('marital_status', v)} label={v.charAt(0).toUpperCase() + v.slice(1)} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section D: LES Deductions ────────────────────────────────────── */}
        <Section label="D — LES Deductions">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">FEHB</p>
              <Field label="Bi-weekly Premium (Employee Share)" type="number"
                value={inputs.fehb_premium_biweekly} onChange={(v) => set('fehb_premium_biweekly', v)}
                placeholder="e.g. 350" prefix="$" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">FEGLI</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bi-weekly Premium" type="number"
                  value={inputs.fegli_premium_biweekly} onChange={(v) => set('fegli_premium_biweekly', v)}
                  placeholder="e.g. 45" prefix="$" />
                <Field label="FEGLI Code" type="text"
                  value={inputs.fegli_code} onChange={(v) => set('fegli_code', v)}
                  placeholder="e.g. Basic, B-1, C" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">TSP Contributions</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Traditional TSP Bi-weekly" type="number"
                  value={inputs.tsp_contribution_traditional_biweekly}
                  onChange={(v) => set('tsp_contribution_traditional_biweekly', v)}
                  placeholder="e.g. 800" prefix="$" />
                <Field label="Roth TSP Bi-weekly" type="number"
                  value={inputs.tsp_contribution_roth_biweekly}
                  onChange={(v) => set('tsp_contribution_roth_biweekly', v)}
                  placeholder="e.g. 200" prefix="$" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Section E: TSP Information ───────────────────────────────────── */}
        <Section label="E — TSP Information">
          <div className="space-y-6">

            {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total TSP Balance" type="number"
                value={inputs.tsp_balance_total} onChange={(v) => set('tsp_balance_total', v)}
                placeholder="e.g. 450000" prefix="$" />
              <Field label="Non-taxable Roth Balance" type="number"
                value={inputs.tsp_balance_roth} onChange={(v) => set('tsp_balance_roth', v)}
                placeholder="e.g. 75000" prefix="$" />
            </div>

            {/* Per-fund current balances */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Current Balance by Fund ($)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([['tsp_fund_g', 'G Fund'], ['tsp_fund_f', 'F Fund'], ['tsp_fund_c', 'C Fund'],
                   ['tsp_fund_s', 'S Fund'], ['tsp_fund_i', 'I Fund']] as const).map(([field, label]) => (
                  <Field key={field} label={label} type="number"
                    value={inputs[field]} onChange={(v) => set(field, v)}
                    placeholder="0" prefix="$" />
                ))}
                <div className="col-span-3 grid grid-cols-2 gap-3">
                  <Field label="L Fund Balance" type="number"
                    value={inputs.tsp_fund_l} onChange={(v) => set('tsp_fund_l', v)}
                    placeholder="0" prefix="$" />
                  <Field label="Which L Fund?" type="text"
                    value={inputs.tsp_fund_l_name} onChange={(v) => set('tsp_fund_l_name', v)}
                    placeholder="e.g. L 2045" />
                </div>
              </div>
            </div>

            {/* Per-fund future contribution %s */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Future Contribution Allocation (%)
              </p>
              {allocWarning && (
                <p className="mb-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  Allocations sum to {allocTotal.toFixed(1)}% — should total 100%.
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {([['tsp_alloc_g_pct', 'G Fund %'], ['tsp_alloc_f_pct', 'F Fund %'], ['tsp_alloc_c_pct', 'C Fund %'],
                   ['tsp_alloc_s_pct', 'S Fund %'], ['tsp_alloc_i_pct', 'I Fund %'], ['tsp_alloc_l_pct', 'L Fund %']] as const).map(([field, label]) => (
                  <Field key={field} label={label} type="number"
                    value={inputs[field]} onChange={(v) => set(field, v)}
                    placeholder="0" />
                ))}
              </div>
            </div>

          </div>
        </Section>

        {/* ── Section F: Social Security ───────────────────────────────────── */}
        <Section label="F — Social Security">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Monthly Benefit at 62" type="number"
              value={inputs.ss_benefit_62} onChange={(v) => set('ss_benefit_62', v)}
              placeholder="e.g. 1400" prefix="$" />
            <Field label="Monthly Benefit at 67" type="number"
              value={inputs.ss_benefit_67} onChange={(v) => set('ss_benefit_67', v)}
              placeholder="e.g. 2100" prefix="$" />
            <Field label="Monthly Benefit at 70" type="number"
              value={inputs.ss_benefit_70} onChange={(v) => set('ss_benefit_70', v)}
              placeholder="e.g. 2600" prefix="$" />
          </div>
          <p className="mt-2 text-xs text-slate-400">From SSA.gov statement.</p>
        </Section>

        {/* ── Section G: Assumptions (collapsible) ────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setAssumptionsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-semibold text-[#1B3D8F]">G — Assumptions</span>
            <span className="text-slate-400 text-xs">{assumptionsOpen ? '▲ Collapse' : '▼ Expand'}</span>
          </button>
          {assumptionsOpen && (
            <div className="px-5 pb-5 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-4 mt-4">
                <Field label="Inflation / High-3 Growth (%)" type="number"
                  value={inputs.inflation_rate} onChange={(v) => set('inflation_rate', v)}
                  placeholder="e.g. 2.5" />
                <Field label="TSP Growth Rate (%)" type="number"
                  value={inputs.tsp_growth_rate} onChange={(v) => set('tsp_growth_rate', v)}
                  placeholder="e.g. 6.0" />
                <Field label="COLA (in Retirement) (%)" type="number"
                  value={inputs.cola_rate} onChange={(v) => set('cola_rate', v)}
                  placeholder="e.g. 2.0" />
              </div>
            </div>
          )}
        </section>

      </div>

      {/* ── Sticky footer actions ────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 mt-8 -mx-8 px-8 py-4 flex items-center gap-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-full
                     hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Scenario'}
        </button>
        <button
          onClick={handleGeneratePreview}
          disabled={saving}
          className="px-5 py-2 bg-[#CC2229] text-white text-sm font-semibold rounded-full
                     hover:bg-[#a81b21] disabled:opacity-50 transition-colors"
        >
          Generate Retirement Preview →
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>}
      </div>
    </div>
  )
}

// ── Local sub-components (not exported — kept simple, no abstraction needed) ──

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-[#1B3D8F]">{label}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{children}</label>
}

function Radio({
  checked, onChange, label, disabled, dimmed,
}: {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
  dimmed?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 text-sm cursor-pointer ${dimmed ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700'}`}>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="accent-[#1B3D8F]"
      />
      {label}
    </label>
  )
}

function Field({
  label, type = 'text', value, onChange, placeholder, prefix, helper,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  prefix?: string
  helper?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-lg text-sm text-gray-900 py-2
                      focus:outline-none focus:ring-2 focus:ring-[#1B3D8F]/20 focus:border-[#1B3D8F]
                      placeholder:text-gray-300
                      ${prefix ? 'pl-6 pr-3' : 'px-3'}`}
        />
      </div>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  )
}
