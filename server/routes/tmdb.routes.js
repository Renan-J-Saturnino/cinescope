const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const TMDB_BASE = 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;
const FETCH_TIMEOUT_MS = 8000;

// Evita abuso do proxy (protege a cota da chave do TMDB)
const tmdbLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um instante.' }
});
router.use(tmdbLimiter);

// Cache simples em memória (reduz chamadas repetidas ao TMDB)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function tmdbFetch(path, query = {}) {
  if (!API_KEY) {
    const err = new Error('TMDB_API_KEY não configurada no servidor.');
    err.status = 500;
    throw err;
  }

  const params = new URLSearchParams({ language: 'pt-BR', ...query, api_key: API_KEY });
  const url = `${TMDB_BASE}${path}?${params.toString()}`;

  const cacheKey = url;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let r;
  try {
    r = await fetch(url, { signal: controller.signal });
  } catch (e) {
    const err = new Error(
      e.name === 'AbortError'
        ? 'A API do TMDB demorou demais para responder. Tente novamente.'
        : 'Não foi possível conectar à API do TMDB.'
    );
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    const err = new Error(`Erro na API do TMDB (${r.status})`);
    err.status = r.status === 401 ? 500 : r.status;
    throw err;
  }
  const data = await r.json();
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// GET /api/tmdb/trending
router.get('/trending', asyncRoute(async (req, res) => {
  const data = await tmdbFetch('/trending/all/day');
  res.json(data);
}));

// GET /api/tmdb/search?q=...&type=multi|movie|tv
router.get('/search', asyncRoute(async (req, res) => {
  const { q, type = 'multi' } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: 'Parâmetro "q" é obrigatório.' });
  if (!['multi', 'movie', 'tv'].includes(type)) {
    return res.status(400).json({ error: 'Parâmetro "type" inválido.' });
  }
  const data = await tmdbFetch(`/search/${type}`, { query: q, include_adult: 'false' });
  res.json(data);
}));

// GET /api/tmdb/details/:type/:id
router.get('/details/:type/:id', asyncRoute(async (req, res) => {
  const { type, id } = req.params;
  if (!['movie', 'tv'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID inválido.' });
  const data = await tmdbFetch(`/${type}/${id}`);
  res.json(data);
}));

// GET /api/tmdb/discover/:type  (usado pela roleta / sorteio)
router.get('/discover/:type', asyncRoute(async (req, res) => {
  const { type } = req.params;
  if (!['movie', 'tv'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });

  const allowed = [
    'sort_by', 'include_adult', 'vote_count.gte', 'with_genres', 'vote_average.gte',
    'primary_release_date.gte', 'primary_release_date.lte',
    'first_air_date.gte', 'first_air_date.lte', 'with_people', 'with_keywords', 'page'
  ];
  const query = {};
  for (const key of allowed) {
    if (req.query[key] !== undefined) query[key] = req.query[key];
  }
  const data = await tmdbFetch(`/discover/${type}`, query);
  res.json(data);
}));

// GET /api/tmdb/person-search?q=...
router.get('/person-search', asyncRoute(async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: 'Parâmetro "q" é obrigatório.' });
  const data = await tmdbFetch('/search/person', { query: q });
  res.json(data);
}));

// GET /api/tmdb/keyword-search?q=...
router.get('/keyword-search', asyncRoute(async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: 'Parâmetro "q" é obrigatório.' });
  const data = await tmdbFetch('/search/keyword', { query: q });
  res.json(data);
}));

// GET /api/tmdb/popular/:type?page=
router.get('/popular/:type', asyncRoute(async (req, res) => {
  const { type } = req.params;
  if (!['movie', 'tv'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  const { page = 1 } = req.query;
  const data = await tmdbFetch(`/${type}/popular`, { page });
  res.json(data);
}));

module.exports = router;
