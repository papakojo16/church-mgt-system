import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Confirm, fmtMoney, fmtDate, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

// Receipts page: lists donation receipts with on-screen preview and PDF download; only staff may remove them.
export default function Receipts() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isStaff = ['admin', 'finance'].includes(user?.role);

  const { data, loading, reload } = useFetch(() => api.get('/api/receipts'), []);
  const [deleting, setDeleting] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');

  async function confirmDelete() {
    try {
      await api.post(`/api/receipts/${deleting.id}/delete`, {}, { entity: 'donation', op: 'delete' });
      snackbar('Receipt removed from list', 'success');
      setDeleting(null);
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Delete failed', 'error');
    }
  }

  // Fetch the receipt's rendered HTML and show it in an iframe; a message is shown if offline.
  async function showPreview(r) {
    setPreview(r);
    setPreviewHtml('');
    try {
      // Uses fetch directly (not the api wrapper) so the raw HTML body can be read.
      const res = await fetch(`/api/receipts/${r.id}/html`, { headers: { Authorization: `Bearer ${localStorage.getItem('mtolivet_token')}` } });
      setPreviewHtml(await res.text());
    } catch {
      setPreviewHtml('<p>Could not load receipt preview while offline.</p>');
    }
  }

  // Download the receipt as a PDF by turning the response blob into a temporary object URL.
  async function openPdf(r) {
    try {
      const res = await fetch(`/api/receipts/${r.id}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('mtolivet_token')}` } });
      if (!res.ok) throw new Error('Could not load PDF');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${r.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke the temporary URL shortly after so the browser can free the blob.
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      snackbar(err.message || 'PDF download failed', 'error');
    }
  }

  const list = data || [];

  return (
    <div>
      <PageBanner title="Receipts" subtitle={`${list.length} donation receipts`} />
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty label="No receipts available." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Date</th>
                <th>Donor</th>
                <th>Category</th>
                <th>Method</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  {/* Receipt numbers are the id zero-padded to 6 digits. */}
                  <td>RCP-{String(r.id).padStart(6, '0')}</td>
                  <td>{fmtDate(r.donation_date)}</td>
                  <td>{r.donor_name}</td>
                  <td>{r.category}</td>
                  <td>{r.payment_method}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(r.amount)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn small secondary" onClick={() => showPreview(r)}>
                        View
                      </button>
                      <button className="btn small secondary" onClick={() => openPdf(r)}>
                        PDF
                      </button>
                      {isStaff && (
                        <button className="btn small danger" onClick={() => setDeleting(r)}>
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

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receipt RCP-{String(preview.id).padStart(6, '0')}</h3>
              <div className="row">
                <button className="btn small secondary" onClick={() => openPdf(preview)}>
                  Download PDF
                </button>
                <button className="icon-btn" onClick={() => setPreview(null)}>
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>
            <div className="table-wrap" style={{ maxHeight: '70vh', overflow: 'auto', border: 'none' }}>
              {previewHtml ? (
                <iframe title="receipt" srcDoc={previewHtml} style={{ width: '100%', height: '70vh', border: 'none' }} />
              ) : (
                <Loading />
              )}
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <Confirm title="Delete Receipt" message={`Remove receipt RCP-${String(deleting.id).padStart(6, '0')} from this list? (It will be hidden for the current user.)`} onYes={confirmDelete} onNo={() => setDeleting(null)} />
      )}
    </div>
  );
}
