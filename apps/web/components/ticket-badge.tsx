interface TicketBadgeProps {
  remaining: number;
  total: number;
}

export function TicketBadge({ remaining, total }: TicketBadgeProps) {
  if (remaining === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Sold Out
      </span>
    );
  }

  const percentage = (remaining / total) * 100;

  if (percentage < 10) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        {remaining} left
      </span>
    );
  }

  if (percentage <= 50) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        {remaining} left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      {remaining} available
    </span>
  );
}
