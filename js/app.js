// ─── ESTADO GERAL ───────────────────────────────────────────
let currentType = 'multi';
let currentItem = null;
let currentStar = 0;

// Cache local (espelha o que está salvo no backend, por usuário logado)
// chave: `${media_type}:${tmdb_id}`
let favorites = {};
let ratings = {};

function favKey(id, type) { return `${type}:${id}`; }

// ─── INIT ───────────────────────────────────────────────────
async function init() {
  await initAuth();
  if (currentUser) await loadUserData();
  updateFavCount();
  loadTrending();

  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
}

async function afterLoginRefresh() {
  await loadUserData();
  updateFavCount();
  // Se estivermos vendo grids na tela, redesenha para refletir favoritos/notas
  rerenderVisibleGrids();
}

async function loadUserData() {
  try {
    const [favData, ratingData] = await Promise.all([api.listFavorites(), api.listRatings()]);
    favorites = {};
    (favData.favorites || []).forEach(f => { favorites[favKey(f.tmdb_id, f.media_type)] = f; });
    ratings = {};
    (ratingData.ratings || []).forEach(r => { ratings[favKey(r.tmdb_id, r.media_type)] = r; });
  } catch (err) {
    console.error('Erro ao carregar dados do usuário:', err);
  }
}

function rerenderVisibleGrids() {
  if (document.getElementById('results-section').style.display !== 'none') doSearch(true);
  if (document.getElementById('trending-section').style.display !== 'none') loadTrending();
}

