import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageBanner, Card } from '../ui/Shared.jsx';

// About page: shows app version, current user, and the offline/PWA status from the auth context.
export default function About() {
  const { user, online, pending } = useAuth();
  const version = '1.0.0';

  return (
    <div>
      <PageBanner title="About" subtitle="About this system" />
      <div className="grid two">
        <Card title="Mt. Olivet Methodist Church Management System">
          <p className="muted">
            A complete church management platform covering member records, finances, receipts, announcements, events,
            organisations, statistics and church profile content. The app works online and offline.
          </p>
          <p className="muted mt-16" style={{ fontSize: 13 }}>
            <b>Version:</b> {version}
            <br />
            <b>Logged in as:</b> {user?.full_name} ({user?.role})
            <br />
            <b>Connection:</b> {online ? 'Online' : 'Offline'}
            <br />
            <b>Pending offline changes:</b> {pending}
          </p>
        </Card>
        <Card title="Offline &amp; PWA">
          <p className="muted">
            This app is a Progressive Web App (PWA). Once loaded, the main pages are cached so they keep working without
            an internet connection. Changes you make while offline are queued on your device and automatically synced to
            the server when you reconnect.
          </p>
        </Card>
      </div>
    </div>
  );
}
