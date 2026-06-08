// ============================================================
// SOCIAL CONNECT - Main App
// ============================================================
const API = '/api';
let currentUser = null;
let currentPage = null;
let authToken = localStorage.getItem('token');

// ============================================================
// UTILS
// ============================================================
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
function avatarEl(src, name, size = 44) {
  if (src) {
    const img = document.createElement('img');
    img.src = `/uploads/avatars/${src}`;
    img.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;`;
    img.onerror = () => img.replaceWith(initials(name, size));
    return img;
  }
  return initials(name, size);
}
function initials(name = '?', size = 44) {
  const d = el('div', 'avatar-placeholder');
  d.style.cssText = `width:${size}px;height:${size}px;font-size:${size * 0.4}px;`;
  d.textContent = name.charAt(0).toUpperCase();
  return d;
}
function timeAgo(dateStr) {
  const d = new Date(dateStr), now = Date.now(), diff = (now - d) / 1000;
  if (diff < 60) return 'เมื่อกี้';
  if (diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff/86400)} วันที่แล้ว`;
}
function formatNum(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'K' : n; }
function toast(msg, type = 'info') {
  let c = $('toast-container');
  if (!c) { c = el('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const t = el('div', `toast ${type}`, msg);
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

async function api(method, path, data, isForm = false) {
  const opts = { method, headers: {} };
  if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
  if (data) {
    if (isForm) { opts.body = data; }
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
  }
  const r = await fetch(API + path, opts);
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
  return json;
}

// ============================================================
// ROUTER
// ============================================================
const routes = {};
function route(path, fn) { routes[path] = fn; }
function navigate(path, push = true) {
  if (push) history.pushState({}, '', path);
  const parts = path.split('/').filter(Boolean);
  const key = '/' + (parts[0] || '');
  if (routes[key]) routes[key](parts);
  else renderNotFound();
  if (currentUser) updateSidebarActive(path);
}
window.addEventListener('popstate', () => navigate(location.pathname, false));

// ============================================================
// INIT
// ============================================================
async function init() {
  $('app').innerHTML = '<div class="loading-screen"><div class="loader"></div><p>กำลังโหลด...</p></div>';
  if (authToken) {
    try {
      const data = await api('GET', '/auth/me');
      currentUser = data.user;
      currentUser.pages = data.pages;
    } catch { authToken = null; localStorage.removeItem('token'); }
  }
  setupRoutes();
  navigate(location.pathname, false);
}

function setupRoutes() {
  route('/', () => { if (!requireAuth()) return; renderHome(); });
  route('/home', () => { if (!requireAuth()) return; renderHome(); });
  route('/register', () => renderRegister());
  route('/login', () => renderLogin());
  route('/verify-email', () => handleVerifyEmail());
  route('/set-password', () => renderSetPassword());
  route('/profile', (p) => { if (!requireAuth()) return; renderProfile(p[1] || currentUser.username); });
  route('/page', (p) => { if (!requireAuth()) return; renderPageProfile(p[1]); });
  route('/marketplace', () => { if (!requireAuth()) return; renderMarketplace(); });
  route('/live', () => { if (!requireAuth()) return; renderLivestream(); });
  route('/chat', () => { if (!requireAuth()) return; renderChat(); });
  route('/notifications', () => { if (!requireAuth()) return; renderNotifications(); });
  route('/settings', () => { if (!requireAuth()) return; renderSettings(); });
  route('/kyc', () => { if (!requireAuth()) return; renderKYC(); });
  route('/create-page', () => { if (!requireAuth()) return; renderCreatePage(); });
}

function requireAuth() {
  if (!currentUser) { navigate('/login'); return false; }
  return true;
}

// ============================================================
// LAYOUT
// ============================================================
function renderLayout(mainContent, activeNav = '') {
  $('app').innerHTML = `
    <nav id="navbar">
      <a class="nav-logo" href="/" onclick="navigate('/');return false;">SocialConnect</a>
      <div class="nav-search" style="position:relative;">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="ค้นหาผู้ใช้หรือเพจ..." id="nav-search-input" autocomplete="off">
        <div id="search-results" class="search-results" style="display:none;"></div>
      </div>
      <div class="nav-actions">
        <button class="nav-icon-btn" onclick="navigate('/notifications')"><i class="fas fa-bell"></i><span class="badge" id="notif-badge" style="display:none;"></span></button>
        <button class="nav-icon-btn" onclick="navigate('/chat')"><i class="fas fa-comment-dots"></i></button>
        <div class="dropdown">
          <button class="nav-icon-btn" id="user-menu-btn" onclick="toggleUserMenu()">
            ${currentUser ? `<img src="${currentUser.avatar ? '/uploads/avatars/'+currentUser.avatar : ''}" class="nav-avatar" onerror="this.style.display='none'" id="nav-av">` : '<i class="fas fa-user-circle"></i>'}
          </button>
          <div class="dropdown-menu" id="user-menu" style="display:none;">
            <div class="dropdown-item" onclick="navigate('/profile/${currentUser?.username}')"><i class="fas fa-user"></i> โปรไฟล์</div>
            <div class="dropdown-item" onclick="navigate('/create-page')"><i class="fas fa-flag"></i> สร้างเพจ</div>
            <div class="dropdown-item" onclick="navigate('/kyc')"><i class="fas fa-shield-alt"></i> ยืนยันตัวตน KYC</div>
            <div class="dropdown-item" onclick="navigate('/settings')"><i class="fas fa-cog"></i> ตั้งค่า</div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i> ออกจากระบบ</div>
          </div>
        </div>
      </div>
    </nav>
    <aside id="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-item ${activeNav==='home'?'active':''}" onclick="navigate('/home')"><i class="fas fa-home"></i> หน้าหลัก</div>
        <div class="sidebar-item ${activeNav==='profile'?'active':''}" onclick="navigate('/profile/${currentUser?.username}')"><i class="fas fa-user"></i> โปรไฟล์</div>
        <div class="sidebar-item ${activeNav==='marketplace'?'active':''}" onclick="navigate('/marketplace')"><i class="fas fa-store"></i> มาร์เก็ตเพลส</div>
        <div class="sidebar-item ${activeNav==='live'?'active':''}" onclick="navigate('/live')"><i class="fas fa-video"></i> ไลฟ์สด</div>
        <div class="sidebar-item ${activeNav==='chat'?'active':''}" onclick="navigate('/chat')"><i class="fas fa-comment-dots"></i> แชท</div>
        <div class="sidebar-item ${activeNav==='notifications'?'active':''}" onclick="navigate('/notifications')"><i class="fas fa-bell"></i> แจ้งเตือน</div>
        <div class="sidebar-item ${activeNav==='settings'?'active':''}" onclick="navigate('/settings')"><i class="fas fa-cog"></i> ตั้งค่า</div>
      </div>
      ${currentUser?.pages?.length ? `
      <div class="sidebar-section">
        <div class="sidebar-title">เพจของฉัน</div>
        ${currentUser.pages.map(p => `
          <div class="sidebar-item" onclick="navigate('/page/${p.username}')">
            <img src="${p.avatar ? '/uploads/avatars/'+p.avatar : ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;background:var(--bg);" onerror="this.style.display='none'">
            <span>${p.name}</span>
          </div>`).join('')}
      </div>` : ''}
      <div class="sidebar-section">
        <div class="sidebar-item" onclick="navigate('/create-page')"><i class="fas fa-plus-circle"></i> สร้างเพจใหม่</div>
        <div class="sidebar-item" onclick="navigate('/kyc')"><i class="fas fa-shield-alt"></i> ยืนยันตัวตน KYC</div>
      </div>
    </aside>
    <main id="main">${mainContent}</main>
  `;
  setupNavSearch();
  loadNotifBadge();
  document.addEventListener('click', (e) => {
    const menu = $('user-menu'); const btn = $('user-menu-btn');
    if (menu && !menu.contains(e.target) && !btn?.contains(e.target)) menu.style.display = 'none';
  });
}

function updateSidebarActive(path) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
}

function toggleUserMenu() {
  const m = $('user-menu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

async function loadNotifBadge() {
  try {
    const data = await api('GET', '/notifications');
    const unread = data.notifications.filter(n => !n.is_read).length;
    const badge = $('notif-badge');
    if (badge) { badge.textContent = unread; badge.style.display = unread ? 'block' : 'none'; }
  } catch {}
}

function setupNavSearch() {
  const input = $('nav-search-input');
  const results = $('search-results');
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (!input.value.trim()) { results.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      try {
        const data = await api('GET', `/search?q=${encodeURIComponent(input.value)}`);
        if (!data.users.length && !data.pages.length) { results.style.display = 'none'; return; }
        results.innerHTML = [
          ...data.users.map(u => `<div class="search-result-item" onclick="navigate('/profile/${u.username}');this.closest('.search-results').style.display='none'">
            <img src="${u.avatar?'/uploads/avatars/'+u.avatar:''}" class="search-result-avatar" onerror="this.style.display='none'">
            <div class="search-result-info"><div class="search-result-name">${u.first_name} ${u.last_name}</div><div class="search-result-sub">@${u.username}</div></div>
          </div>`),
          ...data.pages.map(p => `<div class="search-result-item" onclick="navigate('/page/${p.username}');this.closest('.search-results').style.display='none'">
            <img src="${p.avatar?'/uploads/avatars/'+p.avatar:''}" class="search-result-avatar" onerror="this.style.display='none'">
            <div class="search-result-info"><div class="search-result-name">${p.name}</div><div class="search-result-sub">เพจ</div></div>
          </div>`)
        ].join('');
        results.style.display = 'block';
      } catch {}
    }, 300);
  });
  document.addEventListener('click', (e) => { if (!input.contains(e.target)) results.style.display = 'none'; });
}

// ============================================================
// AUTH PAGES
// ============================================================
function renderLogin() {
  if (currentUser) { navigate('/'); return; }
  $('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><h1><i class="fas fa-circle-nodes"></i> SocialConnect</h1><p>เชื่อมต่อโลกใบนี้</p></div>
        <div class="auth-tabs">
          <button class="auth-tab" onclick="navigate('/register')">สมัครสมาชิก</button>
          <button class="auth-tab active">เข้าสู่ระบบ</button>
        </div>
        <form id="login-form">
          <div class="form-group"><label>อีเมล</label><input class="form-control" type="email" id="l-email" placeholder="example@email.com" required></div>
          <div class="form-group"><label>รหัสผ่าน</label><input class="form-control" type="password" id="l-pass" placeholder="รหัสผ่าน" required></div>
          <button class="btn btn-primary btn-full" type="submit" id="login-btn">เข้าสู่ระบบ</button>
        </form>
        <p style="text-align:center;margin-top:16px;font-size:14px;color:var(--text-muted);">ยังไม่มีบัญชี? <a href="/register" onclick="navigate('/register');return false;">สมัครสมาชิก</a></p>
      </div>
    </div>`;
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('login-btn'); btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
    try {
      const data = await api('POST', '/auth/login', { email: $('l-email').value, password: $('l-pass').value });
      authToken = data.token; localStorage.setItem('token', authToken);
      currentUser = data.user; currentUser.pages = [];
      toast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ', 'success');
      navigate('/');
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  });
}

function renderRegister() {
  if (currentUser) { navigate('/'); return; }
  $('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><h1><i class="fas fa-circle-nodes"></i> SocialConnect</h1><p>เชื่อมต่อโลกใบนี้</p></div>
        <div class="auth-tabs">
          <button class="auth-tab active">สมัครสมาชิก</button>
          <button class="auth-tab" onclick="navigate('/login')">เข้าสู่ระบบ</button>
        </div>
        <form id="reg-form">
          <div class="form-row">
            <div class="form-group"><label>ชื่อ *</label><input class="form-control" id="r-fname" placeholder="ชื่อ" required></div>
            <div class="form-group"><label>นามสกุล *</label><input class="form-control" id="r-lname" placeholder="นามสกุล" required></div>
          </div>
          <div class="form-group"><label>อีเมล *</label><input class="form-control" type="email" id="r-email" placeholder="example@email.com" required></div>
          <div class="form-group">
            <label>เบอร์โทรศัพท์</label>
            <div class="input-group">
              <select class="form-control" id="r-phonecode">
                <option value="+66">🇹🇭 +66</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+81">🇯🇵 +81</option>
                <option value="+86">🇨🇳 +86</option>
                <option value="+65">🇸🇬 +65</option>
                <option value="+60">🇲🇾 +60</option>
              </select>
              <input class="form-control" id="r-phone" placeholder="0812345678" type="tel">
            </div>
          </div>
          <div class="form-group"><label>วันเดือนปีเกิด</label><input class="form-control" type="date" id="r-birth"></div>
          <div class="form-group">
            <label>อาชีพ</label>
            <select class="form-control" id="r-occ">
              <option value="">-- เลือกอาชีพ --</option>
              <option>นักเรียน/นักศึกษา</option>
              <option>พนักงานบริษัท</option>
              <option>ข้าราชการ</option>
              <option>ธุรกิจส่วนตัว</option>
              <option>แพทย์/พยาบาล</option>
              <option>วิศวกร</option>
              <option>นักบัญชี</option>
              <option>ครู/อาจารย์</option>
              <option>เกษตรกร</option>
              <option>ฟรีแลนซ์</option>
              <option>อื่นๆ</option>
            </select>
          </div>
          <div class="form-group"><label>ที่อยู่</label><textarea class="form-control" id="r-addr" rows="2" placeholder="บ้านเลขที่ ถนน อำเภอ จังหวัด"></textarea></div>
          <div class="form-group"><label>สัญชาติ</label><input class="form-control" id="r-nat" placeholder="ไทย"></div>
          <div class="form-group">
            <label>ภาษา</label>
            <select class="form-control" id="r-lang">
              <option value="th">🇹🇭 ภาษาไทย</option>
              <option value="en">🇬🇧 English</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="ja">🇯🇵 日本語</option>
            </select>
          </div>
          <button class="btn btn-primary btn-full" type="submit" id="reg-btn">สมัครสมาชิก</button>
        </form>
        <p style="text-align:center;margin-top:16px;font-size:14px;color:var(--text-muted);">มีบัญชีแล้ว? <a href="/login" onclick="navigate('/login');return false;">เข้าสู่ระบบ</a></p>
      </div>
    </div>`;
  $('reg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('reg-btn'); btn.disabled = true; btn.textContent = 'กำลังสมัคร...';
    try {
      const data = await api('POST', '/auth/register', {
        first_name: $('r-fname').value, last_name: $('r-lname').value,
        email: $('r-email').value, phone_code: $('r-phonecode').value,
        phone: $('r-phone').value, birthdate: $('r-birth').value,
        occupation: $('r-occ').value, address: $('r-addr').value,
        nationality: $('r-nat').value, language: $('r-lang').value
      });
      $('app').innerHTML = `
        <div class="auth-page">
          <div class="auth-card" style="text-align:center;">
            <i class="fas fa-envelope-circle-check" style="font-size:64px;color:var(--primary);"></i>
            <h2 style="margin-top:16px;">สมัครสมาชิกสำเร็จ!</h2>
            <p style="color:var(--text-muted);margin-top:8px;">กรุณาตรวจสอบอีเมลของคุณ</p>
            <div style="background:var(--bg);border-radius:12px;padding:20px;margin-top:20px;text-align:left;">
              <p style="font-weight:700;margin-bottom:12px;">ขั้นตอนถัดไป:</p>
              <p>1. <a href="${data.verify_link}" onclick="navigate('/verify-email?token=${data.verify_link.split('=')[1]}');return false;">คลิกลิงค์ยืนยันอีเมล</a></p>
              <p style="margin-top:8px;">2. <a href="${data.password_link}" onclick="navigate('/set-password?token=${data.password_link.split('=')[1]}');return false;">คลิกลิงค์ตั้งรหัสผ่าน</a></p>
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:16px;">(ในระบบจริง ลิงค์จะถูกส่งไปที่อีเมลของคุณ)</p>
          </div>
        </div>`;
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'สมัครสมาชิก'; }
  });
}

async function handleVerifyEmail() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  $('app').innerHTML = '<div class="loading-screen"><div class="loader"></div><p>กำลังยืนยันอีเมล...</p></div>';
  try {
    await api('GET', `/auth/verify-email?token=${token}`);
    $('app').innerHTML = `<div class="auth-page"><div class="auth-card" style="text-align:center;"><i class="fas fa-circle-check" style="font-size:64px;color:var(--green);"></i><h2 style="margin-top:16px;">ยืนยันอีเมลสำเร็จ!</h2><p style="margin-top:8px;color:var(--text-muted);">กรุณาตั้งรหัสผ่านเพื่อเข้าใช้งาน</p><a href="/set-password?token=${token}" onclick="navigate('/set-password?token=${token}');return false;" class="btn btn-primary" style="display:inline-block;margin-top:20px;">ตั้งรหัสผ่าน</a></div></div>`;
  } catch (err) {
    $('app').innerHTML = `<div class="auth-page"><div class="auth-card" style="text-align:center;"><i class="fas fa-circle-xmark" style="font-size:64px;color:var(--red);"></i><h2 style="margin-top:16px;">Token ไม่ถูกต้อง</h2><p style="color:var(--text-muted);">${err.message}</p></div></div>`;
  }
}

function renderSetPassword() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  $('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo"><h1><i class="fas fa-lock"></i> ตั้งรหัสผ่าน</h1></div>
        <form id="pw-form">
          <div class="form-group"><label>รหัสผ่านใหม่</label><input class="form-control" type="password" id="pw1" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)" minlength="8" required></div>
          <div class="form-group"><label>ยืนยันรหัสผ่าน</label><input class="form-control" type="password" id="pw2" placeholder="ยืนยันรหัสผ่าน" required></div>
          <button class="btn btn-primary btn-full" type="submit" id="pw-btn">บันทึกรหัสผ่าน</button>
        </form>
      </div>
    </div>`;
  $('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if ($('pw1').value !== $('pw2').value) { toast('รหัสผ่านไม่ตรงกัน', 'error'); return; }
    try {
      await api('POST', '/auth/set-password', { token, password: $('pw1').value });
      toast('ตั้งรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบ', 'success');
      navigate('/login');
    } catch (err) { toast(err.message, 'error'); }
  });
}

function logout() {
  authToken = null; currentUser = null;
  localStorage.removeItem('token');
  navigate('/login');
}

// ============================================================
// HOME FEED
// ============================================================
async function renderHome() {
  renderLayout(`
    <div class="page-content">
      <div id="create-post-area"></div>
      <div id="posts-feed"><div class="loading-screen" style="height:200px;"><div class="loader"></div></div></div>
    </div>`, 'home');
  renderCreatePost('user', currentUser.id);
  loadFeed();
}

function renderCreatePost(authorType, authorId) {
  const area = $('create-post-area');
  if (!area) return;
  area.innerHTML = `
    <div class="card create-post">
      <div class="create-post-input">
        ${authorType === 'user' ? `<img src="${currentUser.avatar?'/uploads/avatars/'+currentUser.avatar:''}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--bg);" onerror="this.style.display='none'">` : ''}
        <textarea id="post-text" placeholder="คุณกำลังคิดอะไรอยู่?" rows="1" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
      </div>
      <div class="post-media-preview" id="media-preview"></div>
      <div class="create-post-actions">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;"><i class="fas fa-image"></i> รูปภาพ/วิดีโอ<input type="file" accept="image/*,video/*" multiple style="display:none;" id="post-media-input" onchange="previewPostMedia(this)"></label>
        <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="submitPost('${authorType}','${authorId}')"><i class="fas fa-paper-plane"></i> โพสต์</button>
      </div>
    </div>`;
}

function previewPostMedia(input) {
  const preview = $('media-preview');
  preview.innerHTML = '';
  Array.from(input.files).forEach((f, i) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const item = el('div', 'preview-item');
      item.innerHTML = `<img src="${ev.target.result}"><button class="remove-preview" onclick="removePreviewMedia(${i})">×</button>`;
      preview.appendChild(item);
    };
    reader.readAsDataURL(f);
  });
}

function removePreviewMedia(idx) {
  const input = $('post-media-input');
  const dt = new DataTransfer();
  Array.from(input.files).forEach((f, i) => { if (i !== idx) dt.items.add(f); });
  input.files = dt.files;
  previewPostMedia(input);
}

async function submitPost(authorType, authorId) {
  const text = $('post-text').value.trim();
  const mediaInput = $('post-media-input');
  if (!text && (!mediaInput?.files || !mediaInput.files.length)) { toast('กรุณากรอกข้อความหรือเลือกรูปภาพ', 'error'); return; }
  const form = new FormData();
  form.append('content', text);
  form.append('author_type', authorType);
  form.append('author_id', authorId);
  if (mediaInput?.files) Array.from(mediaInput.files).forEach(f => form.append('media', f));
  try {
    await api('POST', '/posts', form, true);
    toast('โพสต์สำเร็จ!', 'success');
    $('post-text').value = '';
    $('media-preview').innerHTML = '';
    loadFeed();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadFeed(authorType, authorId) {
  const feed = $('posts-feed');
  if (!feed) return;
  try {
    const q = authorType && authorId ? `?author_type=${authorType}&author_id=${authorId}` : '';
    const data = await api('GET', `/posts${q}`);
    if (!data.posts.length) {
      feed.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><h3>ยังไม่มีโพสต์</h3><p>เริ่มโพสต์หรือติดตามเพื่อนเพื่อเห็นโพสต์</p></div>';
      return;
    }
    feed.innerHTML = data.posts.map(post => renderPostCard(post)).join('');
    attachPostHandlers();
  } catch (err) { feed.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`; }
}

function renderPostCard(post) {
  const media = post.media ? (() => { try { return JSON.parse(post.media); } catch { return []; } })() : [];
  const authorName = post.author?.first_name ? `${post.author.first_name} ${post.author.last_name}` : (post.author?.name || 'ผู้ใช้');
  const authorLink = post.author_type === 'user' ? `/profile/${post.author?.username}` : `/page/${post.author?.username}`;
  const kyc = post.author_type === 'user' && post.author?.kyc_status === 'verified';
  return `
    <div class="card post-card" id="post-${post.id}">
      <div class="post-header">
        <img src="${post.author?.avatar ? '/uploads/avatars/'+post.author.avatar : ''}" class="post-author-avatar" onerror="this.style.display='none'" onclick="navigate('${authorLink}')">
        <div class="post-author-info">
          <div class="post-author-name" onclick="navigate('${authorLink}')">${authorName} ${kyc ? '<i class="fas fa-circle-check verified-badge"></i>' : ''}</div>
          <div class="post-time">${timeAgo(post.created_at)}</div>
        </div>
        <button class="btn btn-outline btn-xs" onclick="showDonateModal('post',${post.id})"><i class="fas fa-gift"></i> โดเนท</button>
      </div>
      ${post.content ? `<div class="post-body">${post.content.replace(/\n/g,'<br>')}</div>` : ''}
      ${media.length ? `<div class="post-media">${media.map(m => m.match(/\.(mp4|webm)$/i) ? `<video src="/uploads/posts/${m}" controls></video>` : `<img src="/uploads/posts/${m}">`).join('')}</div>` : ''}
      <div class="post-stats">
        <span><i class="fas fa-thumbs-up" style="color:var(--primary)"></i> ${formatNum(post.like_count||0)}</span>
        <span>${formatNum(post.comment_count||0)} ความคิดเห็น</span>
        <span>${formatNum(post.share_count||0)} แชร์</span>
        <span style="margin-left:auto;"><i class="fas fa-eye"></i> ${formatNum(post.views||0)}</span>
      </div>
      <div class="post-actions">
        <button class="post-action-btn ${post.user_liked ? 'liked' : ''}" data-like="${post.id}"><i class="fas fa-thumbs-up"></i> ถูกใจ</button>
        <button class="post-action-btn" data-comment="${post.id}"><i class="fas fa-comment"></i> คอมเม้นท์</button>
        <button class="post-action-btn" data-share="${post.id}"><i class="fas fa-share"></i> แชร์</button>
      </div>
      <div class="post-comments" id="comments-${post.id}" style="display:none;"></div>
    </div>`;
}

function attachPostHandlers() {
  document.querySelectorAll('[data-like]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.like;
      try {
        const r = await api('POST', `/posts/${id}/like`);
        btn.classList.toggle('liked', r.liked);
        const card = $(`post-${id}`);
        const likeSpan = card?.querySelector('.post-stats span');
        if (likeSpan) {
          const count = parseInt(likeSpan.textContent.replace(/[^0-9]/g, '')) || 0;
          likeSpan.innerHTML = `<i class="fas fa-thumbs-up" style="color:var(--primary)"></i> ${formatNum(r.liked ? count+1 : count-1)}`;
        }
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  document.querySelectorAll('[data-comment]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.comment;
      const section = $(`comments-${id}`);
      if (!section) return;
      if (section.style.display !== 'none') { section.style.display = 'none'; return; }
      section.style.display = 'block';
      const data = await api('GET', `/posts/${id}/comments`);
      section.innerHTML = `
        ${data.comments.map(c => `
          <div class="comment-item">
            <img src="${c.avatar?'/uploads/avatars/'+c.avatar:''}" class="comment-avatar" onerror="this.style.display='none'">
            <div class="comment-bubble"><div class="comment-author">${c.first_name} ${c.last_name}</div><div class="comment-text">${c.content}</div></div>
          </div>`).join('')}
        <div class="comment-input">
          <img src="${currentUser?.avatar?'/uploads/avatars/'+currentUser.avatar:''}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
          <textarea id="c-input-${id}" placeholder="เขียนความคิดเห็น..." rows="1"></textarea>
          <button class="btn btn-primary btn-xs" onclick="submitComment(${id})"><i class="fas fa-paper-plane"></i></button>
        </div>`;
    });
  });
  document.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.share;
      await api('POST', `/posts/${id}/share`);
      const shareUrl = `${location.origin}/post/${id}`;
      navigator.clipboard?.writeText(shareUrl).then(() => toast('คัดลอกลิงค์แล้ว!', 'success')).catch(() => toast('แชร์สำเร็จ!', 'success'));
    });
  });
}

async function submitComment(postId) {
  const input = $(`c-input-${postId}`);
  if (!input || !input.value.trim()) return;
  try {
    await api('POST', `/posts/${postId}/comments`, { content: input.value });
    input.value = '';
    const btn = document.querySelector(`[data-comment="${postId}"]`);
    if (btn) btn.click(); btn.click();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// PROFILE PAGE
// ============================================================
async function renderProfile(username) {
  renderLayout('<div class="loading-screen" style="height:300px;"><div class="loader"></div></div>', 'profile');
  try {
    const data = await api('GET', `/users/${username}`);
    const user = data.user;
    const isOwn = currentUser && currentUser.id === user.id;
    const followData = !isOwn ? await api('GET', `/follow/check?target_type=user&target_id=${user.id}`) : null;
    const isFollowing = followData?.following;

    $('main').innerHTML = `
      <div style="max-width:900px;margin:0 auto;">
        <div class="card" style="margin-bottom:16px;">
          <div class="profile-cover">
            ${user.cover_photo ? `<img src="/uploads/covers/${user.cover_photo}">` : ''}
            ${isOwn ? `<label class="btn btn-secondary btn-sm profile-cover-edit" style="cursor:pointer;"><i class="fas fa-camera"></i> เปลี่ยนภาพปก<input type="file" accept="image/*" style="display:none;" onchange="uploadCover(this)"></label>` : ''}
          </div>
          <div class="profile-info">
            <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">
              <div class="profile-avatar-wrap">
                <img src="${user.avatar ? '/uploads/avatars/'+user.avatar : ''}" class="profile-avatar" onerror="this.src=''">
                ${isOwn ? `<label class="profile-avatar-edit" style="cursor:pointer;"><i class="fas fa-camera"></i><input type="file" accept="image/*" style="display:none;" onchange="uploadAvatar(this)"></label>` : ''}
              </div>
              <div style="flex:1;">
                <div class="profile-name">${user.first_name} ${user.last_name} ${user.kyc_status==='verified'?'<i class="fas fa-circle-check verified-badge"></i>':''}</div>
                <div class="profile-username">@${user.username}</div>
                ${user.bio ? `<div class="profile-bio">${user.bio}</div>` : ''}
              </div>
              <div class="profile-actions">
                ${isOwn ? `<button class="btn btn-secondary" onclick="showEditProfile()"><i class="fas fa-edit"></i> แก้ไขโปรไฟล์</button>` :
                  `<button class="btn ${isFollowing?'btn-secondary':'btn-primary'}" onclick="toggleFollow('user',${user.id},this)">${isFollowing?'<i class="fas fa-user-check"></i> ติดตามแล้ว':'<i class="fas fa-user-plus"></i> ติดตาม'}</button>
                  <button class="btn btn-outline" onclick="startChat(${user.id})"><i class="fas fa-comment"></i> แชท</button>`}
                <button class="btn btn-outline btn-sm" onclick="shareProfile('user','${user.username}')"><i class="fas fa-share"></i></button>
              </div>
            </div>
            <div class="profile-stats">
              <div class="profile-stat"><div class="profile-stat-num">${formatNum(data.stats.posts)}</div><div class="profile-stat-label">โพสต์</div></div>
              <div class="profile-stat"><div class="profile-stat-num">${formatNum(data.stats.followers)}</div><div class="profile-stat-label">ผู้ติดตาม</div></div>
              <div class="profile-stat"><div class="profile-stat-num">${formatNum(data.stats.following)}</div><div class="profile-stat-label">กำลังติดตาม</div></div>
            </div>
            <div class="profile-url"><i class="fas fa-link"></i> ${location.origin}/profile/${user.username} <button class="btn btn-xs btn-outline" onclick="shareProfile('user','${user.username}')">คัดลอก</button></div>
          </div>
        </div>

        <div class="profile-tabs">
          <div class="profile-tab active" onclick="showProfileTab('posts',this,'user',${user.id})">โพสต์</div>
          <div class="profile-tab" onclick="navigate('/marketplace')">มาร์เก็ตเพลส (ซื้อ)</div>
          <div class="profile-tab" onclick="navigate('/live')">ไลฟ์สด (ดู)</div>
        </div>
        <div id="profile-tab-content">
          ${isOwn ? '<div id="create-post-area"></div>' : ''}
          <div id="posts-feed"></div>
        </div>
      </div>`;
    if (isOwn) renderCreatePost('user', user.id);
    loadFeed('user', user.id);
  } catch (err) { $('main').innerHTML = `<div class="empty-state"><i class="fas fa-user-slash"></i><h3>${err.message}</h3></div>`; }
}

function showProfileTab(tab, el, type, id) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'posts') loadFeed(type, id);
}

async function toggleFollow(type, id, btn) {
  try {
    const data = await api('POST', '/follow', { target_type: type, target_id: id });
    if (data.followed) { btn.className = 'btn btn-secondary'; btn.innerHTML = `<i class="fas fa-user-check"></i> ติดตามแล้ว`; }
    else { btn.className = 'btn btn-primary'; btn.innerHTML = `<i class="fas fa-user-plus"></i> ติดตาม`; }
  } catch (err) { toast(err.message, 'error'); }
}

async function startChat(userId) {
  try {
    const data = await api('POST', '/chats/direct', { target_user_id: userId });
    navigate(`/chat?room=${data.room.id}`);
  } catch (err) { toast(err.message, 'error'); }
}

function shareProfile(type, username) {
  const url = `${location.origin}/${type === 'user' ? 'profile' : 'page'}/${username}`;
  navigator.clipboard?.writeText(url).then(() => toast('คัดลอกลิงค์โปรไฟล์แล้ว!', 'success')).catch(() => showModal('แชร์โปรไฟล์', `<div class="share-link-box"><input value="${url}" readonly onclick="this.select()"><button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('คัดลอกแล้ว!','success'))">คัดลอก</button></div>`));
}

function showEditProfile() {
  showModal('แก้ไขโปรไฟล์', `
    <form id="edit-profile-form">
      <div class="form-group"><label>ชื่อผู้ใช้ (URL)</label><input class="form-control" id="ep-username" value="${currentUser.username}" placeholder="username"></div>
      <div class="form-group"><label>ประวัติส่วนตัว</label><textarea class="form-control" id="ep-bio" rows="3" placeholder="เขียนอะไรเกี่ยวกับตัวคุณ...">${currentUser.bio||''}</textarea></div>
      <div class="form-group"><label>ที่อยู่</label><input class="form-control" id="ep-addr" value="${currentUser.address||''}" placeholder="ที่อยู่"></div>
      <div class="form-group"><label>อาชีพ</label><input class="form-control" id="ep-occ" value="${currentUser.occupation||''}" placeholder="อาชีพ"></div>
    </form>`, async () => {
    try {
      const form = new FormData();
      form.append('username', $('ep-username').value);
      form.append('bio', $('ep-bio').value);
      form.append('address', $('ep-addr').value);
      form.append('occupation', $('ep-occ').value);
      const data = await api('PUT', '/users/me', form, true);
      currentUser = { ...currentUser, ...data.user };
      toast('บันทึกโปรไฟล์สำเร็จ!', 'success');
      closeModal();
      navigate(`/profile/${currentUser.username}`);
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function uploadAvatar(input) {
  const form = new FormData(); form.append('avatar', input.files[0]);
  try { const d = await api('PUT', '/users/me', form, true); currentUser.avatar = d.user.avatar; toast('เปลี่ยนรูปโปรไฟล์สำเร็จ!', 'success'); navigate(`/profile/${currentUser.username}`); }
  catch (err) { toast(err.message, 'error'); }
}

async function uploadCover(input) {
  const form = new FormData(); form.append('cover', input.files[0]);
  try { await api('PUT', '/users/me', form, true); toast('เปลี่ยนภาพปกสำเร็จ!', 'success'); navigate(`/profile/${currentUser.username}`); }
  catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// PAGE PROFILE
// ============================================================
async function renderPageProfile(username) {
  renderLayout('<div class="loading-screen" style="height:300px;"><div class="loader"></div></div>');
  try {
    const data = await api('GET', `/pages/${username}`);
    const page = data.page;
    const isOwner = currentUser && currentUser.id === page.owner_id;
    const followData = !isOwner ? await api('GET', `/follow/check?target_type=page&target_id=${page.id}`) : null;

    $('main').innerHTML = `
      <div style="max-width:900px;margin:0 auto;">
        <div class="card" style="margin-bottom:16px;">
          <div class="profile-cover">
            ${page.cover_photo ? `<img src="/uploads/covers/${page.cover_photo}">` : ''}
          </div>
          <div class="profile-info">
            <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">
              <div class="profile-avatar-wrap">
                <img src="${page.avatar ? '/uploads/avatars/'+page.avatar : ''}" class="profile-avatar" onerror="this.src=''">
              </div>
              <div style="flex:1;">
                <div class="profile-name">${page.name} <span class="tag blue">เพจ</span></div>
                <div class="profile-username">@${page.username}</div>
                ${page.description ? `<div class="profile-bio">${page.description}</div>` : ''}
                ${page.category ? `<div style="margin-top:6px;"><span class="tag">${page.category}</span></div>` : ''}
              </div>
              <div class="profile-actions">
                ${isOwner ? `<button class="btn btn-secondary" onclick="showEditPage(${page.id})"><i class="fas fa-edit"></i> แก้ไขเพจ</button>` :
                  `<button class="btn ${followData?.following?'btn-secondary':'btn-primary'}" onclick="toggleFollow('page',${page.id},this)">${followData?.following?'<i class="fas fa-bookmark"></i> ติดตามแล้ว':'<i class="fas fa-bookmark"></i> ติดตาม'}</button>`}
                <button class="btn btn-outline btn-sm" onclick="shareProfile('page','${page.username}')"><i class="fas fa-share"></i></button>
              </div>
            </div>
            <div class="profile-stats">
              <div class="profile-stat"><div class="profile-stat-num">${formatNum(data.stats.posts)}</div><div class="profile-stat-label">โพสต์</div></div>
              <div class="profile-stat"><div class="profile-stat-num">${formatNum(data.stats.followers)}</div><div class="profile-stat-label">ผู้ติดตาม</div></div>
            </div>
          </div>
        </div>

        <div class="profile-tabs">
          <div class="profile-tab active" id="tab-posts" onclick="showPageTab('posts',this,${page.id})">โพสต์</div>
          <div class="profile-tab" id="tab-marketplace" onclick="showPageTab('marketplace',this,${page.id})">มาร์เก็ตเพลส ${isOwner?'(ลงขาย)':'(ซื้อ)'}</div>
          <div class="profile-tab" id="tab-live" onclick="showPageTab('live',this,${page.id})">ไลฟ์สด ${isOwner?'(ไลฟ์ได้)':'(ดูไลฟ์)'}</div>
          <div class="profile-tab" onclick="navigate('/notifications')">แจ้งเตือน</div>
          <div class="profile-tab" onclick="navigate('/settings')">ตั้งค่า</div>
        </div>
        <div id="page-tab-content">
          ${isOwner ? '<div id="create-post-area"></div>' : ''}
          <div id="posts-feed"></div>
        </div>
      </div>`;
    if (isOwner) renderCreatePost('page', page.id);
    loadFeed('page', page.id);
    window._currentPageData = { page, isOwner };
  } catch (err) { $('main').innerHTML = `<div class="empty-state"><i class="fas fa-flag"></i><h3>${err.message}</h3></div>`; }
}

function showPageTab(tab, el, pageId) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const content = $('page-tab-content');
  const { page, isOwner } = window._currentPageData || {};
  if (tab === 'posts') {
    content.innerHTML = `${isOwner ? '<div id="create-post-area"></div>' : ''}<div id="posts-feed"></div>`;
    if (isOwner) renderCreatePost('page', pageId);
    loadFeed('page', pageId);
  } else if (tab === 'marketplace') {
    if (isOwner) {
      content.innerHTML = `<div style="margin-bottom:16px;"><button class="btn btn-primary" onclick="showCreateListing(${pageId})"><i class="fas fa-plus"></i> ลงประกาศขาย</button></div><div id="page-listings"></div>`;
      loadPageListings(pageId);
    } else {
      content.innerHTML = '<div id="posts-feed"><div class="loading-screen" style="height:200px;"><div class="loader"></div></div></div>';
      loadMarketplaceItems();
    }
  } else if (tab === 'live') {
    if (isOwner) {
      content.innerHTML = `<button class="btn btn-danger" onclick="showStartLive(${pageId})"><i class="fas fa-video"></i> เริ่มไลฟ์สด</button><div id="page-lives" style="margin-top:16px;"></div>`;
    } else {
      content.innerHTML = '<div id="posts-feed"></div>';
      loadLivestreamGrid();
    }
  }
}

async function loadPageListings(pageId) {
  try {
    const data = await api('GET', `/marketplace?page_id=${pageId}`);
    const el2 = $('page-listings');
    if (!el2) return;
    if (!data.items.length) { el2.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h3>ยังไม่มีสินค้า</h3></div>'; return; }
    el2.innerHTML = `<div class="marketplace-grid">${data.items.map(item => renderProductCard(item)).join('')}</div>`;
  } catch {}
}

// ============================================================
// MARKETPLACE
// ============================================================
async function renderMarketplace() {
  renderLayout(`
    <div class="wide-content">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h2><i class="fas fa-store"></i> มาร์เก็ตเพลส</h2>
        <div style="display:flex;gap:10px;">
          <select class="form-control" style="width:auto;" id="cat-filter" onchange="loadMarketplaceItems()">
            <option value="">ทุกหมวดหมู่</option>
            <option>อิเล็กทรอนิกส์</option>
            <option>เสื้อผ้า</option>
            <option>อาหาร</option>
            <option>รถยนต์</option>
            <option>บ้านและสวน</option>
            <option>กีฬา</option>
            <option>อื่นๆ</option>
          </select>
        </div>
      </div>
      <div id="marketplace-grid"></div>
    </div>`, 'marketplace');
  loadMarketplaceItems();
}

async function loadMarketplaceItems() {
  const grid = $('marketplace-grid') || document.querySelector('#posts-feed');
  if (!grid) return;
  try {
    const cat = $('cat-filter')?.value || '';
    const data = await api('GET', `/marketplace${cat ? '?category='+encodeURIComponent(cat) : ''}`);
    if (!data.items.length) { grid.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h3>ไม่มีสินค้า</h3></div>'; return; }
    grid.innerHTML = `<div class="marketplace-grid">${data.items.map(item => renderProductCard(item)).join('')}</div>`;
  } catch (err) { grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation"></i><h3>${err.message}</h3></div>`; }
}

function renderProductCard(item) {
  const images = (() => { try { return JSON.parse(item.images); } catch { return []; } })();
  return `
    <div class="product-card" onclick="showProductDetail(${item.id})">
      ${images.length ? `<img src="/uploads/marketplace/${images[0]}" class="product-img">` : `<div class="product-img" style="display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="font-size:48px;color:var(--border);"></i></div>`}
      <div class="product-info">
        <div class="product-title">${item.title}</div>
        <div class="product-price">฿${Number(item.price).toLocaleString()}</div>
        <div class="product-seller"><i class="fas fa-store"></i> ${item.page_name||'ร้านค้า'}</div>
        <span class="product-badge ${item.condition==='new'?'new':'used'}">${item.condition==='new'?'ใหม่':'มือสอง'}</span>
      </div>
    </div>`;
}

function showProductDetail(id) { toast('ฟังก์ชันแสดงรายละเอียดสินค้า (เพิ่มเติมได้)', 'info'); }

function showCreateListing(pageId) {
  showModal('ลงประกาศขายสินค้า', `
    <form id="listing-form">
      <div class="form-group"><label>ชื่อสินค้า *</label><input class="form-control" id="l-title" required></div>
      <div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="l-desc" rows="3"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>ราคา (บาท) *</label><input class="form-control" type="number" id="l-price" min="0" required></div>
        <div class="form-group"><label>จำนวนสต็อก</label><input class="form-control" type="number" id="l-stock" value="1" min="0"></div>
      </div>
      <div class="form-group"><label>หมวดหมู่</label><select class="form-control" id="l-cat"><option value="">-- เลือก --</option><option>อิเล็กทรอนิกส์</option><option>เสื้อผ้า</option><option>อาหาร</option><option>รถยนต์</option><option>บ้านและสวน</option><option>กีฬา</option><option>อื่นๆ</option></select></div>
      <div class="form-group"><label>สภาพสินค้า</label><select class="form-control" id="l-cond"><option value="new">ใหม่</option><option value="used">มือสอง</option></select></div>
      <div class="form-group"><label>รูปภาพสินค้า</label><input type="file" accept="image/*" multiple id="l-imgs" class="form-control"></div>
    </form>`, async () => {
    const form = new FormData();
    form.append('page_id', pageId);
    form.append('title', $('l-title').value);
    form.append('description', $('l-desc').value);
    form.append('price', $('l-price').value);
    form.append('stock', $('l-stock').value);
    form.append('category', $('l-cat').value);
    form.append('condition', $('l-cond').value);
    Array.from($('l-imgs').files).forEach(f => form.append('images', f));
    try { await api('POST', '/marketplace', form, true); toast('ลงประกาศสำเร็จ!', 'success'); closeModal(); loadPageListings(pageId); }
    catch (err) { toast(err.message, 'error'); }
  });
}

// ============================================================
// LIVESTREAM
// ============================================================
async function renderLivestream() {
  renderLayout(`
    <div class="wide-content">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h2><i class="fas fa-video" style="color:var(--red)"></i> ไลฟ์สดกำลังออกอากาศ</h2>
      </div>
      <div id="live-grid"></div>
    </div>`, 'live');
  loadLivestreamGrid();
}

async function loadLivestreamGrid() {
  const grid = $('live-grid') || document.querySelector('#posts-feed');
  if (!grid) return;
  try {
    const data = await api('GET', '/livestreams');
    if (!data.livestreams.length) { grid.innerHTML = '<div class="empty-state"><i class="fas fa-video-slash"></i><h3>ไม่มีไลฟ์สดในขณะนี้</h3><p>ติดตามเพจที่คุณชื่นชอบเพื่อรับแจ้งเตือนเมื่อเริ่มไลฟ์</p></div>'; return; }
    grid.innerHTML = `<div class="live-grid">${data.livestreams.map(l => `
      <div class="live-card" onclick="watchLive(${l.id})">
        <div class="live-thumb">
          ${l.thumbnail ? `<img src="/uploads/livestream/${l.thumbnail}">` : '<i class="fas fa-video" style="font-size:48px;color:#444;"></i>'}
          <div class="live-badge"><i class="fas fa-circle"></i> LIVE</div>
          <div class="live-viewers"><i class="fas fa-eye"></i> ${formatNum(l.viewer_count)}</div>
        </div>
        <div class="live-info">
          <div class="live-title">${l.title}</div>
          <div class="live-page"><i class="fas fa-store"></i> ${l.page_name}</div>
        </div>
      </div>`).join('')}</div>`;
  } catch (err) { grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation"></i><h3>${err.message}</h3></div>`; }
}

function watchLive(id) { toast('เปิดหน้าต่างดูไลฟ์สด (สามารถต่อเชื่อม streaming server ได้)', 'info'); }

function showStartLive(pageId) {
  showModal('เริ่มไลฟ์สด', `
    <form id="live-form">
      <div class="form-group"><label>ชื่อไลฟ์สด *</label><input class="form-control" id="lv-title" placeholder="หัวข้อไลฟ์สดของคุณ" required></div>
      <div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="lv-desc" rows="2"></textarea></div>
    </form>`, async () => {
    try {
      const data = await api('POST', '/livestreams', { page_id: pageId, title: $('lv-title').value, description: $('lv-desc').value });
      toast(`เริ่มไลฟ์สดสำเร็จ! Stream Key: ${data.stream_key}`, 'success');
      closeModal();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ============================================================
// CHAT
// ============================================================
async function renderChat() {
  renderLayout(`<div class="wide-content"><div class="chat-layout" id="chat-layout"><div class="chat-sidebar" id="chat-sidebar"><div class="chat-sidebar-header">แชท</div><div id="chat-list"></div></div><div class="chat-main" id="chat-main" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);"><i class="fas fa-comment-dots" style="font-size:48px;opacity:0.3;"></i></div></div></div>`, 'chat');
  loadChatList();
  const params = new URLSearchParams(location.search);
  const roomId = params.get('room');
  if (roomId) openChat(roomId);
}

async function loadChatList() {
  const list = $('chat-list');
  if (!list) return;
  try {
    const data = await api('GET', '/chats');
    if (!data.rooms.length) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">ยังไม่มีแชท</div>'; return; }
    list.innerHTML = data.rooms.map(r => `
      <div class="chat-item" onclick="openChat(${r.id})">
        <div class="avatar-placeholder" style="width:44px;height:44px;font-size:18px;">${(r.name||'C').charAt(0)}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${r.name||'การสนทนา'}</div>
          <div class="chat-item-last">${r.last_message||'เริ่มต้นการสนทนา'}</div>
        </div>
        ${r.unread_count > 0 ? `<div class="chat-unread">${r.unread_count}</div>` : ''}
      </div>`).join('');
  } catch {}
}

async function openChat(roomId) {
  const main = $('chat-main');
  if (!main) return;
  main.innerHTML = '<div class="loading-screen" style="height:100%;"><div class="loader"></div></div>';
  try {
    const data = await api('GET', `/chats/${roomId}/messages`);
    main.innerHTML = `
      <div class="chat-header">
        <div class="avatar-placeholder" style="width:36px;height:36px;font-size:14px;">C</div>
        <div style="flex:1;font-weight:700;">การสนทนา</div>
      </div>
      <div class="chat-messages" id="chat-msgs">
        ${data.messages.map(m => `
          <div class="message-row ${m.sender_id === currentUser.id ? 'own' : ''}">
            ${m.sender_id !== currentUser.id ? `<img src="${m.avatar?'/uploads/avatars/'+m.avatar:''}" class="message-avatar" onerror="this.style.display='none'">` : ''}
            <div>
              <div class="message-bubble">${m.content}</div>
              <div class="message-time">${timeAgo(m.created_at)}</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="chat-input">
        <textarea id="msg-input" placeholder="พิมพ์ข้อความ..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg(${roomId});}"></textarea>
        <button class="btn btn-primary" onclick="sendMsg(${roomId})"><i class="fas fa-paper-plane"></i></button>
      </div>`;
    const msgs = $('chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  } catch (err) { main.innerHTML = `<div style="padding:20px;color:var(--red);">${err.message}</div>`; }
}

async function sendMsg(roomId) {
  const input = $('msg-input');
  if (!input || !input.value.trim()) return;
  const text = input.value; input.value = '';
  try {
    await api('POST', `/chats/${roomId}/messages`, { content: text });
    openChat(roomId);
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function renderNotifications() {
  renderLayout('<div class="page-content"><div class="card"><div class="card-header"><h2><i class="fas fa-bell"></i> การแจ้งเตือน</h2><button class="btn btn-outline btn-sm" onclick="markAllRead()">อ่านทั้งหมด</button></div><div id="notif-list"></div></div></div>', 'notifications');
  try {
    const data = await api('GET', '/notifications');
    const list = $('notif-list');
    if (!data.notifications.length) { list.innerHTML = '<div class="empty-state" style="padding:40px;"><i class="fas fa-bell-slash"></i><h3>ไม่มีการแจ้งเตือน</h3></div>'; return; }
    const icons = { follow:'fa-user-plus follow', like:'fa-heart like', comment:'fa-comment comment', donate:'fa-gift donate' };
    list.innerHTML = data.notifications.map(n => `
      <div class="notif-item ${n.is_read?'':'unread'}">
        <div class="notif-icon ${icons[n.type]?.split(' ')[1]||''}"><i class="fas ${icons[n.type]?.split(' ')[0]||'fa-bell'}"></i></div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-body">${n.body||''}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');
  } catch (err) { toast(err.message, 'error'); }
}

async function markAllRead() {
  try { await api('PUT', '/notifications/read-all'); toast('อ่านทั้งหมดแล้ว', 'success'); loadNotifBadge(); renderNotifications(); } catch {}
}

// ============================================================
// SETTINGS
// ============================================================
async function renderSettings() {
  renderLayout(`
    <div class="wide-content">
      <h2 style="margin-bottom:20px;"><i class="fas fa-cog"></i> ตั้งค่า</h2>
      <div class="settings-layout">
        <div class="settings-nav">
          <div class="settings-nav-item active" onclick="showSettingsPanel('account',this)"><i class="fas fa-user"></i> บัญชี</div>
          <div class="settings-nav-item" onclick="showSettingsPanel('notifications',this)"><i class="fas fa-bell"></i> การแจ้งเตือน</div>
          <div class="settings-nav-item" onclick="showSettingsPanel('privacy',this)"><i class="fas fa-lock"></i> ความเป็นส่วนตัว</div>
          <div class="settings-nav-item" onclick="navigate('/kyc')"><i class="fas fa-shield-alt"></i> ยืนยันตัวตน KYC</div>
        </div>
        <div class="settings-panel" id="settings-panel">
          <div id="settings-content"></div>
        </div>
      </div>
    </div>`, 'settings');
  showSettingsPanel('account', document.querySelector('.settings-nav-item'));
}

async function showSettingsPanel(panel, el) {
  document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  const content = $('settings-content');
  if (!content) return;
  if (panel === 'account') {
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">ข้อมูลบัญชี</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <img src="${currentUser?.avatar?'/uploads/avatars/'+currentUser.avatar:''}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;background:var(--bg);" onerror="this.style.display='none'">
          <div>
            <div style="font-weight:700;">${currentUser?.first_name} ${currentUser?.last_name}</div>
            <div style="color:var(--text-muted);">@${currentUser?.username}</div>
            <div style="margin-top:4px;"><span class="tag ${currentUser?.kyc_status==='verified'?'blue':''}">${currentUser?.kyc_status==='verified'?'✓ ยืนยันตัวตนแล้ว':'ยังไม่ยืนยัน'}</span></div>
          </div>
        </div>
        <button class="btn btn-outline" onclick="showEditProfile()"><i class="fas fa-edit"></i> แก้ไขโปรไฟล์</button>
        <button class="btn btn-danger" style="margin-left:10px;" onclick="logout()"><i class="fas fa-sign-out-alt"></i> ออกจากระบบ</button>
      </div>`;
  } else if (panel === 'notifications') {
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">การแจ้งเตือน</div>
        <div class="toggle-row"><div><div class="toggle-label">โพสต์ใหม่</div><div class="toggle-desc">เมื่อมีคนโพสต์ในเพจที่ติดตาม</div></div><label class="toggle"><input type="checkbox" checked id="s-post"><span class="toggle-slider"></span></label></div>
        <div class="toggle-row"><div><div class="toggle-label">ความคิดเห็น</div><div class="toggle-desc">เมื่อมีคนคอมเม้นท์โพสต์ของคุณ</div></div><label class="toggle"><input type="checkbox" checked id="s-comment"><span class="toggle-slider"></span></label></div>
        <div class="toggle-row"><div><div class="toggle-label">การติดตาม</div><div class="toggle-desc">เมื่อมีคนติดตามคุณ</div></div><label class="toggle"><input type="checkbox" checked id="s-follow"><span class="toggle-slider"></span></label></div>
        <div class="toggle-row"><div><div class="toggle-label">ข้อความ</div><div class="toggle-desc">เมื่อได้รับข้อความใหม่</div></div><label class="toggle"><input type="checkbox" checked id="s-msg"><span class="toggle-slider"></span></label></div>
        <button class="btn btn-primary" style="margin-top:16px;" onclick="saveNotifSettings()"><i class="fas fa-save"></i> บันทึก</button>
      </div>`;
  } else if (panel === 'privacy') {
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">ความเป็นส่วนตัว</div>
        <div class="form-group"><label>โปรไฟล์</label><select class="form-control" id="s-profile-privacy"><option value="public">สาธารณะ</option><option value="friends">เพื่อนเท่านั้น</option><option value="private">ส่วนตัว</option></select></div>
        <div class="form-group"><label>โพสต์</label><select class="form-control" id="s-posts-privacy"><option value="public">สาธารณะ</option><option value="friends">เพื่อนเท่านั้น</option><option value="private">ส่วนตัว</option></select></div>
        <button class="btn btn-primary" onclick="savePrivacySettings()"><i class="fas fa-save"></i> บันทึก</button>
      </div>`;
  }
}

async function saveNotifSettings() {
  try {
    await api('PUT', '/settings', {
      notification_post: $('s-post')?.checked ? 1 : 0,
      notification_comment: $('s-comment')?.checked ? 1 : 0,
      notification_follow: $('s-follow')?.checked ? 1 : 0,
      notification_message: $('s-msg')?.checked ? 1 : 0,
    });
    toast('บันทึกการตั้งค่าแล้ว', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function savePrivacySettings() {
  try {
    await api('PUT', '/settings', { privacy_profile: $('s-profile-privacy')?.value, privacy_posts: $('s-posts-privacy')?.value });
    toast('บันทึกการตั้งค่าแล้ว', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================================
// KYC PAGE
// ============================================================
function renderKYC() {
  renderLayout(`
    <div class="page-content">
      <div class="card">
        <div class="card-header"><h2><i class="fas fa-shield-alt"></i> ยืนยันตัวตน (e-KYC)</h2></div>
        <div class="card-body">
          <p style="color:var(--text-muted);margin-bottom:20px;">ยืนยันตัวตนเพื่อรับเครื่องหมาย ✓ และเข้าถึงฟีเจอร์พิเศษ</p>

          <div class="kyc-step">
            <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">1</span> เลือกแพ็กเกจการยืนยัน</div>
            <div class="plan-cards">
              <div class="plan-card selected" id="plan-monthly" onclick="selectPlan('monthly')">
                <div class="plan-price">฿330</div>
                <div class="plan-period">รายเดือน</div>
              </div>
              <div class="plan-card" id="plan-yearly" onclick="selectPlan('yearly')">
                <div class="plan-price">฿2,000</div>
                <div class="plan-period">รายปี</div>
                <div class="plan-save">ประหยัด ฿1,960</div>
              </div>
            </div>
          </div>

          <div class="kyc-step">
            <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">2</span> สแกนใบหน้า</div>
            <label class="kyc-upload-area" for="kyc-face">
              <i class="fas fa-camera"></i>
              <p>คลิกเพื่ออัปโหลดรูปใบหน้า</p>
              <input type="file" id="kyc-face" accept="image/*" capture="user" style="display:none;" onchange="previewKyc(this,'kyc-face-preview')">
            </label>
            <img id="kyc-face-preview" class="kyc-preview">
          </div>

          <div class="kyc-step">
            <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">3</span> สแกนบัตรประชาชน</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <label class="kyc-upload-area" for="kyc-id-front">
                <i class="fas fa-id-card"></i><p>ด้านหน้า</p>
                <input type="file" id="kyc-id-front" accept="image/*" style="display:none;" onchange="previewKyc(this,'kyc-id-front-preview')">
              </label>
              <label class="kyc-upload-area" for="kyc-id-back">
                <i class="fas fa-id-card"></i><p>ด้านหลัง</p>
                <input type="file" id="kyc-id-back" accept="image/*" style="display:none;" onchange="previewKyc(this,'kyc-id-back-preview')">
              </label>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
              <img id="kyc-id-front-preview" class="kyc-preview" style="display:none;">
              <img id="kyc-id-back-preview" class="kyc-preview" style="display:none;">
            </div>
          </div>

          <div class="kyc-step">
            <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">4</span> สแกน Visa / Passport (สำหรับชาวต่างชาติ)</div>
            <label class="kyc-upload-area" for="kyc-passport">
              <i class="fas fa-passport"></i><p>คลิกเพื่ออัปโหลด (ไม่บังคับสำหรับคนไทย)</p>
              <input type="file" id="kyc-passport" accept="image/*" style="display:none;" onchange="previewKyc(this,'kyc-passport-preview')">
            </label>
            <img id="kyc-passport-preview" class="kyc-preview">
          </div>

          <div class="kyc-step">
            <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">5</span> ผูกบัญชีคริปโต (ไม่บังคับ)</div>
            <div class="form-group"><label>Wallet Address</label><input class="form-control" id="kyc-wallet" placeholder="0x... หรือ wallet address"></div>
          </div>

          <button class="btn btn-primary btn-full" id="kyc-submit-btn" onclick="submitKYC()"><i class="fas fa-shield-alt"></i> ส่งข้อมูลยืนยันตัวตน</button>

          ${currentUser?.kyc_status === 'verified' ? `<div style="margin-top:16px;padding:16px;background:#e8f5e9;border-radius:12px;color:#2e7d32;font-weight:700;text-align:center;"><i class="fas fa-circle-check"></i> ยืนยันตัวตนแล้ว</div>` : ''}
        </div>
      </div>
    </div>`, 'kyc');
  window._kycPlan = 'monthly';
}

function selectPlan(plan) {
  window._kycPlan = plan;
  $('plan-monthly')?.classList.toggle('selected', plan === 'monthly');
  $('plan-yearly')?.classList.toggle('selected', plan === 'yearly');
}

function previewKyc(input, previewId) {
  const preview = $(previewId);
  if (!preview || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
  reader.readAsDataURL(input.files[0]);
}

async function submitKYC() {
  const btn = $('kyc-submit-btn');
  btn.disabled = true; btn.textContent = 'กำลังส่ง...';
  try {
    // Subscribe first
    await api('POST', '/kyc/subscribe', { plan: window._kycPlan || 'monthly' });
    // Submit docs
    const form = new FormData();
    const face = $('kyc-face')?.files[0];
    const front = $('kyc-id-front')?.files[0];
    const back = $('kyc-id-back')?.files[0];
    const passport = $('kyc-passport')?.files[0];
    const wallet = $('kyc-wallet')?.value;
    if (face) form.append('face', face);
    if (front) form.append('id_front', front);
    if (back) form.append('id_back', back);
    if (passport) form.append('passport_visa', passport);
    if (wallet) form.append('crypto_wallet', wallet);
    await api('POST', '/kyc/submit', form, true);
    // Auto-approve (demo)
    await api('POST', '/kyc/approve', {});
    currentUser.kyc_status = 'verified';
    toast('ยืนยันตัวตนสำเร็จ! 🎉', 'success');
    renderKYC();
  } catch (err) { toast(err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'ส่งข้อมูลยืนยันตัวตน'; } }
}

// ============================================================
// CREATE PAGE
// ============================================================
function renderCreatePage() {
  renderLayout(`
    <div class="page-content">
      <div class="card">
        <div class="card-header"><h2><i class="fas fa-flag"></i> สร้างเพจใหม่</h2></div>
        <div class="card-body">
          <form id="create-page-form">
            <div class="form-group"><label>ชื่อเพจ *</label><input class="form-control" id="pg-name" placeholder="ชื่อธุรกิจหรือแบรนด์ของคุณ" required></div>
            <div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="pg-desc" rows="3" placeholder="อธิบายเพจของคุณ"></textarea></div>
            <div class="form-group"><label>หมวดหมู่</label><select class="form-control" id="pg-cat"><option value="">-- เลือกหมวดหมู่ --</option><option>ร้านอาหาร</option><option>แฟชั่น</option><option>เทคโนโลยี</option><option>สุขภาพ</option><option>ท่องเที่ยว</option><option>บันเทิง</option><option>กีฬา</option><option>ธุรกิจ</option><option>อื่นๆ</option></select></div>
            <div class="form-group"><label>เว็บไซต์</label><input class="form-control" id="pg-web" type="url" placeholder="https://example.com"></div>
            <div class="form-group"><label>เบอร์โทร</label><input class="form-control" id="pg-phone" type="tel"></div>
            <div class="form-group"><label>ที่อยู่</label><textarea class="form-control" id="pg-addr" rows="2"></textarea></div>
            <button class="btn btn-primary btn-full" type="submit" id="pg-btn"><i class="fas fa-plus"></i> สร้างเพจ</button>
          </form>
        </div>
      </div>
    </div>`);
  $('create-page-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('pg-btn'); btn.disabled = true; btn.textContent = 'กำลังสร้าง...';
    try {
      const data = await api('POST', '/pages', { name: $('pg-name').value, description: $('pg-desc').value, category: $('pg-cat').value, website: $('pg-web').value, phone: $('pg-phone').value, address: $('pg-addr').value });
      currentUser.pages = [...(currentUser.pages||[]), data.page];
      toast('สร้างเพจสำเร็จ!', 'success');
      navigate(`/page/${data.page.username}`);
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'สร้างเพจ'; }
  });
}

// ============================================================
// DONATE MODAL
// ============================================================
function showDonateModal(targetType, targetId) {
  showModal('โดเนท', `
    <p style="margin-bottom:16px;color:var(--text-muted);">เลือกจำนวนที่ต้องการโดเนท</p>
    <div class="donate-amounts">
      ${[20,50,100,200,500,1000].map(a => `<button class="donate-amount-btn" onclick="selectDonate(${a},this)">฿${a}</button>`).join('')}
    </div>
    <div class="form-group"><label>จำนวนอื่นๆ (บาท)</label><input class="form-control" type="number" id="donate-custom" placeholder="กรอกจำนวน" min="1" oninput="clearDonateSelect()"></div>
    <div class="form-group"><label>ข้อความ</label><input class="form-control" id="donate-msg" placeholder="ข้อความให้กำลังใจ..."></div>
    <input type="hidden" id="donate-amount" value="20">
  `, async () => {
    const amount = parseFloat($('donate-custom')?.value || $('donate-amount')?.value || 0);
    if (!amount || amount < 1) { toast('กรุณาเลือกหรือกรอกจำนวน', 'error'); return; }
    try { await api('POST', '/donate', { target_type: targetType, target_id: targetId, amount, message: $('donate-msg')?.value }); toast(`โดเนท ฿${amount} สำเร็จ! 🎉`, 'success'); closeModal(); }
    catch (err) { toast(err.message, 'error'); }
  }, 'โดเนท');
}

function selectDonate(amt, btn) {
  document.querySelectorAll('.donate-amount-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const input = $('donate-amount'); if (input) input.value = amt;
  const custom = $('donate-custom'); if (custom) custom.value = '';
}

function clearDonateSelect() { document.querySelectorAll('.donate-amount-btn').forEach(b => b.classList.remove('selected')); }

// ============================================================
// MODAL
// ============================================================
function showModal(title, content, onConfirm, confirmLabel = 'ยืนยัน') {
  const overlay = el('div', 'modal-overlay');
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h2>${title}</h2><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">${content}</div>
      ${onConfirm ? `<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="window._modalConfirm()">${confirmLabel}</button></div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  window._modalConfirm = onConfirm;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
}

function closeModal() { $('modal-overlay')?.remove(); }

function renderNotFound() {
  if (currentUser) {
    renderLayout('<div class="empty-state" style="margin-top:60px;"><i class="fas fa-map-signs"></i><h3>ไม่พบหน้าที่คุณค้นหา</h3><p>กลับไปหน้าหลัก</p><button class="btn btn-primary" style="margin-top:16px;" onclick="navigate(\'/\')">หน้าหลัก</button></div>');
  } else {
    navigate('/login');
  }
}

// ============================================================
// START
// ============================================================
init();
