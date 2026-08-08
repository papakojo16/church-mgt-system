import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Modal, Confirm, fmtMoney, fmtDate, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// Fixed category lists used by the forms and also exported for reuse (e.g. reports).
export const DONATION_CATEGORIES = ['Tithe', 'Offering', 'MDF', 'Appeals', 'Donations', 'Harvest', 'Pledge', 'Project Fund', 'Grace Box', 'Other'];
// Only these categories are attributed to a specific member; everything else is a church-wide collection.
export const INDIVIDUAL_CATEGORIES = ['Tithe', 'Donations', 'Pledge'];
export const EXPENSE_CATEGORIES = ['Utilities', 'Salaries', 'Repairs', 'Transport', 'Food', 'Supplies', 'Rent', 'Outreach', 'Other'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Finances page: tabs for Donations, Expenses and a Summary, each rendered by its own component.
export default function Finances() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const [tab, setTab] = useState('donations');
  // Role guards: only finance roles may edit records; reading is also allowed for pastors.
  const isFin = ['admin', 'finance'].includes(user?.role);
  const isReader = ['admin', 'finance', 'pastor'].includes(user?.role);

  return (
    <div>
      <PageBanner title="Finances" subtitle="Manage donations, expenses and reports" />
      <div className="tabs">
        <button className={tab === 'donations' ? 'active' : ''} onClick={() => setTab('donations')}>
          Donations
        </button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
          Expenses
        </button>
        <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
          Summary
        </button>
      </div>

      {tab === 'donations' && <DonationsTab isFin={isFin} isReader={isReader} snackbar={snackbar} />}
      {tab === 'expenses' && <ExpensesTab isFin={isFin} isReader={isReader} snackbar={snackbar} />}
      {tab === 'summary' && <SummaryTab isReader={isReader} snackbar={snackbar} />}
    </div>
  );
}

