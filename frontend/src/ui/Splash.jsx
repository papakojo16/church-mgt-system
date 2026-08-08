import React from 'react';
import { Icon } from './icons.jsx';

// Full-screen startup overlay with the church logo/name and a spinner.
// `leaving` toggles the fade-out class so it can animate away before unmount.
export default function Splash({ logo, name, leaving }) {
  return (
    <div className={`splash ${leaving ? 'splash-leave' : ''}`}>
      <div className="splash-inner">
        {logo ? (
          <img className="splash-logo" src={logo} alt="Logo" />
        ) : (
          // No logo loaded yet: fall back to a cross icon.
          <span className="splash-logo splash-logo-fallback">
            <Icon name="cross" size={34} strokeWidth={3} />
          </span>
        )}
        <h1 className="splash-name">{name || 'Mt. Olivet'}</h1>
        <div className="splash-spinner" />
      </div>
    </div>
  );
}
