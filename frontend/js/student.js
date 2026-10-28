(() => {
  const { $, esc } = UI;
  const user = UI.guard('student');
  if (!user) return;

  let items = [];
  UI.fillSelect($('#category'), UI.CATEGORIES);
  UI.fillSelect($('#priority'), UI.PRIORITIES);
  $('#priority').value = 'Medium';
  UI.fillSelect($('#filter'), UI.STATUSES, 'All statuses');

  function render() {
    UI.renderStats($('#stats'), items);
    const f = $('#filter').value;
    const rows = items.filter((i) => !f || i.status === f);
    $('#list').innerHTML = rows.length
      ? rows.map((c) => `<tr data-id="${esc(c.complaintId)}">
          <td><strong>${esc(c.title)}</strong><div class="muted">${esc(c.category)}</div></td>
          <td>${UI.prio(c.priority)}</td><td>${UI.badge(c.status)}</td>
          <td class="muted">${esc(UI.fmt(c.createdAt))}</td></tr>`).join('')
      : `<tr><td colspan="4" class="empty">No complaints to show.</td></tr>`;
  }

  async function load() {
    try { items = await Api.list(); render(); } catch (e) { UI.toast(e.message, 'err'); }
  }

  $('#filter').addEventListener('change', render);
  $('#refresh').addEventListener('click', load);

  $('#list').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const c = items.find((i) => i.complaintId === tr.dataset.id);
    if (c) UI.openModal(UI.detailHtml(c, false));
  });

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true;
    try {
      await Api.create({
        title: $('#title').value, category: $('#category').value, priority: $('#priority').value,
        location: $('#location').value, description: $('#description').value,
      });
      e.target.reset(); $('#priority').value = 'Medium';
      UI.toast('Complaint submitted. You will be notified of status changes by email.');
      await load();
    } catch (err) { UI.toast(err.message, 'err'); } finally { btn.disabled = false; }
  });

  load();
})();
