import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useSnackbar, PasswordField } from '../ui/Shared.jsx';

// Minimum password length, validated locally before the account is created.
const MIN_PASSWORD_LENGTH = 8;

// Self-service registration page; new accounts are always created with the basic "member" role.
export default function Register() {
  const { register } = useAuth();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', full_name: '', password: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      snackbar(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'error');
      return;
    }
    setBusy(true);
    try {
      // Force the member role on self-registration so users can never grant themselves staff privileges.
      await register({ ...form, role: 'member' });
      snackbar('Account created. Welcome!', 'success');
      navigate('/dashboard');
    } catch (err) {
      snackbar(err.message || 'Registration failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Create account</h2>
        <p className="muted mb-16">Create your account.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Username</label>
            <input value={form.username} onChange={(e) => set('username', e.target.value)} required />
          </div>
          <PasswordField
            label="Password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
          />
          <div className="field">
            <label>Email (optional)</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Phone (optional)</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Creating account\u2026' : 'Create account'}
          </button>
        </form>
        <div className="row center mt-16" style={{ justifyContent: 'center' }}>
          <button className="auth-link" onClick={() => navigate('/login')}>
            Already have an account? Log in
          </button>
        </div>
      </div>
    </div>
  );
}
