import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useSnackbar, PasswordField } from '../ui/Shared.jsx';

// Minimum length for the new password, validated before the change is submitted.
const MIN_PASSWORD_LENGTH = 8;

// Shown after first login with a temporary/generated password; the user must set their own before continuing.
export default function ForcePasswordChange() {
  const { changePassword, markPasswordChanged, logout } = useAuth();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.new_password.length < MIN_PASSWORD_LENGTH) {
      snackbar(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'error');
      return;
    }
    if (form.new_password !== form.confirm) {
      snackbar('Passwords do not match', 'error');
      return;
    }
    setBusy(true);
    try {
      await changePassword(form.current_password, form.new_password);
      // Clear the "must change password" flag so the app stops forcing this screen, then go to the dashboard.
      markPasswordChanged();
      snackbar('Password changed. Welcome!', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      snackbar(err.message || 'Password change failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Set a new password</h2>
        <p className="muted mb-16">For security, you must choose your own password before continuing.</p>
        <form onSubmit={submit}>
          <PasswordField
            label="Current (temporary) password"
            value={form.current_password}
            onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
            autoFocus
            required
          />
          <PasswordField
            label="New password"
            value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
          />
          <PasswordField
            label="Confirm new password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            required
          />
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Saving\u2026' : 'Change Password'}
          </button>
        </form>
        <div className="row center mt-16" style={{ justifyContent: 'center' }}>
          <button className="auth-link" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
