import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Modal, Confirm, fmtDate, fmtEventWhen, toDate, timeValue, toInputValue, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Reads an image file and returns a resized JPEG data-URL to keep uploads small
// (mirrors the helper used by the logo/picture uploaders elsewhere in the app).
function resizeImage(file, maxSize = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
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

// Derive a display status for an event by comparing its start/end times against now;
// a one-off event turns "past" once 30 minutes after its end time have elapsed.
function eventStatus(e) {
  const start = toDate(e.event_date);
  if (!start) return null;
  const now = new Date();
  const end = toDate(e.end_date) || start;
  const pastAt = new Date(end.getTime() + 30 * 60000);

  if (e.is_recurring) {
    // Compare against the next occurrence: this week's slot, rolled to next week
    // once this week's has fully passed (plus the 30-min grace period).
    const dayIdx = WEEKDAYS.indexOf(e.recurrence_rule || e.day_of_week || '');
    if (dayIdx < 0) return 'upcoming';
    let diff = dayIdx - now.getDay();
    let occStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, start.getHours(), start.getMinutes());
    let occEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, end.getHours(), end.getMinutes());
    if (now > new Date(occEnd.getTime() + 30 * 60000)) {
      diff += 7;
      occStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, start.getHours(), start.getMinutes());
      occEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, end.getHours(), end.getMinutes());
    }
    if (now >= occStart) return 'started';
    return 'upcoming';
  }

  if (now > pastAt) return 'past';
  if (now >= start) return 'started';
  return 'upcoming';
}

// Small coloured pill showing an event's current status.
function StatusBadge({ status }) {
  if (!status) return null;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`event-status ${status}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

// Events page: lists events with date/time and status badges; admins can create/edit/delete events and record attendance.
export default function Events() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isWriter = ['admin'].includes(user?.role);

  const { data, loading, reload } = useFetch(() => api.get('/api/events'), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', end_date: '', location: '', image: '', is_recurring: false, day_of_week: 'Sunday', start_time: '', end_time: '' });
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setEditing(null);
    setForm({ title: '', description: '', event_date: '', end_date: '', location: '', image: '', is_recurring: false, day_of_week: 'Sunday', start_time: '', end_time: '' });
    setFormOpen(true);
  }

  function openEdit(e) {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description || '',
      event_date: toInputValue(toDate(e.event_date)),
      end_date: toInputValue(toDate(e.end_date)),
      location: e.location || '',
      image: e.image || '',
      is_recurring: !!e.is_recurring,
      day_of_week: e.recurrence_rule || e.day_of_week || 'Sunday',
      start_time: timeValue(toDate(e.event_date)),
      end_time: timeValue(toDate(e.end_date)),
    });
    setFormOpen(true);
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
      // Recurring events carry their schedule as weekday + times; one-off events
      // carry full datetimes (optionally an end date for multi-day events).
      const body = { title: form.title, description: form.description, location: form.location, is_recurring: form.is_recurring, image: form.image };
      if (form.is_recurring) {
        body.day_of_week = form.day_of_week;
        if (form.start_time) body.start_time = form.start_time;
        if (form.end_time) body.end_time = form.end_time;
      } else {
        if (form.event_date) body.event_date = form.event_date;
        if (form.end_date) body.end_date = form.end_date;
      }
      if (editing) {
        await api.put(`/api/events/${editing.id}`, body, { entity: 'event', op: 'update' });
        snackbar('Event updated', 'success');
      } else {
        await api.post('/api/events', body, { entity: 'event', op: 'create' });
        snackbar('Event created', 'success');
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
      await api.del(`/api/events/${deleting.id}`, { entity: 'event', op: 'delete' });
      snackbar('Event deleted', 'success');
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
        title="Events"
        subtitle={`${list.length} events`}
        actions={
          isWriter ? (
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={16} /> New Event
            </button>
          ) : null
        }
      />

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty label="No events scheduled." />
      ) : (
        <div className="grid two">
          {list.map((e) => (
            <div className="card" key={e.id}>
              {e.image && <img className="ev-flier" src={e.image} alt={`${e.title} flier`} />}
              <div className="row between">
                <h3 style={{ marginBottom: 0 }}>{e.title}</h3>
                <StatusBadge status={eventStatus(e)} />
              </div>
              <p className="muted mt-8">
                {fmtEventWhen(e)}
                {e.location ? ` \u2022 ${e.location}` : ''}
                {e.is_recurring ? ' \u2022 Recurring' : ''}
              </p>
              {e.description && <p className="muted mt-8">{e.description}</p>}
              <div className="row mt-16">
                {isWriter && (
                  <>
                    <button className="btn small secondary" onClick={() => openEdit(e)}>
                      Edit
                    </button>
                    <button className="btn small secondary" onClick={() => setAttendanceFor(e)}>
                      Attendance
                    </button>
                    <button className="btn small danger" onClick={() => setDeleting(e)}>
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
        title={editing ? 'Edit Event' : 'New Event'}
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
            <label>Title</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.is_recurring} onChange={(e) => set('is_recurring', e.target.checked)} id="recur" />
              <label htmlFor="recur" style={{ color: 'var(--text)' }}>Recurring event</label>
            </div>
          </div>

          {form.is_recurring ? (
            <div className="form-row three">
              <div className="field">
                <label>Day of week</label>
                <select value={form.day_of_week} onChange={(e) => set('day_of_week', e.target.value)}>
                  {WEEKDAYS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Start time</label>
                <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
              </div>
              <div className="field">
                <label>End time</label>
                <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="field">
                <label>Start date &amp; time</label>
                <input type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} required />
              </div>
              <div className="field">
                <label>End date &amp; time (multi-day)</label>
                <input type="datetime-local" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </div>
            </div>
          )}

          <div className="field">
            <label>Location</label>
            <input value={form.location} onChange={(e) => set('location', e.target.value)} />
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

      {attendanceFor && <AttendanceModal event={attendanceFor} onClose={() => setAttendanceFor(null)} snackbar={snackbar} />}

      {deleting && (
        <Confirm title="Delete Event" message={`Delete "${deleting.title}"?`} onYes={confirmDelete} onNo={() => setDeleting(null)} />
      )}
    </div>
  );
}

// Popup for recording a single member's attendance for the selected event.
function AttendanceModal({ event, onClose, snackbar }) {
  const { data: members } = useFetch(() => api.get('/api/members').catch(() => []), []);
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState('Present');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // Link the attendance to the event date, falling back to today if the event has no date (e.g. recurring).
      await api.post(`/api/events/${event.id}/attendance`, { member_id: Number(memberId), status, service_date: fmtDate(event.event_date) || new Date().toISOString().slice(0, 10) });
      snackbar('Attendance recorded', 'success');
      setMemberId('');
    } catch (err) {
      snackbar(err.message || 'Failed to record', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Attendance \u2013 ${event.title}`} open={true} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Member</label>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
            <option value="">Select member…</option>
            {(members || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Present</option>
            <option>Absent</option>
            <option>Excused</option>
          </select>
        </div>
        <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Saving\u2026' : 'Record Attendance'}
        </button>
      </form>
    </Modal>
  );
}
