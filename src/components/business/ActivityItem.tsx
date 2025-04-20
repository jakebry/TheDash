import { ReactNode } from 'react';

interface ActivityItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  time: string;
}

export function ActivityItem({ icon, title, description, time }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-700 pb-4">
      <div className="p-2 bg-light-blue rounded-lg">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-white">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <div className="text-xs text-gray-500">{time}</div>
    </div>
  );
}