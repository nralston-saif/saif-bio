/**
 * Seed sample data for local development.
 * Usage: npx tsx scripts/seed.ts (requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the environment, e.g. via `dotenv -e .env.local`).
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const { data: donor } = await supabase
    .from('bio_contacts')
    .insert({
      contact_type: 'individual',
      display_name: 'Jane Donor',
      first_name: 'Jane',
      last_name: 'Donor',
      email: 'jane.donor@example.com',
      address_line1: '1 Main St',
      city: 'Oakland',
      state: 'CA',
      postal_code: '94601',
      is_donor: true,
    })
    .select()
    .single()

  const { data: grantee } = await supabase
    .from('bio_contacts')
    .insert({
      contact_type: 'organization',
      display_name: 'BioSafety Lab Collective',
      org_name: 'BioSafety Lab Collective',
      email: 'grants@biosafetylab.example.org',
      tax_id: '98-7654321',
      is_grantee: true,
    })
    .select()
    .single()

  const { data: funder } = await supabase
    .from('bio_contacts')
    .insert({
      contact_type: 'organization',
      display_name: 'Open Philanthropy Example Fund',
      org_name: 'Open Philanthropy Example Fund',
      email: 'programs@opef.example.org',
      is_funder: true,
    })
    .select()
    .single()

  const { data: vendor } = await supabase
    .from('bio_contacts')
    .insert({
      contact_type: 'organization',
      display_name: 'Acme Accounting LLP',
      org_name: 'Acme Accounting LLP',
      is_vendor: true,
      w9_on_file: true,
      tax_id: '11-2233445',
    })
    .select()
    .single()

  if (donor) {
    await supabase.from('bio_contributions').insert([
      {
        contact_id: donor.id,
        amount_cents: 250_000,
        received_date: '2026-03-15',
        method: 'wire',
      },
      {
        contact_id: donor.id,
        amount_cents: 50_000,
        received_date: '2026-05-01',
        method: 'check',
        check_number: '1042',
        quid_pro_quo: true,
        goods_services_description: 'two fundraising dinner tickets',
        goods_services_value_cents: 15_000,
      },
    ])
  }

  const { data: legalCategory } = await supabase
    .from('bio_expense_categories')
    .select('id')
    .eq('name', 'Accounting fees')
    .single()

  if (legalCategory && vendor) {
    await supabase.from('bio_expenses').insert({
      expense_date: '2026-04-10',
      amount_cents: 120_000,
      description: 'Annual 990 preparation',
      category_id: legalCategory.id,
      vendor_contact_id: vendor.id,
      payment_method: 'ach',
      is_1099_eligible: true,
    })
  }

  if (grantee) {
    await supabase.from('bio_grant_proposals').insert({
      applicant_contact_id: grantee.id,
      title: 'Community biosafety training program',
      summary: 'Twelve-month training program for community lab biosafety officers.',
      pillars: ['detect', 'prevent'],
      amount_requested_cents: 5_000_000,
      received_date: '2026-05-20',
      entered_date: '2026-05-20',
      source: 'email',
      status: 'in_review',
    })
  }

  if (funder) {
    await supabase.from('bio_grants_in').insert({
      funder_contact_id: funder.id,
      opportunity_name: 'Biosecurity Field Building 2026',
      amount_requested_cents: 25_000_000,
      status: 'preparing',
      application_deadline: '2026-07-15',
    })
  }

  console.log('Seed complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
