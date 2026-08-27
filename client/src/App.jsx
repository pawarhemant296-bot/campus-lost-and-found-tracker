import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import AppLayout from './components/AppLayout.jsx';
import { useAuth } from './lib/auth.jsx';
import { Button, Empty } from './components/ui.jsx';

import Landing from './pages/Landing.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Contact from './pages/Contact.jsx';
import Browse from './pages/Browse.jsx';
import ItemDetails from './pages/ItemDetails.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

import Dashboard from './pages/Dashboard.jsx';
import ReportItem from './pages/ReportItem.jsx';
import MyReports from './pages/MyReports.jsx';
import Matches from './pages/Matches.jsx';
import Claims from './pages/Claims.jsx';
import ClaimFlow from './pages/ClaimFlow.jsx';
import Messages from './pages/Messages.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import Profile from './pages/Profile.jsx';

import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminItems from './pages/admin/AdminItems.jsx';
import AdminClaims from './pages/admin/AdminClaims.jsx';
import AdminDisputes from './pages/admin/AdminDisputes.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

function Booting() {
  return (
    <div className="center" style={{ minHeight: '100vh' }}>
      <div className="col gap-4 center">
        <div className="radar" style={{ width: 190 }}>
          <div className="radar-sweep" />
          <div className="radar-core" style={{ width: 62, height: 62 }} />
        </div>
        <span className="eyebrow">Tracing back…</span>
      </div>
    </div>
  );
}

function RequireAuth({ children, admin = false }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) return <Booting />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/app" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="container section">
      <Empty
        icon="radar"
        title="Signal lost — page not found"
        message="The page you were looking for has drifted out of range."
        action={<Button to="/" iconRight="arrowRight">Back to home</Button>}
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* -------------------------------------------------------- public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/items/:id" element={<ItemDetails />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ---------------------------------------------------------- auth */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ----------------------------------------------------- app (user) */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout variant="user" />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="report/:type" element={<ReportItem />} />
        <Route path="reports" element={<MyReports />} />
        <Route path="matches" element={<Matches />} />
        <Route path="claims" element={<Claims />} />
        <Route path="claims/:id" element={<ClaimFlow />} />
        <Route path="messages" element={<Messages />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* --------------------------------------------------------- admin */}
      <Route
        path="/admin"
        element={
          <RequireAuth admin>
            <AppLayout variant="admin" />
          </RequireAuth>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="items" element={<AdminItems />} />
        <Route path="claims" element={<AdminClaims />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
