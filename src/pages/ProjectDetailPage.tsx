import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Map, Calendar, ArrowLeft, Edit, DollarSign, Clock, Building2, CheckSquare, FileText, User, MessageCircle as Message, ImageIcon, Camera } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import toast from 'react-hot-toast';

// Stock project images from Unsplash
const stockImages = [
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80", // construction site
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80", // architecture
  "https://images.unsplash.com/photo-1508450859948-4e04fabaa4ea?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80", // building
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80", // house
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80", // cityscape
  "https://images.unsplash.com/photo-1486718448742-163732cd1544?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80", // building construction
];

// Get a deterministic image based on project ID
const getProjectImage = (projectId: string, imageUrl?: string | null) => {
  if (imageUrl) return imageUrl;
  
  // Use the last character of the ID to determine image index
  const lastChar = projectId.charAt(projectId.length - 1);
  const index = parseInt(lastChar, 16) % stockImages.length;
  return stockImages[index];
};

interface Project {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  address: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  budget: number | null;
  created_at: string;
  image_url?: string | null;
  business?: {
    id: string;
    name: string;
  };
}

export default function ProjectDetailPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editingImage, setEditingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
  }, [projectId]);

  const fetchProject = async (id: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          business:businesses(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setProject(data);
      checkOwnerStatus(data.business_id);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const checkOwnerStatus = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('created_by')
        .eq('id', businessId)
        .single();

      if (error) throw error;

      setIsOwner(user?.id === data.created_by);
    } catch (error) {
      console.error('Error checking owner status:', error);
    }
  };
  
  const updateProjectImage = async () => {
    if (!project) return;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ image_url: newImageUrl })
        .eq('id', project.id);

      if (error) throw error;
      
      // Update local state
      setProject({
        ...project,
        image_url: newImageUrl
      });
      
      setEditingImage(false);
      setNewImageUrl('');
      toast.success('Project image updated');
    } catch (error) {
      console.error('Error updating project image:', error);
      toast.error('Failed to update project image');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-emerald-500';
      case 'completed':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDaysActive = (startDate: string) => {
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-xl text-white mb-4">Project not found</h2>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate(`/projects/${project.business_id}`)}
          className="text-gray-400 hover:text-white flex items-center gap-2 p-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Project Header & Details */}
        <div className="md:col-span-2 bg-highlight-blue rounded-xl overflow-hidden shadow-xl">
          <div className="h-2 bg-gradient-to-r from-neon-blue to-blue-600"></div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">{project.name}</h1>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-neon-blue" />
                  <span className="text-gray-300">{project.business?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 md:mt-0">
                <span className={`px-3 py-1 rounded-full text-sm text-white font-medium ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
                {isOwner && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Project
                  </button>
                )}
              </div>
            </div>

            {project.description && (
              <div className="bg-light-blue/50 p-4 rounded-lg mb-6">
                <p className="text-gray-300">{project.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-light-blue/30 p-4 rounded-lg border border-light-blue/20">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-neon-blue" />
                  <h3 className="text-sm font-medium text-gray-300">Start Date</h3>
                </div>
                <p className="text-white text-lg pl-8">{formatDate(project.start_date)}</p>
              </div>

              <div className="bg-light-blue/30 p-4 rounded-lg border border-light-blue/20">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-neon-blue" />
                  <h3 className="text-sm font-medium text-gray-300">Days Active</h3>
                </div>
                <p className="text-white text-lg pl-8">{getDaysActive(project.start_date)} days</p>
              </div>

              {project.budget && (
                <div className="bg-light-blue/30 p-4 rounded-lg border border-light-blue/20">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-5 h-5 text-neon-blue" />
                    <h3 className="text-sm font-medium text-gray-300">Budget</h3>
                  </div>
                  <p className="text-white text-lg pl-8">${project.budget.toLocaleString()}</p>
                </div>
              )}

              {project.address && (
                <div className="bg-light-blue/30 p-4 rounded-lg border border-light-blue/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Map className="w-5 h-5 text-neon-blue" />
                    <h3 className="text-sm font-medium text-gray-300">Location</h3>
                  </div>
                  <p className="text-white text-lg pl-8">{project.address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Project Image */}
        <div className="bg-highlight-blue rounded-xl overflow-hidden shadow-xl">
          <div className="relative h-64 md:h-full">
            <img 
              src={getProjectImage(project.id, project.image_url)}
              alt={project.name}
              className="w-full h-full object-cover"
            />
            
            {isOwner && (
              <button
                className="absolute bottom-4 right-4 bg-light-blue/80 hover:bg-light-blue rounded-lg px-3 py-2 text-white flex items-center gap-2 text-sm transition-colors"
                onClick={() => {
                  setEditingImage(true);
                  setNewImageUrl(project.image_url || '');
                }}
              >
                <Camera className="w-4 h-4" />
                Change Image
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-highlight-blue rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-neon-blue" />
              Tasks
            </h2>
            <div className="bg-light-blue/30 p-6 rounded-lg border border-light-blue/20 text-center">
              <p className="text-gray-300">Task management coming soon</p>
              <button className="mt-3 px-4 py-2 bg-neon-blue text-white rounded-lg">
                Create First Task
              </button>
            </div>
          </div>

          <div className="bg-highlight-blue rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-neon-blue" />
              Notes
            </h2>
            <div className="bg-light-blue/30 p-6 rounded-lg border border-light-blue/20 text-center">
              <p className="text-gray-300">Project notes coming soon</p>
              <button className="mt-3 px-4 py-2 bg-neon-blue text-white rounded-lg">
                Add Note
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-highlight-blue rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-neon-blue" />
              Team Members
            </h2>
            <div className="bg-light-blue/30 p-6 rounded-lg border border-light-blue/20 text-center">
              <p className="text-gray-300">Team management coming soon</p>
              <button className="mt-3 px-4 py-2 bg-neon-blue text-white rounded-lg">
                Assign Team Members
              </button>
            </div>
          </div>

          <div className="bg-highlight-blue rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Message className="w-5 h-5 text-neon-blue" />
              Project Messages
            </h2>
            <div className="bg-light-blue/30 p-6 rounded-lg border border-light-blue/20 text-center">
              <p className="text-gray-300">Project chat coming soon</p>
              <button 
                className="mt-3 px-4 py-2 bg-neon-blue text-white rounded-lg"
                onClick={() => navigate('/chat')}
              >
                Go to Messages
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Image URL Change Modal */}
      {editingImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-6">Update Project Image</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue mb-4"
              />
              
              {newImageUrl && (
                <div className="mb-4">
                  <p className="text-sm text-gray-300 mb-2">Preview:</p>
                  <div className="h-40 bg-light-blue/30 rounded-lg overflow-hidden">
                    <img 
                      src={newImageUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1579547945413-497e1b99dac0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80";
                        toast.error("Invalid image URL. Using fallback.");
                      }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setEditingImage(false);
                    setNewImageUrl('');
                  }}
                  className="px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-light-blue transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateProjectImage}
                  disabled={!newImageUrl}
                  className="flex-1 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  Update Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}