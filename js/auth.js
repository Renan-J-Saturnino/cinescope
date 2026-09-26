// ─── ESTADO DE SESSÃO ───────────────────────────────────────
let currentUser = null;

async function initAuth() {
  try {
    const data = await api.me();
    currentUser = data.user;
  } catch (_) {
    currentUser = null;
  }
  renderAuthArea();
  return currentUser;
}

function renderAuthArea() {
  const el = document.getElementById('auth-area');
  if (currentUser) {
    el.innerHTML = `
      <span class="user-chip">Olá, <strong>${escapeHtml(currentUser.name.split(' ')[0])}</strong></span>
      <button class="btn-ghost" onclick="handleLogout()">Sair</button>
    `;
  } else {
    el.innerHTML = `<button class="btn-gold" onclick="openAuthModal()">ENTRAR</button>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── MODAL DE LOGIN/CADASTRO ────────────────────────────────
function openAuthModal(tab) {
  document.getElementById('auth-error').classList.remove('show');
  switchAuthTab(tab || 'login');
  document.getElementById('auth-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  document.getElementById('auth-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeAuthModalOutside(e) {
  if (e.target === document.getElementById('auth-modal-overlay')) closeAuthModal();
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('auth-tab-login').classList.toggle('active', isLogin);
  document.getElementById('auth-tab-register').classList.toggle('active', !isLogin);
  document.getElementById('login-form').style.display = isLogin ? '' : 'none';
  document.getElementById('register-form').style.display = isLogin ? 'none' : '';
  document.getElementById('auth-error').classList.remove('show');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.add('show');
}

async function handleLogin(evt) {
  evt.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');

  btn.disabled = true;
  try {
    const data = await api.login(email, password);
    currentUser = data.user;
    renderAuthArea();
    closeAuthModal();
    showToast(`Bem-vindo, ${currentUser.name.split(' ')[0]}!`, 'gold');
    await afterLoginRefresh();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.disabled = false;
  }
  return false;
}

async function handleRegister(evt) {
  evt.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const btn = document.getElementById('register-submit');

  btn.disabled = true;
  try {
    const data = await api.register(name, email, password);
    currentUser = data.user;
    renderAuthArea();
    closeAuthModal();
    showToast(`Conta criada! Bem-vindo, ${currentUser.name.split(' ')[0]}.`, 'gold');
    await afterLoginRefresh();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.disabled = false;
  }
  return false;
}

async function handleLogout() {
  try { await api.logout(); } catch (_) {}
  currentUser = null;
  favorites = {};
  ratings = {};
  renderAuthArea();
  updateFavCount();
  showToast('Você saiu da sua conta.');
  const activeTab = document.querySelector('.nav-btn.active');
  if (activeTab && activeTab.textContent.includes('Favoritos')) renderFavs();
  if (activeTab && activeTab.textContent.includes('Avaliados')) renderRated();
}

// Requer login para uma ação; se não estiver logado, abre o modal e retorna false.
function requireLogin() {
  if (currentUser) return true;
  showToast('Entre na sua conta para continuar.');
  openAuthModal('login');
  return false;
}
