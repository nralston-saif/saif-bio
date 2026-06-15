import type {
  Contact,
  Contribution,
  Settings,
  StockContributionDetail,
} from '@/lib/supabase/types/database'
import { formatCents } from '@/lib/utils/money'
import { formatDateLong } from '@/lib/utils/dates'

/**
 * Builds the frozen data snapshot an acknowledgement letter is rendered from.
 * Pure function so the IRS Pub 1771 language branches are unit-testable.
 */

export interface LetterData {
  orgLegalName: string
  ein: string
  orgAddressLines: string[]
  donorName: string
  donorAddressLines: string[]
  letterDate: string
  receivedDate: string
  /** e.g. "$1,500.00" for cash; null for non-cash gifts */
  amountFormatted: string | null
  nonCashDescription: string | null
  /** The Pub 1771-required paragraph about goods/services */
  goodsServicesStatement: string
  deductibilityStatement: string
  closingText: string
  signatoryName: string
  signatoryTitle: string
}

const NO_GOODS_STATEMENT =
  'No goods or services were provided in exchange for this contribution.'

const IN_KIND_NOTE =
  'As required by federal tax law, this letter describes the donated property but does not assign it a value. Donors are responsible for determining the fair market value of donated property.'

function formatShares(shares: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(shares)
}

function stockDescription(stockDetail: StockContributionDetail | null | undefined): string {
  if (!stockDetail) {
    throw new Error('Stock contribution details are required before generating letters.')
  }

  const ticker = stockDetail.ticker_symbol ? ` (${stockDetail.ticker_symbol})` : ''
  const cusip = stockDetail.cusip ? `, CUSIP ${stockDetail.cusip}` : ''
  return `${formatShares(stockDetail.shares)} shares of ${stockDetail.security_name}${ticker}${cusip}. ${IN_KIND_NOTE}`
}

export function buildLetterData(
  contribution: Contribution,
  contact: Contact,
  settings: Settings,
  letterDate: string,
  stockDetail?: StockContributionDetail | null
): LetterData {
  if (!settings.ein) {
    throw new Error('Organization EIN is not set. Add it in Settings before generating letters.')
  }
  if (!settings.letter_signatory_name) {
    throw new Error('Letter signatory is not set. Add it in Settings before generating letters.')
  }

  let goodsServicesStatement: string
  if (contribution.quid_pro_quo) {
    const value = formatCents(contribution.goods_services_value_cents)
    goodsServicesStatement =
      `In exchange for this contribution, ${settings.org_legal_name} provided the following goods or services: ` +
      `${contribution.goods_services_description}. Our good-faith estimate of the value of these goods or services is ${value}. ` +
      `Only the amount of your contribution that exceeds the value of the goods or services provided is deductible for federal income tax purposes.`
  } else {
    goodsServicesStatement = NO_GOODS_STATEMENT
  }

  const isNonCash = contribution.method === 'in_kind' || contribution.method === 'stock'
  const nonCashDescription =
    contribution.method === 'stock'
      ? stockDescription(stockDetail)
      : contribution.method === 'in_kind'
        ? `${contribution.in_kind_description} ${IN_KIND_NOTE}`
        : null

  const orgAddressLines = [
    settings.address_line1,
    settings.address_line2,
    [settings.city, settings.state, settings.postal_code].filter(Boolean).join(', ') || null,
  ].filter((line): line is string => Boolean(line))

  const donorAddressLines = [
    contact.address_line1,
    contact.address_line2,
    [contact.city, contact.state, contact.postal_code].filter(Boolean).join(', ') || null,
  ].filter((line): line is string => Boolean(line))

  return {
    orgLegalName: settings.org_legal_name,
    ein: settings.ein,
    orgAddressLines,
    donorName: contact.display_name,
    donorAddressLines,
    letterDate: formatDateLong(letterDate),
    receivedDate: formatDateLong(contribution.received_date),
    amountFormatted: isNonCash ? null : formatCents(contribution.amount_cents),
    nonCashDescription,
    goodsServicesStatement,
    deductibilityStatement:
      `${settings.org_legal_name} is a tax-exempt organization described in Section 501(c)(3) of the Internal Revenue Code ` +
      `(EIN ${settings.ein}). Contributions are deductible to the extent allowed by law. Please retain this letter for your tax records.`,
    closingText: settings.letter_closing_text,
    signatoryName: settings.letter_signatory_name,
    signatoryTitle: settings.letter_signatory_title ?? '',
  }
}
