import React from 'react';
import { useNavigate } from 'react-router-dom';
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
export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="privacy-page container">
      <button className="auth-link mb-16" onClick={() => navigate(-1)}>
        &larr; Back
      </button>
      <div className="privacy-content">{renderMarkdown(policyText)}</div>
    </div>
  );
}
