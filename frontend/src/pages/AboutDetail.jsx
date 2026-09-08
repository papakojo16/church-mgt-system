import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getPublicData } from '../api/publicData.js';
import { useReveal } from '../ui/hooks.jsx';
import { SocialLinks, Confirm, fmtEventWhen } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// Horizontal scrolling news ticker
function NewsTicker({ news }) {
  const items = [...news, ...news];
  return (
    <div className="news-ticker" aria-live="polite" aria-label="Church news">
      <div className="news-ticker-track">
        {items.map((item, index) => (
          <div key={index} className="news-item">
            <Icon name="megaphone" size={14} />
            <span className="news-title">{item.title}</span>
            {item.content && <span className="news-content">{item.content}</span>}
            <Icon name="circle" size={8} className="news-divider" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Convert a title into a URL-safe slug (lowercase, hyphens, no leading/trailing dash). Also imported by AboutChurch.jsx.
export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Trigger a browser download of a gallery image, naming the file from the caption.
function downloadImage(pic) {
  const name = (pic.caption || 'image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'image';
  const a = document.createElement('a');
  a.href = pic.image;
  a.download = `${name}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Detail page for one About/Organisation/Activity entry, matched by its slug; shows events and a picture gallery.
export default function AboutDetail({ kind }) {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const revealRef = useReveal();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewPic, setViewPic] = useState(null);
  const [confirmDownload, setConfirmDownload] = useState(null);

  // Fetch public content once; `alive` prevents state updates after the component unmounts.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPublicData()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Resolve the requested slug against the right collection depending on the page kind.
  const isActivity = kind === 'activity';
  const isBasic = kind === 'basic';
  const list = (isActivity ? data?.activities : isBasic ? data?.basics : data?.organisations) || [];
  const item = list.find((x) => slugify(x.title) === slug) || null;
  const name = data?.church_name || 'Mt. Olivet Methodist Church';
  const label = isActivity ? 'Activities' : isBasic ? 'About Us' : 'Organisations';
  const backTo = '/about-church';
  const typeName = isActivity ? 'activity' : isBasic ? 'section' : 'organisation';

  // Return to the About page and open the tab this item belongs to.
  function goBack() {
    navigate(backTo, { state: { tab: isActivity ? 'activities' : isBasic ? 'about' : 'organisations' } });
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
          <button onClick={goBack}>{label}</button>
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

      <header className="ab-hero">
        <h1>{loading ? label : item ? item.title : 'Not Found'}</h1>
        <p>{loading ? 'Loading...' : item ? (item.subtitle || '') : `This ${isActivity ? 'activity' : isBasic ? 'section' : 'organisation'} could not be found.`}</p>
      </header>

      {data?.news?.length > 0 && <NewsTicker news={data.news} />}

      <main className="ab-detail-page">
        {loading ? (
          <div className="ab-detail-card">
            <div className="spinner" />
            <p className="muted center mt-8">Loading {label.toLowerCase()}...</p>
          </div>
        ) : (
          <article className="ab-detail-card reveal">
            <button className="ab-back" onClick={goBack}>
              <Icon name="arrow-left" size={16} /> All {label}
            </button>
            {item && item.subtitle && <div className="ab-sub">{item.subtitle}</div>}
            <h1>{item ? item.title : 'Not Found'}</h1>
            <p className="ab-detail-desc">{item ? (item.content || item.description) : `The ${typeName} you are looking for does not exist or has been removed.`}</p>
            {item?.events?.length > 0 && (
              <section className="ab-detail-section">
                <h3>Events</h3>
                <div className="ab-event-list">
                  {item.events.map((e) => (
                    <div className="ab-event" key={e.id}>
                      <div className="ab-event-date">{fmtEventWhen(e)}</div>
                      <div className="ab-event-body">
                        <h4>{e.title}</h4>
                        {e.location && <p className="muted"><Icon name="map-pin" size={13} /> {e.location}</p>}
                        {e.description && <p className="muted" style={{ fontSize: 13 }}>{e.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {item?.pictures?.length > 0 && (
              <section className="ab-detail-section">
                <h3>Pictures</h3>
                <div className="gallery">
                  {item.pictures.map((p) => (
                    <div className="gallery-item" key={p.id}>
                      <img src={p.image} alt={p.caption || item.title} onClick={() => setViewPic(p)} />
                      {p.caption && <div className="caption">{p.caption}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {item?.images?.length > 0 && (
              <section className="ab-detail-section">
                <h3>Pictures</h3>
                <div className="gallery">
                  {item.images.map((img, i) => {
                    // Legacy data may store images as plain URL strings; normalise them to objects.
                    const pic = typeof img === 'string' ? { id: i, image: img, caption: '' } : img;
                    return (
                      <div className="gallery-item" key={pic.id}>
                        <img src={pic.image} alt={pic.caption || item.title} onClick={() => setViewPic(pic)} />
                        {pic.caption && <div className="caption">{pic.caption}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </article>
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
        <button className="hero-btn ghost" onClick={() => navigate('/')} style={{ marginLeft: 8 }}>
          Back to Home
        </button>
      </section>

      <footer className="lp-footer">
        {'\u00A9'} {new Date().getFullYear()} {name}
      </footer>

      {viewPic && (
        <div className="lightbox" onClick={() => setViewPic(null)}>
          <button className="lightbox-close" title="Close">
            <Icon name="x" size={22} />
          </button>
          <button className="lightbox-download" title="Download image" onClick={(e) => { e.stopPropagation(); setConfirmDownload(viewPic); }}>
            <Icon name="download" size={20} />
          </button>
          <figure className="lightbox-body" onClick={(e) => e.stopPropagation()}>
            <img src={viewPic.image} alt={viewPic.caption || item?.title || ''} />
            {viewPic.caption && <figcaption>{viewPic.caption}</figcaption>}
          </figure>
        </div>
      )}

      {confirmDownload && (
        <Confirm
          title="Download image?"
          message={`Are you sure you want to download "${confirmDownload.caption || item?.title || 'this image'}"?`}
          yesLabel="Download"
          onYes={() => {
            downloadImage(confirmDownload);
            setConfirmDownload(null);
          }}
          onNo={() => setConfirmDownload(null)}
        />
      )}
    </div>
  );
}
