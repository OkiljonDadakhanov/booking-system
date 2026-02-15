'use client';

interface SortDropdownProps {
  sortBy: string;
  sortOrder: string;
  onSortChange: (sortBy: string, sortOrder: string) => void;
}

export function SortDropdown({
  sortBy,
  sortOrder,
  onSortChange,
}: SortDropdownProps) {
  const options = [
    { value: 'date-asc', label: 'Date (earliest)' },
    { value: 'date-desc', label: 'Date (latest)' },
    { value: 'price-asc', label: 'Price (low to high)' },
    { value: 'price-desc', label: 'Price (high to low)' },
    { value: 'title-asc', label: 'Title (A-Z)' },
    { value: 'title-desc', label: 'Title (Z-A)' },
  ];

  const currentValue = `${sortBy}-${sortOrder}`;

  return (
    <select
      value={currentValue}
      onChange={(e) => {
        const [newSortBy, newSortOrder] = e.target.value.split('-');
        onSortChange(newSortBy, newSortOrder);
      }}
      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white text-sm"
      aria-label="Sort events"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
