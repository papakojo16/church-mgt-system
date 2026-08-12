import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Modal, Confirm, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseRoles(m) {
  const raw = m?.roles;
  if (!raw) return ['Member'];
  if (Array.isArray(raw)) return raw.length ? raw : ['Member'];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) && p.length ? p : ['Member'];
  } catch {
    return ['Member'];
  }
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

function dateParts(dt) {
  const d = toDate(dt);
  if (!d) return { day: '--', month: '', label: String(dt || ''), when: String(dt || '') };
  const label = `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: MONTHS[d.getMonth()],
    label,
    when: `${label} at ${time}`,
  };
}

function toInputValue(dt) {
  const d = toDate(dt);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function resizeImage(file, maxSize = 1280, quality = 0.82) {
  // Reads an image file and returns a resized JPEG data-URL to keep uploads small.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      // Guard against files the browser cannot decode (e.g. HEIC on some devices):
      // give up after 10s so the upload list does not hang.
      const timer = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error('decode-timeout'));
      }, 10000);
      img.onload = () => {
        clearTimeout(timer);
        if (!img.naturalWidth) {
          reject(new Error('decode-failed'));
          return;
        }
        // Shrink only when the image is larger than maxSize, keeping its aspect ratio.
        let { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        if (scale < 1) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('decode-failed'));
      };
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Ministries() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isWriter = ['admin'].includes(user?.role);

  const { data, loading, reload } = useFetch(() => api.get('/api/ministries'), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [managing, setManaging] = useState(null);
  const [detail, setDetail] = useState(null);
  const [joinTarget, setJoinTarget] = useState(null);
  const [joinRole, setJoinRole] = useState('Member');
  const [form, setForm] = useState({ name: '', description: '', leader_id: '', roles: 'Member' });
  const [busy, setBusy] = useState(false);

  const { data: members } = useFetch(() => api.get('/api/members').catch(() => []), []);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', description: '', leader_id: '', roles: 'Member' });
    setFormOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({
      name: m.name,
      description: m.description || '',
      leader_id: m.leader_id || '',
      roles: parseRoles(m).join(', '),
    });
    setFormOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        leader_id: form.leader_id ? Number(form.leader_id) : null,
        roles: form.roles.split(',').map((r) => r.trim()).filter(Boolean),
      };
      if (editing) {
        await api.put(`/api/ministries/${editing.id}`, body, { entity: 'ministry', op: 'update' });
        snackbar('Organisation updated', 'success');
      } else {
        await api.post('/api/ministries', body, { entity: 'ministry', op: 'create' });
        snackbar('Organisation created', 'success');
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
      await api.del(`/api/ministries/${deleting.id}`, { entity: 'ministry', op: 'delete' });
      snackbar('Organisation deleted', 'success');
      setDeleting(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  function openJoin(m) {
    const roles = parseRoles(m);
    setJoinTarget(m);
    setJoinRole(roles.length > 1 ? roles[0] : 'Member');
  }

  async function confirmJoin() {
    if (!joinTarget) return;
    try {
      await api.post(`/api/ministries/${joinTarget.id}/join`, { role: joinRole }, { queue: false });
      snackbar(`You joined ${joinTarget.name}`, 'success');
      setJoinTarget(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Failed to join', 'error');
    }
  }

  async function leaveOrg(m) {
    try {
      await api.post(`/api/ministries/${m.id}/leave`, {}, { queue: false });
      snackbar(`You left ${m.name}`, 'success');
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Failed to leave', 'error');
    }
  }

  const list = data || [];
  const joinOptions = joinTarget ? parseRoles(joinTarget) : [];

  return (
    <div>
      <PageBanner
        title="Organizations"
        subtitle={`${list.length} organisations`}
        actions={
          isWriter ? (
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={16} /> New Organisation
            </button>
          ) : null
        }
      />

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty label="No organisations yet." />
      ) : (
        <div className="grid two">
          {list.map((m) => (
            <div className="card clickable" key={m.id} onClick={() => setDetail(m)} role="button" tabIndex={0}>
              <h3>{m.name}</h3>
              {m.description && <p className="muted">{m.description}</p>}
              <p className="muted mt-8" style={{ fontSize: 12 }}>
                {m.member_count || 0} members
                {m.leader_name ? ` \u2022 Leader: ${m.leader_name}` : ''}
              </p>
              <div className="row mt-16 wrap">
                {m.is_member ? (
                  <button className="btn small danger" onClick={(e) => { e.stopPropagation(); leaveOrg(m); }}>
                    Leave
                  </button>
                ) : (
                  <button className="btn small primary" onClick={(e) => { e.stopPropagation(); openJoin(m); }}>
                    Join
                  </button>
                )}
                <button className="btn small secondary" onClick={(e) => { e.stopPropagation(); setManaging(m); }}>
                  Members
                </button>
                {isWriter && (
                  <>
                    <button className="btn small secondary" onClick={(e) => { e.stopPropagation(); openEdit(m); }}>
                      Edit
                    </button>
                    <button className="btn small danger" onClick={(e) => { e.stopPropagation(); setDeleting(m); }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editing ? 'Edit Organisation' : 'New Organisation'}
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
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Leader</label>
              <select value={form.leader_id} onChange={(e) => set('leader_id', e.target.value)}>
                <option value="">None</option>
                {(members || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Roles (comma separated, e.g. Member, President, Secretary)</label>
              <input value={form.roles} onChange={(e) => set('roles', e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>

      {joinTarget && (
        <Modal
          title={`Join ${joinTarget.name}`}
          open={true}
          onClose={() => setJoinTarget(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setJoinTarget(null)}>
                Cancel
              </button>
              <button className="btn primary" onClick={confirmJoin}>
                Join
              </button>
            </>
          }
        >
          <div className="field">
            <label>Join as</label>
            <select value={joinRole} onChange={(e) => setJoinRole(e.target.value)}>
              {joinOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {detail && (
        <OrgDetailModal
          ministry={detail}
          onClose={() => setDetail(null)}
          snackbar={snackbar}
          reloadMinistries={reload}
        />
      )}

      {managing && (
        <ManageMembersModal
          ministry={managing}
          onClose={() => setManaging(null)}
          snackbar={snackbar}
          reloadMinistries={reload}
        />
      )}

      {deleting && (
        <Confirm title="Delete Organisation" message={`Delete "${deleting.name}"?`} onYes={confirmDelete} onNo={() => setDeleting(null)} />
      )}
    </div>
  );
}

function OrgDetailModal({ ministry, onClose, snackbar, reloadMinistries }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('events');
  const canEdit = user?.role === 'admin' || (ministry.my_role || '').toLowerCase() === 'secretary';
  const [eventForm, setEventForm] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [delPic, setDelPic] = useState(null);
  const [viewPic, setViewPic] = useState(null);

  const eventsFetcher = () => api.get(`/api/ministries/${ministry.id}/events`);
  const picsFetcher = () => api.get(`/api/ministries/${ministry.id}/pictures`);
  const { data: eventsData, loading: eventsLoading, reload: reloadEvents } = useFetch(eventsFetcher, [ministry.id]);
  const { data: picsData, loading: picsLoading, reload: reloadPics } = useFetch(picsFetcher, [ministry.id]);

  const events = eventsData || [];
  const now = Date.now();
  const upcoming = events.filter((e) => {
    const d = toDate(e.event_date || e.end_date);
    return d && d.getTime() >= now;
  });
  const past = events.filter((e) => {
    const d = toDate(e.event_date || e.end_date);
    return d && d.getTime() < now;
  });

  return (
    <Modal title={ministry.name} open={true} onClose={onClose} wide>
      <div className="tabs">
        <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
          Events {events.length ? `(${events.length})` : ''}
        </button>
        <button className={tab === 'pictures' ? 'active' : ''} onClick={() => setTab('pictures')}>
          Pictures {picsData?.length ? `(${picsData.length})` : ''}
        </button>
      </div>

      {tab === 'events' && (
        <div>
          <div className="row mb-16" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 13 }}>Upcoming {upcoming.length} \u2022 Past {past.length}</span>
            {canEdit && (
              <button className="btn small primary" onClick={() => setEventForm({ mode: 'new' })}>
                <Icon name="plus" size={14} /> Add Event
              </button>
            )}
          </div>
          {eventsLoading ? (
            <Loading />
          ) : events.length === 0 ? (
            <Empty label="No events yet." />
          ) : (
            <div style={{ maxHeight: '52vh', overflow: 'auto' }}>
              {upcoming.length > 0 && <h4 style={{ fontSize: 13, margin: '8px 0' }}>Upcoming</h4>}
              {upcoming.map((e) => (
                <EventRow key={e.id} event={e} canEdit={canEdit} onEdit={() => setEventForm({ mode: 'edit', event: e })} onDelete={() => setDeletingEvent(e)} />
              ))}
              {past.length > 0 && <h4 style={{ fontSize: 13, margin: '16px 0 8px' }}>Past</h4>}
              {past.map((e) => (
                <EventRow key={e.id} event={e} canEdit={canEdit} onEdit={() => setEventForm({ mode: 'edit', event: e })} onDelete={() => setDeletingEvent(e)} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'pictures' && (
        <div>
          {canEdit && (
            <UploadPicture
              snackbar={snackbar}
              onDone={async (image, caption) => {
                try {
                  await api.post(`/api/ministries/${ministry.id}/pictures`, { image, caption }, { entity: 'ministry', op: 'upload_picture' });
                  snackbar('Picture uploaded', 'success');
                  reloadPics().catch(() => {});
                } catch (err) {
                  snackbar(err.message || 'Upload failed', 'error');
                }
              }}
            />
          )}
          {picsLoading ? (
            <Loading />
          ) : !picsData || picsData.length === 0 ? (
            <Empty label="No pictures yet." />
          ) : (
            <div className="gallery" style={{ marginTop: canEdit ? 16 : 0 }}>
              {picsData.map((p) => (
                <div className="gallery-item" key={p.id}>
                  <img src={p.image} alt={p.caption || ministry.name} onClick={() => setViewPic(p)} />
                  {p.caption && <div className="caption">{p.caption}</div>}
                  {canEdit && (
                    <button className="del-btn" onClick={() => setDelPic(p)} title="Delete">
                      <Icon name="trash-2" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {eventForm && (
        <EventFormModal
          ministry={ministry}
          mode={eventForm.mode}
          event={eventForm.event}
          onClose={() => setEventForm(null)}
          onSaved={async () => {
            setEventForm(null);
            await reloadEvents().catch(() => {});
          }}
          snackbar={snackbar}
        />
      )}

      {deletingEvent && (
        <Confirm
          title="Delete Event"
          message={`Delete "${deletingEvent.title}"?`}
          onYes={async () => {
            try {
              await api.del(`/api/ministries/${ministry.id}/events/${deletingEvent.id}`, { entity: 'ministry', op: 'delete_event' });
              snackbar('Event deleted', 'success');
              setDeletingEvent(null);
              reloadEvents().catch(() => {});
              reloadMinistries().catch(() => {});
            } catch (err) {
              snackbar(err.message || 'Delete failed', 'error');
            }
          }}
          onNo={() => setDeletingEvent(null)}
        />
      )}

      {delPic && (
        <Confirm
          title="Delete Picture"
          message="Delete this picture?"
          onYes={async () => {
            try {
              await api.del(`/api/ministries/${ministry.id}/pictures/${delPic.id}`, { entity: 'ministry', op: 'delete_picture' });
              snackbar('Picture deleted', 'success');
              setDelPic(null);
              reloadPics().catch(() => {});
            } catch (err) {
              snackbar(err.message || 'Delete failed', 'error');
            }
          }}
          onNo={() => setDelPic(null)}
        />
      )}

      {viewPic && (
        <Modal title={viewPic.caption || ministry.name} open={true} onClose={() => setViewPic(null)} wide>
          <img src={viewPic.image} alt={viewPic.caption || ministry.name} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
          {viewPic.uploader_name && <p className="muted mt-8" style={{ fontSize: 12 }}>Uploaded by {viewPic.uploader_name}</p>}
        </Modal>
      )}
    </Modal>
  );
}

function EventRow({ event, canEdit, onEdit, onDelete }) {
  const dp = dateParts(event.event_date);
  return (
    <div className="event-row">
      <div className="event-badge">
        <span className="day">{dp.day}</span>
        <span className="month">{dp.month}</span>
      </div>
      <div className="body">
        {event.image && <img className="ev-thumb" src={event.image} alt={`${event.title} flier`} />}
        <div className="title">{event.title}</div>
        <div className="meta">
          <span><Icon name="clock" size={13} /> {dp.when}</span>
          {event.location && <span><Icon name="map-pin" size={13} /> {event.location}</span>}
        </div>
        {event.description && <div className="desc">{event.description}</div>}
      </div>
      {canEdit && (
        <div className="actions">
          <button className="btn small secondary" onClick={onEdit} title="Edit">
            <Icon name="edit-2" size={13} />
          </button>
          <button className="btn small danger" onClick={onDelete} title="Delete">
            <Icon name="trash-2" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function EventFormModal({ ministry, mode, event, onClose, onSaved, snackbar }) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    event_date: toInputValue(event?.event_date) || '',
    location: event?.location || '',
    image: event?.image || '',
  });
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Turn a selected file into a resized data-URL preview; errors surface in the snackbar.
  async function pickFlier(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      snackbar('Please choose an image file', 'error');
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      set('image', dataUrl);
    } catch {
      snackbar('Could not read that image', 'error');
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        event_date: form.event_date,
        location: form.location,
        image: form.image,
      };
      if (mode === 'edit' && event) {
        await api.put(`/api/ministries/${ministry.id}/events/${event.id}`, body, { entity: 'ministry', op: 'update_event' });
        snackbar('Event updated', 'success');
      } else {
        await api.post(`/api/ministries/${ministry.id}/events`, body, { entity: 'ministry', op: 'create_event' });
        snackbar('Event created', 'success');
      }
      onSaved();
    } catch (err) {
      snackbar(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={mode === 'edit' ? 'Edit Event' : 'New Event'}
      open={true}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'Saving\u2026' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={save}>
        <div className="field">
          <label>Title</label>
          <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </div>
        <div className="field">
          <label>Date & time</label>
          <input type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} required />
        </div>
        <div className="field">
          <label>Location</label>
          <input value={form.location} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="field">
          <label>Event flier (image)</label>
          {form.image ? (
            <div className="ev-flier-preview">
              <img src={form.image} alt="Event flier" />
              <div className="row mt-8">
                <button type="button" className="btn small secondary" onClick={() => set('image', '')}>
                  Remove image
                </button>
                <label className="btn small primary" style={{ marginLeft: 8 }}>
                  Change image
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickFlier(e.target.files[0])} />
                </label>
              </div>
            </div>
          ) : (
            <label className="btn secondary upload-btn">
              <Icon name="upload-cloud" size={16} /> Choose image
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickFlier(e.target.files[0])} />
            </label>
          )}
        </div>
      </form>
    </Modal>
  );
}

function UploadPicture({ onDone, snackbar }) {
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState([]); // array of { file, url }
  const [caption, setCaption] = useState('');
  const fileRef = React.useRef(null);

  // Clean up object URLs when the component unmounts so memory is not leaked.
  useEffect(() => {
    return () => {
      setPreviews((prev) => {
        (prev || []).forEach((p) => {
          try { URL.revokeObjectURL(p.url); } catch {}
        });
        return prev;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const bad = files.find((f) => !f.type.startsWith('image/'));
    if (bad) {
      snackbar('Please choose image files only', 'error');
      return;
    }
    // Show previews instantly via object URLs (no decoding) so they appear even
    // on phones with image formats the canvas cannot read. Resizing happens at upload.
    const added = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews((prev) => [...prev, ...added]);
  }

  async function upload() {
    if (!previews.length) return;
    setBusy(true);
    const tag = caption.trim();
    let failed = 0;
    try {
      // Resize each selected file, then hand it to onDone along with the shared caption.
      for (const p of previews) {
        try {
          const dataUrl = await resizeImage(p.file);
          await onDone(dataUrl, tag);
          try { URL.revokeObjectURL(p.url); } catch {}
        } catch {
          // Skip unreadable files but keep uploading the rest.
          failed++;
          try { URL.revokeObjectURL(p.url); } catch {}
        }
      }
      if (failed) snackbar(`${failed} image${failed > 1 ? 's' : ''} could not be read`, 'error');
    } finally {
      setPreviews([]);
      setCaption('');
      setBusy(false);
    }
  }

  function removePreview(idx) {
    setPreviews((prev) => {
      // Release the object URL of the removed preview.
      const target = prev[idx];
      if (target) { try { URL.revokeObjectURL(target.url); } catch {} }
      return prev.filter((_, k) => k !== idx);
    });
  }

  return (
    <div className="upload-drop">
      {previews.length > 0 && (
        <div className="row wrap upload-previews" style={{ gap: 8 }}>
          {previews.map((p, k) => (
            <div className="upload-preview-wrap" key={k}>
              <img className="upload-preview" src={p.url} alt="preview" />
              <button type="button" className="del-btn" onClick={() => removePreview(k)} title="Remove">
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <input
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            style={{ flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}
          />
          <button className="btn small secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload-cloud" size={14} /> Choose images
          </button>
          {previews.length > 0 && (
            <button className="btn small primary" onClick={upload} disabled={busy}>
              {busy ? 'Uploading\u2026' : `Upload ${previews.length > 1 ? `(${previews.length})` : ''}`}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={pickFiles} />
      </div>
    </div>
  );
}

function ManageMembersModal({ ministry, onClose, snackbar, reloadMinistries }) {
  const { user } = useAuth();
  const isWriter = ['admin'].includes(user?.role);
  const { data: list, reload } = useFetch(() => api.get(`/api/ministries/${ministry.id}/members`), [ministry.id]);
  const { data: members } = useFetch(() => api.get('/api/members').catch(() => []), []);
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState('Member');
  const [busy, setBusy] = useState(false);
  const roles = parseRoles(ministry);

  const inMinistry = new Set((list || []).map((m) => m.member_id));

  async function addMember(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/ministries/${ministry.id}/members`, { member_id: Number(memberId), role }, { entity: 'ministry', op: 'add_member' });
      snackbar('Member added', 'success');
      setMemberId('');
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(m, newRole) {
    try {
      await api.put(`/api/ministries/${ministry.id}/members/${m.member_id}`, { role: newRole }, { entity: 'ministry', op: 'update_member' });
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Failed', 'error');
    }
  }

  async function removeMember(m) {
    try {
      await api.del(`/api/ministries/${ministry.id}/members/${m.member_id}`, { entity: 'ministry', op: 'remove_member' });
      snackbar(`${m.full_name} removed`, 'success');
      reload().catch(() => {});
      reloadMinistries().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Failed', 'error');
    }
  }

  return (
    <Modal title={`Members \u2013 ${ministry.name}`} open={true} onClose={onClose}>
      {isWriter && (
        <form onSubmit={addMember} className="row wrap mb-16">
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required style={{ flex: 1, minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <option value="">Add member\u2026</option>
            {(members || []).filter((m) => !inMinistry.has(m.id)).map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="btn small primary" disabled={busy}>
            Add
          </button>
        </form>
      )}

      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty label="No members in this organisation." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.member_id}>
                  <td>{m.full_name}</td>
                  <td>
                    {isWriter ? (
                      <select value={m.ministry_role} onChange={(e) => changeRole(m, e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      m.ministry_role
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {isWriter && (
                        <button className="btn small danger" onClick={() => removeMember(m)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