// Donations tab: date-filterable list of donations plus a record form.
function DonationsTab({ isFin, isReader, snackbar }) {
  const { data: members } = useFetch(() => api.get('/api/members').catch(() => []), []);
  const { data, loading, reload } = useFetch(() => api.get('/api/donations'), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ member_id: '', amount: '', category: 'Tithe', payment_method: 'Cash', reference: '', notes: '', donation_date: '' });
  const [busy, setBusy] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter the table to the chosen date range; compares formatted dates as yyyy-mm-dd strings so ordering is lexicographic.
  const rows = useMemo(() => {
    let list = data || [];
    if (startDate) list = list.filter((d) => fmtDate(d.donation_date) >= startDate);
    if (endDate) list = list.filter((d) => fmtDate(d.donation_date) <= endDate);
    return list;
  }, [data, startDate, endDate]);

  function set(k, v) {
    // When the category becomes a church-wide one, drop any previously chosen member so no donor is recorded.
    if (k === 'category' && !INDIVIDUAL_CATEGORIES.includes(v)) {
      setForm((f) => ({ ...f, [k]: v, member_id: '' }));
      return;
    }
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isIndividual = INDIVIDUAL_CATEGORIES.includes(form.category);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form };
      // Church-wide donations are stored without a member reference.
      if (!isIndividual) body.member_id = null;
      await api.post('/api/donations', body, { entity: 'donation', op: 'create' });
      snackbar('Donation recorded', 'success');
      setFormOpen(false);
      setForm({ member_id: '', amount: '', category: 'Tithe', payment_method: 'Cash', reference: '', notes: '', donation_date: '' });
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const total = rows.reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <div>
      <div className="row between wrap mb-16">
        <div className="row wrap">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
        </div>
        <div className="row">
          <b>Total: {fmtMoney(total)}</b>
          {isFin && (
            <button className="btn primary" onClick={() => setFormOpen(true)}>
              <Icon name="plus" size={16} /> Record Donation
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty label="No donations recorded." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Category</th>
                <th>Method</th>
                <th>Reference</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{fmtDate(d.donation_date)}</td>
                  <td>{d.donor_name || 'All Members'}</td>
                  <td>{d.category}</td>
                  <td>{d.payment_method}</td>
                  <td>{d.reference}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        title="Record Donation"
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
          {isIndividual ? (
            <div className="field">
              <label>Member</label>
              <select value={form.member_id} onChange={(e) => set('member_id', e.target.value)} required>
                <option value="">Select member\u2026</option>
                {(members || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              This donation is for <b>All Members</b> (church-wide collection).
            </p>
          )}
          <div className="form-row">
            <div className="field">
              <label>Amount</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {DONATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Payment method</label>
              <select value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
                <option>Cash</option>
                <option>Momo</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
              </select>
            </div>
            <div className="field">
              <label>Reference</label>
              <input value={form.reference} onChange={(e) => set('reference', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Donation date</label>
            <input type="date" value={form.donation_date} onChange={(e) => set('donation_date', e.target.value)} />
          </div>
          <div className="field">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Expenses tab: list of recorded expenses with add/edit/delete (finance roles only).
function ExpensesTab({ isFin, isReader, snackbar }) {
  const { data, loading, reload } = useFetch(() => api.get('/api/expenses'), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ amount: '', category: 'Utilities', description: '', expense_date: '' });
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setEditing(null);
    setForm({ amount: '', category: 'Utilities', description: '', expense_date: '' });
    setFormOpen(true);
  }

  function openEdit(e) {
    setEditing(e);
    setForm({
      amount: e.amount,
      category: e.category,
      description: e.description || '',
      expense_date: e.expense_date ? fmtDate(e.expense_date) : '',
    });
    setFormOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/api/expenses/${editing.id}`, form, { entity: 'expense', op: 'update' });
        snackbar('Expense updated', 'success');
      } else {
        await api.post('/api/expenses', form, { entity: 'expense', op: 'create' });
        snackbar('Expense recorded', 'success');
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
      await api.del(`/api/expenses/${deleting.id}`, { entity: 'expense', op: 'delete' });
      snackbar('Expense deleted', 'success');
      setDeleting(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  const total = (data || []).reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div>
      <div className="row between mb-16">
        <b>Total: {fmtMoney(total)}</b>
        {isFin && (
          <button className="btn primary" onClick={openAdd}>
            <Icon name="plus" size={16} /> Record Expense
          </button>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <Empty label="No expenses recorded." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Approved by</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.expense_date)}</td>
                  <td>{e.category}</td>
                  <td>{e.description}</td>
                  <td>{e.approved_by_name || '\u2014'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(e.amount)}</td>
                  <td>
                    <div className="row-actions">
                      {isFin && (
                        <button className="btn small secondary" onClick={() => openEdit(e)}>
                          Edit
                        </button>
                      )}
                      {isFin && (
                        <button className="btn small danger" onClick={() => setDeleting(e)}>
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
        title={editing ? 'Edit Expense' : 'Record Expense'}
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
              <label>Amount</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="field">
            <label>Expense date</label>
            <input type="date" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} />
          </div>
        </form>
      </Modal>

      {deleting && (
        <Confirm title="Delete Expense" message={`Delete expense of ${fmtMoney(deleting.amount)}?`} onYes={confirmDelete} onNo={() => setDeleting(null)} />
      )}
    </div>
  );
}

// Summary tab: totals and per-category breakdowns, a yearly/monthly report table, and an admin-only bulk delete.
function SummaryTab({ isReader, snackbar }) {
  const { user } = useAuth();
  const { data: summary } = useFetch(() => api.get('/api/financial-summary'), []);
  const { data: report, reload } = useFetch(() => api.get('/api/monthly-report'), []);
  const year = new Date().getFullYear();
  const [yearVal, setYearVal] = useState(year);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function loadReport() {
    const res = await api.get(`/api/monthly-report?year=${yearVal}`);
    return res;
  }
  // Reloads the monthly report whenever the selected year changes.
  const reportByYear = useFetch(() => loadReport(), [yearVal]);

  async function deleteYear() {
    try {
      const res = await api.del(`/api/donations/period?period=yearly&year=${yearVal}`);
      snackbar(`Deleted ${res.deleted} donations for ${yearVal}`, 'success');
      setConfirmOpen(false);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  const inc = summary || {};
  const rep = reportByYear.data || report || {};
  const monthly = rep.monthly_income || [];

  return (
    <div>
      <div className="grid stats mb-16">
        <div className="stat-card">
          <div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{fmtMoney(inc.total_income)}</div>
            <div className="stat-label">Total Income</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{fmtMoney(inc.total_expenses)}</div>
            <div className="stat-label">Total Expenses</div>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-value">{fmtMoney(inc.balance)}</div>
            <div className="stat-label">Balance</div>
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Income by Category</h3>
          {inc.income_by_category && inc.income_by_category.length ? (
            inc.income_by_category.map((c) => (
              <div key={c.category} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{c.category}</span>
                <b>{fmtMoney(c.total)}</b>
              </div>
            ))
          ) : (
            <Empty label="No income yet." />
          )}
        </div>
        <div className="card">
          <h3>Expenses by Category</h3>
          {inc.expenses_by_category && inc.expenses_by_category.length ? (
            inc.expenses_by_category.map((c) => (
              <div key={c.category} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{c.category}</span>
                <b>{fmtMoney(c.total)}</b>
              </div>
            ))
          ) : (
            <Empty label="No expenses yet." />
          )}
        </div>
      </div>

      <div className="card mt-16">
        <div className="row between mb-16">
          <h3>Monthly Report {yearVal}</h3>
          <div className="row">
            <input type="number" value={yearVal} onChange={(e) => setYearVal(e.target.value)} style={{ width: 90, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }} />
            <button className="btn small secondary" onClick={loadReport}>
              View
            </button>
            {/* Permanently deleting a year of donations is restricted to admins. */}
            {isReader && user?.role === 'admin' && (
              <button className="btn small danger" onClick={() => setConfirmOpen(true)}>
                Delete {yearVal} donations
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Income</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, idx) => {
                // Look up each month (API returns 1-12) and default to zero when no data exists for it.
                const incRow = (monthly.find((r) => Number(r.m) === idx + 1) || {}).total || 0;
                const expRow = ((rep.monthly_expenses || []).find((r) => Number(r.m) === idx + 1) || {}).total || 0;
                return (
                  <tr key={m}>
                    <td>{m}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(incRow)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(expRow)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(incRow - expRow)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && (
        <Confirm
          title="Delete Donations"
          message={`This will permanently delete ALL donations recorded in ${yearVal}. Continue?`}
          onYes={deleteYear}
          onNo={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
