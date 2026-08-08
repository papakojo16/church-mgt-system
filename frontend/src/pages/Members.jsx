import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Modal, Confirm, fmtDate, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// Minimum length enforced for any password set on a member account.
const MIN_PASSWORD_LENGTH = 8;

// Blank form shape shared by the add/edit modal; dates are kept as empty strings until submitted.
const EMPTY_MEMBER = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  role: 'member',
  gender: 'Male',
  address: '',
  date_of_birth: '',
  family_name: '',
  baptism_date: '',
  membership_date: '',
};

const ROLE_LABELS = {
  member: 'Member',
  finance: 'Finance Officer',
  pastor: 'Reverend',
  admin: 'Admin',
};

// Members page: searchable member directory with add/edit/view/delete and a detail popup.
export default function Members() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  // Role guards: admins alone may add/delete; edit is currently also admin-only.
  const isAdmin = user?.role === 'admin';
  const canEdit = ['admin'].includes(user?.role);

  const { data, loading, reload } = useFetch(() => api.get('/api/members'), []);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_MEMBER);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(false);

  const members = data || [];
  // Client-side filtering: match the search term against several fields at once.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setForm({ ...EMPTY_MEMBER });
    setEditing(null);
    setGenerated(false);
    setFormOpen(true);
  }

  // Pre-fill the form for editing; dates are reformatted to yyyy-mm-dd for the date inputs, and the password starts blank.
  function openEdit(m) {
    setForm({
      username: m.username || '',
      password: '',
      full_name: m.full_name || '',
      email: m.email || '',
      phone: m.phone || '',
      role: m.role || 'member',
      gender: m.gender || 'Male',
      address: m.address || '',
      date_of_birth: m.date_of_birth ? fmtDate(m.date_of_birth) : '',
      family_name: m.family_name || '',
      baptism_date: m.baptism_date ? fmtDate(m.baptism_date) : '',
      membership_date: m.membership_date ? fmtDate(m.membership_date) : '',
    });
    setEditing(m);
    setGenerated(false);
    setFormOpen(true);
  }

  // Generates a cryptographically random password (using crypto.getRandomValues) for staff accounts.
  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    const arr = new Uint8Array(14);
    crypto.getRandomValues(arr);
    let pwd = '';
    for (let i = 0; i < arr.length; i++) pwd += chars[arr[i] % chars.length];
    setForm((f) => ({ ...f, password: pwd }));
    setGenerated(true);
    snackbar('Random password generated. Staff must change it on first login.', 'info', 6000);
  }

  async function save(e) {
    e.preventDefault();
    if (form.password && form.password.length < MIN_PASSWORD_LENGTH) {
      snackbar(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'error');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        // On update the password is only sent when the admin typed a new one; otherwise the existing one is kept.
        const body = { ...form };
        delete body.password;
        if (!body.password) delete body.password;
        if (form.password) body.password = form.password;
        await api.put(`/api/members/${editing.id}`, body, { entity: 'member', op: 'update' });
        snackbar('Member updated', 'success');
      } else {
        // New members with a generated password are flagged so they must change it on first login.
        await api.post('/api/members', { ...form, must_change_password: generated }, { entity: 'member', op: 'create' });
        snackbar(generated ? 'Member created. They must set their own password on first login.' : 'Member created', 'success');
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
      await api.del(`/api/members/${deleting.id}`, { entity: 'member', op: 'delete' });
      snackbar('Member deleted', 'success');
      setDeleting(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  return (
    <div>
      <PageBanner
        title="Members"
        subtitle={`${members.length} members`}
        actions={
          isAdmin ? (
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={16} /> Add Member
            </button>
          ) : null
        }
      />

      <input
        className="search mb-16"
        style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}
        placeholder="Search members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty label="No members found." />
      ) : (
        <div className="table-wrap member-list-wrap">
          <table className="data member-list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td data-label="Name">
                    <b style={{ cursor: 'pointer' }} onClick={() => setViewing(m)}>
                      {m.full_name}
                    </b>
                  </td>
                  <td data-label="Username">{m.username}</td>
                  <td data-label="Email">{m.email}</td>
                  <td data-label="Phone">{m.phone}</td>
                  <td data-label="Role">
                    <span className="tag">{ROLE_LABELS[m.role] || m.role}</span>
                  </td>
                  <td data-label="Joined">{fmtDate(m.date_joined)}</td>
                  <td data-label="">
                    <div className="row-actions">
                      <button className="btn small secondary" onClick={() => setViewing(m)}>
                        View
                      </button>
                      {canEdit && (
                        <button className="btn small secondary" onClick={() => openEdit(m)}>
                          Edit
                        </button>
                      )}
                      {/* Admins can delete anyone except themselves to avoid locking the account out. */}
                      {isAdmin && m.id !== user.id && (
                        <button className="btn small danger" onClick={() => setDeleting(m)}>
                          Delete
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

      <Modal
        title={editing ? `Edit ${editing.full_name}` : 'Add Member'}
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
              <label>Full name</label>
              <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={form.username} onChange={(e) => set('username', e.target.value)} required disabled={!!editing} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Password {editing ? '(leave blank to keep)' : ''}</label>
              <div className="row" style={{ gap: 6 }}>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => {
                    set('password', e.target.value);
                    if (e.target.value !== form.password) setGenerated(false);
                  }}
                  required={!editing}
                  placeholder={editing ? '' : `Min ${MIN_PASSWORD_LENGTH} characters`}
                />
                {!editing && (
                  <button type="button" className="btn small secondary" onClick={generatePassword} title="Generate a random password">
                    Generate
                  </button>
                )}
              </div>
              {generated && (
                <p className="muted" style={{ fontSize: 12 }}>
                  Staff must change this password on first login.
                </p>
              )}
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                <option value="member">Member</option>
                <option value="finance">Finance Officer</option>
                <option value="pastor">Reverend</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="field">
              <label>Date of birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="form-row three">
            <div className="field">
              <label>Family name</label>
              <input value={form.family_name} onChange={(e) => set('family_name', e.target.value)} />
            </div>
            <div className="field">
              <label>Baptism date</label>
              <input type="date" value={form.baptism_date} onChange={(e) => set('baptism_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Membership date</label>
              <input type="date" value={form.membership_date} onChange={(e) => set('membership_date', e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal title="Member Profile" open={!!viewing} onClose={() => setViewing(null)}>
        {viewing && <MemberProfileView member={viewing} />}
      </Modal>

      {deleting && (
        <Confirm
          title="Delete Member"
          message={`Are you sure you want to delete "${deleting.full_name}"? This cannot be undone.`}
          onYes={confirmDelete}
          onNo={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// Read-only profile popup shown when a row is clicked; also loads the member's organisations.
function MemberProfileView({ member }) {
  const { data: ministries } = useFetch(() => api.get(`/api/ministries/user/${member.id}`).catch(() => []), [member.id]);
  const rows = [
    ['Username', member.username],
    ['Email', member.email],
    ['Phone', member.phone],
    ['Role', ROLE_LABELS[member.role] || member.role],
    ['Gender', member.gender],
    ['Date of birth', fmtDate(member.date_of_birth)],
    ['Family name', member.family_name],
    ['Baptism date', fmtDate(member.baptism_date)],
    ['Membership date', fmtDate(member.membership_date)],
    ['Address', member.address],
    ['Joined', fmtDate(member.date_joined)],
    ['Active', member.is_active ? 'Yes' : 'No'],
  ];
  return (
    <div>
      <div className="grid two">
        <div>
          <h3 style={{ marginBottom: 8 }}>{member.full_name}</h3>
          {rows.map(([k, v]) => (
            <p key={k} className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
              <b>{k}:</b> {v || '\u2014'}
            </p>
          ))}
        </div>
        <div>
          <h3 style={{ marginBottom: 8 }}>Organisations</h3>
          {ministries && ministries.length ? (
            ministries.map((m) => (
              <div key={m.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <b>{m.name}</b>
                <span className="tag">{m.ministry_role}</span>
              </div>
            ))
          ) : (
            <p className="muted">Not a member of any organisation.</p>
          )}
        </div>
      </div>
    </div>
  );
}
