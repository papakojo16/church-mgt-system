import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getPublicData } from '../api/publicData.js';
import { CountUp, useReveal } from '../ui/hooks.jsx';
import { Icon } from '../ui/icons.jsx';
import { SocialLinks } from '../ui/Shared.jsx';

// Static list of system features advertised on the landing page, each linking to a route.
const FEATURES = [
  {
    icon: 'users',
    title: 'Member Directory',
    desc: 'Manage profiles, contact details and membership records for the whole congregation.',
    to: '/members',
  },
  {
    icon: 'dollar-sign',
    title: 'Finances',
    desc: 'Record donations and expenses, track tithes, offerings and the monthly balance.',
    to: '/finances',
  },
  {
    icon: 'file-text',
    title: 'Receipts',
    desc: 'Generate printable and PDF payment receipts for every contribution instantly.',
    to: '/receipts',
  },
  {
    icon: 'bell',
    title: 'Announcements',
    desc: 'Post church notices with priorities and expiry dates so everyone stays informed.',
    to: '/announcements',
  },
  {
    icon: 'calendar',
    title: 'Events & Attendance',
    desc: 'Schedule services and events, and record who attended each gathering.',
    to: '/events',
  },
  {
    icon: 'layers',
    title: 'Organizations',
    desc: 'Organise fellowships and ministries with leaders, roles and member lists.',
    to: '/ministries',
  },
];

// Public landing page: hero, community stats, feature cards, and CTAs that adapt to login state.
export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const revealRef = useReveal();
  const [data, setData] = useState(null);

  // Load cached public content (church name, tagline, social links, counts) on mount.
  useEffect(() => {
    getPublicData()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const name = data?.church_name || 'Mt. Olivet Methodist Church';
  const tagline = data?.tagline || 'Worship, Fellowship and Service';

  const stats = [
    { label: 'Organisations', value: data?.organisations?.length || 0 },
    { label: 'Weekly Activities', value: data?.activities?.length || 0 },
    { label: 'Upcoming Events', value: data?.upcoming_events?.length || 0 },
    { label: 'Announcements', value: data?.announcements?.length || 0 },
  ];

  // Feature links go straight to the app for logged-in users; everyone else is sent to log in first.
  function go(to) {
    if (user) navigate(to);
    else navigate('/login');
  }

  function scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div ref={revealRef}>
      <nav className="lp-nav">
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
          <a href="#features">Features</a>
          <a href="#community">Our Community</a>
          <button className="lp-nav-about" onClick={() => navigate('/about-church')}>About the Church</button>
          {user ? (
            <button className="btn solid" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')}>Log in</button>
              <button className="btn solid" onClick={() => navigate('/register')}>
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      <header className="lp-hero">
        <div className="hero-shape" style={{ width: 220, height: 220, top: -60, left: -60, animationDelay: '0s' }} />
        <div className="hero-shape" style={{ width: 140, height: 140, top: 30, right: 30, animationDelay: '1.5s' }} />
        <div className="hero-shape" style={{ width: 90, height: 90, bottom: 40, left: 60, animationDelay: '3s' }} />
        <div className="hero-inner">
          <h1>{name}</h1>
          <p className="tagline">{tagline}</p>
          <p className="hero-slogan">Mt.Olivet!!!... Mpaebo Bea, Place of Prayer</p>
          <div className="hero-cta">
            {user ? (
              <button className="hero-btn primary" onClick={() => navigate('/dashboard')}>
                Open Dashboard
              </button>
            ) : (
              <>
                <button className="hero-btn primary" onClick={() => navigate('/login')}>
                  Member Login
                </button>
                <button className="hero-btn ghost" onClick={() => navigate('/register')}>
                  Create Account
                </button>
              </>
            )}
            <button className="hero-btn ghost" onClick={() => navigate('/about-church')}>
              About the Church
            </button>
          </div>
        </div>
        <div className="scroll-hint" onClick={scrollToFeatures}>
          <Icon name="chevron-down" size={24} />
        </div>
      </header>

      <section className="lp-section" id="community">
        <h2>Our Community</h2>
        <p className="sub">Active groups, gatherings and news in one place</p>
        <div className="stats-row">
          {stats.map((s, i) => (
            <div className="stat-tile reveal" key={s.label} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="num">
                <CountUp value={s.value} />
              </div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="features">
        <h2>Everything Your Church Needs</h2>
        <p className="sub">A complete management system that works online and offline</p>
        <div className="feat-grid">
          {FEATURES.map((f, i) => (
            <button className="feat-card reveal" key={f.title} onClick={() => go(f.to)} style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="feat-icon">
                <Icon name={f.icon} size={22} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="go">
                {user ? 'Open' : 'Sign in to use'} {'\u2192'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>Join Us This Sunday</h2>
        <p>Worship, fellowship and a community that cares. There is a place for you here.</p>
        <SocialLinks social={data?.social} />
        {user ? (
          <button className="hero-btn primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        ) : (
          <>
            <button className="hero-btn primary" onClick={() => navigate('/register')}>
              Create an Account
            </button>
            <button className="hero-btn ghost" onClick={() => navigate('/login')} style={{ marginLeft: 8 }}>
              Log In
            </button>
          </>
        )}
      </section>

      <footer className="lp-footer">
        {'\u00A9'} {new Date().getFullYear()} {name}
      </footer>
    </div>
  );
}
