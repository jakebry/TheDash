import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import Login from '../pages/Login';
import Layout from '../components/Layout';
import Settings from '../pages/Settings';
import AdminSettings from '../pages/AdminSettings';
import BusinessPage from '../pages/BusinessPage';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import Chat from '../pages/Chat';

export default function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/dashboard"
        element={
          user ? (
            <Layout>
              <div>Dashboard Content</div>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/business"
        element={
          user ? (
            <BusinessPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/time-clock"
        element={
          user ? (
            <Layout>
              <div>Time Clock</div>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/chat"
        element={
          user ? (
            <Chat />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/settings"
        element={
          user ? (
            <Settings />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={
          user ? (
            <AdminSettings />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/projects"
        element={
          user ? (
            <ProjectsPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/projects/:businessId"
        element={
          user ? (
            <ProjectsPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/project/:projectId"
        element={
          user ? (
            <ProjectDetailPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}