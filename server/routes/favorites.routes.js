const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/favorites
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ favorites: rows });
});

// POST /api/favorites  { tmdb_id, media_type, title, poster_path, release_date, vote_average }
router.post('/', (req, res) => {
  const { tmdb_id, media_type, title, poster_path, release_date, vote_average } = req.body || {};

  if (!tmdb_id || !['movie', 'tv'].includes(media_type) || !title) {
    return res.status(400).json({ error: 'Dados obrigatórios: tmdb_id, media_type, title.' });
  }

  try {
    db.prepare(`
      INSERT INTO favorites (user_id, tmdb_id, media_type, title, poster_path, release_date, vote_average)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, tmdb_id, media_type, title, poster_path || null, release_date || null, vote_average ?? null);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Já está nos favoritos.' });
    }
    throw err;
  }

  res.status(201).json({ ok: true });
});

// DELETE /api/favorites/:tmdbId/:mediaType
router.delete('/:tmdbId/:mediaType', (req, res) => {
  const { tmdbId, mediaType } = req.params;
  const info = db
    .prepare('DELETE FROM favorites WHERE user_id = ? AND tmdb_id = ? AND media_type = ?')
    .run(req.user.id, tmdbId, mediaType);

  if (info.changes === 0) return res.status(404).json({ error: 'Favorito não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;
