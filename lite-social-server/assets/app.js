document.addEventListener('DOMContentLoaded', () => {
  const profile = document.querySelector('.profile');
  document.addEventListener('click', e => { if (profile?.open && !profile.contains(e.target)) profile.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && profile?.open) profile.open = false; });

  document.querySelectorAll('.comment-form').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    const input = form.elements.text;
    const button = form.querySelector('button');
    const text = input.value.trim();
    if (!text) return;
    button.disabled = true;
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('No se pudo publicar el comentario.');
      const comment = await response.json();
      const item = document.createElement('div'); item.className = 'comment';
      const author = document.createElement('b'); author.textContent = comment.User;
      item.append(author, document.createTextNode(comment.Text));
      const comments = form.closest('.comments');
      comments.querySelector('.comment-list').append(item);
      const count = comments.querySelector('.comments-count');
      if (count) count.textContent = `Comentarios (${comments.querySelectorAll('.comment').length})`;
      input.value = '';
    } catch (err) { alert(err.message); }
    finally { button.disabled = false; }
  }));

  document.querySelectorAll('.reaction-form').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button');
    const count = button.querySelector('em');
    button.disabled = true;
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('No se pudo guardar la reacción.');
      const result = await response.json();
      count.textContent = result.count;
      button.classList.add('reaction-pulse');
      window.setTimeout(() => button.classList.remove('reaction-pulse'), 450);
    } catch (err) { alert(err.message); }
    finally { button.disabled = false; }
  }));

  const search = document.querySelector('#post-search');
  const filter = document.querySelector('#post-filter');
  const empty = document.querySelector('#empty-state');
  function applyFilters() {
    const q = (search?.value || '').trim().toLocaleLowerCase(); let shown = 0;
    document.querySelectorAll('.post[data-kind]').forEach(post => {
      const visible = post.dataset.search.includes(q) && (filter?.value === 'all' || filter?.value === post.dataset.kind);
      post.hidden = !visible; if (visible) shown++;
    });
    if (empty) empty.hidden = shown !== 0;
  }
  search?.addEventListener('input', applyFilters); filter?.addEventListener('change', applyFilters);

  const dialog = document.querySelector('#edit-dialog');
  document.querySelectorAll('.edit-open').forEach(button => button.addEventListener('click', () => {
    const form = dialog.querySelector('form'); form.elements.id.value = button.dataset.id; form.elements.caption.value = button.dataset.caption || ''; dialog.showModal();
  }));
  dialog?.querySelector('.dialog-cancel')?.addEventListener('click', () => dialog.close());
  document.addEventListener('error', e => { if (e.target instanceof HTMLVideoElement) { const note = e.target.nextElementSibling; if (note) note.hidden = false; } }, true);
});
