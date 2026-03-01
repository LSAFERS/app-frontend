import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Client } from '../lib/api'
import type { ScenarioInputs } from './ScenarioInputsTab'

type Props = {
  client: Client
  onGoToInputs: () => void
}

export function ScenarioPreviewTab({ client, onGoToInputs }: Props) {
  const [inputs, setInputs] = useState<ScenarioInputs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.scenario.get(client.id).then((s) => {
      if (s.inputs && Object.keys(s.inputs).length > 0) {
        setInputs(s.inputs as ScenarioInputs)
      }
      setLoading(false)
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setLoading(false)
    })
  }, [client.id])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  if (error) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        {error}
      </div>
    )
  }

  if (!inputs) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-[#DDE2EC]">
        <p className="text-sm text-slate-500 font-medium">No scenario saved yet.</p>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          Enter inputs and click &ldquo;Generate Retirement Preview&rdquo;.
        </p>
        <button
          onClick={onGoToInputs}
          className="text-sm text-[#1B3D8F] font-semibold hover:underline"
        >
          Go to Scenario Inputs →
        </button>
      </div>
    )
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const dob = parseDate(inputs.date_of_birth)
  const scd = parseDate(inputs.retirement_scd)
  const retire = parseDate(inputs.goal_retirement_date)
  const hasCoreDates = !!(dob && scd && retire)
  const hasHigh3 = !!(inputs.high_3_salary || inputs.current_salary)
  const eligibility = (hasCoreDates && inputs.special_provisions === 'none')
    ? computeEligibility(dob!, retire!, scd!)
    : null
  const projCols = (hasCoreDates && hasHigh3) ? computeProjectionTable(inputs) : null
  const survivorPct = parseFloat(inputs.survivor_benefit || '0')

  return (
    <div className="max-w-4xl">

      {/* Preview header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h2 className="text-xl font-bold text-[#1B3D8F]">{client.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">
            Federal Retirement Preview · Planning Grade Only
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGoToInputs}
            className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600
                       rounded-full hover:bg-gray-50 transition-colors"
          >
            ← Edit Inputs
          </button>
          <button
            disabled
            className="text-xs px-3 py-1.5 border border-slate-200 text-slate-300
                       rounded-lg cursor-not-allowed"
            title="Coming in v2"
          >
            Download PDF (v2)
          </button>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── 1. Retirement Eligibility ─────────────────────────────────────── */}
        <PreviewCard title="Retirement Eligibility">
          {!hasCoreDates ? (
            <Placeholder>Enter Date of Birth, Retirement SCD, and Goal Retirement Date to compute eligibility.</Placeholder>
          ) : (
            <div className="space-y-4">
              <div>
                <SectionLabel>Retirement Characterization</SectionLabel>
                <Row label="Retirement System" value={inputs.retirement_system} />
                <Row label="Employee Type" value={inputs.special_provisions !== 'none' ? inputs.special_provisions : 'REGULAR'} />
                <Row label="Retirement Type" value={eligibility?.retirementType ?? 'See note below'} />
              </div>
              <div>
                <SectionLabel>Federal Service</SectionLabel>
                <Row label="Service Computation Date" value={fmtDateShort(inputs.retirement_scd)} />
                <Row label="Creditable Service (Today)" value={fmtServiceStr(scd!, new Date())} />
              </div>
              <div>
                <SectionLabel>Eligibility</SectionLabel>
                <Row label="Planned Retirement Date" value={fmtDateShort(inputs.goal_retirement_date)} />
                <Row label="Service at Retirement" value={fmtServiceStr(scd!, retire!)} />
                <Row label="Age at Retirement" value={fmtAgeStr(dob!, retire!)} />
                <div className="mt-3">
                  <span className={`inline-block text-sm font-bold px-3 py-1.5 rounded-lg ${
                    eligibility?.statusColor === 'green'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : eligibility?.statusColor === 'amber'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    Retirement Status: {eligibility?.retirementStatus ?? 'Not computed'}
                  </span>
                </div>
                {inputs.special_provisions !== 'none' && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                    Special Provisions ({inputs.special_provisions}) noted — eligibility rules for this provision type are not yet modeled in v1.
                  </p>
                )}
              </div>
            </div>
          )}
        </PreviewCard>

        {/* ── 2. High-3 Average ─────────────────────────────────────────────── */}
        <PreviewCard title="High-3 Average">
          {!hasHigh3 ? (
            <Placeholder>Enter Estimated High-3 or Current Salary to display this section.</Placeholder>
          ) : (
            <div className="space-y-1">
              <Row label="Average at Retirement" value={fmtDollar(inputs.high_3_salary || inputs.current_salary)} />
              <Row label="Retirement Date" value={fmtDateShort(inputs.goal_retirement_date)} />
              {projCols && (
                <Row label="Projected Growth Rate (per year)" value={`${inputs.inflation_rate || '2.5'}%`} />
              )}
              {!inputs.high_3_salary && inputs.current_salary && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  No High-3 entered — using current salary as a proxy. Enter Estimated High-3 for a more accurate figure.
                </p>
              )}
            </div>
          )}
        </PreviewCard>

        {/* ── 3. Proposed & Delayed Retirement ─────────────────────────────── */}
        <PreviewCard title="Proposed & Delayed Retirement">
          {!projCols ? (
            <Placeholder>Enter dates and High-3 to view the retirement projection table.</Placeholder>
          ) : (
            <>
              {/* Input summary */}
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-0.5 pb-4 border-b border-gray-100">
                <Row label="Estimated High-3" value={fmtDollar(inputs.high_3_salary || inputs.current_salary)} />
                <Row label="High-3 Growth / Year" value={`${inputs.inflation_rate || '2.5'}%`} />
                <Row label="COLA (in Retirement)" value={`${inputs.cola_rate || '2.0'}%`} />
                <Row label="Service at Retirement" value={fmtServiceStr(scd!, retire!)} />
                <Row label="Age at Retirement" value={fmtAgeStr(dob!, retire!)} />
                <Row label="Sick Leave Hours" value={inputs.sick_leave_hours ? `${parseFloat(inputs.sick_leave_hours).toLocaleString()} hrs` : '—'} />
                <Row label="FERS Survivor Election" value={
                  survivorPct === 50 ? '50% Annuity' :
                  survivorPct === 25 ? '25% Annuity' : 'None'
                } />
              </div>

              {/* Projection table */}
              <div className="overflow-x-auto -mx-6">
                <table className="text-sm border-collapse" style={{ minWidth: `${208 + projCols.length * 82}px`, width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[#1B3D8F] text-left pl-6 pr-4 py-2.5 text-xs font-semibold text-white min-w-[208px]" />
                      {projCols.map((col, i) => (
                        <th
                          key={i}
                          className={`px-2 py-2.5 text-center text-xs font-semibold text-white whitespace-nowrap ${i === 0 ? 'bg-[#CC2229]' : 'bg-[#1B3D8F]'}`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TR label="Age In Years"              cols={projCols} get={c => c.ageYears} />
                    <TR label="Age In Months"             cols={projCols} get={c => c.ageMonths} blank0 />
                    <TR label="Service Years"             cols={projCols} get={c => c.serviceYears} />
                    <TR label="Service Months"            cols={projCols} get={c => c.serviceMonths} blank0 />
                    <TR label="Sick Leave Years"          cols={projCols} get={c => c.slYears} blank0 />
                    <TR label="Sick Leave Months"         cols={projCols} get={c => c.slMonths} blank0 />
                    <TR label="Estimated High-3 Avg ($)"  cols={projCols} get={c => c.high3} dollar />
                    <TR label="Change in High-3 ($)"      cols={projCols} get={c => c.high3Change} dollar blank0 />
                    <TR label="Annual Annuity (Before Reductions)" cols={projCols} get={c => c.annualGross} dollar group />
                    <TR label="Annual Annuity – No Survivor"       cols={projCols} get={c => c.annualGross} dollar />
                    <TR label="Monthly Annuity – No Survivor"      cols={projCols} get={c => c.monthlyNoSurvivor} dollar />
                    {survivorPct > 0 && (<>
                      <TR label={`Annual Annuity – With ${survivorPct}% Survivor`} cols={projCols} get={c => c.annualWithSurvivor} dollar group />
                      <TR label="Monthly Annuity – With Survivor"                  cols={projCols} get={c => c.monthlyWithSurvivor} dollar />
                      <TR label="Annual Survivor Annuity"                           cols={projCols} get={c => c.annualSurvivor} dollar />
                      <TR label="Monthly Survivor Annuity"                          cols={projCols} get={c => c.monthlySurvivor} dollar />
                      <TR label="Annual Cost of Survivor Annuity"                   cols={projCols} get={c => c.annualCost} dollar group />
                      <TR label="Monthly Cost of Survivor Annuity"                  cols={projCols} get={c => c.monthlyCost} dollar />
                    </>)}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400 ml-6">
                Sick leave hours are held constant across all columns. High-3 grows by {inputs.inflation_rate || '2.5'}% per year of delay.{' '}
                COLA of {inputs.cola_rate || '2.0'}% applies once in retirement and is not reflected in this comparison.
              </p>
            </>
          )}
        </PreviewCard>

        {/* ── 4. Social Security Snapshot ─────────────────────────────────── */}
        <PreviewCard title="Social Security Snapshot">
          {(inputs.ss_benefit_62 || inputs.ss_benefit_67 || inputs.ss_benefit_70) ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-100">
                    <th className="pb-2 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      Claiming Age
                    </th>
                    <th className="pb-2 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">
                      Est. Monthly Benefit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr>
                    <td className="py-2.5 text-slate-700">Age 62 (Early)</td>
                    <td className="py-2.5 font-semibold text-slate-900 text-right">{fmtDollar(inputs.ss_benefit_62)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-slate-700">Age 67 (Full Retirement Age)</td>
                    <td className="py-2.5 font-semibold text-slate-900 text-right">{fmtDollar(inputs.ss_benefit_67)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-slate-700">Age 70 (Maximum)</td>
                    <td className="py-2.5 font-semibold text-slate-900 text-right">{fmtDollar(inputs.ss_benefit_70)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-3">
                Source: SSA.gov statement. Claiming strategy not modeled in v1.
              </p>
            </>
          ) : (
            <Placeholder>Enter Social Security benefit estimates to display this section.</Placeholder>
          )}
        </PreviewCard>

        {/* ── 5. TSP Summary ──────────────────────────────────────────────── */}
        <PreviewCard title="TSP Balance">
          {inputs.tsp_balance_total ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-center border border-gray-200">
                  <p className="text-2xl font-bold text-[#1B3D8F]">{fmtDollar(inputs.tsp_balance_total)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Total Balance</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center border border-gray-200">
                  <p className="text-2xl font-bold text-[#1B3D8F]">{fmtDollar(inputs.tsp_balance_roth) || '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Roth (Non-taxable)</p>
                </div>
              </div>

              {/* Fund breakdown if entered */}
              {hasFundData(inputs) && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Fund Allocation
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-100">
                        <th className="pb-1.5 text-xs font-semibold text-slate-500">Fund</th>
                        <th className="pb-1.5 text-xs font-semibold text-slate-500 text-right">Balance</th>
                        <th className="pb-1.5 text-xs font-semibold text-slate-500 text-right">Future Alloc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {getFundRows(inputs).map(({ name, balance, alloc }) => (
                        <tr key={name}>
                          <td className="py-2 text-slate-700">{name}</td>
                          <td className="py-2 text-right text-slate-900 font-medium">{fmtDollar(balance)}</td>
                          <td className="py-2 text-right text-slate-500">{alloc ? `${alloc}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-slate-400 mt-3">
                {/* TODO: Add growth projection table using weighted fund blend + tsp_growth_rate assumption */}
                Growth projection table coming in next build phase.
              </p>
            </>
          ) : (
            <Placeholder>Enter TSP balance information to display this section.</Placeholder>
          )}
        </PreviewCard>

        {/* ── 6. FEHB ─────────────────────────────────────────────────────── */}
        <PreviewCard title="FEHB — Health Insurance">
          {inputs.fehb_premium_biweekly ? (
            <>
              <Row label="Bi-weekly Premium (Employee Share)" value={fmtDollar(inputs.fehb_premium_biweekly)} />
              <Row label="Monthly Equivalent" value={fmtDollar(String(parseFloat(inputs.fehb_premium_biweekly) * 26 / 12))} />
              <p className="text-xs text-slate-400 mt-3">
                FEHB continues into retirement subject to eligibility. Government share of premium also continues.
              </p>
            </>
          ) : (
            <Placeholder>Enter FEHB premium to display this section.</Placeholder>
          )}
        </PreviewCard>

        {/* ── 7. FEGLI ────────────────────────────────────────────────────── */}
        <PreviewCard title="FEGLI — Life Insurance">
          {(inputs.fegli_premium_biweekly || inputs.fegli_code) ? (
            <>
              <Row label="Coverage Code" value={inputs.fegli_code || '—'} />
              <Row label="Bi-weekly Premium" value={fmtDollar(inputs.fegli_premium_biweekly)} />
              <p className="text-xs text-slate-400 mt-3">
                Standard FEGLI reductions apply in retirement per OPM schedule.
                Coverage reduction details coming in a future update.
              </p>
            </>
          ) : (
            <Placeholder>Enter FEGLI information to display this section.</Placeholder>
          )}
        </PreviewCard>

      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-xs text-slate-400 border-t border-slate-200 pt-4 leading-relaxed">
        This preview is for planning purposes only and does not constitute an official benefit calculation.
        All figures are estimates and should be verified with OPM, TSP, SSA, and other authoritative sources
        before making retirement decisions.
      </p>
    </div>
  )
}

