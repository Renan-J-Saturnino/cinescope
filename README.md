# 🎬 CineScope

Aplicação completa (front-end + back-end) para descobrir filmes e séries, favoritar,
avaliar com estrelas e "sortear" algo pra assistir com base em filtros — usando a
API do [TMDB](https://www.themoviedb.org/).

Este projeto nasceu de um protótipo estático em um único arquivo HTML e foi
reestruturado como uma aplicação web profissional:

| Antes (protótipo) | Agora |
|---|---|
| Chave da API do TMDB exposta no código do navegador | Chave fica só no servidor (`.env`), nunca é enviada ao cliente |
| Favoritos/avaliações no `localStorage` (por navegador, sem login) | Contas de usuário reais, dados salvos em banco SQLite no servidor |
| Tudo em 1 arquivo `.html` com `<style>`/`<script>` inline | Back-end (Express + SQLite) e front-end organizados em módulos |
| Sem autenticação | Cadastro/login com senha criptografada (bcrypt) e sessão via cookie JWT httpOnly |
| Sem proteção contra abuso | Rate limiting, cabeçalhos de segurança (Helmet/CSP), cache de respostas do TMDB |

## Arquitetura

```
cinescope/
├── server/                 # Back-end (Node.js + Express)
│   ├── index.js             # Setup do servidor, middlewares, rotas, arquivos estáticos
│   ├── db/
│   │   ├── database.js      # Conexão SQLite + criação das tabelas
│   │   └── migrate.js       # Script utilitário (npm run seed)
│   ├── middleware/
│   │   └── auth.js          # Emissão/verificação de JWT (cookie httpOnly)
│   └── routes/
│       ├── auth.routes.js       # /api/auth/*      (registro, login, logout, me)
│       ├── tmdb.routes.js       # /api/tmdb/*       (proxy seguro + cache do TMDB)
│       ├── favorites.routes.js  # /api/favorites/*  (CRUD de favoritos do usuário)
│       └── ratings.routes.js    # /api/ratings/*    (CRUD de avaliações do usuário)
├── public/                  # Front-end estático servido pelo Express
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js           # Cliente HTTP para o back-end próprio
│       ├── auth.js          # Estado de sessão + modal de login/cadastro
│       └── app.js           # Busca, grade de resultados, modal de detalhes, sorteio
├── data/                    # Banco SQLite (criado automaticamente, não versionar)
├── .env.example
└── package.json
```

### Por que um back-end?

O protótipo original chamava a API do TMDB **diretamente do navegador**, com a
chave de API escrita no HTML — qualquer pessoa que abrisse o "Ver código-fonte"
tinha acesso à chave. Além disso, favoritos e notas ficavam presos ao
`localStorage` daquele navegador específico, sem sincronizar entre dispositivos
e sem dono (qualquer pessoa no mesmo computador via os mesmos dados).

Agora:
- O **navegador nunca fala com o TMDB** — ele fala com o nosso back-end
  (`/api/tmdb/...`), que por sua vez consulta o TMDB usando a chave guardada
  no `.env` do servidor.
- **Favoritos e avaliações pertencem a uma conta** (tabelas `favorites` e
  `ratings` no SQLite, vinculadas ao `user_id`), então funcionam em qualquer
  dispositivo em que a pessoa faça login.
- Um **cache em memória de 5 minutos** nas rotas do TMDB reduz o número de
  chamadas repetidas à API externa.
- **Rate limiting** protege tanto as rotas de autenticação (contra força
  bruta) quanto o proxy do TMDB (contra estourar a cota da chave).

## Pré-requisitos

- Node.js 18 ou superior
- Uma chave de API gratuita do TMDB: crie uma conta em
  [themoviedb.org](https://www.themoviedb.org/), vá em **Configurações → API**
  e gere uma "API Key (v3 auth)".

## Como rodar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Copie o arquivo de exemplo de variáveis de ambiente
cp .env.example .env

# 3. Edite o .env e preencha:
#    TMDB_API_KEY=sua_chave_do_tmdb
#    JWT_SECRET=um_valor_aleatorio_forte (ex: openssl rand -hex 32)

# 4. Suba o servidor
npm start

# Acesse http://localhost:3000
```

Para desenvolvimento com reinício automático ao salvar arquivos:

```bash
npm run dev
```

O banco de dados SQLite (`data/cinescope.db`) é criado automaticamente na
primeira execução — não é preciso rodar migrações manualmente. Caso queira
recriá-lo isoladamente, existe `npm run seed`.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta em que o servidor sobe (padrão `3000`) |
| `TMDB_API_KEY` | Chave da API do TMDB (obrigatória) |
| `JWT_SECRET` | Segredo usado para assinar os tokens de sessão |
| `JWT_EXPIRES_IN` | Validade do token/sessão (padrão `7d`) |
| `NODE_ENV` | `development` ou `production` (afeta cookies `secure` e logs) |

## API do back-end

Todas as rotas abaixo (exceto `/api/tmdb/*` e `/api/auth/register|login`)
exigem estar autenticado (cookie de sessão enviado automaticamente pelo
navegador após o login).

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria uma conta `{ name, email, password }` |
| POST | `/api/auth/login` | Login `{ email, password }` |
| POST | `/api/auth/logout` | Encerra a sessão |
| GET | `/api/auth/me` | Retorna o usuário logado |

### Proxy do TMDB (somente leitura, cacheado)
| Método | Rota |
|---|---|
| GET | `/api/tmdb/trending` |
| GET | `/api/tmdb/search?q=&type=multi\|movie\|tv` |
| GET | `/api/tmdb/details/:type/:id` |
| GET | `/api/tmdb/discover/:type?...filtros` |
| GET | `/api/tmdb/person-search?q=` |
| GET | `/api/tmdb/keyword-search?q=` |
| GET | `/api/tmdb/popular/:type?page=` |

### Favoritos (requer login)
| Método | Rota |
|---|---|
| GET | `/api/favorites` |
| POST | `/api/favorites` |
| DELETE | `/api/favorites/:tmdbId/:mediaType` |

### Avaliações (requer login)
| Método | Rota |
|---|---|
| GET | `/api/ratings` |
| PUT | `/api/ratings` (cria ou atualiza) |
| DELETE | `/api/ratings/:tmdbId/:mediaType` |

## Segurança

- Senhas com hash `bcrypt` (nunca armazenadas em texto puro)
- Sessão via **cookie httpOnly** (não acessível por JavaScript no navegador,
  reduzindo risco de roubo de token via XSS)
- `helmet` com Content-Security-Policy restritiva
- `express-rate-limit` nas rotas de autenticação e no proxy do TMDB
- Validação de entrada nas rotas (e-mail, tamanho de senha, tipos aceitos, etc.)
- Timeout de 8s nas chamadas ao TMDB, para o servidor nunca ficar "pendurado"
  caso a API externa esteja fora do ar

## Próximos passos sugeridos (não implementados aqui)

- Recuperação de senha por e-mail
- Deploy com HTTPS (ex: Render, Railway, Fly.io) — lembre de definir
  `NODE_ENV=production` para os cookies exigirem `secure`
- Migrar o SQLite para Postgres se o projeto crescer (o código de acesso a
  dados está isolado em `server/db/`, facilitando a troca)
- Testes automatizados (ex: Jest + Supertest) para as rotas da API

## Licença

Projeto de uso livre para fins de estudo/portfólio.
