import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Map, Building2, Plus, Edit, Calendar, DollarSign, Briefcase } from 'lucide-react';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { useRole } from '../hooks/useRole';
import toast from 'react-hot-toast';

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
}

interface Business {
  id: string;
  name: string;
}

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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'future'>('all');
  const { user } = useAuth();
  const { role } = useRole(user?.id ?? null);
  const navigate = useNavigate();
  const { businessId } = useParams();

  useEffect(() => {
    if (businessId) {
      setSelectedBusinessId(businessId);
    }
    fetchUserBusinesses();
  }, [businessId]);

  useEffect(() => {
    if (selectedBusinessId) {
      fetchProjects(selectedBusinessId);
    }
  }, [selectedBusinessId]);

  const fetchUserBusinesses = async () => {
    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user?.id);

      if (membershipError) throw membershipError;

      if (!membershipData || membershipData.length === 0) {
        setBusinesses([]);
        setLoading(false);
        return;
      }

      const businessIds = membershipData.map(membership => membership.business_id);

      const { data: businessesData, error: businessesError } = await supabase
        .from('businesses')
        .select('id, name')
        .in('id', businessIds);

      if (businessesError) throw businessesError;

      setBusinesses(businessesData || []);

      // If no business is selected yet and we have businesses, select the first one
      if (!selectedBusinessId && businessesData && businessesData.length > 0) {
        setSelectedBusinessId(businessId || businessesData[0].id);
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (businessId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('business_id', businessId)
        .order('start_date', { ascending: false });

      if (error) throw error;

      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const updateProjectImage = async (projectId: string, imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ image_url: imageUrl })
        .eq('id', projectId);

      if (error) throw error;
      
      // Update local state
      setProjects(projects.map(project => 
        project.id === projectId ? { ...project, image_url: imageUrl } : project
      ));
      
      setEditingImageProject(null);
      setNewImageUrl('');
      toast.success('Project image updated');
    } catch (error) {
      console.error('Error updating project image:', error);
      toast.error('Failed to update project image');
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleBusinessChange = (businessId: string) => {
    setSelectedBusinessId(businessId);
    navigate(`/projects/${businessId}`);
  };

  const filteredProjects = projects.filter(project => {
    const today = new Date();
    const startDate = new Date(project.start_date);
    const endDate = project.end_date ? new Date(project.end_date) : null;

    switch (filter) {
      case 'completed':
        return project.status === 'completed' || (endDate && endDate < today);
      case 'future':
        return startDate > today;
      default:
        return true;
    }
  });

  const handleNewProject = () => {
    setShowNewProjectModal(true);
  };

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            {role === 'admin' && businesses.length > 0 && (
              <select
                value={selectedBusinessId || ''}
                onChange={(e) => handleBusinessChange(e.target.value)}
                className="bg-highlight-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue px-3 py-1"
              >
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleNewProject}
              className="flex items-center gap-2 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-neon-blue text-white'
                  : 'bg-light-blue text-gray-300 hover:text-white'
              }`}
            >
              All Projects
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'completed'
                  ? 'bg-neon-blue text-white'
                  : 'bg-light-blue text-gray-300 hover:text-white'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('future')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'future'
                  ? 'bg-neon-blue text-white'
                  : 'bg-light-blue text-gray-300 hover:text-white'
              }`}
            >
              Future Projects
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Briefcase className="w-16 h-16 text-gray-500 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Projects Found</h2>
            <p className="text-gray-400 mb-6">
              {selectedBusinessId ? "This business doesn't have any projects yet." : "Please select a business to view projects."}
            </p>
            {selectedBusinessId && (
              <button
                onClick={handleNewProject}
                className="flex items-center gap-2 px-6 py-3 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Briefcase className="w-16 h-16 text-gray-500 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">No {filter} Projects Found</h2>
                <p className="text-gray-400">
                  {filter === 'completed' 
                    ? "No completed projects yet."
                    : filter === 'future'
                    ? "No future projects scheduled."
                    : "No projects found."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-highlight-blue rounded-xl overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-700/50 flex flex-col"
                  >
                <div className="h-40 overflow-hidden">
                  <img 
                    src={getProjectImage(project.id, project.image_url)}
                    alt={project.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 rounded-full text-xs text-white font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-white mb-2">{project.name}</h3>
                  
                  {project.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">{project.description}</p>
                  )}
                  
                  <div className="space-y-3 mt-auto">
                    {project.address && (
                      <div className="flex items-start gap-3">
                        <Map className="w-4 h-4 text-neon-blue mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{project.address}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-neon-blue flex-shrink-0" />
                      <span className="text-sm text-gray-300">Started {formatDate(project.start_date)}</span>
                    </div>
                    
                    {project.budget && (
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-neon-blue flex-shrink-0" />
                        <span className="text-sm text-gray-300">
                          Budget: ${project.budget.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-5 flex items-center justify-between">
                    <button
                      className="text-neon-blue hover:text-blue-400 text-sm flex items-center gap-1"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      View Details
                    </button>
                    <button
                      className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                      onClick={() => setEditingProject(project)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showNewProjectModal && selectedBusinessId && (
        <NewProjectModal
          businessId={selectedBusinessId}
          businessName={businesses.find(b => b.id === selectedBusinessId)?.name || ''}
          onClose={() => setShowNewProjectModal(false)}
          onProjectCreated={(newProject) => {
            setProjects([newProject, ...projects]);
            setShowNewProjectModal(false);
          }}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdate={(updatedProject) => {
            setProjects(projects.map(p => 
              p.id === updatedProject.id ? updatedProject : p
            ));
            setEditingProject(null);
          }}
        />
      )}
    </Layout>
  );
}

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onUpdate: (project: Project) => void;
}

function EditProjectModal({ project, onClose, onUpdate }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [address, setAddress] = useState(project.address || '');
  const [startDate, setStartDate] = useState(new Date(project.start_date).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '');
  const [budget, setBudget] = useState(project.budget?.toString() || '');
  const [status, setStatus] = useState(project.status || 'active');
  const [imageUrl, setImageUrl] = useState(project.image_url || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      const { data, error } = await supabase
        .from('projects')
        .update({
          name,
          description: description || null,
          address: address || null,
          start_date: startDate,
          end_date: endDate || null,
          budget: budget ? parseFloat(budget) : null,
          status,
          image_url: imageUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)
        .select()
        .single();
        
      if (error) throw error;
      
      toast.success('Project updated successfully');
      onUpdate(data as Project);
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-lg my-8">
        <h2 className="text-xl font-semibold text-white mb-6">Edit Project</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Budget
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              placeholder="Enter amount"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
            />
            {imageUrl && (
              <div className="mt-2">
                <div className="h-32 bg-light-blue/30 rounded-lg overflow-hidden">
                  <img 
                    src={imageUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = stockImages[0];
                      toast.error("Invalid image URL. Using fallback.");
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-light-blue transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name || !startDate}
              className="flex-1 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface NewProjectModalProps {
  businessId: string;
  businessName: string;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

function NewProjectModal({ businessId, businessName, onClose, onProjectCreated }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [budget, setBudget] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Format date correctly for database
      const formattedDate = new Date(startDate).toISOString();
      
      const { data, error } = await supabase
        .from('projects')
        .insert({
          business_id: businessId,
          name,
          description: description || null,
          address: address || null,
          start_date: formattedDate,
          budget: budget ? parseFloat(budget) : null,
          status: 'active',
          image_url: imageUrl || null
        })
        .select()
        .single();
        
      if (error) throw error;
      
      toast.success('Project created successfully');
      onProjectCreated(data as Project);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-highlight-blue p-6 rounded-xl w-full max-w-lg my-8">
        <h2 className="text-xl font-semibold text-white mb-6">New Project for {businessName}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              rows={3}
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
            />
            {imageUrl && (
              <div className="mt-2 h-20 bg-light-blue/30 rounded-lg overflow-hidden">
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1579547945413-497e1b99dac0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80";
                    toast.error("Invalid image URL. Using fallback.");
                  }}
                />
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Budget
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full px-4 py-2 bg-light-blue border border-gray-600 rounded-lg text-white focus:outline-none focus:border-neon-blue"
              placeholder="Enter amount"
              step="0.01"
              min="0"
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 text-white rounded-lg hover:bg-light-blue transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name || !startDate}
              className="flex-1 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}