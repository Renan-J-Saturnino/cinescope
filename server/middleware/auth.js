const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('[AVISO] JWT_SECRET não definido no .env — usando valor inseguro temporário.');
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET || 'dev-secret-inseguro',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Exige autenticação: bloqueia a requisição se não houver token válido.
function requireAuth(req, res, next) {
  const token = req.cookies?.cinescope_token;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET || 'dev-secret-inseguro');
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

// Autenticação opcional: se houver token válido, popula req.user; caso
// contrário segue em frente sem bloquear (usado em rotas públicas).
function optionalAuth(req, res, next) {
  const token = req.cookies?.cinescope_token;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET || 'dev-secret-inseguro');
    } catch (err) {
      // token inválido/expirado: apenas ignora, segue sem usuário
    }
  }
  next();
}

module.exports = { signToken, requireAuth, optionalAuth };
