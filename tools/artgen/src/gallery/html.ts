import type { Manifest } from '../manifest.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

export interface GalleryOptions {
  /** Maps a repo-relative file to an <img> src (a server URL or a data URI). */
  src: (file: string) => string;
  /** Read-only galleries (static exports) hide the review buttons. */
  interactive: boolean;
}

const STYLE = `
body{margin:0;padding:24px;background:#2a2433;color:#e8e0d5;font:14px/1.4 ui-monospace,monospace}
h1{font-size:18px;margin:0 0 16px}h2{font-size:15px;margin:24px 0 4px}
.meta{color:#bdb3b8;font-size:12px;margin:0 0 8px;max-width:960px}
.grid{display:flex;flex-wrap:wrap;gap:12px}
figure{margin:0;padding:8px;background:#3b3245;border:2px solid #1e1a26;width:256px}
figure.approved{border-color:#a3c25e}figure.rejected{opacity:.45}
img{display:block;width:256px;height:256px;image-rendering:pixelated;
 background:repeating-conic-gradient(#efe7dc 0 25%,#fbf6ee 0 50%) 0 0/32px 32px}
figcaption{display:flex;gap:6px;align-items:center;margin-top:6px}
button{font:inherit;background:#5e5463;color:#fff8ec;border:2px solid #1e1a26;padding:2px 8px;cursor:pointer}
button[data-r=approved]{background:#3e6b3a}button[data-r=rejected]{background:#a8344a}
input{font:inherit;flex:1;min-width:0;background:#1e1a26;color:#e8e0d5;border:1px solid #5e5463}`;

const SCRIPT = `
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('button[data-r]'); if (!b) return;
  const fig = b.closest('figure');
  const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryId: fig.dataset.entry, index: Number(fig.dataset.index),
      review: b.dataset.r, note: fig.querySelector('input').value }) });
  if (res.ok) fig.className = b.dataset.r; else alert(await res.text());
});`;

export function galleryHtml(manifest: Manifest, opts: GalleryOptions): string {
  const sections = manifest.entries
    .filter((e) => e.status === 'completed')
    .map((e) => {
      const p = e.params;
      const desc = typeof p.description === 'string' ? p.description : '';
      const figures = e.outputs
        .map((o) => {
          const buttons = opts.interactive
            ? `<button data-r="approved">✓</button><button data-r="rejected">✗</button>
               <button data-r="pending">·</button><input value="${esc(o.note ?? '')}" placeholder="note">`
            : `<span>${o.review}${o.note ? ` — ${esc(o.note)}` : ''}</span>`;
          return `<figure class="${o.review}" data-entry="${esc(e.id)}" data-index="${String(o.index)}">
            <img src="${esc(opts.src(o.file))}" alt="${esc(e.id)} #${String(o.index)}">
            <figcaption><b>#${String(o.index)}</b>${buttons}</figcaption></figure>`;
        })
        .join('\n');
      return `<section><h2>${esc(e.id)}${e.cardId ? ` · ${esc(e.cardId)}` : ''}</h2>
        <p class="meta">/${esc(e.endpoint)} · seed ${String(e.seed)} · ${String(e.cost.generations)} gen · ${esc(desc)}</p>
        <div class="grid">${figures}</div></section>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>artgen review</title><style>${STYLE}</style></head><body>
<h1>artgen review gallery</h1>${sections}
${opts.interactive ? `<script>${SCRIPT}</script>` : ''}</body></html>`;
}
