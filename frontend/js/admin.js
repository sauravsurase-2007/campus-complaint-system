(() => {
  const { $, esc } = UI;
  const user = UI.guard('admin');
  if (!user) return;

  let items = [];
  UI.fillSelect($('#fStatus'), UI.STATUSES, 'All statuses');
  UI.fillSelect($('#fCategory'), UI.CATEGORIES, 'All categories');

  function filtered() {
    const s = $('#fStatus').value, c = $('#fCategory').value, q = $('#fSearch').value.trim().toLowerCase();
    return items.filter((i) =>
      (!s || i.status === s) && (!c || i.category === c) &&
      (!q || [i.title, i.description, i.userName, i.userEmail, i.complaintId].some((v) => String(v).toLowerCase().includes(q))));
  }

  function render() {
    UI.renderStats($('#stats'), items);
    const rows = filtered();
    $('#list').innerHTML = rows.length
      ? rows.map((c) => `<tr data-id="${esc(c.complaintId)}">
          <td><strong>${esc(c.title)}</strong><div class="muted">${esc(c.category)} &middot; ${esc(c.complaintId.slice(0, 8))}</div></td>
          <td>${esc(c.userName)}<div class="muted">${esc(c.userEmail)}</div></td>
          <td>${UI.prio(c.priority)}</td><td>${UI.badge(c.status)}</td>
          <td class="muted">${esc(UI.fmt(c.createdAt))}</td></tr>`).join('')
      : `<tr><td colspan="5" class="empty">No complaints match your filters.</td></tr>`;
  }

  async function load() {
    try { items = await Api.list(); render(); } catch (e) { UI.toast(e.message, 'err'); }
  }

  ['fStatus', 'fCategory'].forEach((id) => $('#' + id).addEventListener('change', render));
  $('#fSearch').addEventListener('input', render);
  $('#refresh').addEventListener('click', load);

  $('#list').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const c = items.find((i) => i.complaintId === tr.dataset.id);
    if (!c) return;
    const body = UI.openModal(UI.detailHtml(c, true) + `
      <h3>Manage complaint</h3>
      <form id="manage" class="stack">
        <label>Status<select id="mStatus">${UI.STATUSES.map((s) => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label>Admin remark (visible to the student)<textarea id="mRemark" rows="3" maxlength="1000">${esc(c.adminRemark)}</textarea></label>
        <button class="btn" type="submit">Save &amp; notify student</button>
      </form>`);
    $('#manage', body).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = ev.submitter; btn.disabled = true;
      try {
        const updated = await Api.update(c.complaintId, { status: $('#mStatus').value, adminRemark: $('#mRemark').value });
        items = items.map((i) => (i.complaintId === updated.complaintId ? updated : i));
        render(); UI.closeModal(); UI.toast('Complaint updated and student notified.');
      } catch (err) { UI.toast(err.message, 'err'); btn.disabled = false; }
    });
  });

  load();
})();
