// StatusBadge component - no external UI imports needed

interface StatusBadgeProps {
  status: string;
  type?: 'candidate' | 'visa' | 'contract' | 'gate' | 'generic';
  className?: string;
}

const candidateStatusColors: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  shortlisted: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  interview1: 'bg-purple-100 text-purple-800 border-purple-200',
  interview2: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  contract: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  visa: 'bg-orange-100 text-orange-800 border-orange-200',
  placed: 'bg-green-100 text-green-800 border-green-200',
  withdrawn: 'bg-gray-100 text-gray-800 border-gray-200',
};

const visaStatusColors: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-800 border-gray-200',
  documents_submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  appointment_booked: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const contractStatusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  signed: 'bg-green-100 text-green-800 border-green-200',
  expired: 'bg-orange-100 text-orange-800 border-orange-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const gateStatusColors: Record<string, string> = {
  eligible: 'bg-green-100 text-green-800 border-green-200',
  not_placement_ready: 'bg-red-100 text-red-800 border-red-200',
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

  const colorClass = colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass} ${className}`}>
      {formatStatus(status)}
    </span>
  );
}