// ── FERS MRA lookup ────────────────────────────────────────────────────────────

function getMRA(birthYear: number): { years: number; months: number } {
  if (birthYear <= 1947) return { years: 55, months: 0 }
  if (birthYear === 1948) return { years: 55, months: 2 }
  if (birthYear === 1949) return { years: 55, months: 4 }
  if (birthYear === 1950) return { years: 55, months: 6 }
  if (birthYear === 1951) return { years: 55, months: 8 }
  if (birthYear === 1952) return { years: 55, months: 10 }
  if (birthYear <= 1964) return { years: 56, months: 0 }
  if (birthYear === 1965) return { years: 56, months: 2 }
  if (birthYear === 1966) return { years: 56, months: 4 }
  if (birthYear === 1967) return { years: 56, months: 6 }
  if (birthYear === 1968) return { years: 56, months: 8 }
  if (birthYear === 1969) return { years: 56, months: 10 }
  return { years: 57, months: 0 }
}

// ── Eligibility computation ────────────────────────────────────────────────────

interface EligibilityResult {
  retirementType: string
  retirementStatus: string
  statusColor: 'green' | 'amber' | 'red'
}

function computeEligibility(dob: Date, retire: Date, scd: Date): EligibilityResult {
  const age = dateDiff(dob, retire)
  const ageFrac = age.years + age.months / 12
  const svc = dateDiff(scd, retire)
  const svcFrac = svc.years + svc.months / 12
  const mra = getMRA(dob.getFullYear())
  const mraFrac = mra.years + mra.months / 12

  if ((ageFrac >= 62 && svcFrac >= 5) ||
      (ageFrac >= 60 && svcFrac >= 20) ||
      (ageFrac >= mraFrac && svcFrac >= 30)) {
    return { retirementType: 'REGULAR', retirementStatus: 'Service and Age Requirements Met', statusColor: 'green' }
  }
  if (ageFrac >= mraFrac && svcFrac >= 10) {
    return { retirementType: 'MRA+10 (Reduced)', retirementStatus: 'Eligible – Annuity Reduced 5% Per Year Under Age 62', statusColor: 'amber' }
  }
  return { retirementType: 'Not Yet Eligible', retirementStatus: 'Service or Age Requirement Not Met', statusColor: 'red' }
}

