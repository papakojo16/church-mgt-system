import React, { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { Icon } from './ui/icons.jsx';
import { Confirm } from './ui/Shared.jsx';
import { api } from './api/client.js';
import { getPublicData } from './api/publicData.js';
import Landing from './pages/Landing.jsx';
import AboutChurch from './pages/AboutChurch.jsx';
import AboutDetail from './pages/AboutDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Privacy from './pages/Privacy.jsx';
import ForcePasswordChange from './pages/ForcePasswordChange.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import Finances from './pages/Finances.jsx';
import Announcements from './pages/Announcements.jsx';
import Events from './pages/Events.jsx';
import Ministries from './pages/Ministries.jsx';
import Receipts from './pages/Receipts.jsx';
import Reports from './pages/Reports.jsx';
import Statistics from './pages/Statistics.jsx';
import ActivityLogs from './pages/ActivityLogs.jsx';
import Calculator from './pages/Calculator.jsx';
import Profile from './pages/Profile.jsx';
import ChurchProfile from './pages/ChurchProfile.jsx';
import About from './pages/About.jsx';
import Splash from './ui/Splash.jsx';

// Role buckets used to gate navigation items and routes.
const ALL = ['admin', 'pastor', 'finance', 'member'];
const STAFF = ['admin', 'pastor', 'finance'];

// Central navigation config: route path, label, icon and the roles allowed to see each entry.
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home', roles: ALL },
  { to: '/members', label: 'Members', icon: 'users', roles: STAFF },
  { to: '/finances', label: 'Finances', icon: 'dollar-sign', roles: STAFF },
  { to: '/announcements', label: 'Announcements', icon: 'bell', roles: ALL },
  { to: '/events', label: 'Events', icon: 'calendar', roles: ALL },
  { to: '/ministries', label: 'Organizations', icon: 'layers', roles: ALL },
  { to: '/receipts', label: 'Receipts', icon: 'file-text', roles: ALL },
  { to: '/reports', label: 'Reports', icon: 'clipboard', roles: STAFF },
  { to: '/statistics', label: 'Statistics', icon: 'bar-chart-2', roles: ALL },
  { to: '/activity-logs', label: 'Activity Logs', icon: 'activity', roles: ['admin'] },
  { to: '/calculator', label: 'Calculator', icon: 'hash', roles: ['admin', 'finance'] },
  { to: '/about-church', label: 'About Church', icon: 'book-open', roles: ALL },
  { to: '/church', label: 'Church Profile', icon: 'tool', roles: ['admin'] },
  { to: '/profile', label: 'My Profile', icon: 'user', roles: ALL },
  { to: '/about', label: 'About', icon: 'help-circle', roles: ['admin'] },
];

// True when the logged-in user exists and holds one of the allowed roles.
function hasRole(user, roles) {
  return !!user && roles.includes(user.role);
}

// Guards any page that merely requires a logged-in user; redirects to login when unauthenticated.
// A forced password change takes precedence so the user completes it before using the app.
function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/force-password" replace />;
  return children;
}

// Role-based route guard: blocks the page and redirects to the dashboard when the role is missing.
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/force-password" replace />;
  if (!hasRole(user, roles)) return <Navigate to="/dashboard" replace />;
  return children;
}

// Top app bar: online/offline status, pending-change chip, sync + dark-mode buttons, user info.
function AppBar({ title }) {
  const { user, online, pending, syncing, darkMode, setDarkMode, doSync, logout, themeName, setThemeName } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Confirm dialog handled logout, then returns to the public landing page.
  function handleLogout() {
    setConfirmLogout(false);
    logout();
    navigate('/');
  }
  return (
    <header className="appbar">
      <div className="appbar-left">
        <span className="appbar-title">{title}</span>
        {!online ? (
          <span className="chip offline" title="You are currently offline">
            <Icon name="wifi-off" size={14} /> Offline
          </span>
        ) : (
          <span className="chip online" title="You are connected">
            <Icon name="wifi" size={14} /> Online
          </span>
        )}
        {online && pending > 0 && (
          <span className="chip" title="Pending offline changes">
            {syncing ? 'Syncing\u2026' : `${pending} pending`}
          </span>
        )}
      </div>
      <div className="appbar-right">
        {/* Sync button — always visible so users can push queued offline changes at any time.
            Shows the pending count when there are queued writes and a "Syncing…" state while pushing. */}
        <button
          className={`chip refresh ${syncing || pending === 0 ? 'ready' : ''}`}
          onClick={doSync}
          disabled={syncing}
          title={pending > 0 ? 'Sync pending changes' : 'Check for pending changes'}
        >
          <Icon name="refresh-cw" size={14} /> {syncing ? 'Syncing\u2026' : pending > 0 ? `Sync (${pending})` : 'Sync'}
        </button>
        <button className="icon-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Light mode' : 'Dark mode'}>
          <Icon name={darkMode ? 'sun' : 'moon'} size={18} />
        </button>
        {user && (
          <>
            <span className="chip role">{user.role_display || user.role}</span>
            <span className="chip username">{user.username}</span>
          </>
        )}
        <button className="icon-btn" onClick={() => setConfirmLogout(true)} title="Log out">
          <Icon name="log-out" size={18} />
        </button>
      </div>
      {confirmLogout && (
        <Confirm
          title="Log Out"
          message="Are you sure you want to log out?"
          yesLabel="Logout"
          onYes={handleLogout}
          onNo={() => setConfirmLogout(false)}
        />
      )}
    </header>
  );
}

