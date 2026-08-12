import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getPublicData } from '../api/publicData.js';
import { fmtDate, fmtEventWhen, SocialLinks, Loading } from '../ui/Shared.jsx';
import { useReveal } from '../ui/hooks.jsx';
import { Icon } from '../ui/icons.jsx';
import { slugify } from './AboutDetail.jsx';

// The tabbed sections shown to the public on the "About the Church" page.
const TABS = [
  ['about', 'About Us'],
  ['organisations', 'Organisations'],
  ['activities', 'Activities'],
  ['events', 'Events'],
  ['announcements', 'Announcements'],
];

// Public "About the Church" page: pulls all church content from the public API and renders it by tab.
export default function AboutChurch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const revealRef = useReveal();
  const [data, setData] = useState(null);
  // Initial tab can be set by navigation state (e.g. when returning from a detail page).
  const [tab, setTab] = useState(() => location.state?.tab || 'about');

  // Public content is already fetched and cached in memory by the landing page
  // (getPublicData), so reusing it here makes the About tab render instantly
  // instead of re-downloading the full payload (incl. base64 images) every visit.
  useEffect(() => {
    getPublicData()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const name = data?.church_name || 'Mt. Olivet Methodist Church';
  const tagline = data?.tagline || 'Worship, Fellowship and Service';

  return (
    <div ref={revealRef}>
      <div className="lp-nav">
        <button className="lp-brand" onClick={() => navigate('/')}>
          {data?.logo ? (
            <img className="lp-logo-img" src={data.logo} alt="Logo" />
          ) : (
            <span className="logo-dot">
              <Icon name="cross" size={16} strokeWidth={3} />
            </span>
          )}
          <span>Mt. Olivet</span>
        </button>
        <div className="lp-nav-links">
          <button onClick={() => navigate('/')}>Home</button>
          {user ? (
            <button className="btn solid" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
          ) : (
            <button className="btn solid" onClick={() => navigate('/login')}>
              Log in
            </button>
          )}
        </div>
      </div>

      <header className="ab-hero">
        <h1>{name}</h1>
        <p>{tagline}</p>
        <p className="hero-slogan">Mt.Olivet!!!... Mpaebo Bea, Place of Prayer</p>
      </header>

      <div className="ab-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="ab-panel" key={tab}>
        {!data ? (
          <Loading label="Loading church content…" />
        ) : (
          <>
            {tab === 'about' && <AboutPanel data={data} onOpen={(b) => navigate(`/about-church/basic/${slugify(b.title)}`)} />}
            {tab === 'organisations' && <OrganisationsPanel data={data} onOpen={(o) => navigate(`/about-church/organisation/${slugify(o.title)}`)} />}
            {tab === 'activities' && <ActivitiesPanel data={data} onOpen={(a) => navigate(`/about-church/activity/${slugify(a.title)}`)} />}
            {tab === 'events' && <EventsPanel data={data} />}
            {tab === 'announcements' && <AnnouncementsPanel data={data} />}
          </>
        )}
      </div>

      <section className="lp-cta-band">
        <h2>Come Worship With Us</h2>
        <p>There is a warm welcome waiting for you at {name}.</p>
        <SocialLinks social={data?.social} />
        {user ? (
          <button className="hero-btn primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        ) : (
          <button className="hero-btn primary" onClick={() => navigate('/register')}>
            Create an Account
          </button>
        )}
        <button className="hero-btn ghost" onClick={() => navigate('/')} style={{ marginLeft: 8 }}>
          Back to Home
        </button>
      </section>

      <footer className="lp-footer">
        {'\u00A9'} {new Date().getFullYear()} {name}
      </footer>
    </div>
  );
}

// Grid of "basic info" cards; clicking one navigates to its slug-based detail page.
function AboutPanel({ data, onOpen }) {
  const basics = data?.basics || [];
  return (
    <div className="grid two">
      {basics.map((b, i) => (
        <button
          key={i}
          className="ab-item reveal ab-clickable"
          onClick={() => onOpen(b)}
          style={{ transitionDelay: `${i * 70}ms` }}
        >
          <div className="ab-sub">{b.title}</div>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {b.content}
          </p>
          <span className="ab-view">
            View details <Icon name="chevron-down" size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}

// Card grid of the church's organisations; each links to its detail page.
function OrganisationsPanel({ data, onOpen }) {
  const orgs = data?.organisations || [];
  return (
    <div className="feat-grid">
      {orgs.map((o, i) => (
        <button
          key={i}
          className="ab-item reveal ab-clickable"
          onClick={() => onOpen(o)}
          style={{ transitionDelay: `${i * 60}ms` }}
        >
          <div className="ab-sub">{o.subtitle}</div>
          <h3>{o.title}</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            {o.description}
          </p>
          <span className="ab-view">
            View details <Icon name="chevron-down" size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}

// Card grid of weekly activities; each links to its detail page.
function ActivitiesPanel({ data, onOpen }) {
  const acts = data?.activities || [];
  return (
    <div className="feat-grid">
      {acts.map((a, i) => (
        <button
          key={i}
          className="ab-item reveal ab-clickable"
          onClick={() => onOpen(a)}
          style={{ transitionDelay: `${i * 60}ms` }}
        >
          <div className="ab-sub">{a.subtitle}</div>
          <h3>{a.title}</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            {a.description}
          </p>
          <span className="ab-view">
            View details <Icon name="chevron-down" size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}

// Public read-only list of upcoming events with their fliers.
function EventsPanel({ data }) {
  const events = data?.upcoming_events || [];
  if (!events.length) return <p className="muted center">No upcoming events at the moment.</p>;
  return (
    <div className="grid two">
      {events.map((e) => (
        <div className="ab-item" key={e.id}>
          {e.image && <img className="ab-flier" src={e.image} alt={`${e.title} flier`} />}
          <div className="ab-sub">{fmtEventWhen(e)}</div>
          <h3>{e.title}</h3>
          {e.location && (
            <p className="muted" style={{ fontSize: 13 }}>
              {'\u2022'} {e.location}
            </p>
          )}
          {e.description && (
            <p className="muted mt-8" style={{ fontSize: 13 }}>
              {e.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// Public read-only list of active announcements with their priority tags.
function AnnouncementsPanel({ data }) {
  const anns = data?.announcements || [];
  if (!anns.length) return <p className="muted center">No announcements right now.</p>;
  return (
    <div>
      {anns.map((a) => (
        <div className="ab-item mb-16" key={a.id}>
          <div className="row between wrap">
            <h3>{a.title}</h3>
            <span className={`tag ${a.priority}`}>{a.priority}</span>
          </div>
          <p className="muted mt-8" style={{ fontSize: 14 }}>
            {a.content}
          </p>
          {a.date_expires && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Expires {fmtDate(a.date_expires)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
