import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  onClick?: () => void;
}

export function StatCard({ icon, label, value, subtitle, onClick }: StatCardProps) {
  return (
    <div 
      className={`bg-highlight-blue text-white rounded-xl p-4 flex items-center space-x-4 ${onClick ? 'cursor-pointer hover:bg-light-blue transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold">{value}</span>
          {subtitle && <span className="text-sm text-gray-400">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}