// ─── TRENDING ───────────────────────────────────────────────
async function loadTrending() {
  const grid = document.getElementById('trending-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando destaques...</p></div>';
  try {
    const data = await api.trending();
    renderGrid(grid, (data.results || []).slice(0, 20));
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// ─── BUSCA ──────────────────────────────────────────────────
function setFilter(btn, type) {
  currentType = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (document.getElementById('search-input').value.trim()) doSearch();
}

async function doSearch(silent) {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;

  document.getElementById('trending-section').style.display = 'none';
  document.getElementById('results-section').style.display = 'block';

  const label = document.getElementById('results-label');
  const grid = document.getElementById('results-grid');
  label.textContent = `Resultados para "${q}"`;
  if (!silent) grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando...</p></div>';

  try {
    const data = await api.search(q, currentType);
    if (!data.results || !data.results.length) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">🎬</div><p>Nenhum resultado encontrado.</p></div>';
      return;
    }
    renderGrid(grid, data.results);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// ─── RENDER GRID / CARDS ────────────────────────────────────
function renderGrid(grid, items) {
  grid.innerHTML = '';
  items.forEach((item, i) => {
    if (!item.title && !item.name) return;
    const card = createCard(item, i);
    grid.appendChild(card);
  });
}

function createCard(item, i) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const poster = item.poster_path ? `${IMG_BASE}w342${item.poster_path}` : null;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '—';
  const type = item.media_type || (item.title ? 'movie' : 'tv');
  const isFav = !!favorites[favKey(item.id, type)];
  const myRating = ratings[favKey(item.id, type)];

  const div = document.createElement('div');
  div.className = 'card';
  div.style.animationDelay = `${i * 0.05}s`;

  div.innerHTML = `
    <div class="type-badge">${type === 'movie' ? 'Filme' : 'Série'}</div>
    <button class="fav-btn ${isFav ? 'active' : ''}" title="Favoritar">${isFav ? '♥' : '♡'}</button>
    ${poster
      ? `<img class="card-poster" src="${poster}" alt="${escapeHtml(title)}" loading="lazy">`
      : `<div class="card-poster-placeholder">🎬</div>`
    }
    <div class="card-overlay">
      <div style="font-size:0.8rem;color:var(--muted);margin-bottom:4px">${year}</div>
      <div style="font-size:0.85rem;font-weight:500;margin-bottom:6px">${escapeHtml(title)}</div>
      <div class="rating-badge">★ ${rating}<span style="margin-left:6px;color:var(--muted)">/10</span></div>
      ${myRating ? `<div style="margin-top:6px;font-size:0.75rem;color:var(--gold2)">Minha nota: ${'★'.repeat(myRating.stars)}</div>` : ''}
    </div>
    <div class="card-info">
      <div class="card-title">${escapeHtml(title)}</div>
      <div class="card-meta">
        <span>${year || '—'}</span>
        <span class="rating-badge">★ ${rating}</span>
      </div>
    </div>
  `;

  div.querySelector('.fav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav(item, type, div.querySelector('.fav-btn'));
  });
  div.addEventListener('click', () => openModal(item));
  return div;
}

// ─── MODAL DE DETALHES ──────────────────────────────────────
async function openModal(item) {
  currentItem = item;
  currentStar = 0;

  const type = item.media_type || (item.title ? 'movie' : 'tv');
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const poster = item.poster_path ? `${IMG_BASE}w342${item.poster_path}` : '';
  const backdrop = item.backdrop_path ? `${IMG_BASE}w1280${item.backdrop_path}` : poster;

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-backdrop').src = backdrop;
  document.getElementById('modal-poster').src = poster;
  document.getElementById('modal-synopsis').textContent = item.overview || 'Sinopse não disponível.';

  const rating = item.vote_average ? item.vote_average.toFixed(1) : '—';
  document.getElementById('modal-tmdb-rating').innerHTML = `★ ${rating} <span style="font-size:0.75rem;color:var(--muted);font-weight:300">TMDB · ${item.vote_count || 0} votos</span>`;
  document.getElementById('modal-meta').innerHTML = `
    <span>📅 ${year || '—'}</span>
    <span>🎭 ${type === 'movie' ? 'Filme' : 'Série'}</span>
    ${item.original_language ? `<span>🌐 ${item.original_language.toUpperCase()}</span>` : ''}
  `;

  try {
    const details = await api.details(type, item.id);
    if (details.genres) {
      document.getElementById('modal-genres').innerHTML =
        details.genres.map(g => `<span class="genre-tag">${escapeHtml(g.name)}</span>`).join('');
    }
    if (details.runtime) {
      document.getElementById('modal-meta').innerHTML += `<span>⏱ ${details.runtime}min</span>`;
    }
    if (details.number_of_seasons) {
      document.getElementById('modal-meta').innerHTML += `<span>📺 ${details.number_of_seasons} temporada(s)</span>`;
    }
  } catch (_) {}

  const isFav = !!favorites[favKey(item.id, type)];
  const favBtn = document.getElementById('fav-modal-btn');
  favBtn.textContent = isFav ? '♥ Favoritado' : '♡ Favoritar';
  favBtn.className = `fav-modal-btn ${isFav ? 'active' : ''}`;

  loadExistingRating();

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function loadExistingRating() {
  if (!currentItem) return;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  const existing = ratings[favKey(currentItem.id, type)];
  const display = document.getElementById('saved-rating-display');
  const starsEl = document.querySelectorAll('.star-btn');

  starsEl.forEach(s => s.classList.remove('active'));
  document.getElementById('rating-comment').value = '';
  currentStar = 0;

  if (existing) {
    currentStar = existing.stars;
    starsEl.forEach(s => { if (parseInt(s.dataset.v) <= existing.stars) s.classList.add('active'); });
    document.getElementById('rating-comment').value = existing.comment || '';
    display.style.display = 'block';
    display.innerHTML = `
      <div class="stars">${'★'.repeat(existing.stars)}${'☆'.repeat(5 - existing.stars)}</div>
      ${existing.comment ? `<div class="comment">"${escapeHtml(existing.comment)}"</div>` : ''}
      <div style="font-size:0.72rem;color:var(--muted);margin-top:6px">${(existing.updated_at || '').slice(0, 10)}</div>
    `;
  } else {
    display.style.display = 'none';
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  currentItem = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ─── ESTRELAS ───────────────────────────────────────────────
function setStar(v) {
  currentStar = v;
  document.querySelectorAll('.star-btn').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= v);
  });
}

// ─── AVALIAÇÃO (persistida no backend) ──────────────────────
async function saveRating() {
  if (!currentItem) return;
  if (!requireLogin()) return;
  if (!currentStar) { showToast('Selecione pelo menos 1 estrela.'); return; }

  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  const comment = document.getElementById('rating-comment').value.trim();

  try {
    await api.saveRatingApi({
      tmdb_id: currentItem.id,
      media_type: type,
      title: currentItem.title || currentItem.name,
      poster_path: currentItem.poster_path || null,
      release_date: currentItem.release_date || currentItem.first_air_date || null,
      stars: currentStar,
      comment
    });
    ratings[favKey(currentItem.id, type)] = {
      tmdb_id: currentItem.id, media_type: type, stars: currentStar, comment,
      updated_at: new Date().toISOString()
    };
    showToast('Avaliação salva!', 'gold');
    loadExistingRating();
  } catch (err) {
    showToast(err.message || 'Erro ao salvar avaliação.');
  }
}

// ─── FAVORITOS (persistidos no backend) ─────────────────────
async function toggleFav(item, type, btnEl) {
  if (!requireLogin()) return;
  const key = favKey(item.id, type);
  const isFav = !!favorites[key];

  try {
    if (isFav) {
      await api.removeFavorite(item.id, type);
      delete favorites[key];
      showToast('Removido dos favoritos.');
    } else {
      await api.addFavorite({
        tmdb_id: item.id,
        media_type: type,
        title: item.title || item.name,
        poster_path: item.poster_path || null,
        release_date: item.release_date || item.first_air_date || null,
        vote_average: item.vote_average || null
      });
      favorites[key] = { tmdb_id: item.id, media_type: type };
      showToast('Adicionado aos favoritos!', 'gold');
    }
    if (btnEl) {
      btnEl.textContent = favorites[key] ? '♥' : '♡';
      btnEl.classList.toggle('active', !!favorites[key]);
    }
    updateFavCount();
  } catch (err) {
    showToast(err.message || 'Erro ao atualizar favoritos.');
  }
}

async function toggleFavModal() {
  if (!currentItem) return;
  const type = currentItem.media_type || (currentItem.title ? 'movie' : 'tv');
  const favBtn = document.getElementById('fav-modal-btn');
  await toggleFav(currentItem, type, null);
  const isFav = !!favorites[favKey(currentItem.id, type)];
  favBtn.textContent = isFav ? '♥ Favoritado' : '♡ Favoritar';
  favBtn.className = `fav-modal-btn ${isFav ? 'active' : ''}`;
}

function updateFavCount() {
  const count = Object.keys(favorites).length;
  document.getElementById('fav-count').textContent = count ? `(${count})` : '';
}

// ─── ABAS ───────────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (window.event && window.event.target) window.event.target.classList.add('active');

  document.getElementById('tab-buscar').style.display = tab === 'buscar' ? '' : 'none';
  document.getElementById('trending-section').style.display = tab === 'buscar' ? '' : 'none';
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('tab-favoritos').style.display = tab === 'favoritos' ? '' : 'none';
  document.getElementById('tab-avaliados').style.display = tab === 'avaliados' ? '' : 'none';
  document.getElementById('tab-sorteio').style.display = tab === 'sorteio' ? '' : 'none';

  if (tab === 'favoritos') renderFavs();
  if (tab === 'avaliados') renderRated();
  if (tab === 'sorteio') initSorteio();
}

function lockedHint(msg) {
  return `<div class="locked-hint"><div class="icon">🔒</div><p>${msg}</p>
    <button class="btn-gold" onclick="openAuthModal('login')">ENTRAR / CRIAR CONTA</button></div>`;
}

function renderFavs() {
  const grid = document.getElementById('favs-grid');
  if (!currentUser) { grid.innerHTML = lockedHint('Entre na sua conta para ver seus favoritos.'); return; }

  const items = Object.values(favorites).map(f => ({
    id: f.tmdb_id, media_type: f.media_type, title: f.title, name: f.title,
    poster_path: f.poster_path, release_date: f.release_date, vote_average: f.vote_average
  }));
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">♡</div><p>Nenhum favorito ainda. Explore e adicione filmes!</p></div>';
    return;
  }
  renderGrid(grid, items);
}

