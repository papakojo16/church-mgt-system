import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { SnackbarProvider } from './ui/Shared.jsx';
import ErrorBoundary from './ui/ErrorBoundary.jsx';
import { preloadPublicData } from './api/publicData.js';
import './styles.css';

// Warm the shared public-content cache (church name/logo, About Us, events,
// announcements) as early as possible so navigating to the About pages from the
// dashboard is instant instead of waiting on a fresh download.
preloadPublicData();

// Registers the service worker that enables offline support (caching + sync) for the app.
// When an updated worker activates on an already-controlled page, reload to pick up the new version.
async function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (hadController) {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) {
            nw.addEventListener('statechange', () => {
              if (nw.state === 'activated') {
                location.reload();
              }
            });
          }
        });
      }
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
}

// App entry point: wraps the app in the router and the snackbar + auth providers.
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <SnackbarProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SnackbarProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

registerSW();
