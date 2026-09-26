// ─── CLIENTE HTTP PARA O BACKEND PRÓPRIO ───────────────────
// Todas as chamadas passam pelo nosso servidor (mesma origem),
// que por sua vez fala com o TMDB usando a chave guardada no .env.
// Isso mantém a API key do TMDB fora do navegador do usuário.

const IMG_BASE = 'https://image.tmdb.org/t/p/';

async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* resposta sem corpo */ }

  if (!res.ok) {
    const message = (data && data.error) || `Erro na requisição (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  // auth
  me: () => apiRequest('/api/auth/me'),
  login: (email, password) => apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name, email, password) => apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),

  // tmdb (proxy)
  trending: () => apiRequest('/api/tmdb/trending'),
  search: (q, type) => apiRequest(`/api/tmdb/search?q=${encodeURIComponent(q)}&type=${type}`),
  details: (type, id) => apiRequest(`/api/tmdb/details/${type}/${id}`),
  discover: (type, params) => apiRequest(`/api/tmdb/discover/${type}?${params}`),
  personSearch: (q) => apiRequest(`/api/tmdb/person-search?q=${encodeURIComponent(q)}`),
  keywordSearch: (q) => apiRequest(`/api/tmdb/keyword-search?q=${encodeURIComponent(q)}`),
  popular: (type, page) => apiRequest(`/api/tmdb/popular/${type}?page=${page}`),

  // favoritos
  listFavorites: () => apiRequest('/api/favorites'),
  addFavorite: (payload) => apiRequest('/api/favorites', { method: 'POST', body: JSON.stringify(payload) }),
  removeFavorite: (tmdbId, mediaType) => apiRequest(`/api/favorites/${tmdbId}/${mediaType}`, { method: 'DELETE' }),

  // avaliações
  listRatings: () => apiRequest('/api/ratings'),
  saveRatingApi: (payload) => apiRequest('/api/ratings', { method: 'PUT', body: JSON.stringify(payload) }),
  removeRating: (tmdbId, mediaType) => apiRequest(`/api/ratings/${tmdbId}/${mediaType}`, { method: 'DELETE' })
};
