import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from './Feedback.jsx';

/** Requires a signed-in user; remembers where they were heading. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Requires the admin role (Admin Module). */
export function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container">
        <div className="alert alert-error">Administrator access is required for this page.</div>
      </div>
    );
  }
  return <Outlet />;
}

export default ProtectedRoute;
