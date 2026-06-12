const STYLES: Record<string, string> = {
  // generic
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  // letters
  generated: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  // expenses
  paid: 'bg-green-100 text-green-800',
  reimbursed: 'bg-blue-100 text-blue-800',
  // proposals
  received: 'bg-gray-100 text-gray-700',
  in_review: 'bg-yellow-100 text-yellow-800',
  decided: 'bg-blue-100 text-blue-800',
  withdrawn: 'bg-gray-100 text-gray-500',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-700',
  // grants out
  awarded: 'bg-green-100 text-green-800',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-700',
  terminated: 'bg-red-100 text-red-700',
  // disbursements / reports / deliverables
  scheduled: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-gray-100 text-gray-500',
  upcoming: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-700',
  waived: 'bg-gray-100 text-gray-500',
  submitted: 'bg-blue-100 text-blue-800',
  // grants in
  prospect: 'bg-gray-100 text-gray-700',
  preparing: 'bg-yellow-100 text-yellow-800',
  // votes
  yes: 'bg-green-100 text-green-800',
  no: 'bg-red-100 text-red-700',
  maybe: 'bg-yellow-100 text-yellow-800',
}

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? 'bg-gray-100 text-gray-700'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}
