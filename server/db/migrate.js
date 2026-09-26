// Basta importar database.js: a criação das tabelas (CREATE TABLE IF NOT EXISTS)
// já acontece na conexão. Este script existe para rodar isso isoladamente,
// via `npm run seed`, sem precisar subir o servidor inteiro.
require('./database');
console.log('✓ Banco de dados pronto em data/cinescope.db');
