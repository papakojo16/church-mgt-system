import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Confirm, fmtDate, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// The four attendance buckets, used both for the table columns and the chart's grouped bars.
const CATS = [
  { key: 'adult_male', label: 'Adult Men', color: 'var(--theme-medium)' },
  { key: 'adult_female', label: 'Adult Women', color: 'var(--theme-highlight)' },
  { key: 'child_male', label: 'Boys', color: 'var(--success)' },
  { key: 'child_female', label: 'Girls', color: 'var(--warning)' },
];

// SVG grouped bar chart of attendance per service date; bars are sized relative to the largest value (max, min 1).
function Chart({ data }) {
  if (!data || !data.length) return null;
  const width = 720;
  const height = 260;
  const pad = 34;
  const barMinW = 20;
  const chartWidth = width - pad * 2;
  const chartHeight = height - pad * 2;
  const max = Math.max(...data.map((r) => Math.max(...CATS.map((c) => Number(r[c.key]) || 0))), 1);
  // Each service date gets a slice of the width; bars within a slice are laid out side by side.
  const step = chartWidth / data.length;
  const group = Math.min(step * 0.95, 80);
  const barW = Math.max((group - (CATS.length - 1) * 4) / CATS.length, barMinW);

  return (
    <div>
      <div className="chart-legend">
        {CATS.map((c) => (
          <span key={c.key} className="legend-item">
            <span className="legend-dot" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pad + chartHeight * (1 - f);
          return (
            <g key={f}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={pad - 6} y={y + 4} fontSize={10} fill="var(--text-2)" textAnchor="end">
                {Math.round(max * f)}
              </text>
            </g>
          );
        })}
        {data.map((r, i) => {
          const x0 = pad + i * step + (step - group) / 2;
          return (
            <g key={i}>
              {CATS.map((c, j) => {
                const v = Number(r[c.key]) || 0;
                const h = (v / max) * chartHeight;
                return (
                  <rect
                    key={c.key}
                    x={x0 + j * (barW + 4)}
                    y={pad + chartHeight - h}
                    width={barW}
                    height={Math.max(h, 1)}
                    fill={c.color}
                    rx={2}
                  />
                );
              })}
              {/* X-axis label: shows only the MM-DD part of each service date. */}
              <text x={pad + i * step + step / 2} y={height - 12} fontSize={9} fill="var(--text-2)" textAnchor="middle">
                {fmtDate(r.service_date).slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Statistics page: weekly attendance records, a trend chart, and an admin-only add/edit form.
export default function Statistics() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isWriter = ['admin'].includes(user?.role);

  const { data, loading, reload } = useFetch(() => api.get('/api/attendance'), []);
  const { data: chartData } = useFetch(() => api.get('/api/attendance/chart'), []);
  const [formOpen, setFormOpen] = useState(false);
  // New attendance defaults to today's date (yyyy-mm-dd for the date input).
  const [form, setForm] = useState({ service_date: new Date().toISOString().slice(0, 10), adult_male: '', adult_female: '', child_male: '', child_female: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openEdit(r) {
    setForm({
      service_date: fmtDate(r.service_date),
      adult_male: r.adult_male,
      adult_female: r.adult_female,
      child_male: r.child_male,
      child_female: r.child_female,
      note: r.note || '',
    });
    setFormOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/attendance', form, { entity: 'weekly_attendance', op: 'upsert' });
      snackbar('Attendance saved', 'success');
      setFormOpen(false);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/attendance/${deleting.id}`, { entity: 'weekly_attendance', op: 'delete' });
      snackbar('Attendance record deleted', 'success');
      setDeleting(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  const list = data || [];

  return (
    <div>
      <PageBanner
        title="Statistics"
        subtitle="Weekly attendance tracking"
        actions={
          isWriter ? (
            <button className="btn primary" onClick={() => { setFormOpen(true); }}>
              + Record Attendance
            </button>
          ) : null
        }
      />

      <div className="card mb-16">
        <h3 className="mb-16">Attendance Trend</h3>
        {chartData && chartData.length ? (
          <Chart data={chartData} />
        ) : (
          <Empty label="No attendance data yet." />
        )}
      </div>

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty label="No attendance records." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Service Date</th>
                <th style={{ textAlign: 'right' }}>Adult Men</th>
                <th style={{ textAlign: 'right' }}>Adult Women</th>
                <th style={{ textAlign: 'right' }}>Boys</th>
                <th style={{ textAlign: 'right' }}>Girls</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Recorded By</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.service_date)}</td>
                  <td style={{ textAlign: 'right' }}>{r.adult_male}</td>
                  <td style={{ textAlign: 'right' }}>{r.adult_female}</td>
                  <td style={{ textAlign: 'right' }}>{r.child_male}</td>
                  <td style={{ textAlign: 'right' }}>{r.child_female}</td>
                  <td style={{ textAlign: 'right' }}>
                    {/* Total attendance for that service = sum of all four buckets. */}
                    <b>{r.adult_male + r.adult_female + r.child_male + r.child_female}</b>
                  </td>
                  <td>{r.recorded_by_name || '\u2014'}</td>
                  <td>
                    <div className="row-actions">
                      {isWriter && (
                        <>
                          <button className="btn small secondary" onClick={() => openEdit(r)}>
                            Edit
                          </button>
                          <button className="btn small danger" onClick={() => setDeleting(r)}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Weekly Attendance</h3>
              <button className="icon-btn" onClick={() => setFormOpen(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="field">
                <label>Service date</label>
                <input type="date" value={form.service_date} onChange={(e) => set('service_date', e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Adult men</label>
                  <input type="number" min="0" value={form.adult_male} onChange={(e) => set('adult_male', e.target.value)} />
                </div>
                <div className="field">
                  <label>Adult women</label>
                  <input type="number" min="0" value={form.adult_female} onChange={(e) => set('adult_female', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Boys</label>
                  <input type="number" min="0" value={form.child_male} onChange={(e) => set('child_male', e.target.value)} />
                </div>
                <div className="field">
                  <label>Girls</label>
                  <input type="number" min="0" value={form.child_female} onChange={(e) => set('child_female', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Note</label>
                <input value={form.note} onChange={(e) => set('note', e.target.value)} />
              </div>
              <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Saving\u2026' : 'Save'}
              </button>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <Confirm title="Delete Record" message={`Delete attendance for ${fmtDate(deleting.service_date)}?`} onYes={confirmDelete} onNo={() => setDeleting(null)} />
      )}
    </div>
  );
}
