import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Modal, Confirm, fmtDate, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

const PRIORITIES = ['Normal', 'Urgent', 'High', 'Low'];

// Announcements page: church notices plus a "This Week's Service" upload section.
export default function Announcements() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  // Role guards: admins write announcements/services; staff see everything, ordinary members only active notices.
  const isWriter = ['admin'].includes(user?.role);
  const canSeeAll = ['admin', 'pastor', 'finance'].includes(user?.role);

  const fetchAll = () => api.get(canSeeAll ? '/api/announcements/all' : '/api/announcements?active=true');
  const { data, loading, reload } = useFetch(fetchAll, [canSeeAll]);
  const { data: svcData, reload: reloadSvc } = useFetch(() => api.get('/api/service-details'), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', priority: 'Normal', date_expires: '' });
  const [busy, setBusy] = useState(false);

  const [svcOpen, setSvcOpen] = useState(false);
  const [svcEditing, setSvcEditing] = useState(null);
  const [svcDeleting, setSvcDeleting] = useState(null);
  const [svcForm, setSvcForm] = useState({ service_date: '', preacher: '', bible_reading: '' });
  const [svcBusy, setSvcBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setSvc(k, v) {
    setSvcForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setEditing(null);
    setForm({ title: '', content: '', priority: 'Normal', date_expires: '' });
    setFormOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      priority: a.priority || 'Normal',
      date_expires: a.date_expires ? fmtDate(a.date_expires) : '',
    });
    setFormOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form };
      // An empty expiry date means the announcement never expires, so it is omitted from the request.
      if (!body.date_expires) delete body.date_expires;
      if (editing) {
        await api.put(`/api/announcements/${editing.id}`, body, { entity: 'announcement', op: 'update' });
        snackbar('Announcement updated', 'success');
      } else {
        await api.post('/api/announcements', body, { entity: 'announcement', op: 'create' });
        snackbar('Announcement created', 'success');
      }
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
      await api.del(`/api/announcements/${deleting.id}`, { entity: 'announcement', op: 'delete' });
      snackbar('Announcement deleted', 'success');
      setDeleting(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  function openSvcAdd() {
    setSvcEditing(null);
    // Default a new service entry to today's date (yyyy-mm-dd for the date input).
    setSvcForm({ service_date: new Date().toISOString().slice(0, 10), preacher: '', bible_reading: '' });
    setSvcOpen(true);
  }

  function openSvcEdit(s) {
    setSvcEditing(s);
    setSvcForm({
      service_date: s.service_date ? fmtDate(s.service_date) : '',
      preacher: s.preacher || '',
      bible_reading: s.bible_reading || '',
    });
    setSvcOpen(true);
  }

  async function saveSvc(e) {
    e.preventDefault();
    setSvcBusy(true);
    try {
      if (svcEditing) {
        await api.put(`/api/service-details/${svcEditing.id}`, { ...svcForm }, { entity: 'service_detail', op: 'update' });
        snackbar('Service updated', 'success');
      } else {
        await api.post('/api/service-details', { ...svcForm }, { entity: 'service_detail', op: 'create' });
        snackbar('Service uploaded', 'success');
      }
      setSvcOpen(false);
      reloadSvc().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Save failed', 'error');
    } finally {
      setSvcBusy(false);
    }
  }

  async function confirmSvcDelete() {
    try {
      await api.del(`/api/service-details/${svcDeleting.id}`, { entity: 'service_detail', op: 'delete' });
      snackbar('Service deleted', 'success');
      setSvcDeleting(null);
      reloadSvc().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  const list = data || [];
  const services = svcData || [];

  return (
    <div>
      <PageBanner
        title="Announcements"
        subtitle={`${list.length} announcements`}
        actions={
          isWriter ? (
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={16} /> New Announcement
            </button>
          ) : null
        }
      />

      <div className="card mb-16">
        <div className="row between wrap mb-8">
          <h3>
            <Icon name="book-open" size={16} /> This Week's Service
          </h3>
          {isWriter && (
            <button className="btn small primary" onClick={openSvcAdd}>
              <Icon name="plus" size={14} /> Upload Service
            </button>
          )}
        </div>
        {services.length === 0 ? (
          <p className="muted">No service details uploaded yet.</p>
        ) : (
          services.map((s) => (
            <div className="service-row" key={s.id}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <p className="muted" style={{ fontSize: 12 }}>
                  <Icon name="calendar" size={12} /> {fmtDate(s.service_date)}
                  {s.created_by_name ? ` \u2022 Uploaded by ${s.created_by_name}` : ''}
                </p>
                {s.preacher && (
                  <p className="mt-4">
                    <b>Preacher:</b> {s.preacher}
                  </p>
                )}
                {s.bible_reading && (
                  <p className="muted mt-4" style={{ whiteSpace: 'pre-line' }}>
                    <b>Bible Reading:</b> {s.bible_reading}
                  </p>
                )}
              </div>
              {isWriter && (
                <div className="row">
                  <button className="btn small secondary" onClick={() => openSvcEdit(s)}>
                    Edit
                  </button>
                  <button className="btn small danger" onClick={() => setSvcDeleting(s)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty label="No announcements." />
      ) : (
        list.map((a) => (
          <div className="card mb-16" key={a.id}>
            <div className="row between wrap">
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="row">
                  <h3>{a.title}</h3>
                  <span className={`tag ${a.priority}`}>{a.priority}</span>
                </div>
                <p className="muted mt-8">{a.content}</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {a.author_name ? `By ${a.author_name} \u2022 ` : ''}
                  {fmtDate(a.created_at)}
                  {a.date_expires ? ` \u2022 Expires ${fmtDate(a.date_expires)}` : ''}
                </p>
              </div>
              {isWriter && (
                <div className="row">
                  <button className="btn small secondary" onClick={() => openEdit(a)}>
                    Edit
                  </button>
                  <button className="btn small danger" onClick={() => setDeleting(a)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      <Modal
        title={editing ? 'Edit Announcement' : 'New Announcement'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'Saving\u2026' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          <div className="form-row">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Content</label>
            <textarea value={form.content} onChange={(e) => set('content', e.target.value)} required />
          </div>
          <div className="field">
            <label>Expiry date (optional)</label>
            <input type="date" value={form.date_expires} onChange={(e) => set('date_expires', e.target.value)} />
          </div>
        </form>
      </Modal>

      <Modal
        title={svcEditing ? 'Edit Service' : 'Upload Service'}
        open={svcOpen}
        onClose={() => setSvcOpen(false)}
        footer={
          <>
            <button className="btn secondary" onClick={() => setSvcOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={saveSvc} disabled={svcBusy}>
              {svcBusy ? 'Saving\u2026' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={saveSvc}>
          <div className="field">
            <label>Service date</label>
            <input type="date" value={svcForm.service_date} onChange={(e) => setSvc('service_date', e.target.value)} required />
          </div>
          <div className="field">
            <label>Preacher</label>
            <input value={svcForm.preacher} onChange={(e) => setSvc('preacher', e.target.value)} placeholder="e.g. Rev. John Mensah" />
          </div>
          <div className="field">
            <label>Bible Reading</label>
            <textarea
              value={svcForm.bible_reading}
              onChange={(e) => setSvc('bible_reading', e.target.value)}
              placeholder="e.g. Old Testament: Isaiah 40:1\u201311 \u2022 New Testament: John 1:1\u201314"
              rows={3}
            />
          </div>
        </form>
      </Modal>

      {deleting && (
        <Confirm title="Delete Announcement" message={`Delete "${deleting.title}"?`} onYes={confirmDelete} onNo={() => setDeleting(null)} />
      )}
      {svcDeleting && (
        <Confirm title="Delete Service" message={`Delete the service on ${fmtDate(svcDeleting.service_date)}?`} onYes={confirmSvcDelete} onNo={() => setSvcDeleting(null)} />
      )}
    </div>
  );
}
