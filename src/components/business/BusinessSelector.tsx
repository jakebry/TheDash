import { Business } from '../../types/business';

interface BusinessSelectorProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onBusinessChange: (businessId: string) => void;
}

export function BusinessSelector({ businesses, selectedBusiness, onBusinessChange }: BusinessSelectorProps) {
  if (businesses.length <= 1) return null;
  
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-400 mb-2">
        Select Business
      </label>
      <select
        value={selectedBusiness?.id || ''}
        onChange={(e) => onBusinessChange(e.target.value)}
        className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
      >
        {businesses.map((business) => (
          <option key={business.id} value={business.id}>
            {business.name}
          </option>
        ))}
      </select>
    </div>
  );
}