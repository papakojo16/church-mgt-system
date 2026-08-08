import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useSnackbar, PasswordField } from '../ui/Shared.jsx';

// Login page: authenticates via the auth context and redirects to the dashboard on success.
export default function Login() {
  const { login } = useAuth();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // Username is trimmed; whitespace-only input would otherwise be sent to the server.
      await login(username.trim(), password);
      snackbar('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err) {
      snackbar(err.message || 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Log in</h2>
        <p className="muted mb-16">Access your portal</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <PasswordField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Logging in\u2026' : 'Log in'}
          </button>
        </form>
        <div className="row center mt-16" style={{ justifyContent: 'center' }}>
          <button className="auth-link" onClick={() => navigate('/register')}>
            Create a new account
          </button>
          <span className="muted">|</span>
          <button className="auth-link" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
