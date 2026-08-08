import React, { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './icons.jsx';

/* ---------- Snackbar ---------- */
const SnackbarContext = createContext(null);

// Renders transient toast notifications; each snackbar auto-dismisses after its timeout.
export function SnackbarProvider({ children }) {
  const [items, setItems] = useState([]);

  // Push a toast; a unique id lets it be removed independently when it expires.
  const push = useCallback((message, type = 'info', timeout = 3500) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), timeout);
  }, []);

  return (
    <SnackbarContext.Provider value={push}>
      {children}
      <div className="snackbar-wrap">
        {items.map((i) => (
          <div key={i.id} className={`snackbar ${i.type}`}>
            {i.message}
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}

/* ---------- Modal ---------- */
// Overlay dialog: clicking the backdrop closes it, clicks inside the panel are ignored.
export function Modal({ title, open, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={wide ? 'modal wide' : 'modal'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
// Standard yes/no modal built on Modal; defaults the action button to a danger "Delete".
export function Confirm({ title, message, onYes, onNo, yesLabel = 'Delete' }) {
  return (
    <Modal title={title} open={true} onClose={onNo}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="btn secondary" onClick={onNo}>
          Cancel
        </button>
        <button className="btn danger" onClick={onYes}>
          {yesLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Spinner ---------- */
export function Spinner() {
  return <div className="spinner" />;
}

// Centered spinner with an optional caption for async page states.
export function Loading({ label = 'Loading...' }) {
  return (
    <div className="empty">
      <Spinner />
      <p className="muted mt-8">{label}</p>
    </div>
  );
}

export function Empty({ label = 'No data to show.' }) {
  return <div className="empty">{label}</div>;
}

/* ---------- Page banner ---------- */
// Page header row with title/subtitle and optional action buttons.
export function PageBanner({ title, subtitle, actions }) {
  return (
    <div className="row between wrap mb-16">
      <div>
        <h1 style={{ fontSize: 22 }}>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/* ---------- Section card ---------- */
// Content card with an optional header row (title + action buttons).
export function Card({ title, children, actions }) {
  return (
    <div className="card">
      {title && (
        <div className="row between mb-16" style={{ marginBottom: title ? 12 : 0 }}>
          <h3>{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- Social media links ---------- */
// Renders clickable social/contact links from whatever fields the church provided.
export function SocialLinks({ social }) {
  const s = social || {};
  // Phone/WhatsApp numbers are stripped to digits (keeping a leading +) for tel:/wa.me links.
  const clean = (v) => String(v || '').replace(/[^\d+]/g, '');
  const links = [
    s.phone && { icon: 'phone', label: 'Call us', href: `tel:${clean(s.phone)}` },
    s.whatsapp && { icon: 'whatsapp', label: 'Chat on WhatsApp', href: `https://wa.me/${clean(s.whatsapp).replace(/^\+/, '')}` },
    s.email && { icon: 'mail', label: 'Email us', href: `mailto:${s.email}` },
    s.facebook && { icon: 'facebook', label: 'Follow on Facebook', href: /^https?:\/\//.test(s.facebook) ? s.facebook : `https://${s.facebook}` },
    s.tiktok && { icon: 'tiktok', label: 'Follow on TikTok', href: /^https?:\/\//.test(s.tiktok) ? s.tiktok : `https://${s.tiktok}` },
  ].filter(Boolean);

  if (!links.length) return null;
  return (
    <div className="social-row">
      {links.map((l) => (
        <a key={l.icon} className="social-link" href={l.href} target="_blank" rel="noreferrer" title={l.label} aria-label={l.label}>
          <Icon name={l.icon} size={20} />
        </a>
      ))}
    </div>
  );
}

/* ---------- Formatting helpers ---------- */
// Money as locale string with exactly 2 decimals.
export function fmtMoney(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Date string shortened to its YYYY-MM-DD portion.
export function fmtDate(s) {
  if (!s) return '';
  return String(s).slice(0, 10);
}

/* ---------- Password field with show/hide toggle ---------- */
// Inline SVG for the password visibility toggle (off = crossed-out eye).
function EyeIcon({ off }) {
  return off ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Text input that masks its value, with a toggle button to reveal it as plain text.
export function PasswordField({ label, value, onChange, required, autoFocus, placeholder, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="pwd-wrap">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="pwd-toggle"
          onClick={() => setShow((s) => !s)}
          title={show ? 'Hide password' : 'Show password'}
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <EyeIcon off={show} />
        </button>
      </div>
      {hint && (
        <p className="muted" style={{ fontSize: 12 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
