import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getPublicData } from '../api/publicData.js';
import { useReveal } from '../ui/hooks.jsx';
import { SocialLinks, Loading, Confirm } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

export default function Gallery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const revealRef = useReveal();
  const [data, setData] = useState(null);
  const [viewPic, setViewPic] = useState(null);
  const [confirmDownload, setConfirmDownload] = useState(null);

  useEffect(() => {
    getPublicData()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const name = data?.church_name || 'Mt. Olivet Methodist Church';
  const gallery = data?.gallery || [];

  return (
    <div ref={revealRef} className="gallery-page">
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
          <button onClick={() => navigate('/about-church')}>About Church</button>
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
      </nav>

      <header className="gallery-hero">
        <h1>Gallery</h1>
        <p>Moments of worship, fellowship, and service</p>
      </header>

      <main className="gallery-main">
        {!data ? (
          <Loading label="Loading gallery..." />
        ) : gallery.length === 0 ? (
          <div className="gallery-empty reveal">
            <Icon name="image-off" size={48} />
            <h2>No Pictures Yet</h2>
            <p className="muted">The gallery is empty. Check back later!</p>
          </div>
        ) : (
          <div className="gallery-grid" role="list">
            {gallery.map((pic, index) => (
              <figure
                key={pic.id || index}
                className="gallery-item reveal"
                style={{ transitionDelay: `${index * 50}ms` }}
                role="listitem"
              >
                <img
                  src={pic.image}
                  alt={pic.caption || `Gallery image ${index + 1}`}
                  loading="lazy"
                  onClick={() => setViewPic(pic)}
                />
                {pic.caption && (
                  <figcaption className="gallery-caption">{pic.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </main>

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
        <button className="hero-btn ghost" onClick={() => navigate('/about-church')} style={{ marginLeft: 8 }}>
          Back to About Church
        </button>
      </section>

      <footer className="lp-footer">
        {'\u00A9'} {new Date().getFullYear()} {name}
      </footer>

      {viewPic && (
        <div className="lightbox" onClick={() => setViewPic(null)} role="dialog" aria-modal="true" aria-label="Image preview">
          <button className="lightbox-close" title="Close" onClick={() => setViewPic(null)}>
            <Icon name="x" size={22} />
          </button>
          <button className="lightbox-download" title="Download image" onClick={(e) => { e.stopPropagation(); setConfirmDownload(viewPic); }}>
            <Icon name="download" size={20} />
          </button>
          <figure className="lightbox-body" onClick={(e) => e.stopPropagation()}>
            <img src={viewPic.image} alt={viewPic.caption || ''} />
            {viewPic.caption && <figcaption>{viewPic.caption}</figcaption>}
          </figure>
        </div>
      )}

      {confirmDownload && (
        <Confirm
          title="Download image?"
          message={`Are you sure you want to download "${confirmDownload.caption || 'this image'}"?`}
          yesLabel="Download"
          onYes={() => {
            const name = (confirmDownload.caption || 'image')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') || 'image';
            const a = document.createElement('a');
            a.href = confirmDownload.image;
            a.download = `${name}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setConfirmDownload(null);
          }}
          onNo={() => setConfirmDownload(null)}
        />
      )}
    </div>
  );
}