// ── Projection column type ─────────────────────────────────────────────────────

interface ProjCol {
  label: string
  ageYears: number
  ageMonths: number
  serviceYears: number
  serviceMonths: number
  slYears: number
  slMonths: number
  high3: number
  high3Change: number
  annualGross: number
  monthlyNoSurvivor: number
  annualWithSurvivor: number
  monthlyWithSurvivor: number
  annualSurvivor: number
  monthlySurvivor: number
  annualCost: number
  monthlyCost: number
}

// ── Projection table computation ───────────────────────────────────────────────

function computeProjectionTable(inputs: ScenarioInputs): ProjCol[] {
  const dob = parseDate(inputs.date_of_birth)!
  const scd = parseDate(inputs.retirement_scd)!
  const baseRetire = parseDate(inputs.goal_retirement_date)!
  const high3Base = parseFloat(inputs.high_3_salary || inputs.current_salary || '0')
  const inflationRate = parseFloat(inputs.inflation_rate || '2.5') / 100
  const survivorPct = parseFloat(inputs.survivor_benefit || '0')

  // Sick leave fixed at proposed retirement hours
  const sickHours = parseFloat(inputs.sick_leave_hours || '0') || 0
  const slFrac = sickHours / 2087
  const slYears = Math.floor(slFrac)
  const slMonths = Math.floor((slFrac - slYears) * 12)
  const slTotalYears = slYears + slMonths / 12

  return Array.from({ length: 12 }, (_, n) => {
    const retireDate = new Date(baseRetire)
    retireDate.setFullYear(retireDate.getFullYear() + n)

    const age = dateDiff(dob, retireDate)
    const svc = dateDiff(scd, retireDate)
    const ageFrac = age.years + age.months / 12
    const regularSvcFrac = svc.years + svc.months / 12
    const totalSvcFrac = regularSvcFrac + slTotalYears

    const high3 = Math.round(high3Base * Math.pow(1 + inflationRate, n))
    const prevHigh3 = n === 0 ? high3 : Math.round(high3Base * Math.pow(1 + inflationRate, n - 1))
    const high3Change = n === 0 ? 0 : high3 - prevHigh3

    // 1.1% multiplier if age ≥ 62 AND regular creditable service ≥ 20 yrs
    const multiplier = (ageFrac >= 62 && regularSvcFrac >= 20) ? 0.011 : 0.010
    const annualGross = Math.round(high3 * totalSvcFrac * multiplier)
    const monthlyNoSurvivor = Math.round(annualGross / 12)

    const reductionRate = survivorPct === 50 ? 0.10 : survivorPct === 25 ? 0.05 : 0
    const annualWithSurvivor = Math.round(annualGross * (1 - reductionRate))
    const monthlyWithSurvivor = Math.round(annualWithSurvivor / 12)
    const annualSurvivor = Math.round(annualGross * (survivorPct / 100))
    const monthlySurvivor = Math.round(annualSurvivor / 12)
    const annualCost = annualGross - annualWithSurvivor
    const monthlyCost = monthlyNoSurvivor - monthlyWithSurvivor

    return {
      label: n === 0 ? 'Proposed' : `Age ${age.years}`,
      ageYears: age.years,
      ageMonths: age.months,
      serviceYears: svc.years,
      serviceMonths: svc.months,
      slYears,
      slMonths,
      high3,
      high3Change,
      annualGross,
      monthlyNoSurvivor,
      annualWithSurvivor,
      monthlyWithSurvivor,
      annualSurvivor,
      monthlySurvivor,
      annualCost,
      monthlyCost,
    }
  })
}

