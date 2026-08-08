import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, fmtMoney, fmtDate, Loading, Empty, PageBanner, Modal, Confirm } from '../ui/Shared.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Reports page: financial report for a chosen year/period, donor summary modal, and an admin-only period delete.
export default function Reports() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isReader = ['admin', 'finance', 'pastor'].includes(user?.role);
  const year = new Date().getFullYear();
  // Report filters: year, period (yearly/monthly/all), and month when monthly is selected.
  const [yearVal, setYearVal] = useState(year);
  const [period, setPeriod] = useState('yearly');
  const [monthVal, setMonthVal] = useState('1');
  const [donorModal, setDonorModal] = useState(false);
  const [donors, setDonors] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: report, loading, reload } = useFetch(() => api.get(`/api/monthly-report?year=${yearVal}`), [yearVal]);

  const rep = report || {};

  // Open the donor summary modal; the month parameter is only included for a monthly period.
  async function loadDonors() {
    setDonorModal(true);
    setDonors(null);
    const params = new URLSearchParams({ period });
    params.set('year', yearVal);
    if (period === 'monthly') params.set('month', monthVal);
    const res = await api.get(`/api/donors-summary?${params.toString()}`);
    setDonors(res);
  }

  async function confirmDelete() {
    try {
      const params = new URLSearchParams({ period });
      params.set('year', yearVal);
      if (period === 'monthly') params.set('month', monthVal);
      const res = await api.del(`/api/donations/period?${params.toString()}`);
      snackbar(`Deleted ${res.deleted} donations`, 'success');
      setDeleteConfirm(false);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  const periodLabel = period === 'monthly' ? `${MONTHS[Number(monthVal) - 1]} ${yearVal}` : period === 'yearly' ? `${yearVal}` : 'all time';

  return (
    <div className="reports">
      <PageBanner title="Reports" subtitle="Monthly financial report and donor summaries" />

      <div className="row between wrap mb-16">
        <div className="row wrap">
          <input type="number" value={yearVal} onChange={(e) => setYearVal(e.target.value)} style={{ width: 100, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <option value="yearly">Yearly</option>
            <option value="monthly">Monthly</option>
            <option value="all">All time</option>
          </select>
          {period === 'monthly' && (
            <select value={monthVal} onChange={(e) => setMonthVal(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="row">
          <button className="btn secondary" onClick={loadDonors}>
            Donor Summary
          </button>
          {/* Deleting donations in bulk is restricted to admins. */}
          {user?.role === 'admin' && (
            <button className="btn danger" onClick={() => setDeleteConfirm(true)}>
              Delete Period
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="grid two mb-16">
            <div className="card">
              <h3>Monthly Report</h3>
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
                      // Match each month row to its API data (months are 1-12) and default to zero when absent.
                      const inc = ((rep.monthly_income || []).find((r) => Number(r.m) === idx + 1) || {}).total || 0;
                      const exp = ((rep.monthly_expenses || []).find((r) => Number(r.m) === idx + 1) || {}).total || 0;
                      return (
                        <tr key={m}>
                          <td>{m}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(inc)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(exp)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(inc - exp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="card mb-16">
                <h3>Income by Category</h3>
                {rep.income_by_category && rep.income_by_category.length ? (
                  rep.income_by_category.map((c) => (
                    <div key={c.category} className="row between" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{c.category}</span>
                      <b>{fmtMoney(c.total)}</b>
                    </div>
                  ))
                ) : (
                  <Empty label="No income." />
                )}
              </div>
              <div className="card">
                <h3>Top Donors</h3>
                {rep.top_donors && rep.top_donors.length ? (
                  rep.top_donors.map((d, i) => (
                    <div key={i} className="row between" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>
                        {i + 1}. {d.full_name}
                      </span>
                      <b>{fmtMoney(d.total)}</b>
                    </div>
                  ))
                ) : (
                  <Empty label="No donors." />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Modal title={`Donor Summary \u2013 ${periodLabel}`} open={donorModal} onClose={() => setDonorModal(false)}>
        {!donors ? (
          <Loading />
        ) : donors.length === 0 ? (
          <Empty label="No donations in this period." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((d) => (
                  <tr key={d.member_id}>
                    <td>{d.full_name}</td>
                    <td style={{ textAlign: 'right' }}>{d.donation_count}</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(d.total_amount)}</td>
                    <td>{fmtDate(d.last_donation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {deleteConfirm && (
        <Confirm
          title="Delete Donations"
          message={`Permanently delete ALL donations for ${periodLabel}? This cannot be undone.`}
          onYes={confirmDelete}
          onNo={() => setDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