function renderRated() {
  const grid = document.getElementById('rated-grid');
  if (!currentUser) { grid.innerHTML = lockedHint('Entre na sua conta para ver suas avaliações.'); return; }

  const items = Object.values(ratings).map(r => ({
    id: r.tmdb_id, media_type: r.media_type, title: r.title, name: r.title,
    poster_path: r.poster_path, release_date: r.release_date
  }));
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">★</div><p>Você ainda não avaliou nada.</p></div>';
    return;
  }
  renderGrid(grid, items);
}

// ─── TOAST ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg, style) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show${style ? ' ' + style : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════
// ─── SORTEIO ENGINE ────────────────────────────────
// ═══════════════════════════════════════════════════

const GENRES_MOVIE = [
  {id:28,name:'Ação'},{id:12,name:'Aventura'},{id:16,name:'Animação'},
  {id:35,name:'Comédia'},{id:80,name:'Crime'},{id:99,name:'Documentário'},
  {id:18,name:'Drama'},{id:10751,name:'Família'},{id:14,name:'Fantasia'},
  {id:36,name:'História'},{id:27,name:'Terror'},{id:10402,name:'Música'},
  {id:9648,name:'Mistério'},{id:10749,name:'Romance'},{id:878,name:'Ficção Científica'},
  {id:10770,name:'Filme de TV'},{id:53,name:'Suspense'},{id:10752,name:'Guerra'},{id:37,name:'Faroeste'}
];

