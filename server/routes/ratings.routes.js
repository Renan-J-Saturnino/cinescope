const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/ratings
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM ratings WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user.id);
  res.json({ ratings: rows });
});

// PUT /api/ratings  (cria ou atualiza — upsert)
// body: { tmdb_id, media_type, title, poster_path, release_date, stars, comment }
router.put('/', (req, res) => {
  const { tmdb_id, media_type, title, poster_path, release_date, stars, comment } = req.body || {};

  if (!tmdb_id || !['movie', 'tv'].includes(media_type) || !title) {
    return res.status(400).json({ error: 'Dados obrigatórios: tmdb_id, media_type, title.' });
  }
  const starsNum = Number(stars);
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return res.status(400).json({ error: 'stars deve ser um inteiro entre 1 e 5.' });
  }

  db.prepare(`
    INSERT INTO ratings (user_id, tmdb_id, media_type, title, poster_path, release_date, stars, comment, updated_at)
    VALUES (@user_id, @tmdb_id, @media_type, @title, @poster_path, @release_date, @stars, @comment, datetime('now'))
    ON CONFLICT(user_id, tmdb_id, media_type)
    DO UPDATE SET stars = @stars, comment = @comment, updated_at = datetime('now')
  `).run({
    user_id: req.user.id,
    tmdb_id,
    media_type,
    title,
    poster_path: poster_path || null,
    release_date: release_date || null,
    stars: starsNum,
    comment: comment ? String(comment).slice(0, 2000) : null
  });

  res.json({ ok: true });
});

// DELETE /api/ratings/:tmdbId/:mediaType
router.delete('/:tmdbId/:mediaType', (req, res) => {
  const { tmdbId, mediaType } = req.params;
  const info = db
    .prepare('DELETE FROM ratings WHERE user_id = ? AND tmdb_id = ? AND media_type = ?')
    .run(req.user.id, tmdbId, mediaType);

  if (info.changes === 0) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
