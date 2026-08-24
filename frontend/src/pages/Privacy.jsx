import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Modal, useSnackbar } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';
import { api } from '../api/client.js';
import policyText from '../../../PRIVACY.md?raw';

// Tiny Markdown subset renderer (headings, lists, bold, links, paragraphs) so the
// privacy policy can live in a single source file (PRIVACY.md) and be rendered here.
function renderInline(text) {
  // Support **bold** and [label](url) inline.
  const parts = [];
  const regex = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else parts.push(<a key={m.index} href={m[4]} target="_blank" rel="noreferrer">{m[3]}</a>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={key++}>{line.slice(4)}</h3>);
      i += 1;
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={key++}>{line.slice(3)}</h2>);
      i += 1;
    } else if (line.startsWith('# ')) {
      blocks.push(<h1 key={key++}>{line.slice(2)}</h1>);
      i += 1;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={items.length}>{renderInline(lines[i].slice(2))}</li>);
        i += 1;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
    } else {
      // Paragraph: gather consecutive non-empty, non-special lines.
      const para = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('- ') && !lines[i].startsWith('* ')) {
        para.push(lines[i]);
        i += 1;
      }
      blocks.push(<p key={key++}>{renderInline(para.join(' '))}</p>);
    }
  }
  return blocks;
}

// Public privacy-policy page. No auth required so visitors can read it before registering.
// Admins additionally get an "update" icon to edit the policy, which is stored server-side
// (falling back to the bundled PRIVACY.md when nothing has been customized yet).
export default function Privacy() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isAdmin = user?.role === 'admin';

  const [text, setText] = useState(policyText);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  // Load any admin-customized policy; keep the bundled copy as the initial/fallback value.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/privacy')
      .then((data) => {
        if (!cancelled && data && data.content) setText(data.content);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function openEditor() {
    setDraft(text);
    setEditing(true);
  }

  // One-click reset: overwrite any stored value (e.g. a stray test edit) with
  // the bundled PRIVACY.md so the page shows the real policy again.
  async function restoreDefault() {
    setBusy(true);
    try {
      await api.put('/api/privacy', { content: policyText }, { queue: false });
      setText(policyText);
      setEditing(false);
      snackbar('Privacy policy restored to default', 'success');
    } catch (e) {
      snackbar('Failed to restore privacy policy', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api.put('/api/privacy', { content: draft }, { queue: false });
      setText(draft);
      setEditing(false);
      snackbar('Privacy policy updated', 'success');
    } catch (e) {
      snackbar('Failed to update privacy policy', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="privacy-page container">
      <div className="privacy-header">
        <button className="auth-link" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
        {isAdmin && (
          <button className="icon-btn" title="Update privacy policy" onClick={openEditor}>
            <Icon name="edit-2" size={18} />
          </button>
        )}
      </div>
      <div className="privacy-content">{renderMarkdown(text)}</div>

      <Modal
        title="Update Privacy Policy"
        open={editing}
        onClose={() => setEditing(false)}
        footer={
          <>
            <button className="btn secondary" onClick={restoreDefault} disabled={busy} title="Replace with the policy from PRIVACY.md">
              Restore default
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <textarea
          className="privacy-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={20}
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Markdown supported: # headings, **bold**, - lists, [links](url).
        </p>
      </Modal>
    </div>
  );
}