const GENRES_TV = [
  {id:10759,name:'Ação & Aventura'},{id:16,name:'Animação'},{id:35,name:'Comédia'},
  {id:80,name:'Crime'},{id:99,name:'Documentário'},{id:18,name:'Drama'},
  {id:10751,name:'Família'},{id:10762,name:'Kids'},{id:9648,name:'Mistério'},
  {id:10763,name:'Notícias'},{id:10764,name:'Reality'},{id:10765,name:'Ficção Científica & Fantasia'},
  {id:10766,name:'Novela'},{id:10767,name:'Talk'},{id:10768,name:'Guerra & Política'},{id:37,name:'Faroeste'}
];

let sorteioType = 'movie';
let sorteioFilters = {
  genres: [], actors: [], directors: [], keywords: [],
  yearMin: 1960, yearMax: new Date().getFullYear(), ratingMin: 0
};
let slotInterval = null;
let lastSorteioResult = null;

function initSorteio() {
  const ui = document.getElementById('sorteio-ui');
  ui.innerHTML = buildSorteioHTML();
  renderGenrePills();
  setupRangeListeners();
}

function buildSorteioHTML() {
  const yr = new Date().getFullYear();
  return `
  <div class="sorteio-wrap">
    <div class="hero-label">● Roleta cinematográfica</div>
    <h2 class="sorteio-title">Deixa o acaso<br><em>escolher</em> por você</h2>
    <p class="sorteio-sub">Configure os filtros ou sortei totalmente aleatório.</p>

    <div class="type-toggle">
      <button class="active" onclick="setSorteioType('movie',this)">🎬 Filmes</button>
      <button onclick="setSorteioType('tv',this)">📺 Séries</button>
      <button onclick="setSorteioType('both',this)">✦ Ambos</button>
    </div>

    <div class="filter-cards">
      <div class="filter-card" style="grid-column:1/-1">
        <label>Gêneros</label>
        <div class="genre-pills" id="genre-pills"></div>
      </div>

      <div class="filter-card">
        <label>Ator / Atriz</label>
        <div class="filter-card-inner">
          <input type="text" id="actor-input" placeholder="Nome do ator..." onkeydown="if(event.key==='Enter')searchPerson('actor')">
          <button class="search-tag-btn" onclick="searchPerson('actor')">+ Adicionar</button>
        </div>
        <div class="tags-list" id="actor-tags"></div>
      </div>

      <div class="filter-card">
        <label>Diretor(a)</label>
        <div class="filter-card-inner">
          <input type="text" id="director-input" placeholder="Nome do diretor..." onkeydown="if(event.key==='Enter')searchPerson('director')">
          <button class="search-tag-btn" onclick="searchPerson('director')">+ Adicionar</button>
        </div>
        <div class="tags-list" id="director-tags"></div>
      </div>

      <div class="filter-card">
        <label>Palavra-chave / Tema</label>
        <div class="filter-card-inner">
          <input type="text" id="keyword-input" placeholder="Ex: vampiro, viagem no tempo..." onkeydown="if(event.key==='Enter')searchKeyword()">
          <button class="search-tag-btn" onclick="searchKeyword()">+ Adicionar</button>
        </div>
        <div class="tags-list" id="keyword-tags"></div>
      </div>

      <div class="filter-card">
        <label>Período: <span id="year-label">${sorteioFilters.yearMin} – ${sorteioFilters.yearMax}</span></label>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="range-wrap">
            <span style="font-size:0.75rem;color:var(--muted);min-width:32px">De</span>
            <input type="range" id="year-min" min="1900" max="${yr}" value="${sorteioFilters.yearMin}" step="1">
            <span class="range-val" id="year-min-val">${sorteioFilters.yearMin}</span>
          </div>
          <div class="range-wrap">
            <span style="font-size:0.75rem;color:var(--muted);min-width:32px">Até</span>
            <input type="range" id="year-max" min="1900" max="${yr}" value="${sorteioFilters.yearMax}" step="1">
            <span class="range-val" id="year-max-val">${sorteioFilters.yearMax}</span>
          </div>
        </div>
      </div>

      <div class="filter-card">
        <label>Nota mínima TMDB: <span id="rating-label">${sorteioFilters.ratingMin > 0 ? sorteioFilters.ratingMin + '+' : 'Qualquer'}</span></label>
        <div class="range-wrap" style="margin-top:8px">
          <span style="font-size:0.75rem;color:var(--muted);min-width:32px">★</span>
          <input type="range" id="rating-min" min="0" max="9" value="${sorteioFilters.ratingMin}" step="0.5">
          <span class="range-val" id="rating-min-val">${sorteioFilters.ratingMin || '—'}</span>
        </div>
      </div>
    </div>

    <div class="slot-reel" id="slot-reel">
      <div class="slot-text" id="slot-text">Pronto para sortear</div>
    </div>

    <div class="reveal-stage" id="reveal-stage"></div>

    <button class="sortear-btn" id="sortear-btn" onclick="executarSorteio()">🎲 SORTEAR COM FILTROS</button>
    <button class="sortear-random-btn" onclick="sorteioRandom()">↻ Totalmente aleatório (sem filtros)</button>
  </div>`;
}

