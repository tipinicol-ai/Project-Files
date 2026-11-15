document.addEventListener('DOMContentLoaded', () => {
  const posts = document.querySelector('#admin-posts');
  const users = document.querySelector('#admin-users');
  const search = document.querySelector('#admin-search');
  const winList = document.querySelector('#admin-wins');
  let latest = [];
  let latestWins = [];

  function renderPosts() {
    const q = (search?.value || '').trim().toLocaleLowerCase();
    posts.replaceChildren();
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

  function renderWins() {
    winList.replaceChildren();
    if (!latestWins.length) { winList.textContent = 'Aún no hay nombres en el ranking. Agrega el primero arriba.'; return; }
    for (const [index, entry] of latestWins.entries()) {
      const row = document.createElement('article'); row.className = `admin-win-row${index === 0 ? ' admin-win-leader' : ''}`;
      const place = document.createElement('span'); place.className = 'admin-win-place'; place.textContent = `#${index + 1}`;
      const identity = document.createElement('div'); identity.className = 'admin-win-identity';
      const gamer = document.createElement('strong'); gamer.textContent = entry.user;
      const updated = document.createElement('small'); updated.textContent = entry.updatedBy ? `Último cambio: ${entry.updatedBy} · ${new Date(entry.updatedAt).toLocaleString()}` : 'Sin actualización registrada';
      identity.append(gamer, updated);
      const form = document.createElement('form'); form.method = 'post'; form.action = '/admin/wins'; form.className = 'admin-win-form';
      const oldName = document.createElement('input'); oldName.type = 'hidden'; oldName.name = 'oldName'; oldName.value = entry.user;
      const name = document.createElement('input'); name.type = 'text'; name.name = 'name'; name.maxLength = 60; name.required = true; name.value = entry.user; name.setAttribute('aria-label', `Nombre del jugador, puesto ${index + 1}`);
      const wins = document.createElement('input'); wins.type = 'number'; wins.name = 'wins'; wins.min = '0'; wins.max = '1000000'; wins.step = '1'; wins.required = true; wins.value = entry.wins; wins.setAttribute('aria-label', `Victorias de ${entry.user}`);
      const save = document.createElement('button'); save.className = 'btn'; save.type = 'submit'; save.textContent = 'Guardar';
      form.append(oldName, name, wins, save); row.append(place, identity, form); winList.append(row);
    }
  }

  search?.addEventListener('input', renderPosts);
  async function refresh() {
    try {
      const r = await fetch('/admin/activity', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) throw new Error('No se pudo cargar la actividad.');
      const data = await r.json(); latest = data.posts || []; latestWins = data.wins || [];
      renderPosts();
      if (!winList.contains(document.activeElement)) renderWins();
      users.replaceChildren();
      if (!data.users?.length) users.textContent = 'No hay usuarios registrados.';
      for (const name of data.users || []) { const tag = document.createElement('span'); tag.className = 'user-chip'; tag.textContent = name; users.append(tag); }
    } catch (_) { posts.textContent = 'No se pudo actualizar. Reintentando…'; }
  }
  refresh(); window.setInterval(refresh, 8000);
});
