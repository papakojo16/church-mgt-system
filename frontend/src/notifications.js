import { api } from './api/client.js';

// Web Notifications helpers. Notifications are shown via the service worker
// (so they appear even when the tab is in the background) and fall back to the
// page's Notification constructor when no worker is active.

const SEEN_KEY = 'mtolivet_seen_notifications';
const ENABLED_KEY = 'mtolivet_notif_enabled';
const PROMPTED_KEY = 'mtolivet_notif_prompted';

let watcherTimer = null;
let seen = loadSeen();

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export function isEnabled() {
  return (
    notificationsSupported() &&
    Notification.permission === 'granted' &&
    localStorage.getItem(ENABLED_KEY) === 'true'
  );
}

export function wasPrompted() {
  return localStorage.getItem(PROMPTED_KEY) === 'true';
}

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSeen() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage may be unavailable */
  }
}

function stripText(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function formatEvent(e) {
  const when = e.event_date ? new Date(e.event_date).toLocaleString() : '';
  return (e.location ? e.location + ' — ' : '') + when;
}

// Show a notification through the active service worker when possible.
export function showNotification(title, body, url = '/') {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const opts = {
    body,
    data: { url },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => {
        try {
          new Notification(title, opts);
        } catch {
          /* ignore */
        }
      });
  } else {
    try {
      new Notification(title, opts);
    } catch {
      /* ignore */
    }
  }
}

// Poll public content and notify about items the user hasn't seen yet.
async function checkOnce() {
  try {
    const data = await api.get('/api/public', { cache: 'no-store' });
    const items = [];
    (data.announcements || []).forEach((a) =>
      items.push({
        id: 'a' + a.id,
        title: a.title || 'New announcement',
        body: stripText(a.content),
        url: '/announcements',
      })
    );
    (data.upcoming_events || []).forEach((e) =>
      items.push({
        id: 'e' + e.id,
        title: e.title || 'New event',
        body: formatEvent(e),
        url: '/events',
      })
    );
    const fresh = items.filter((it) => !seen.has(it.id));
    fresh.forEach((it) => {
      seen.add(it.id);
      showNotification(it.title, it.body, it.url);
    });
    if (fresh.length) saveSeen();
  } catch {
    /* offline or server error: try again next tick */
  }
}

export function startWatcher() {
  if (watcherTimer) return;
  checkOnce();
  watcherTimer = setInterval(checkOnce, 60000);
}

export function stopWatcher() {
  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
  }
}

export function disableNotifications() {
  localStorage.setItem(ENABLED_KEY, 'false');
  stopWatcher();
}

// Ask the user (via an alert/confirm) to enable notifications, then request
// permission. `onResult` receives 'granted' | 'denied' | 'dismissed' | 'unsupported'.
export function promptEnableNotifications({ onResult } = {}) {
  if (!notificationsSupported()) {
    onResult && onResult('unsupported');
    return;
  }
  const perm = Notification.permission;
  if (perm === 'denied') {
    onResult && onResult('denied');
    return;
  }
  if (perm === 'granted') {
    localStorage.setItem(ENABLED_KEY, 'true');
    startWatcher();
    onResult && onResult('granted');
    return;
  }
  // default: use an alert to ask before requesting permission.
  const ok = window.confirm(
    'Enable notifications?\n\nThe app can alert you about new events and announcements even when you are not viewing the page.'
  );
  if (ok) {
    Notification.requestPermission().then((res) => {
      if (res === 'granted') {
        localStorage.setItem(ENABLED_KEY, 'true');
        startWatcher();
      }
      onResult && onResult(res);
    });
  } else {
    localStorage.setItem(PROMPTED_KEY, 'true');
    onResult && onResult('dismissed');
  }
}
