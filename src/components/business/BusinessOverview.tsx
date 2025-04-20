import { Building2, Users, Briefcase, MessageSquare } from 'lucide-react';
import { StatCard } from './StatCard';
import { ActivityItem } from './ActivityItem';
import { Business, BusinessMember } from '../../types/business';
import { useNavigate } from 'react-router-dom';

interface BusinessOverviewProps {
  business: Business;
  members: BusinessMember[];
  isOwner: boolean;
  projectsCount: number;
  unreadCounts: Record<string, number>;
  onEditClick: () => void;
}

export function BusinessOverview({ 
  business, 
  members, 
  isOwner, 
  projectsCount, 
  unreadCounts,
  onEditClick
}: BusinessOverviewProps) {
  const navigate = useNavigate();
  
  if (!business) return null;
  
  return (
    <div className="space-y-6">
      <div className="bg-highlight-blue rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {business.logo_url ? (
              <img 
                src={business.logo_url} 
                alt={business.name} 
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-neon-blue/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-8 h-8 text-neon-blue" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{business.name}</h2>
              {business.description && (
                <p className="text-gray-300 mt-1">{business.description}</p>
              )}
            </div>
          </div>
          
          {isOwner && (
            <button
              onClick={onEditClick}
              className="flex items-center gap-2 px-3 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Manage Business
            </button>
          )}
        </div>
      </div>

      {/* Business stats and quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Users className="w-5 h-5 text-neon-blue" />}
          label="Team Members"
          value={members.length.toString()}
          onClick={() => onEditClick()}
        />
        
        <StatCard 
          icon={<Briefcase className="w-5 h-5 text-emerald-500" />}
          label="Active Projects"
          value={projectsCount.toString()}
          onClick={() => navigate(`/projects/${business.id}`)}
        />
        
        <StatCard 
          icon={<MessageSquare className="w-5 h-5 text-yellow-500" />}
          label="Messages"
          value={(unreadCounts.total || 0).toString()}
          subtitle="unread"
          onClick={() => navigate('/chat')}
        />
      </div>

      {/* Contact Information */}
      <div className="bg-highlight-blue rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Phone Number</p>
            <p className="text-white">{business.phone_number || 'Not provided'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Address</p>
            <p className="text-white">{business.address || 'Not provided'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Website</p>
            {business.website ? (
              <a 
                href={business.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-neon-blue hover:underline"
              >
                {business.website.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <p className="text-white">Not provided</p>
            )}
          </div>
          <div>
            <p className="text-gray-400 text-sm">Business Owner</p>
            <p className="text-white">{business.owner?.full_name || 'Unknown'}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-highlight-blue rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <ActivityItem 
            icon={<Users className="w-4 h-4 text-neon-blue" />}
            title="New team member joined"
            description="John Doe joined the team"
            time="2 hours ago"
          />
          <ActivityItem 
            icon={<Briefcase className="w-4 h-4 text-emerald-500" />}
            title="New project created"
            description="Highland Towers Construction project was created"
            time="1 day ago"
          />
          <ActivityItem 
            icon={<MessageSquare className="w-4 h-4 text-yellow-500" />}
            title="New message"
            description="You have 3 unread messages"
            time="2 days ago"
          />
        </div>
      </div>
    </div>
  );
}