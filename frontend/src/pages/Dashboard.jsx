import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { Card, fmtMoney, fmtDate, Empty, Loading } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// Dashboard is the post-login landing page: shows church stats plus upcoming events and announcements.
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Fetch all headline stats in parallel; each falls back to a placeholder so one failure never blanks the page.
  const stats = useFetch(() => {
    const p1 = api.get('/api/members/count').catch(() => ({ count: '-' }));
    const p2 = api.get('/api/todays-offering').catch(() => ({ total: '-' }));
    const p3 = api.get('/api/monthly-tithe').catch(() => ({ total: '-' }));
    const p4 = api.get('/api/financial-summary').catch(() => ({}));
    return Promise.all([p1, p2, p3, p4]);
  }, []);
  const events = useFetch(() => api.get('/api/events/upcoming').catch(() => []), []);
  const anns = useFetch(() => api.get('/api/announcements?active=true').catch(() => []), []);

  // Role guards: only finance roles see money cards; only admins get a "Manage" shortcut for events.
  const isFinance = ['admin', 'finance', 'pastor'].includes(user?.role);
  const isWriter = ['admin'].includes(user?.role);

  const [count, today, tithe, summary] = stats.data || [null, null, null, null];

  return (
    <div>
      <div className="header-banner">
        <h1>Welcome, {user?.full_name || user?.username}!</h1>
        <p className="role-badge">{user?.role_display || 'User'}</p>
      </div>

      <div className="grid stats mb-16">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--theme-medium)' }}>
            <Icon name="users" size={22} />
          </div>
          <div>
            <div className="stat-value">{stats.data ? count?.count : '\u2026'}</div>
            <div className="stat-label">Members</div>
          </div>
        </div>
        {/* Money figures (offering, tithe, balance) are hidden from non-finance roles. */}
        {isFinance && (
          <>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--success)' }}>
                <Icon name="dollar-sign" size={22} />
              </div>
              <div>
                <div className="stat-value">{today?.total === '-' ? '-' : fmtMoney(today?.total)}</div>
                <div className="stat-label">Today's Offering</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--warning)' }}>
                <Icon name="trending-up" size={22} />
              </div>
              <div>
                <div className="stat-value">{tithe?.total === '-' ? '-' : fmtMoney(tithe?.total)}</div>
                <div className="stat-label">Monthly Tithe</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--danger)' }}>
                <Icon name="activity" size={22} />
              </div>
              <div>
                <div className="stat-value">
                  {summary ? fmtMoney((summary.total_income || 0) - (summary.total_expenses || 0)) : '\u2026'}
                </div>
                <div className="stat-label">Balance</div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid two">
        <Card title="Upcoming Events">
          {events.loading ? (
            <Loading />
          ) : events.data && events.data.length ? (
            events.data.map((e) => (
              <div className="row between" key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <b>{e.title}</b>
                  <div className="muted">{fmtDate(e.event_date)}{e.location ? ` \u2022 ${e.location}` : ''}</div>
                </div>
                {isWriter && (
                  <button className="btn small secondary" onClick={() => navigate('/events')}>
                    Manage
                  </button>
                )}
              </div>
            ))
          ) : (
            <Empty label="No upcoming events." />
          )}
        </Card>

        <Card title="Latest Announcements">
          {anns.loading ? (
            <Loading />
          ) : anns.data && anns.data.length ? (
            anns.data.slice(0, 5).map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row between">
                  <b>{a.title}</b>
                  <span className={`tag ${a.priority}`}>{a.priority}</span>
                </div>
                <p className="muted" style={{ fontSize: 13 }}>
                  {String(a.content || '').slice(0, 140)}
                </p>
              </div>
            ))
          ) : (
            <Empty label="No announcements." />
          )}
        </Card>
      </div>
    </div>
  );
}
