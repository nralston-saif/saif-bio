import type { Contact, Contribution, Settings } from '@/lib/supabase/types/database'
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
  /** e.g. "$1,500.00" for cash; null for in-kind */
  amountFormatted: string | null
  inKindDescription: string | null
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

export function buildLetterData(
  contribution: Contribution,
  contact: Contact,
  settings: Settings,
  letterDate: string
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

  const isInKind = contribution.method === 'in_kind'

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
    amountFormatted: isInKind ? null : formatCents(contribution.amount_cents),
    inKindDescription: isInKind
      ? `${contribution.in_kind_description} ${IN_KIND_NOTE}`
      : null,
    goodsServicesStatement,
    deductibilityStatement:
      `${settings.org_legal_name} is a tax-exempt organization described in Section 501(c)(3) of the Internal Revenue Code ` +
      `(EIN ${settings.ein}). Contributions are deductible to the extent allowed by law. Please retain this letter for your tax records.`,
    closingText: settings.letter_closing_text,
    signatoryName: settings.letter_signatory_name,
    signatoryTitle: settings.letter_signatory_title ?? '',
  }
}