function setSorteioType(type, btn) {
  sorteioType = type;
  document.querySelectorAll('.type-toggle button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGenrePills();
}

function renderGenrePills() {
  const container = document.getElementById('genre-pills');
  if (!container) return;
  const genres = sorteioType === 'tv' ? GENRES_TV : GENRES_MOVIE;
  container.innerHTML = genres.map(g => `
    <button class="genre-pill ${sorteioFilters.genres.includes(g.id) ? 'active' : ''}"
      onclick="toggleGenre(${g.id}, this)">${g.name}</button>
  `).join('');
}

function toggleGenre(id, btn) {
  const idx = sorteioFilters.genres.indexOf(id);
  if (idx === -1) sorteioFilters.genres.push(id);
  else sorteioFilters.genres.splice(idx, 1);
  btn.classList.toggle('active');
}

function setupRangeListeners() {
  const safe = id => document.getElementById(id);

  const bind = (id, onVal) => {
    const el = safe(id);
    if (el) el.addEventListener('input', function() { onVal(parseFloat(this.value)); });
  };

  bind('year-min', v => {
    sorteioFilters.yearMin = v;
    sorteioFilters.yearMax = Math.max(v, sorteioFilters.yearMax);
    const ymx = safe('year-max');
    if (ymx && parseFloat(ymx.value) < v) ymx.value = v;
    safe('year-min-val').textContent = v;
    safe('year-max-val').textContent = sorteioFilters.yearMax;
    safe('year-label').textContent = `${sorteioFilters.yearMin} – ${sorteioFilters.yearMax}`;
  });

  bind('year-max', v => {
    sorteioFilters.yearMax = v;
    sorteioFilters.yearMin = Math.min(v, sorteioFilters.yearMin);
    const ymn = safe('year-min');
    if (ymn && parseFloat(ymn.value) > v) ymn.value = v;
    safe('year-min-val').textContent = sorteioFilters.yearMin;
    safe('year-max-val').textContent = v;
    safe('year-label').textContent = `${sorteioFilters.yearMin} – ${sorteioFilters.yearMax}`;
  });

  bind('rating-min', v => {
    sorteioFilters.ratingMin = v;
    safe('rating-min-val').textContent = v > 0 ? v : '—';
    safe('rating-label').textContent = v > 0 ? v + '+' : 'Qualquer';
  });
}

// ─── PESSOA / PALAVRA-CHAVE ─────────────────────────────────
async function searchPerson(role) {
  const inputId = role === 'actor' ? 'actor-input' : 'director-input';
  const q = document.getElementById(inputId).value.trim();
  if (!q) return;

  showToast('Buscando...');
  try {
    const data = await api.personSearch(q);
    if (!data.results.length) { showToast('Nenhuma pessoa encontrada.'); return; }

    const person = data.results[0];
    const list = role === 'actor' ? sorteioFilters.actors : sorteioFilters.directors;
    const tagsId = role === 'actor' ? 'actor-tags' : 'director-tags';

    if (list.find(p => p.id === person.id)) { showToast('Já adicionado!'); return; }
    list.push({ id: person.id, name: person.name });
    renderTags(tagsId, list, role);
    document.getElementById(inputId).value = '';
    showToast(`✓ ${person.name} adicionado`, 'gold');
  } catch { showToast('Erro ao buscar pessoa.'); }
}

async function searchKeyword() {
  const q = document.getElementById('keyword-input').value.trim();
  if (!q) return;

  try {
    const data = await api.keywordSearch(q);
    if (!data.results.length) { showToast('Keyword não encontrada.'); return; }
    const kw = data.results[0];
    if (sorteioFilters.keywords.find(k => k.id === kw.id)) { showToast('Já adicionada!'); return; }
    sorteioFilters.keywords.push({ id: kw.id, name: kw.name });
    renderTags('keyword-tags', sorteioFilters.keywords, 'keyword');
    document.getElementById('keyword-input').value = '';
    showToast(`✓ "${kw.name}" adicionado`, 'gold');
  } catch { showToast('Erro ao buscar keyword.'); }
}

function renderTags(containerId, list, role) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = list.map((item, i) => `
    <span class="tag">${escapeHtml(item.name)}
      <button onclick="removeTag('${role}',${i})">✕</button>
    </span>`).join('');
}

