require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');

require('./db/database'); // garante que o schema exista ao subir o servidor

const authRoutes = require('./routes/auth.routes');
const tmdbRoutes = require('./routes/tmdb.routes');
const favoritesRoutes = require('./routes/favorites.routes');
const ratingsRoutes = require('./routes/ratings.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "https://image.tmdb.org", "data:"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // A UI usa atributos onclick="" nos elementos (como no protótipo original).
      // Isso é necessário para eles funcionarem, sem afrouxar scriptSrc (que
      // continua bloqueando <script> inline ou de terceiros).
      scriptSrcAttr: ["'unsafe-inline'"]
    }
  }
}));
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── API ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/ratings', ratingsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─── FRONT-END ESTÁTICO ────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ─── TRATAMENTO DE ERROS ───────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`🎬 CineScope rodando em http://localhost:${PORT}`);
  if (!process.env.TMDB_API_KEY) {
    console.warn('⚠️  TMDB_API_KEY não configurada — copie .env.example para .env e preencha sua chave.');
  }
});
