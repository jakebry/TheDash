import { useAuth } from '../contexts/useAuth';
import { Avatar } from './Avatar';
import { NotificationMenu } from './NotificationMenu';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="bg-highlight-blue px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="flex items-center gap-4">
        <NotificationMenu />
        <div className="flex items-center gap-3">
          <Avatar />
        </div>
      </div>
    </nav>
  );
}