document.addEventListener('DOMContentLoaded', () => {
  const posts = document.querySelector('#admin-posts'), users = document.querySelector('#admin-users'), search = document.querySelector('#admin-search');
  let latest = [];
  function renderPosts() {
    const q = (search?.value || '').trim().toLocaleLowerCase(); posts.replaceChildren();
    const shown = latest.filter(p => `${p.Author} ${p.Caption} ${p.File}`.toLocaleLowerCase().includes(q));
    if (!shown.length) { posts.textContent = latest.length ? 'No hay coincidencias en la actividad reciente.' : 'Todavía no hay publicaciones.'; return; }
    for (const p of shown) {
      const row = document.createElement('article'); row.className = 'admin-activity-item';
      const detail = document.createElement('div'), strong = document.createElement('strong'); strong.textContent = p.Author;
      const caption = document.createElement('p'); caption.textContent = p.Caption || `Archivo: ${p.File}`;
      const date = document.createElement('small'); date.textContent = new Date(p.At).toLocaleString(); detail.append(strong, caption, date);
      const form = document.createElement('form'); form.method = 'post'; form.action = '/admin/delete';
      const id = document.createElement('input'); id.type = 'hidden'; id.name = 'id'; id.value = p.ID;
      const button = document.createElement('button'); button.className = 'moderate-button'; button.textContent = 'Eliminar'; button.onclick = ev => { if (!confirm('¿Eliminar esta publicación?')) ev.preventDefault(); };
      form.append(id, button); row.append(detail, form); posts.append(row);
    }
  }
  search?.addEventListener('input', renderPosts);
  async function refresh() {
    try {
      const r = await fetch('/admin/activity', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar la actividad.');
      const data = await r.json(); latest = data.posts || []; renderPosts(); users.replaceChildren();
      if (!data.users?.length) users.textContent = 'No hay usuarios.';
      for (const name of data.users || []) { const tag = document.createElement('span'); tag.className = 'user-chip'; tag.textContent = name; users.append(tag); }
    } catch (_) { posts.textContent = 'No se pudo actualizar. Reintentando…'; }
  }
  refresh(); window.setInterval(refresh, 8000);
});