function removeTag(role, idx) {
  const map = { actor: ['actors','actor-tags'], director: ['directors','director-tags'], keyword: ['keywords','keyword-tags'] };
  const [key, containerId] = map[role];
  sorteioFilters[key].splice(idx, 1);
  renderTags(containerId, sorteioFilters[key], role);
}

// ─── PARÂMETROS DE DISCOVER ─────────────────────────────────
function buildDiscoverParams(mediaType) {
  const params = new URLSearchParams();
  params.set('sort_by', 'popularity.desc');
  params.set('include_adult', 'false');
  params.set('vote_count.gte', '50');

  if (sorteioFilters.genres.length) params.set('with_genres', sorteioFilters.genres.join(','));
  if (sorteioFilters.ratingMin > 0) params.set('vote_average.gte', sorteioFilters.ratingMin);

  if (mediaType === 'movie') {
    params.set('primary_release_date.gte', `${sorteioFilters.yearMin}-01-01`);
    params.set('primary_release_date.lte', `${sorteioFilters.yearMax}-12-31`);
  } else {
    params.set('first_air_date.gte', `${sorteioFilters.yearMin}-01-01`);
    params.set('first_air_date.lte', `${sorteioFilters.yearMax}-12-31`);
  }

  if (sorteioFilters.actors.length || sorteioFilters.directors.length) {
    const people = [...sorteioFilters.actors, ...sorteioFilters.directors].map(p => p.id).join(',');
    params.set('with_people', people);
  }
  if (sorteioFilters.keywords.length) {
    params.set('with_keywords', sorteioFilters.keywords.map(k => k.id).join(','));
  }

  return params.toString();
}

// ─── ANIMAÇÃO DO SLOT ────────────────────────────────────────
const SLOT_PHRASES = [
  'Embaralhando filmes...','Consultando o universo...','Rodando a roleta...',
  'Decisão cinematográfica...','Escolhendo com critério...','Sorteando obra-prima...',
  'Análise de catálogo...','Preparando a sessão...','Fazendo a magia acontecer...',
  'Seleção especial em curso...','Roleta do cinema...','Aguarde o veredicto...'
];

function startSlot() {
  const el = document.getElementById('slot-text');
  if (!el) return;
  el.classList.add('spinning');
  let i = 0;
  slotInterval = setInterval(() => {
    el.textContent = SLOT_PHRASES[i % SLOT_PHRASES.length];
    i++;
  }, 150);
}

function stopSlot(msg) {
  clearInterval(slotInterval);
  const el = document.getElementById('slot-text');
  if (!el) return;
  el.classList.remove('spinning');
  el.textContent = msg || '✦ Resultado';
}

