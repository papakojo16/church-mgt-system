import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, getStoredUser, setToken, setStoredUser, getRefreshToken, setRefreshToken, syncPendingWrites, pendingCount, getToken, onPendingChange } from '../api/client.js';
import { applyThemeVars, getColorInfo, DEFAULT_COLOR } from '../theme/colors.js';
import { useSnackbar } from '../ui/Shared.jsx';

const AuthContext = createContext(null);

// Global auth provider: restores the session from storage and exposes login/logout,
// theme, online status and offline-sync state to the whole app.
export function AuthProvider({ children }) {
  const snackbar = useSnackbar();
  const [user, setUser] = useState(getStoredUser());
  // Theme/dark-mode preferences are persisted to localStorage and applied on startup.
  const [themeName, setThemeName] = useState(() => localStorage.getItem('mtolivet_theme') || DEFAULT_COLOR);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('mtolivet_dark') === 'true');
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncTimer = useRef(null);

  // Apply the chosen theme colors + dark flag to CSS variables and persist the selection.
  useEffect(() => {
    applyThemeVars(themeName, darkMode);
    localStorage.setItem('mtolivet_theme', themeName);
  }, [themeName, darkMode]);

  // Track connectivity: notify the user on transitions and auto-sync when back online.
  useEffect(() => {
    // Read the initial count of queued offline writes, then keep it live by
    // subscribing to pending-change notifications from the API client.
    pendingCount().then(setPending);
    const off = onPendingChange((n) => setPending(n));
    const onOffline = () => {
      setOnline(false);
      snackbar('You are offline. Changes will be saved on your device.', 'warn', 5000);
    };
    const onOnline = () => {
      setOnline(true);
      snackbar('You are back online.', 'success');
      doSync();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      off();
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    // Auto-sync queued offline changes every 30 seconds while logged in and online.
    if (user && online) {
      syncTimer.current = setInterval(doSync, 30000);
      return () => clearInterval(syncTimer.current);
    }
  }, [user, online]);

  // Ref guard prevents overlapping syncs (e.g. from the interval and the Sync button).
  const syncingRef = useRef(false);

  // Push queued offline writes to the server, then refresh the pending counter.
  async function doSync() {
    if (!getToken() || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncPendingWrites();
      setPending(await pendingCount());
    } catch {
      // stay offline
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  // Re-read the queued-write count from IndexedDB and sync it into state.
  async function refreshPending() {
    setPending(await pendingCount());
  }

  // Login: persist the returned token + user, then adopt the server default theme unless the user chose one.
  async function login(username, password) {
    const data = await api.post('/api/auth/login', { username, password }, { queue: false });
    setToken(data.token);
    setRefreshToken(data.refresh_token);
    setStoredUser(data.user);
    setUser(data.user);
    try {
      const themeData = await api.get('/api/theme/colors');
      const defaultName = themeData.default;
      const saved = localStorage.getItem('mtolivet_theme');
      setThemeName(saved || defaultName);
    } catch {
      // use default
    }
    return data.user;
  }

  // Register: persist the returned token + user just like login.
  async function register(payload) {
    const data = await api.post('/api/auth/register', payload, { queue: false });
    setToken(data.token);
    setRefreshToken(data.refresh_token);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }

  // Logout: revoke the refresh token server-side (best-effort), then clear the
  // stored token + user (keeps queued offline writes untouched).
  function logout() {
    const rt = getRefreshToken();
    if (rt) {
      api.post('/api/auth/logout', { refresh_token: rt }, { queue: false }).catch(() => {});
    }
    setToken('');
    setRefreshToken('');
    setStoredUser(null);
    setUser(null);
  }

  // Change password through the API without queuing (must reach the server).
  async function changePassword(current_password, new_password) {
    await api.post('/api/auth/change-password', { current_password, new_password }, { queue: false });
  }

  // Clear the forced-password flag locally once the user has changed it.
  function markPasswordChanged() {
    setUser((u) => {
      const updated = { ...(u || {}), must_change_password: false };
      setStoredUser(updated);
      return updated;
    });
  }

  // Admins can set the church default theme; falls back to the local choice if the server is unreachable.
  async function setDefaultTheme(name) {
    setThemeName(name);
    try {
      await api.put('/api/theme/default', { name }, { queue: false });
    } catch {
      // keep local
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        themeName,
        setThemeName,
        darkMode,
        setDarkMode,
        online,
        pending,
        syncing,
        login,
        register,
        logout,
        changePassword,
        markPasswordChanged,
        doSync,
        setDefaultTheme,
        refreshPending,
        colorInfo: getColorInfo(themeName),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
