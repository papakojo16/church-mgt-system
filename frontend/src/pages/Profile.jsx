import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, setStoredUser } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Card, fmtDate, PageBanner, Modal } from '../ui/Shared.jsx';
import { ALL_COLORS } from '../theme/colors.js';

// Profile page: account/member details, edit profile, password change, and appearance (theme & dark mode).
export default function Profile() {
  const { user, setUser, themeName, setThemeName, darkMode, setDarkMode, setDefaultTheme, changePassword } = useAuth();
  const snackbar = useSnackbar();
  const { data: me, reload } = useFetch(() => api.get('/api/auth/me'), []);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ current_password: '', new_password: '' });
  const [busy, setBusy] = useState(false);

  const [profileForm, setProfileForm] = useState(null);

  const m = me?.member || {};

  // Snapshot the current values into the edit form; dates are converted back to yyyy-mm-dd for the date inputs.
  function openProfile() {
    setProfileForm({
      full_name: me?.full_name || '',
      username: me?.username || '',
      email: me?.email || '',
      phone: me?.phone || '',
      address: m.address || '',
      gender: m.gender || 'Male',
      date_of_birth: m.date_of_birth ? fmtDate(m.date_of_birth) : '',
      family_name: m.family_name || '',
      baptism_date: m.baptism_date ? fmtDate(m.baptism_date) : '',
      membership_date: m.membership_date ? fmtDate(m.membership_date) : '',
    });
  }

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/api/auth/me', profileForm, { entity: 'account', op: 'update' });
      // Keep the auth context and the persisted user in sync so the header/nav reflect the saved values immediately.
      setUser((u) => {
        const updated = {
          ...(u || {}),
          full_name: profileForm.full_name || u?.full_name,
          username: profileForm.username || u?.username,
          email: profileForm.email || u?.email,
          phone: profileForm.phone || u?.phone,
        };
        setStoredUser(updated);
        return updated;
      });
      snackbar('Profile updated', 'success');
      setProfileForm(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pwd.new_password.length < 8) {
      snackbar('New password must be at least 8 characters', 'error');
      return;
    }
    setBusy(true);
    try {
      await changePassword(pwd.current_password, pwd.new_password);
      snackbar('Password changed', 'success');
      setPwd({ current_password: '', new_password: '' });
      setPwdOpen(false);
    } catch (err) {
      snackbar(err.message || 'Password change failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageBanner
        title="My Profile"
        subtitle="Personal details, security and appearance"
        actions={
          <button className="btn primary" onClick={openProfile}>
            Edit Profile
          </button>
        }
      />

      <div className="grid two">
        <Card title="Account">
          {[
            ['Full name', me?.full_name],
            ['Username', me?.username],
            ['Email', me?.email],
            ['Phone', me?.phone],
            ['Role', me?.role],
          ].map(([k, v]) => (
            <p key={k} className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              <b>{k}:</b> {v || '\u2014'}
            </p>
          ))}
          <div className="row mt-16">
            <button className="btn secondary" onClick={() => setPwdOpen(true)}>
              Change Password
            </button>
          </div>
        </Card>

        <div>
          <Card title="Member Details">
            {[
              ['Gender', m.gender],
              ['Date of birth', fmtDate(m.date_of_birth)],
              ['Family name', m.family_name],
              ['Baptism date', fmtDate(m.baptism_date)],
              ['Membership date', fmtDate(m.membership_date)],
              ['Address', m.address],
            ].map(([k, v]) => (
              <p key={k} className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                <b>{k}:</b> {v || '\u2014'}
              </p>
            ))}
          </Card>

          <Card title="Appearance" actions={null}>
            <div className="row between mb-16">
              <span>Dark mode</span>
              <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
            </div>
            <p className="muted mb-8" style={{ fontSize: 12 }}>
              Theme color
            </p>
            <div className="row wrap">
              {ALL_COLORS.map((c) => (
                <button
                  key={c.name}
                  title={c.name}
                    onClick={() => {
                      setThemeName(c.name);
                      // Admins can additionally persist the theme as the default for everyone.
                      if (user?.role === 'admin') setDefaultTheme(c.name);
                    }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: themeName === c.name ? '3px solid var(--text)' : '2px solid var(--border)',
                    background: c.medium,
                  }}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal title="Edit Profile" open={!!profileForm} onClose={() => setProfileForm(null)}>
        {profileForm && (
          <form onSubmit={saveProfile}>
            <div className="form-row">
              <div className="field">
                <label>Full name</label>
                <input value={profileForm.full_name} onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="field">
                <label>Username</label>
                <input value={profileForm.username} onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Email</label>
                <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Gender</label>
              <select value={profileForm.gender} onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))}>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div className="field">
              <label>Date of birth</label>
              <input type="date" value={profileForm.date_of_birth} onChange={(e) => setProfileForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div className="field">
              <label>Family name</label>
              <input value={profileForm.family_name} onChange={(e) => setProfileForm((f) => ({ ...f, family_name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Baptism date</label>
                <input type="date" value={profileForm.baptism_date} onChange={(e) => setProfileForm((f) => ({ ...f, baptism_date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Membership date</label>
                <input type="date" value={profileForm.membership_date} onChange={(e) => setProfileForm((f) => ({ ...f, membership_date: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Address</label>
              <input value={profileForm.address} onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Saving\u2026' : 'Save'}
            </button>
          </form>
        )}
      </Modal>

      <Modal title="Change Password" open={pwdOpen} onClose={() => setPwdOpen(false)}>
        <form onSubmit={savePassword}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={pwd.current_password} onChange={(e) => setPwd((p) => ({ ...p, current_password: e.target.value }))} required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={pwd.new_password} onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))} required />
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Saving\u2026' : 'Change Password'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