// ─── EXECUTAR SORTEIO ────────────────────────────────────────
async function executarSorteio() {
  const btn = document.getElementById('sortear-btn');
  btn.disabled = true;
  document.getElementById('reveal-stage').innerHTML = '';
  startSlot();

  try {
    let mediaType = sorteioType === 'both' ? (Math.random() < 0.5 ? 'movie' : 'tv') : sorteioType;
    const params = buildDiscoverParams(mediaType);

    const first = await api.discover(mediaType, `${params}&page=1`);
    if (!first.results.length) {
      stopSlot('Nenhum resultado encontrado');
      document.getElementById('reveal-stage').innerHTML =
        '<div class="empty-state"><div class="icon">🎬</div><p>Nenhum filme encontrado com esses filtros. Tente combinações diferentes!</p></div>';
      btn.disabled = false;
      return;
    }

    const totalPages = Math.min(first.total_pages, 20);
    const randomPage = Math.floor(Math.random() * totalPages) + 1;
    let pool = first.results;

    if (randomPage > 1) {
      const pageData = await api.discover(mediaType, `${params}&page=${randomPage}`);
      pool = pageData.results;
    }

    const item = pool[Math.floor(Math.random() * pool.length)];
    item.media_type = mediaType;
    lastSorteioResult = item;

    const title = item.title || item.name;
    stopSlot(`✦ ${title}`);
    await renderReveal(item);
  } catch (e) {
    stopSlot('Erro ao sortear');
    showToast(e.message || 'Erro na API. Verifique seus filtros.');
  }

  btn.disabled = false;
}

async function sorteioRandom() {
  document.getElementById('reveal-stage').innerHTML = '';
  startSlot();

  try {
    const type = sorteioType === 'both' ? (Math.random() < 0.5 ? 'movie' : 'tv') : sorteioType;
    const randomPage = Math.floor(Math.random() * 100) + 1;
    const data = await api.popular(type, randomPage);
    const pool = data.results.filter(i => i.poster_path);
    const item = pool[Math.floor(Math.random() * pool.length)];
    item.media_type = type;
    lastSorteioResult = item;

    const title = item.title || item.name;
    stopSlot(`✦ ${title}`);
    await renderReveal(item);
  } catch (e) {
    stopSlot('Erro ao sortear');
    showToast(e.message || 'Erro na API. Tente novamente.');
  }
}

async function renderReveal(item) {
  const stage = document.getElementById('reveal-stage');
  const type = item.media_type || (item.title ? 'movie' : 'tv');
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const poster = item.poster_path ? `${IMG_BASE}w342${item.poster_path}` : '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '—';
  const overview = item.overview || 'Sinopse não disponível.';
  const isFav = !!favorites[favKey(item.id, type)];

  let genreHTML = '';
  try {
    const det = await api.details(type, item.id);
    if (det.genres) genreHTML = det.genres.slice(0, 3).map(g => `<span class="genre-tag">${escapeHtml(g.name)}</span>`).join('');
  } catch {}

  stage.innerHTML = `
    <div class="result-card" style="margin-bottom:28px">
      <div class="result-poster-wrap">
        ${poster
          ? `<img src="${poster}" alt="${escapeHtml(title)}">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;opacity:0.3;background:var(--surface2)">🎬</div>`
        }
      </div>
      <div class="result-body">
        <div>
          <div class="result-eyebrow">SORTEADO PARA VOCÊ · ${type === 'movie' ? 'FILME' : 'SÉRIE'}</div>
          <div class="result-name">${escapeHtml(title)}</div>
          <div class="result-year-type">${year || '—'} · ${type === 'movie' ? 'Filme' : 'Série'}</div>
          <div class="result-rating">★ ${rating} <span style="color:var(--muted)">TMDB</span></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${genreHTML}</div>
          <div class="result-overview">${escapeHtml(overview)}</div>
        </div>
        <div class="result-actions">
          <button class="result-open-btn" onclick="openModal(lastSorteioResult)">Ver Detalhes</button>
          <button class="result-again-btn" onclick="executarSorteio()">↻ Sortear novamente</button>
          <button class="fav-modal-btn ${isFav ? 'active' : ''}" id="reveal-fav-btn"
            onclick="toggleRevealFav()">${isFav ? '♥ Favoritado' : '♡ Favoritar'}</button>
        </div>
      </div>
    </div>
  `;
}

async function toggleRevealFav() {
  if (!lastSorteioResult) return;
  const type = lastSorteioResult.media_type || (lastSorteioResult.title ? 'movie' : 'tv');
  const btn = document.getElementById('reveal-fav-btn');
  await toggleFav(lastSorteioResult, type, null);
  const isFav = !!favorites[favKey(lastSorteioResult.id, type)];
  if (btn) {
    btn.textContent = isFav ? '♥ Favoritado' : '♡ Favoritar';
    btn.classList.toggle('active', isFav);
  }
}

// ─── START ────────────────────────────────────────────────
init();
