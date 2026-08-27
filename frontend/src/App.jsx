import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AdminRoute, ProtectedRoute } from './components/ProtectedRoute.jsx';
import Admin from './pages/Admin.jsx';
import ClaimDetail from './pages/ClaimDetail.jsx';
import ClaimForm from './pages/ClaimForm.jsx';
import Claims from './pages/Claims.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ItemDetail from './pages/ItemDetail.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import MatchDetail from './pages/MatchDetail.jsx';
import Matches from './pages/Matches.jsx';
import Messages from './pages/Messages.jsx';
import MyReports from './pages/MyReports.jsx';
import NotFound from './pages/NotFound.jsx';
import Register from './pages/Register.jsx';
import ReportItem from './pages/ReportItem.jsx';
import Search from './pages/Search.jsx';

/** Every screen from spec section 12. */
export default function App() {
  return (
    <Routes>
      {/* The marketing landing page owns its own navigation, footer and
          palette, so it sits outside the application shell. */}
      <Route path="/" element={<Landing />} />

      <Route element={<Layout />}>
        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/search" element={<Search />} />
        <Route path="/items/:id" element={<ItemDetail />} />

        {/* signed in */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report/:type" element={<ReportItem />} />
          <Route path="/items/:id/edit" element={<ReportItem editing />} />
          <Route path="/items/:id/claim" element={<ClaimForm />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/claims/:id" element={<ClaimDetail />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:itemId/:userId" element={<Messages />} />
          <Route path="/my-reports" element={<MyReports />} />
        </Route>

        {/* admin */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