// Authenticated app frame: sidebar + bottom nav + content area, all filtered by the user's role.
// The "More" sheet shows every feature the user may access on small screens.
function Shell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const titles = {
    dashboard: 'Dashboard',
    members: 'Members',
    finances: 'Finances',
    announcements: 'Announcements',
    events: 'Events',
    ministries: 'Organizations',
    receipts: 'Receipts',
    reports: 'Reports',
    statistics: 'Statistics',
    'activity-logs': 'Activity Logs',
    calculator: 'Calculator',
    church: 'Church Profile',
    profile: 'My Profile',
    about: 'About',
  };
  // Derive the page title from the current URL segment; fall back to the church name.
  const seg = location.pathname.split('/')[1] || 'dashboard';
  const title = titles[seg] || 'Mt. Olivet Methodist';
  // Only render nav entries the current user is allowed to see.
  const visible = NAV.filter((n) => hasRole(user, n.roles));
  // Bottom nav shows the first four items and a "More" button for the rest.
  const mobileItems = visible.slice(0, 4);
  const showMore = visible.length > mobileItems.length;

  function goTo(to) {
    setMenuOpen(false);
    navigate(to);
  }

  return (
    <div className="shell">
      <AppBar title={title} />
      <div className="body-row">
        <nav className="navrail">
          {visible.map((n) => (
            <button key={n.to} className={`nav-item ${location.pathname === n.to ? 'active' : ''}`} onClick={() => navigate(n.to)}>
              <span className="nav-icon">
                <Icon name={n.icon} size={18} />
              </span>
              {n.label}
            </button>
          ))}
        </nav>
        <main className="content">{children}</main>
      </div>
      <nav className="bottom-nav">
        {mobileItems.map((n) => (
          <button key={n.to} className={location.pathname === n.to ? 'active' : ''} onClick={() => navigate(n.to)}>
            <span className="nav-icon">
              <Icon name={n.icon} size={18} />
            </span>
            {n.label}
          </button>
        ))}
        {showMore && (
          <button className={menuOpen ? 'active' : ''} onClick={() => setMenuOpen(true)}>
            <span className="nav-icon">
              <Icon name="more-horizontal" size={18} />
            </span>
            More
          </button>
        )}
      </nav>

      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <b>All Features</b>
              <button className="icon-btn" onClick={() => setMenuOpen(false)} title="Close">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="menu-grid">
              {visible.map((n) => (
                <button key={n.to} className={`menu-item ${location.pathname === n.to ? 'active' : ''}`} onClick={() => goTo(n.to)}>
                  <span className="menu-icon">
                    <Icon name={n.icon} size={18} />
                  </span>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Module-level flag so the splash plays once per page load, not on every route change.
let splashShownOnce = false;

// Renders the landing page with a one-time splash overlay while public church data loads.
function LandingWithSplash() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [publicData, setPublicData] = useState(null);
  const [played, setPlayed] = useState(splashShownOnce);
  const dataRef = React.useRef(null);

  React.useEffect(() => {
    splashShownOnce = true;
    if (played) return;
    let alive = true;

    // Fetch church info for the splash logo/name; retry every second until it arrives.
    const tryLoad = (first) => {
      if (!alive || dataRef.current) return;
      getPublicData({ force: !first })
        .then((d) => {
          if (alive && !dataRef.current) {
            dataRef.current = d;
            setPublicData(d);
          }
        })
        .catch(() => null);
    };
    tryLoad(true);
    const retry = setInterval(() => tryLoad(false), 1000);

    // Splash stays visible ~5s, then fades out (leaving) and is removed at ~5.6s.
    const t = setTimeout(() => {
      if (alive) setLeaving(true);
    }, 5000);
    const t2 = setTimeout(() => {
      if (alive) {
        splashShownOnce = true;
        setPlayed(true);
        setGone(true);
      }
    }, 5600);
    return () => {
      alive = false;
      clearInterval(retry);
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [played]);

  if (played) return <Landing />;
  return (
    <React.Fragment>
      <Landing />
      {!gone && <Splash logo={publicData?.logo} name={publicData?.church_name} leaving={leaving} />}
    </React.Fragment>
  );
}

// Root router: public routes, plus protected and role-gated routes wrapped in the Shell layout.
export default function App() {
  React.useEffect(() => {
    splashShownOnce = true;
  }, []);
  return (
    <Routes>
      <Route path="/" element={<LandingWithSplash />} />
      <Route path="/about-church" element={<AboutChurch />} />
      <Route path="/about-church/organisation/:slug" element={<AboutDetail kind="organisation" />} />
      <Route path="/about-church/activity/:slug" element={<AboutDetail kind="activity" />} />
      <Route path="/about-church/basic/:slug" element={<AboutDetail kind="basic" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/force-password" element={<ForcePasswordChange />} />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <Shell>
              <Dashboard />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/members"
        element={
          <RequireRole roles={STAFF}>
            <Shell>
              <Members />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/finances"
        element={
          <RequireRole roles={STAFF}>
            <Shell>
              <Finances />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/announcements"
        element={
          <Protected>
            <Shell>
              <Announcements />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/events"
        element={
          <Protected>
            <Shell>
              <Events />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/ministries"
        element={
          <Protected>
            <Shell>
              <Ministries />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/receipts"
        element={
          <Protected>
            <Shell>
              <Receipts />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireRole roles={STAFF}>
            <Shell>
              <Reports />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/statistics"
        element={
          <Protected>
            <Shell>
              <Statistics />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <ActivityLogs />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/calculator"
        element={
          <RequireRole roles={['admin', 'finance']}>
            <Shell>
              <Calculator />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/church"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <ChurchProfile />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <Shell>
              <Profile />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/about"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <About />
            </Shell>
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
