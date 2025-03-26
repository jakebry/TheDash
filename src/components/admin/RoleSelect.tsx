interface RoleSelectProps {
  value: string;
  onChange: (role: 'admin' | 'business' | 'user') => void;
  disabled?: boolean;
  isUpdating?: boolean;
}

export function RoleSelect({ value, onChange, disabled, isUpdating }: RoleSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'admin' | 'business' | 'user')}
        disabled={disabled}
        className="bg-light-blue text-white border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-neon-blue disabled:opacity-50"
      >
        <option value="user">User</option>
        <option value="business">Business</option>
        <option value="admin">Admin</option>
      </select>
      {isUpdating && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
          <div className="w-3 h-3 border-t-2 border-r-2 border-neon-blue rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}