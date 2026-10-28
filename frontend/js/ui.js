window.UI = (() => {
  const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
  const CATEGORIES = ['Hostel', 'Academic', 'Library', 'Canteen', 'Transport', 'Infrastructure', 'IT / Network', 'Sanitation', 'Security', 'Other'];
  const PRIORITIES = ['Low', 'Medium', 'High'];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
  const badge = (s) => `<span class="badge ${slug(s)}">${esc(s)}</span>`;
  const prio = (p) => `<span class="prio ${slug(p)}">${esc(p)}</span>`;
  const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const $ = (sel, root = document) => root.querySelector(sel);

  function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function fillSelect(sel, values, allLabel) {
    sel.innerHTML = (allLabel ? `<option value="">${esc(allLabel)}</option>` : '') + values.map((v) => `<option>${esc(v)}</option>`).join('');
  }

  function renderStats(el, items) {
    const count = (s) => items.filter((i) => i.status === s).length;
    const cards = [['Total', items.length, 'total'], ...STATUSES.map((s) => [s, count(s), slug(s)])];
    el.innerHTML = cards.map(([label, n, cls]) => `<div class="stat ${cls}"><div class="n">${n}</div><div class="l">${esc(label)}</div></div>`).join('');
  }

  function openModal(html) {
    const m = $('#modal');
    $('#modalBody').innerHTML = html;
    m.classList.remove('hidden');
    return $('#modalBody');
  }
  function closeModal() { $('#modal').classList.add('hidden'); }

  function detailHtml(c, showStudent) {
    const hist = (c.history || []).slice().reverse().map((h) =>
      `<li>${badge(h.status)} <span class="muted">${esc(fmt(h.at))} &middot; ${esc(h.by)}</span>${h.remark ? `<div>${esc(h.remark)}</div>` : ''}</li>`).join('');
    return `
      <div class="modal-head"><h2>${esc(c.title)}</h2><button class="icon" data-close aria-label="Close">&times;</button></div>
      <div class="meta">${badge(c.status)} ${prio(c.priority)} <span class="chip">${esc(c.category)}</span>${c.location ? `<span class="chip">&#128205; ${esc(c.location)}</span>` : ''}</div>
      ${showStudent ? `<p class="muted">Submitted by <strong>${esc(c.userName)}</strong> (${esc(c.userEmail)})</p>` : ''}
      <p class="desc">${esc(c.description)}</p>
      <p class="muted">ID ${esc(c.complaintId)}<br>Submitted ${esc(fmt(c.createdAt))} &middot; Updated ${esc(fmt(c.updatedAt))}</p>
      <div class="remark"><strong>Admin remark</strong><div>${c.adminRemark ? esc(c.adminRemark) : '<span class="muted">No remark yet.</span>'}</div></div>
      <h3>History</h3><ul class="timeline">${hist}</ul>`;
  }

  // Front-end guard for UX only - the real enforcement is in API Gateway + Lambda.
  function guard(role) {
    const u = Auth.user();
    if (!u) { location.replace('index.html'); return null; }
    if (u.role !== role) { location.replace(Auth.home(u)); return null; }
    $('#userName').textContent = `${u.name} (${u.role})`;
    $('#logout').addEventListener('click', Auth.logout);
    document.addEventListener('click', (e) => { if (e.target.matches('[data-close]') || e.target.id === 'modal') closeModal(); });
    return u;
  }

  return { STATUSES, CATEGORIES, PRIORITIES, esc, badge, prio, fmt, $, toast, fillSelect, renderStats, openModal, closeModal, detailHtml, guard };
})();
