// StatusBadge — muted semantic palette (WEDL v2.0)
// Draft=grey · AI Processed=blue · Manual Review=amber · Approved=green
// Rejected=red · Visa Ready=emerald · Duplicate=orange · Archived=slate

interface StatusBadgeProps {
  status: string;
  type?: 'candidate' | 'visa' | 'contract' | 'gate' | 'generic';
  className?: string;
}

// All tones are muted 50/700 with soft 200 rings — enterprise, not decorative.
const candidateStatusColors: Record<string, string> = {
  waiting:     'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70',
  shortlisted: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',
  rejected:    'bg-red-50 text-red-700 ring-1 ring-red-200/70',
  interview1:  'bg-slate-50 text-slate-700 ring-1 ring-slate-200/70',
  interview2:  'bg-slate-50 text-slate-700 ring-1 ring-slate-200/70',
  contract:    'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70',
  visa:        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
  placed:      'bg-green-50 text-green-700 ring-1 ring-green-200/70',
  withdrawn:   'bg-slate-50 text-slate-600 ring-1 ring-slate-200/70',
};

const visaStatusColors: Record<string, string> = {
  not_started:         'bg-slate-50 text-slate-600 ring-1 ring-slate-200/70',
  documents_submitted: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',
  appointment_booked:  'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70',
  approved:            'bg-green-50 text-green-700 ring-1 ring-green-200/70',
  rejected:            'bg-red-50 text-red-700 ring-1 ring-red-200/70',
};

const contractStatusColors: Record<string, string> = {
  draft:     'bg-slate-50 text-slate-600 ring-1 ring-slate-200/70',
  sent:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200/70',
  signed:    'bg-green-50 text-green-700 ring-1 ring-green-200/70',
  expired:   'bg-orange-50 text-orange-700 ring-1 ring-orange-200/70',
  cancelled: 'bg-red-50 text-red-700 ring-1 ring-red-200/70',
};

const gateStatusColors: Record<string, string> = {
  eligible:             'bg-green-50 text-green-700 ring-1 ring-green-200/70',
  not_placement_ready:  'bg-red-50 text-red-700 ring-1 ring-red-200/70',
};

function formatStatus(status: string): string {
  return status
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function StatusBadge({ status, type = 'generic', className = '' }: StatusBadgeProps) {
  const colorMap =
    type === 'candidate'
      ? candidateStatusColors
      : type === 'visa'
        ? visaStatusColors
        : type === 'contract'
          ? contractStatusColors
          : type === 'gate'
            ? gateStatusColors
            : { ...candidateStatusColors, ...visaStatusColors, ...contractStatusColors };

  const colorClass = colorMap[status] || 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/70';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className}`}>
      {formatStatus(status)}
    </span>
  );
}