// ── Date / display helpers ─────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function dateDiff(from: Date, to: Date): { years: number; months: number } {
  let years = to.getFullYear() - from.getFullYear()
  let months = to.getMonth() - from.getMonth()
  if (to.getDate() < from.getDate()) months--
  if (months < 0) { years--; months += 12 }
  return { years, months }
}

function fmtServiceStr(from: Date, to: Date): string {
  const { years, months } = dateDiff(from, to)
  if (years < 0) return '—'
  return `${years} Year${years !== 1 ? 's' : ''} ${months} Month${months !== 1 ? 's' : ''}`
}

function fmtAgeStr(dob: Date, asOf: Date): string {
  const { years, months } = dateDiff(dob, asOf)
  return `${years} Year${years !== 1 ? 's' : ''} ${months} Month${months !== 1 ? 's' : ''}`
}

function fmtDateShort(s: string): string {
  if (!s) return '—'
  const d = parseDate(s)
  if (!d) return '—'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${mm}-${dd}-${yy}`
}

function fmtDollar(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(n)) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function hasFundData(inputs: ScenarioInputs): boolean {
  return !!(inputs.tsp_fund_g || inputs.tsp_fund_f || inputs.tsp_fund_c ||
            inputs.tsp_fund_s || inputs.tsp_fund_i || inputs.tsp_fund_l)
}

function getFundRows(inputs: ScenarioInputs) {
  const funds = [
    { name: 'G Fund', balance: inputs.tsp_fund_g, alloc: inputs.tsp_alloc_g_pct },
    { name: 'F Fund', balance: inputs.tsp_fund_f, alloc: inputs.tsp_alloc_f_pct },
    { name: 'C Fund', balance: inputs.tsp_fund_c, alloc: inputs.tsp_alloc_c_pct },
    { name: 'S Fund', balance: inputs.tsp_fund_s, alloc: inputs.tsp_alloc_s_pct },
    { name: 'I Fund', balance: inputs.tsp_fund_i, alloc: inputs.tsp_alloc_i_pct },
  ]
  if (inputs.tsp_fund_l || inputs.tsp_fund_l_name) {
    funds.push({
      name: inputs.tsp_fund_l_name ? `L Fund (${inputs.tsp_fund_l_name})` : 'L Fund',
      balance: inputs.tsp_fund_l,
      alloc: inputs.tsp_alloc_l_pct,
    })
  }
  return funds.filter((f) => f.balance)
}

// ── Local sub-components ───────────────────────────────────────────────────────

function PreviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-6 py-3.5 bg-[#1B3D8F] border-b border-[#162f72]">
        <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 border-b border-gray-100 pb-1">
      {children}
    </p>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function TR({
  label, cols, get, dollar = false, blank0 = false, group = false,
}: {
  label: string
  cols: ProjCol[]
  get: (c: ProjCol) => number
  dollar?: boolean
  blank0?: boolean
  group?: boolean
}) {
  return (
    <tr>
      <td className={`sticky left-0 z-10 pl-6 pr-3 py-2 text-xs font-medium whitespace-nowrap border-r border-gray-200 ${
        group ? 'bg-[#EEF2FF] text-[#1B3D8F] font-semibold' : 'bg-white text-slate-500'
      }`}>
        {label}
      </td>
      {cols.map((col, i) => {
        const val = get(col)
        const display = blank0 && val === 0
          ? ''
          : dollar
          ? fmtDollar(val)
          : val.toLocaleString('en-US')
        return (
          <td
            key={i}
            className={`px-2 py-2 text-right text-xs whitespace-nowrap ${
              i === 0 ? 'font-bold text-[#CC2229]' : 'font-medium text-slate-800'
            } ${group ? 'bg-[#EEF2FF]' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
          >
            {display}
          </td>
        )
      })}
    </tr>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-400 italic py-1">{children}</p>
  )
}
