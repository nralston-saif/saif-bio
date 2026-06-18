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
 * Pure function so the IRS Pub 1771 language branches are unit-testable. The
 * wording and layout mirror SAIFbio's outside-counsel gift-acknowledgement
 * template (formal serif letter, FEIN in the header, no goods/services
 * statement) — don't change the legal language without checking IRS Pub 1771.
 */

export interface LetterData {
  /** Full legal name, e.g. "SAIFbio Inc." */
  orgLegalName: string
  /** Defined short name used in the body, e.g. "SAIFbio" */
  orgShortName: string
  ein: string
  orgAddressLines: string[]
  letterDate: string
  /** Recipient block above the salutation: donor name then address lines */
  recipientLines: string[]
  /** e.g. "Dear Jane:" */
  salutation: string
  /** Opening paragraph thanking the donor and describing the gift */
  giftParagraph: string
  /** 501(c)(3) / 509(a)(1) tax-deductibility paragraph */
  deductibilityParagraph: string
  /** No-goods-or-services statement, or the quid pro quo variant */
  goodsServicesParagraph: string
  /** Non-cash gifts only: states the letter does not assign a value */
  inKindNote: string | null
  closingLine: string
  signatoryName: string
  /** e.g. "President, SAIFbio Inc." */
  signatoryTitle: string
}

const IN_KIND_NOTE =
  'As required by federal tax law, this letter describes the donated property but does not assign it a value. You are responsible for determining the fair market value of the donated property.'

/** Strip a corporate suffix for the short reference name: "SAIFbio Inc." -> "SAIFbio". */
function shortName(legalName: string): string {
  const stripped = legalName
    .replace(/,?\s+(inc\.?|llc|l\.l\.c\.|corp\.?|corporation|co\.?|company|foundation|ltd\.?)$/i, '')
    .trim()
  return stripped || legalName
}

/** Standard US "City, ST ZIP" line, omitting blank parts. */
function cityStateZip(
  city: string | null,
  state: string | null,
  postal: string | null
): string | null {
  const left = (city ?? '').replace(/,\s*$/, '').trim()
  const right = [state, postal].filter(Boolean).join(' ').trim()
  const line = [left, right].filter(Boolean).join(', ')
  return line || null
}

function formatShares(shares: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(shares)
}

function stockDescription(stockDetail: StockContributionDetail | null | undefined): string {
  if (!stockDetail) {
    throw new Error('Stock contribution details are required before generating letters.')
  }
  const ticker = stockDetail.ticker_symbol ? ` (${stockDetail.ticker_symbol})` : ''
  const cusip = stockDetail.cusip ? `, CUSIP ${stockDetail.cusip}` : ''
  return `${formatShares(stockDetail.shares)} shares of ${stockDetail.security_name}${ticker}${cusip}`
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

  const orgLegalName = settings.org_legal_name
  const orgShortName = shortName(orgLegalName)

  const isOrg = contact.contact_type === 'organization' || Boolean(contact.org_name)
  // Name the donor by their official/legal name on the letter, not an
  // app-display nickname: prefer the organization's full name for orgs.
  const donorName = isOrg && contact.org_name ? contact.org_name : contact.display_name

  const orgAddressLines = [
    settings.address_line1,
    settings.address_line2,
    cityStateZip(settings.city, settings.state, settings.postal_code),
  ].filter((line): line is string => Boolean(line))

  const donorAddressLines = [
    contact.address_line1,
    contact.address_line2,
    cityStateZip(contact.city, contact.state, contact.postal_code),
  ].filter((line): line is string => Boolean(line))

  const greetName = contact.first_name?.trim() || donorName
  const salutation = `Dear ${greetName}:`

  const isNonCash = contribution.method === 'in_kind' || contribution.method === 'stock'

  let giftClause: string
  if (contribution.method === 'stock') {
    giftClause = stockDescription(stockDetail)
  } else if (contribution.method === 'in_kind') {
    giftClause = contribution.in_kind_description ?? 'in-kind property'
  } else {
    giftClause = `${formatCents(contribution.amount_cents)} USD`
  }

  // Orgs are thanked in the third person ("thank X for its donation"); for an
  // individual we've already greeted them, so thank "you" directly.
  const thanks = isOrg
    ? `thank ${donorName} for its donation of`
    : 'thank you for your donation of'
  const giftParagraph =
    `On behalf of ${orgLegalName} (“${orgShortName}”), I want to ${thanks} ` +
    `${giftClause} to ${orgShortName}, which the organization received on ` +
    `${formatDateLong(contribution.received_date)}.`

  const deductibilityParagraph =
    'Our organization is recognized by the U.S. Internal Revenue Service (“IRS”) as a ' +
    'tax-exempt organization described in Section 501(c)(3) of the U.S. Internal Revenue Code ' +
    '(the “Code”) and a public charity described in Section 509(a)(1) of the Code. Your ' +
    'contribution is tax deductible as a charitable contribution to the full extent allowed by law.'

  let goodsServicesParagraph: string
  if (contribution.quid_pro_quo) {
    const value = formatCents(contribution.goods_services_value_cents)
    goodsServicesParagraph =
      `In consideration for your gift, ${orgShortName} provided the following goods or services: ` +
      `${contribution.goods_services_description}. Our good-faith estimate of the value of these ` +
      `goods or services is ${value}. Only the amount of your contribution that exceeds the value ` +
      'of the goods or services provided is deductible for federal income tax purposes. Please ' +
      'keep this written acknowledgement of your donation for your tax records.'
  } else {
    goodsServicesParagraph =
      'IRS regulations require us to state that no goods or services were provided in ' +
      'consideration for your gift. Please keep this written acknowledgement of your donation ' +
      'for your tax records.'
  }

  const signatoryTitle = settings.letter_signatory_title
    ? `${settings.letter_signatory_title}, ${orgLegalName}`
    : orgLegalName

  return {
    orgLegalName,
    orgShortName,
    ein: settings.ein,
    orgAddressLines,
    letterDate: formatDateLong(letterDate),
    recipientLines: [donorName, ...donorAddressLines],
    salutation,
    giftParagraph,
    deductibilityParagraph,
    goodsServicesParagraph,
    inKindNote: isNonCash ? IN_KIND_NOTE : null,
    closingLine: settings.letter_closing_text,
    signatoryName: settings.letter_signatory_name,
    signatoryTitle,
  }
}
