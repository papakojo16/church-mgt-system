import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// Admin audit trail: every recorded action across the app, filterable by category.
export default function ActivityLogs() {
  const [category, setCategory] = useState('All');
  const { data: categories } = useFetch(() => api.get('/api/activity-categories').catch(() => []), []);
  const fetchLogs = () => api.get(`/api/activity-logs?category=${encodeURIComponent(category)}`);
  const { data, loading, reload } = useFetch(fetchLogs, [category]);

  const logs = data || [];
  const actions = ['created', 'updated', 'deleted', 'registered', 'joined', 'left'];

  return (
    <div>
      <PageBanner
        title="Activity Logs"
        subtitle={`${logs.length} recorded action${logs.length === 1 ? '' : 's'}`}
        actions={
          <>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', marginRight: 8 }}
            >
              <option value="All">All Categories</option>
              {(categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className="btn secondary" onClick={() => reload().catch(() => {})}>
              <Icon name="refresh-cw" size={15} /> Refresh
            </button>
          </>
        }
      />

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty label="No activity recorded yet." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Category</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{log.created_at ? String(log.created_at).replace('T', ' ').slice(0, 19) : '--'}</td>
                  <td>{log.user_name || 'System'}</td>
                  <td>
                    <span className={`tag ${actions.includes(log.action) ? log.action : ''}`}>
                      {log.action || '--'}
                    </span>
                  </td>
                  <td>{log.category || '--'}</td>
                  <td className="muted" style={{ fontSize: 13 }}>
                    {log.details || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
