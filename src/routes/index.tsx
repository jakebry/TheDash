import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import Login from '../pages/Login';
import Layout from '../components/Layout';

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
            <Layout>
              <div>Business Management</div>
            </Layout>
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
            <Layout>
              <div>Chat</div>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}