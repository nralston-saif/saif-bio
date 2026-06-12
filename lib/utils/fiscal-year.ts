/**
 * Fiscal year helpers. A fiscal year is identified by the calendar year in
 * which it ends (e.g. FY2026 with a July start runs Jul 2025 - Jun 2026).
 * With a January start (fiscal_year_start_month = 1), FY2026 = calendar 2026.
 */

export interface FiscalYearRange {
  /** inclusive, YYYY-MM-DD */
  start: string
  /** exclusive, YYYY-MM-DD */
  end: string
}

export function fiscalYearRange(fiscalYear: number, startMonth: number): FiscalYearRange {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (startMonth === 1) {
    return { start: `${fiscalYear}-01-01`, end: `${fiscalYear + 1}-01-01` }
  }
  return {
    start: `${fiscalYear - 1}-${pad(startMonth)}-01`,
    end: `${fiscalYear}-${pad(startMonth)}-01`,
  }
}

/** The fiscal year a given YYYY-MM-DD date falls in */
export function fiscalYearOf(date: string, startMonth: number): number {
  const [year, month] = date.split('-').map(Number)
  if (startMonth === 1) return year
  return month >= startMonth ? year + 1 : year
}

/** The current fiscal year as of today */
export function currentFiscalYear(startMonth: number): number {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return fiscalYearOf(today, startMonth)
}
