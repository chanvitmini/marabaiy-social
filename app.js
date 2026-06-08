/* ============================================================
   SOCIALCONNECT — Frontend SPA
   ============================================================ */

const API = '/api';
let currentUser = null;
let authToken = localStorage.getItem('sc_token');

// ── Utils ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'เมื่อกี้';
  if (s < 3600) return `${Math.floor(s/60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s/3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(s/86400)} วันที่แล้ว`;
}
function fmtNum(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n||0); }
function toast(msg, type = 'info') {
  const c = $('toast-container') || (() => { const d = el('div'); d.id='toast-container'; document.body.appendChild(d); return d; })();
  const t = el('div', `toast ${type}`, msg);
  c.appendChild(t);
  setTimeout(() => { t.style.cssText='opacity:0;transform:translateX(110%);transition:.3s;'; setTimeout(()=>t.remove(), 300); }, 3000);
}
async function api(method, path, data, isForm = false) {
  const opts = { method, headers: {} };
  if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
  if (data) {
    if (isForm) { opts.body = data; }
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
  }
  const r = await fetch(API + path, opts);
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `Error ${r.status}`);
  return json;
}

// ── Router ───────────────────────────────────────────────────
const routes = {};
function route(path, fn) { routes[path] = fn; }
function navigate(path, push = true) {
  if (push) history.pushState({}, '', path);
  const parts = path.split('?')[0].split('/').filter(Boolean);
  const key = '/' + (parts[0] || '');
  const handler = routes[key];
  if (handler) handler(parts);
  else renderNotFound();
}
window.addEventListener('popstate', () => navigate(location.pathname, false));

// ── Init ─────────────────────────────────────────────────────
async function init() {
  $('app').innerHTML = '<div class="loading-screen"><div class="loader"></div><p>กำลังโหลด...</p></div>';
  if (authToken) {
    try {
      const d = await api('GET', '/auth/me');
      currentUser = d.user;
      currentUser.pages = d.pages || [];
    } catch { authToken = null; localStorage.removeItem('sc_token'); }
  }
  route('/', () => requireAuth() && renderHome());
  route('/home', () => requireAuth() && renderHome());
  route('/login', renderLogin);
  route('/register', renderRegister);
  route('/verify-email', handleVerifyEmail);
  route('/set-password', renderSetPassword);
  route('/profile', p => requireAuth() && renderProfile(p[1] || currentUser?.username));
  route('/page', p => requireAuth() && renderPageProfile(p[1]));
  route('/marketplace', () => requireAuth() && renderMarketplace());
  route('/live', () => requireAuth() && renderLive());
  route('/chat', () => requireAuth() && renderChat());
  route('/notifications', () => requireAuth() && renderNotifications());
  route('/settings', () => requireAuth() && renderSettings());
  route('/kyc', () => requireAuth() && renderKYC());
  route('/create-page', () => requireAuth() && renderCreatePage());
  navigate(location.pathname, false);
}

function requireAuth() {
  if (!currentUser) { navigate('/login'); return false; }
  return true;
}

// ── Layout ───────────────────────────────────────────────────
function layout(mainHtml, active = '') {
  const u = currentUser;
  $('app').innerHTML = `
    <nav id="navbar">
      <a class="nav-logo" href="/" onclick="navigate('/');return false;"><i class="fas fa-circle-nodes"></i> SocialConnect</a>
      <div class="nav-search">
        <i class="fas fa-search"></i>
        <input type="text" id="nav-q" placeholder="ค้นหา..." autocomplete="off">
        <div id="search-results" class="search-results" style="display:none;"></div>
      </div>
      <div class="nav-actions">
        <button class="nav-icon-btn" onclick="navigate('/notifications')" title="แจ้งเตือน">
          <i class="fas fa-bell"></i><span class="badge" id="notif-badge" style="display:none;"></span>
        </button>
        <button class="nav-icon-btn" onclick="navigate('/chat')" title="แชท"><i class="fas fa-comment-dots"></i></button>
        <div class="dropdown">
          <button class="nav-icon-btn" id="av-btn" onclick="toggleMenu()">
            ${u?.avatar ? `<img src="/uploads/avatars/${u.avatar}" class="nav-avatar" onerror="this.style.display='none'">` : '<i class="fas fa-user-circle" style="font-size:28px;"></i>'}
          </button>
          <div class="dropdown-menu" id="user-menu" style="display:none;">
            <div class="dropdown-item" onclick="navigate('/profile/${u?.username}')"><i class="fas fa-user"></i> โปรไฟล์</div>
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
        ${sidebarItem('/home','fa-home','หน้าหลัก',active==='home')}
        ${sidebarItem(`/profile/${u?.username}`,'fa-user','โปรไฟล์',active==='profile')}
        ${sidebarItem('/marketplace','fa-store','มาร์เก็ตเพลส',active==='marketplace')}
        ${sidebarItem('/live','fa-video','ไลฟ์สด',active==='live')}
        ${sidebarItem('/chat','fa-comment-dots','แชท',active==='chat')}
        ${sidebarItem('/notifications','fa-bell','แจ้งเตือน',active==='notifications')}
        ${sidebarItem('/settings','fa-cog','ตั้งค่า',active==='settings')}
      </div>
      ${u?.pages?.length ? `<div class="sidebar-section"><div class="sidebar-title">เพจของฉัน</div>${u.pages.map(p=>`
        <div class="sidebar-item" onclick="navigate('/page/${p.username}')">
          ${p.avatar ? `<img src="/uploads/avatars/${p.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : `<div class="avatar-placeholder" style="width:28px;height:28px;font-size:12px;">${p.name.charAt(0)}</div>`}
          <span>${p.name}</span></div>`).join('')}</div>` : ''}
      <div class="sidebar-section">
        <div class="sidebar-item" onclick="navigate('/create-page')"><i class="fas fa-plus-circle"></i> <span>สร้างเพจใหม่</span></div>
      </div>
    </aside>
    <main id="main">${mainHtml}</main>`;
  initNavSearch();
  loadNotifBadge();
  document.addEventListener('click', e => {
    const m = $('user-menu'), b = $('av-btn');
    if (m && !m.contains(e.target) && !b?.contains(e.target)) m.style.display = 'none';
  }, { once: false });
}

function sidebarItem(href, icon, label, active) {
  return `<div class="sidebar-item${active?' active':''}" onclick="navigate('${href}')"><i class="fas ${icon}"></i><span>${label}</span></div>`;
}
function toggleMenu() {
  const m = $('user-menu'); if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

async function loadNotifBadge() {
  try {
    const d = await api('GET', '/notifications');
    const n = d.notifications.filter(x => !x.is_read).length;
    const b = $('notif-badge');
    if (b) { b.textContent = n; b.style.display = n ? 'flex' : 'none'; }
  } catch {}
}

function initNavSearch() {
  const inp = $('nav-q'), res = $('search-results');
  if (!inp) return;
  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    if (!inp.value.trim()) { res.style.display = 'none'; return; }
    t = setTimeout(async () => {
      try {
        const d = await api('GET', `/search?q=${encodeURIComponent(inp.value)}`);
        if (!d.users.length && !d.pages.length) { res.style.display = 'none'; return; }
        res.innerHTML = [
          ...d.users.map(u => `<div class="search-result-item" onclick="closeSearch();navigate('/profile/${u.username}')">
            ${u.avatar ? `<img src="/uploads/avatars/${u.avatar}" class="search-result-avatar" onerror="this.style.display='none'">` : `<div class="avatar-placeholder search-result-avatar" style="width:38px;height:38px;font-size:15px;">${u.first_name.charAt(0)}</div>`}
            <div class="search-result-info"><div class="search-result-name">${u.first_name} ${u.last_name}${u.kyc_status==='verified'?' <i class="fas fa-circle-check verified-badge"></i>':''}</div><div class="search-result-sub">@${u.username}</div></div></div>`),
          ...d.pages.map(p => `<div class="search-result-item" onclick="closeSearch();navigate('/page/${p.username}')">
            ${p.avatar ? `<img src="/uploads/avatars/${p.avatar}" class="search-result-avatar" onerror="this.style.display='none'">` : `<div class="avatar-placeholder search-result-avatar" style="width:38px;height:38px;font-size:15px;">${p.name.charAt(0)}</div>`}
            <div class="search-result-info"><div class="search-result-name">${p.name}</div><div class="search-result-sub"><span class="tag">เพจ</span></div></div></div>`)
        ].join('');
        res.style.display = 'block';
      } catch {}
    }, 300);
  });
  document.addEventListener('click', e => { if (!inp.contains(e.target)) res.style.display = 'none'; });
}
function closeSearch() { const r = $('search-results'); if (r) r.style.display = 'none'; }

// ── Auth ─────────────────────────────────────────────────────
function renderLogin() {
  if (currentUser) return navigate('/');
  $('app').innerHTML = `<div class="auth-page"><div class="auth-card">
    <div class="auth-logo"><h1><i class="fas fa-circle-nodes"></i> SocialConnect</h1><p>เชื่อมต่อโลกใบนี้</p></div>
    <div class="auth-tabs">
      <button class="auth-tab" onclick="navigate('/register')">สมัครสมาชิก</button>
      <button class="auth-tab active">เข้าสู่ระบบ</button>
    </div>
    <form id="lf">
      <div class="form-group"><label>อีเมล</label><input class="form-control" type="email" id="le" placeholder="example@email.com" required></div>
      <div class="form-group"><label>รหัสผ่าน</label><input class="form-control" type="password" id="lp" placeholder="รหัสผ่าน" required></div>
      <button class="btn btn-primary btn-full" type="submit" id="lb">เข้าสู่ระบบ</button>
    </form>
    <div style="text-align:center;margin-top:14px;font-size:14px;color:var(--text-muted);">
      บัญชีทดสอบ: <strong>demo@socialconnect.com</strong> / <strong>demo1234</strong>
    </div>
  </div></div>`;
  $('lf').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('lb'); btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
    try {
      const d = await api('POST', '/auth/login', { email: $('le').value, password: $('lp').value });
      authToken = d.token; localStorage.setItem('sc_token', authToken);
      currentUser = d.user; currentUser.pages = [];
      toast('ยินดีต้อนรับกลับ! 👋', 'success');
      navigate('/');
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  });
}

function renderRegister() {
  if (currentUser) return navigate('/');
  $('app').innerHTML = `<div class="auth-page"><div class="auth-card">
    <div class="auth-logo"><h1><i class="fas fa-circle-nodes"></i> SocialConnect</h1><p>เชื่อมต่อโลกใบนี้</p></div>
    <div class="auth-tabs">
      <button class="auth-tab active">สมัครสมาชิก</button>
      <button class="auth-tab" onclick="navigate('/login')">เข้าสู่ระบบ</button>
    </div>
    <form id="rf">
      <div class="form-row">
        <div class="form-group"><label>ชื่อ *</label><input class="form-control" id="rf1" placeholder="ชื่อ" required></div>
        <div class="form-group"><label>นามสกุล *</label><input class="form-control" id="rf2" placeholder="นามสกุล" required></div>
      </div>
      <div class="form-group"><label>อีเมล *</label><input class="form-control" type="email" id="rf3" placeholder="example@email.com" required></div>
      <div class="form-group"><label>เบอร์โทรศัพท์</label>
        <div class="input-group">
          <select class="form-control" id="rf4">
            <option value="+66">🇹🇭 +66</option><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option>
            <option value="+81">🇯🇵 +81</option><option value="+86">🇨🇳 +86</option><option value="+65">🇸🇬 +65</option>
          </select>
          <input class="form-control" id="rf5" placeholder="0812345678" type="tel">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>วันเกิด</label><input class="form-control" type="date" id="rf6"></div>
        <div class="form-group"><label>อาชีพ</label>
          <select class="form-control" id="rf7">
            <option value="">-- เลือก --</option><option>นักเรียน/นักศึกษา</option><option>พนักงานบริษัท</option>
            <option>ข้าราชการ</option><option>ธุรกิจส่วนตัว</option><option>แพทย์/พยาบาล</option>
            <option>วิศวกร</option><option>ครู/อาจารย์</option><option>ฟรีแลนซ์</option><option>อื่นๆ</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>ที่อยู่</label><textarea class="form-control" id="rf8" rows="2" placeholder="บ้านเลขที่ ถนน อำเภอ จังหวัด"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label>สัญชาติ</label><input class="form-control" id="rf9" placeholder="ไทย" value="ไทย"></div>
        <div class="form-group"><label>ภาษา</label>
          <select class="form-control" id="rf10">
            <option value="th">🇹🇭 ภาษาไทย</option><option value="en">🇬🇧 English</option>
            <option value="zh">🇨🇳 中文</option><option value="ja">🇯🇵 日本語</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-full" type="submit" id="rb">สมัครสมาชิก</button>
    </form>
  </div></div>`;
  $('rf').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('rb'); btn.disabled = true; btn.textContent = 'กำลังสมัคร...';
    try {
      const d = await api('POST', '/auth/register', {
        first_name: $('rf1').value, last_name: $('rf2').value, email: $('rf3').value,
        phone_code: $('rf4').value, phone: $('rf5').value, birthdate: $('rf6').value,
        occupation: $('rf7').value, address: $('rf8').value,
        nationality: $('rf9').value, language: $('rf10').value
      });
      $('app').innerHTML = `<div class="auth-page"><div class="auth-card" style="text-align:center;">
        <i class="fas fa-envelope-circle-check" style="font-size:64px;color:var(--primary);"></i>
        <h2 style="margin-top:16px;">สมัครสมาชิกสำเร็จ!</h2>
        <p style="color:var(--text-muted);margin:8px 0 20px;">กรุณาคลิกลิงค์ด้านล่างเพื่อดำเนินการต่อ</p>
        <div style="background:var(--bg);border-radius:12px;padding:20px;text-align:left;">
          <p style="font-weight:700;margin-bottom:12px;">ขั้นตอนถัดไป:</p>
          <p>1. <a href="${d.verify_link}" onclick="navigate('${new URL(d.verify_link).pathname+new URL(d.verify_link).search}');return false;">✉️ ยืนยันอีเมล</a></p>
          <p style="margin-top:10px;">2. <a href="${d.password_link}" onclick="navigate('${new URL(d.password_link).pathname+new URL(d.password_link).search}');return false;">🔑 ตั้งรหัสผ่าน</a></p>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:16px;">(ในการใช้งานจริง ลิงค์จะถูกส่งทางอีเมล)</p>
      </div></div>`;
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'สมัครสมาชิก'; }
  });
}

async function handleVerifyEmail() {
  const token = new URLSearchParams(location.search).get('token');
  $('app').innerHTML = '<div class="loading-screen"><div class="loader"></div><p>กำลังยืนยันอีเมล...</p></div>';
  try {
    await api('GET', `/auth/verify-email?token=${token}`);
    $('app').innerHTML = `<div class="auth-page"><div class="auth-card" style="text-align:center;">
      <i class="fas fa-circle-check" style="font-size:64px;color:var(--green);"></i>
      <h2 style="margin-top:16px;">ยืนยันอีเมลสำเร็จ!</h2>
      <p style="margin:8px 0 20px;color:var(--text-muted);">กรุณาตั้งรหัสผ่านเพื่อเข้าใช้งาน</p>
      <a onclick="navigate('/set-password?token=${token}');return false;" href="#" class="btn btn-primary">ตั้งรหัสผ่าน →</a>
    </div></div>`;
  } catch (err) {
    $('app').innerHTML = `<div class="auth-page"><div class="auth-card" style="text-align:center;">
      <i class="fas fa-circle-xmark" style="font-size:64px;color:var(--red);"></i>
      <h2 style="margin-top:16px;">Token ไม่ถูกต้อง</h2><p style="color:var(--text-muted);">${err.message}</p>
    </div></div>`;
  }
}

function renderSetPassword() {
  const token = new URLSearchParams(location.search).get('token');
  $('app').innerHTML = `<div class="auth-page"><div class="auth-card">
    <div class="auth-logo"><h1><i class="fas fa-lock"></i> ตั้งรหัสผ่าน</h1></div>
    <form id="pwf">
      <div class="form-group"><label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label><input class="form-control" type="password" id="pw1" minlength="8" required placeholder="รหัสผ่าน"></div>
      <div class="form-group"><label>ยืนยันรหัสผ่าน</label><input class="form-control" type="password" id="pw2" required placeholder="ยืนยันรหัสผ่าน"></div>
      <button class="btn btn-primary btn-full" type="submit">บันทึกรหัสผ่าน</button>
    </form>
  </div></div>`;
  $('pwf').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('pw1').value !== $('pw2').value) return toast('รหัสผ่านไม่ตรงกัน', 'error');
    try {
      await api('POST', '/auth/set-password', { token, password: $('pw1').value });
      toast('ตั้งรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบ', 'success');
      navigate('/login');
    } catch (err) { toast(err.message, 'error'); }
  });
}

function logout() {
  authToken = null; currentUser = null; localStorage.removeItem('sc_token'); navigate('/login');
}

// ── Home ─────────────────────────────────────────────────────
async function renderHome() {
  layout(`<div class="page-content">
    <div id="cpa"></div>
    <div id="feed"><div class="loading-screen" style="height:200px;"><div class="loader"></div></div></div>
  </div>`, 'home');
  buildCreatePost('user', currentUser.id, 'cpa');
  await loadFeed();
}

function buildCreatePost(authorType, authorId, containerId) {
  const c = $(containerId); if (!c) return;
  c.innerHTML = `<div class="card create-post">
    <div class="create-post-input">
      ${currentUser?.avatar ? `<img src="/uploads/avatars/${currentUser.avatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--bg);" onerror="this.style.display='none'">` : `<div class="avatar-placeholder" style="width:44px;height:44px;font-size:18px;">${currentUser?.first_name?.charAt(0)||'?'}</div>`}
      <textarea id="post-txt" placeholder="คุณกำลังคิดอะไรอยู่?" rows="1" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
    </div>
    <div id="media-prev" class="post-media-preview"></div>
    <div class="create-post-actions">
      <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
        <i class="fas fa-image"></i> รูป/วิดีโอ
        <input type="file" accept="image/*,video/*" multiple style="display:none;" id="media-inp" onchange="prevMedia(this)">
      </label>
      <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="doPost('${authorType}','${authorId}')">
        <i class="fas fa-paper-plane"></i> โพสต์
      </button>
    </div>
  </div>`;
}

function prevMedia(inp) {
  const prev = $('media-prev'); prev.innerHTML = '';
  Array.from(inp.files).forEach((f, i) => {
    const r = new FileReader();
    r.onload = ev => {
      const w = el('div', 'preview-item');
      w.innerHTML = `<img src="${ev.target.result}"><button class="remove-preview" onclick="rmMedia(${i})">×</button>`;
      prev.appendChild(w);
    };
    r.readAsDataURL(f);
  });
}

function rmMedia(idx) {
  const inp = $('media-inp'), dt = new DataTransfer();
  Array.from(inp.files).forEach((f,i)=>{ if(i!==idx) dt.items.add(f); });
  inp.files = dt.files; prevMedia(inp);
}

async function doPost(authorType, authorId) {
  const txt = $('post-txt')?.value.trim();
  const inp = $('media-inp');
  if (!txt && !inp?.files?.length) return toast('กรุณากรอกเนื้อหาหรืออัปโหลดรูปภาพ', 'error');
  const form = new FormData();
  form.append('content', txt || '');
  form.append('author_type', authorType);
  form.append('author_id', authorId);
  if (inp?.files) Array.from(inp.files).forEach(f => form.append('media', f));
  try {
    await api('POST', '/posts', form, true);
    toast('โพสต์สำเร็จ! 🎉', 'success');
    if ($('post-txt')) $('post-txt').value = '';
    if ($('media-prev')) $('media-prev').innerHTML = '';
    await loadFeed(authorType !== 'user' ? authorType : null, authorType !== 'user' ? authorId : null);
  } catch (err) { toast(err.message, 'error'); }
}

async function loadFeed(authorType, authorId) {
  const feed = $('feed') || $('posts-feed'); if (!feed) return;
  try {
    const q = authorType && authorId ? `?author_type=${authorType}&author_id=${authorId}` : '';
    const d = await api('GET', `/posts${q}`);
    if (!d.posts.length) { feed.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><h3>ยังไม่มีโพสต์</h3><p>เริ่มโพสต์หรือติดตามผู้ใช้เพื่อดูฟีด</p></div>'; return; }
    feed.innerHTML = d.posts.map(p => postCard(p)).join('');
    bindPosts();
  } catch (err) { feed.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`; }
}

function postCard(p) {
  const media = p.media ? (()=>{try{return JSON.parse(p.media);}catch{return [];}})() : [];
  const name = p.author?.first_name ? `${p.author.first_name} ${p.author.last_name}` : (p.author?.name || 'ผู้ใช้');
  const link = p.author_type === 'user' ? `/profile/${p.author?.username}` : `/page/${p.author?.username}`;
  const kyc  = p.author_type === 'user' && p.author?.kyc_status === 'verified';
  return `<div class="card post-card" id="pc-${p.id}">
    <div class="post-header">
      ${p.author?.avatar ? `<img src="/uploads/avatars/${p.author.avatar}" class="post-author-avatar" onerror="this.style.display='none'" onclick="navigate('${link}')">` : `<div class="avatar-placeholder post-author-avatar" style="font-size:18px;cursor:pointer;" onclick="navigate('${link}')">${name.charAt(0)}</div>`}
      <div class="post-author-info">
        <div class="post-author-name" onclick="navigate('${link}')">${name}${kyc?' <i class="fas fa-circle-check verified-badge" title="ยืนยันตัวตนแล้ว"></i>':''}</div>
        <div class="post-time">${timeAgo(p.created_at)}</div>
      </div>
      <button class="btn btn-outline btn-xs" onclick="showDonate('post',${JSON.stringify(p.id)})"><i class="fas fa-gift"></i> โดเนท</button>
    </div>
    ${p.content ? `<div class="post-body">${escHtml(p.content)}</div>` : ''}
    ${media.length ? `<div class="post-media">${media.map(m=>m.match(/\.(mp4|webm|ogg)$/i)?`<video src="/uploads/posts/${m}" controls></video>`:`<img src="/uploads/posts/${m}" onclick="viewImg(this)">`).join('')}</div>` : ''}
    <div class="post-stats">
      <span id="ls-${p.id}"><i class="fas fa-thumbs-up" style="color:var(--primary)"></i> ${fmtNum(p.like_count||0)}</span>
      <span>${fmtNum(p.comment_count||0)} คอมเม้นท์</span>
      <span>${fmtNum(p.share_count||0)} แชร์</span>
      <span style="margin-left:auto;"><i class="fas fa-eye"></i> ${fmtNum(p.views||0)}</span>
    </div>
    <div class="post-actions">
      <button class="post-action-btn${p.user_liked?' liked':''}" data-like="${p.id}"><i class="fas fa-thumbs-up"></i> ถูกใจ</button>
      <button class="post-action-btn" data-cmt="${p.id}"><i class="fas fa-comment"></i> คอมเม้นท์</button>
      <button class="post-action-btn" data-share="${p.id}"><i class="fas fa-share"></i> แชร์</button>
    </div>
    <div id="cmt-${p.id}" class="post-comments" style="display:none;"></div>
  </div>`;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

function viewImg(img) {
  const ov = el('div','modal-overlay');
  ov.style.cssText='align-items:center;justify-content:center;cursor:zoom-out;';
  ov.innerHTML=`<img src="${img.src}" style="max-width:92vw;max-height:92vh;border-radius:8px;">`;
  ov.onclick=()=>ov.remove(); document.body.appendChild(ov);
}

function bindPosts() {
  document.querySelectorAll('[data-like]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.like;
      try {
        const d = await api('POST', `/posts/${id}/like`);
        btn.classList.toggle('liked', d.liked);
        const s = $(`ls-${id}`); if (s) {
          const n = parseInt(s.textContent.replace(/\D/g,''))||0;
          s.innerHTML = `<i class="fas fa-thumbs-up" style="color:var(--primary)"></i> ${fmtNum(d.liked?n+1:Math.max(0,n-1))}`;
        }
      } catch (err) { toast(err.message,'error'); }
    });
  });
  document.querySelectorAll('[data-cmt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.cmt;
      const sec = $(`cmt-${id}`);
      if (sec.style.display !== 'none') { sec.style.display='none'; return; }
      sec.style.display='block';
      try {
        const d = await api('GET', `/posts/${id}/comments`);
        sec.innerHTML = d.comments.map(c=>`
          <div class="comment-item">
            ${c.avatar?`<img src="/uploads/avatars/${c.avatar}" class="comment-avatar" onerror="this.style.display='none'">`:`<div class="avatar-placeholder comment-avatar" style="width:32px;height:32px;font-size:13px;">${c.first_name.charAt(0)}</div>`}
            <div class="comment-bubble"><div class="comment-author">${escHtml(c.first_name+' '+c.last_name)}</div><div class="comment-text">${escHtml(c.content)}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${timeAgo(c.created_at)}</div></div>
          </div>`).join('')+`
          <div class="comment-input" style="margin-top:8px;">
            ${currentUser?.avatar?`<img src="/uploads/avatars/${currentUser.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`:''}
            <textarea id="ci-${id}" placeholder="เขียนความคิดเห็น..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCmt(${JSON.stringify(id)});}"></textarea>
            <button class="btn btn-primary btn-xs" onclick="sendCmt(${JSON.stringify(id)})"><i class="fas fa-paper-plane"></i></button>
          </div>`;
      } catch (err) { sec.innerHTML=`<p style="padding:10px;color:var(--red);">${err.message}</p>`; }
    });
  });
  document.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.share;
      try { await api('POST', `/posts/${id}/share`); navigator.clipboard?.writeText(`${location.origin}/post/${id}`).catch(()=>{}); toast('คัดลอกลิงค์แล้ว!','success'); } catch {}
    });
  });
}

async function sendCmt(postId) {
  const inp = $(`ci-${postId}`); if (!inp?.value.trim()) return;
  try {
    await api('POST', `/posts/${postId}/comments`, { content: inp.value });
    inp.value = '';
    const btn = document.querySelector(`[data-cmt="${postId}"]`);
    const sec = $(`cmt-${postId}`); sec.style.display = 'none';
    if (btn) btn.click();
  } catch (err) { toast(err.message,'error'); }
}

// ── Profile ──────────────────────────────────────────────────
async function renderProfile(username) {
  layout('<div class="loading-screen" style="height:300px;"><div class="loader"></div></div>', 'profile');
  try {
    const d = await api('GET', `/users/${username}`);
    const u = d.user, isOwn = currentUser?.id === u.id;
    const fol = !isOwn ? await api('GET', `/follow/check?target_type=user&target_id=${u.id}`) : null;

    $('main').innerHTML = `<div style="max-width:900px;margin:0 auto;">
      <div class="card" style="margin-bottom:14px;">
        <div class="profile-cover">${u.cover_photo?`<img src="/uploads/covers/${u.cover_photo}">`:''}
          ${isOwn?`<label class="btn btn-secondary btn-sm profile-cover-edit" style="cursor:pointer;"><i class="fas fa-camera"></i> เปลี่ยนภาพปก<input type="file" accept="image/*" style="display:none;" onchange="uploadCover(this)"></label>`:''}
        </div>
        <div class="profile-info">
          <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">
            <div class="profile-avatar-wrap">
              ${u.avatar?`<img src="/uploads/avatars/${u.avatar}" class="profile-avatar" onerror="this.src=''">`:
                `<div class="avatar-placeholder profile-avatar" style="font-size:48px;">${u.first_name.charAt(0)}</div>`}
              ${isOwn?`<label class="profile-avatar-edit" style="cursor:pointer;"><i class="fas fa-camera"></i><input type="file" accept="image/*" style="display:none;" onchange="uploadAvatar(this)"></label>`:''}
            </div>
            <div style="flex:1;">
              <div class="profile-name">${escHtml(u.first_name+' '+u.last_name)} ${u.kyc_status==='verified'?'<i class="fas fa-circle-check verified-badge" title="ยืนยันตัวตนแล้ว"></i>':''}</div>
              <div class="profile-username">@${u.username}</div>
              ${u.bio?`<div class="profile-bio">${escHtml(u.bio)}</div>`:''}
              ${u.occupation?`<div style="margin-top:4px;font-size:14px;color:var(--text-muted);"><i class="fas fa-briefcase"></i> ${escHtml(u.occupation)}</div>`:''}
            </div>
            <div class="profile-actions">
              ${isOwn?`<button class="btn btn-secondary" onclick="editProfile()"><i class="fas fa-edit"></i> แก้ไขโปรไฟล์</button>`:
                `<button class="btn ${fol?.following?'btn-secondary':'btn-primary'}" id="fol-btn" onclick="toggleFollow('user',${JSON.stringify(u.id)},'fol-btn')">${fol?.following?'<i class="fas fa-user-check"></i> ติดตามแล้ว':'<i class="fas fa-user-plus"></i> ติดตาม'}</button>
                 <button class="btn btn-outline" onclick="startDM(${JSON.stringify(u.id)})"><i class="fas fa-comment"></i> แชท</button>`}
              <button class="btn btn-outline btn-sm" onclick="copyLink('profile','${u.username}')"><i class="fas fa-share"></i></button>
            </div>
          </div>
          <div class="profile-stats">
            <div class="profile-stat"><div class="profile-stat-num">${fmtNum(d.stats.posts)}</div><div class="profile-stat-label">โพสต์</div></div>
            <div class="profile-stat"><div class="profile-stat-num">${fmtNum(d.stats.followers)}</div><div class="profile-stat-label">ผู้ติดตาม</div></div>
            <div class="profile-stat"><div class="profile-stat-num">${fmtNum(d.stats.following)}</div><div class="profile-stat-label">กำลังติดตาม</div></div>
          </div>
          <div class="profile-url"><i class="fas fa-link"></i> ${location.origin}/profile/${u.username}
            <button class="btn btn-xs btn-outline" onclick="copyLink('profile','${u.username}')">คัดลอก</button>
          </div>
        </div>
      </div>
      <div class="profile-tabs">
        <div class="profile-tab active" onclick="switchTab(this,'posts-tab')">โพสต์</div>
        <div class="profile-tab" onclick="navigate('/marketplace')">มาร์เก็ตเพลส <span class="tag" style="margin-left:4px;">ดูเท่านั้น</span></div>
        <div class="profile-tab" onclick="navigate('/live')">ไลฟ์สด <span class="tag" style="margin-left:4px;">ดูเท่านั้น</span></div>
      </div>
      <div id="posts-tab">
        ${isOwn?'<div id="cpa"></div>':''}
        <div id="feed"></div>
      </div>
    </div>`;
    if (isOwn) buildCreatePost('user', u.id, 'cpa');
    await loadFeed('user', u.id);
  } catch (err) { $('main').innerHTML=`<div class="empty-state"><i class="fas fa-user-slash"></i><h3>${err.message}</h3></div>`; }
}

function switchTab(tabEl, contentId) {
  document.querySelectorAll('.profile-tab').forEach(t=>t.classList.remove('active'));
  tabEl.classList.add('active');
}

async function toggleFollow(type, id, btnId) {
  const btn = $(btnId); if (btn) { btn.disabled=true; }
  try {
    const d = await api('POST', '/follow', { target_type: type, target_id: id });
    if (btn) {
      btn.disabled=false;
      if (d.followed) { btn.className='btn btn-secondary'; btn.innerHTML='<i class="fas fa-user-check"></i> ติดตามแล้ว'; }
      else            { btn.className='btn btn-primary';    btn.innerHTML='<i class="fas fa-user-plus"></i> ติดตาม'; }
    }
  } catch (err) { toast(err.message,'error'); if (btn) btn.disabled=false; }
}

async function startDM(userId) {
  try { const d = await api('POST', '/chats/direct', { target_user_id: userId }); navigate(`/chat?room=${d.room.id}`); }
  catch (err) { toast(err.message,'error'); }
}

function copyLink(type, username) {
  const url = `${location.origin}/${type}/${username}`;
  navigator.clipboard?.writeText(url).then(()=>toast('คัดลอกลิงค์แล้ว! 🔗','success')).catch(()=>toast('URL: '+url,'info'));
}

function editProfile() {
  modal('แก้ไขโปรไฟล์',`
    <form id="epf">
      <div class="form-group"><label>ชื่อผู้ใช้ (URL)</label><input class="form-control" id="ep1" value="${escAttr(currentUser.username)}"></div>
      <div class="form-group"><label>ชื่อ</label><input class="form-control" id="ep2" value="${escAttr(currentUser.first_name)}"></div>
      <div class="form-group"><label>นามสกุล</label><input class="form-control" id="ep3" value="${escAttr(currentUser.last_name)}"></div>
      <div class="form-group"><label>ประวัติส่วนตัว</label><textarea class="form-control" id="ep4" rows="3">${escHtml(currentUser.bio||'')}</textarea></div>
      <div class="form-group"><label>อาชีพ</label><input class="form-control" id="ep5" value="${escAttr(currentUser.occupation||'')}"></div>
      <div class="form-group"><label>ที่อยู่</label><input class="form-control" id="ep6" value="${escAttr(currentUser.address||'')}"></div>
    </form>`, async () => {
    const form = new FormData();
    ['username','first_name','last_name','bio','occupation','address'].forEach((k,i)=>{ const v=$(`ep${i+1}`)?.value; if(v!==undefined) form.append(k,v); });
    try {
      const d = await api('PUT', '/users/me', form, true);
      currentUser = {...currentUser, ...d.user};
      toast('บันทึกโปรไฟล์สำเร็จ!','success'); closeModal();
      navigate(`/profile/${currentUser.username}`);
    } catch (err) { toast(err.message,'error'); }
  });
}

function escAttr(s) { return String(s||'').replace(/"/g,'&quot;'); }

async function uploadAvatar(input) {
  const form = new FormData(); form.append('avatar', input.files[0]);
  try { const d = await api('PUT', '/users/me', form, true); currentUser.avatar=d.user.avatar; toast('เปลี่ยนรูปโปรไฟล์แล้ว!','success'); navigate(`/profile/${currentUser.username}`); }
  catch (err) { toast(err.message,'error'); }
}
async function uploadCover(input) {
  const form = new FormData(); form.append('cover', input.files[0]);
  try { await api('PUT', '/users/me', form, true); toast('เปลี่ยนภาพปกแล้ว!','success'); navigate(`/profile/${currentUser.username}`); }
  catch (err) { toast(err.message,'error'); }
}

// ── Page Profile ─────────────────────────────────────────────
async function renderPageProfile(username) {
  layout('<div class="loading-screen" style="height:300px;"><div class="loader"></div></div>');
  try {
    const d = await api('GET', `/pages/${username}`);
    const pg = d.page, isOwner = currentUser?.id === pg.owner_id;
    const fol = !isOwner ? await api('GET', `/follow/check?target_type=page&target_id=${pg.id}`) : null;
    window._pg = { pg, isOwner };

    $('main').innerHTML = `<div style="max-width:900px;margin:0 auto;">
      <div class="card" style="margin-bottom:14px;">
        <div class="profile-cover">${pg.cover_photo?`<img src="/uploads/covers/${pg.cover_photo}">`:''}
        </div>
        <div class="profile-info">
          <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;">
            <div class="profile-avatar-wrap" style="margin-top:-50px;">
              ${pg.avatar?`<img src="/uploads/avatars/${pg.avatar}" class="profile-avatar" onerror="this.src=''">`:
                `<div class="avatar-placeholder profile-avatar" style="font-size:48px;">${pg.name.charAt(0)}</div>`}
            </div>
            <div style="flex:1;">
              <div class="profile-name">${escHtml(pg.name)} <span class="tag blue">เพจ</span></div>
              <div class="profile-username">@${pg.username}</div>
              ${pg.description?`<div class="profile-bio">${escHtml(pg.description)}</div>`:''}
              ${pg.category?`<span class="tag" style="margin-top:6px;">${escHtml(pg.category)}</span>`:''}
            </div>
            <div class="profile-actions">
              ${isOwner?`<button class="btn btn-secondary" onclick="editPage(${JSON.stringify(pg.id)})"><i class="fas fa-edit"></i> แก้ไขเพจ</button>`:
                `<button class="btn ${fol?.following?'btn-secondary':'btn-primary'}" id="fol-btn" onclick="toggleFollow('page',${JSON.stringify(pg.id)},'fol-btn')">${fol?.following?'<i class="fas fa-bookmark"></i> ติดตามแล้ว':'<i class="fas fa-bookmark"></i> ติดตาม'}</button>`}
              <button class="btn btn-outline btn-sm" onclick="copyLink('page','${pg.username}')"><i class="fas fa-share"></i></button>
            </div>
          </div>
          <div class="profile-stats">
            <div class="profile-stat"><div class="profile-stat-num">${fmtNum(d.stats.posts)}</div><div class="profile-stat-label">โพสต์</div></div>
            <div class="profile-stat"><div class="profile-stat-num">${fmtNum(d.stats.followers)}</div><div class="profile-stat-label">ผู้ติดตาม</div></div>
          </div>
        </div>
      </div>
      <div class="profile-tabs">
        <div class="profile-tab active" id="ptab-posts" onclick="pgTab('posts',this)">โพสต์</div>
        <div class="profile-tab" id="ptab-market" onclick="pgTab('market',this)">${isOwner?'🛍️ ลงขาย':'มาร์เก็ตเพลส'}</div>
        <div class="profile-tab" id="ptab-live" onclick="pgTab('live',this)">${isOwner?'🔴 ไลฟ์สด':'ไลฟ์สด'}</div>
      </div>
      <div id="pg-tab">
        ${isOwner?'<div id="cpa"></div>':''}
        <div id="feed"></div>
      </div>
    </div>`;
    if (isOwner) buildCreatePost('page', pg.id, 'cpa');
    await loadFeed('page', pg.id);
  } catch (err) { $('main').innerHTML=`<div class="empty-state"><i class="fas fa-flag"></i><h3>${err.message}</h3></div>`; }
}

async function pgTab(tab, tabEl) {
  document.querySelectorAll('.profile-tab').forEach(t=>t.classList.remove('active'));
  tabEl.classList.add('active');
  const { pg, isOwner } = window._pg || {};
  const cont = $('pg-tab'); if (!cont) return;
  if (tab === 'posts') {
    cont.innerHTML = `${isOwner?'<div id="cpa"></div>':''}<div id="feed"></div>`;
    if (isOwner) buildCreatePost('page', pg.id, 'cpa');
    await loadFeed('page', pg.id);
  } else if (tab === 'market') {
    if (isOwner) {
      cont.innerHTML = `<div style="margin-bottom:12px;"><button class="btn btn-primary" onclick="showCreateListing(${JSON.stringify(pg.id)})"><i class="fas fa-plus"></i> ลงประกาศขาย</button></div><div id="listing-grid"></div>`;
      await loadListings(pg.id);
    } else { cont.innerHTML = '<div id="marketplace-grid"></div>'; await loadMarketItems(); }
  } else if (tab === 'live') {
    if (isOwner) {
      cont.innerHTML = `<div style="margin-bottom:12px;"><button class="btn btn-danger" onclick="showStartLive(${JSON.stringify(pg.id)})"><i class="fas fa-video"></i> เริ่มไลฟ์สด</button></div><div id="live-grid" style="margin-top:12px;"></div>`;
    } else { cont.innerHTML = '<div id="live-grid"></div>'; await loadLiveItems(); }
  }
}

// ── Marketplace ───────────────────────────────────────────────
async function renderMarketplace() {
  layout(`<div class="wide-content">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <h2><i class="fas fa-store"></i> มาร์เก็ตเพลส</h2>
      <select class="form-control" style="width:180px;" id="cat-sel" onchange="loadMarketItems()">
        <option value="">ทุกหมวดหมู่</option>
        <option>อิเล็กทรอนิกส์</option><option>เสื้อผ้า/แฟชั่น</option><option>อาหาร</option>
        <option>รถยนต์/ยานพาหนะ</option><option>บ้านและสวน</option><option>กีฬา</option><option>อื่นๆ</option>
      </select>
    </div>
    <div id="marketplace-grid"></div>
  </div>`, 'marketplace');
  await loadMarketItems();
}

async function loadMarketItems() {
  const grid = $('marketplace-grid') || $('listing-grid'); if (!grid) return;
  try {
    const cat = $('cat-sel')?.value || '';
    const d = await api('GET', `/marketplace${cat?'?category='+encodeURIComponent(cat):''}`);
    if (!d.items.length) { grid.innerHTML='<div class="empty-state"><i class="fas fa-box-open"></i><h3>ไม่มีสินค้า</h3></div>'; return; }
    grid.innerHTML = `<div class="marketplace-grid">${d.items.map(productCard).join('')}</div>`;
  } catch (err) { grid.innerHTML=`<div class="empty-state"><i class="fas fa-exclamation"></i><h3>${err.message}</h3></div>`; }
}

async function loadListings(pageId) {
  const grid = $('listing-grid'); if (!grid) return;
  try {
    const d = await api('GET', `/marketplace?page_id=${pageId}`);
    if (!d.items.length) { grid.innerHTML='<div class="empty-state"><i class="fas fa-box-open"></i><h3>ยังไม่มีสินค้า</h3></div>'; return; }
    grid.innerHTML = `<div class="marketplace-grid">${d.items.map(productCard).join('')}</div>`;
  } catch {}
}

function productCard(item) {
  const imgs = (()=>{try{return JSON.parse(item.images||'[]');}catch{return [];}})();
  return `<div class="product-card">
    <div class="product-img">${imgs.length?`<img src="/uploads/marketplace/${imgs[0]}" alt="${escAttr(item.title)}">`:'<i class="fas fa-image" style="font-size:44px;color:var(--border);"></i>'}</div>
    <div class="product-info">
      <div class="product-title">${escHtml(item.title)}</div>
      <div class="product-price">฿${Number(item.price).toLocaleString()}</div>
      <div class="product-seller"><i class="fas fa-store"></i> ${escHtml(item.page_name||'ร้านค้า')}</div>
      <span class="product-badge ${item.condition==='new'?'new':'used'}">${item.condition==='new'?'สินค้าใหม่':'มือสอง'}</span>
    </div>
  </div>`;
}

function showCreateListing(pageId) {
  modal('ลงประกาศขายสินค้า',`
    <div class="form-group"><label>ชื่อสินค้า *</label><input class="form-control" id="li1" required></div>
    <div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="li2" rows="3"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label>ราคา (บาท) *</label><input class="form-control" type="number" id="li3" min="0" step="0.01"></div>
      <div class="form-group"><label>สต็อก</label><input class="form-control" type="number" id="li4" value="1" min="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>หมวดหมู่</label><select class="form-control" id="li5"><option>อิเล็กทรอนิกส์</option><option>เสื้อผ้า/แฟชั่น</option><option>อาหาร</option><option>บ้านและสวน</option><option>กีฬา</option><option>อื่นๆ</option></select></div>
      <div class="form-group"><label>สภาพ</label><select class="form-control" id="li6"><option value="new">ใหม่</option><option value="used">มือสอง</option></select></div>
    </div>
    <div class="form-group"><label>รูปภาพสินค้า</label><input type="file" accept="image/*" multiple id="li7" class="form-control"></div>`, async () => {
    if (!$('li1').value || !$('li3').value) return toast('กรุณากรอกชื่อและราคาสินค้า','error');
    const form = new FormData();
    form.append('page_id', pageId); form.append('title', $('li1').value);
    form.append('description', $('li2').value); form.append('price', $('li3').value);
    form.append('stock', $('li4').value); form.append('category', $('li5').value);
    form.append('condition', $('li6').value);
    Array.from($('li7').files).forEach(f=>form.append('images',f));
    try { await api('POST', '/marketplace', form, true); toast('ลงประกาศสำเร็จ! 🎉','success'); closeModal(); await loadListings(pageId); }
    catch (err) { toast(err.message,'error'); }
  });
}

// ── Livestream ────────────────────────────────────────────────
async function renderLive() {
  layout(`<div class="wide-content">
    <h2 style="margin-bottom:18px;"><i class="fas fa-video" style="color:var(--red);"></i> ไลฟ์สดกำลังออกอากาศ</h2>
    <div id="live-grid"></div>
  </div>`, 'live');
  await loadLiveItems();
}

async function loadLiveItems() {
  const grid = $('live-grid'); if (!grid) return;
  try {
    const d = await api('GET', '/livestreams');
    if (!d.livestreams.length) { grid.innerHTML='<div class="empty-state"><i class="fas fa-video-slash"></i><h3>ไม่มีไลฟ์สดในขณะนี้</h3><p>ติดตามเพจเพื่อรับแจ้งเตือนเมื่อเริ่มไลฟ์</p></div>'; return; }
    grid.innerHTML = `<div class="live-grid">${d.livestreams.map(l=>`
      <div class="live-card" onclick="toast('ระบบ streaming พร้อมเชื่อมต่อกับ stream key','info')">
        <div class="live-thumb">${l.thumbnail?`<img src="/uploads/livestream/${l.thumbnail}">`:'<i class="fas fa-video" style="font-size:48px;color:#555;"></i>'}
          <div class="live-badge"><i class="fas fa-circle"></i> LIVE</div>
          <div class="live-viewers"><i class="fas fa-eye"></i> ${fmtNum(l.viewer_count)}</div>
        </div>
        <div class="live-info"><div class="live-title">${escHtml(l.title)}</div><div class="live-page"><i class="fas fa-store"></i> ${escHtml(l.page_name||'')}</div></div>
      </div>`).join('')}</div>`;
  } catch (err) { grid.innerHTML=`<div class="empty-state"><i class="fas fa-exclamation"></i><h3>${err.message}</h3></div>`; }
}

function showStartLive(pageId) {
  modal('เริ่มไลฟ์สด',`
    <div class="form-group"><label>ชื่อไลฟ์สด *</label><input class="form-control" id="lv1" placeholder="หัวข้อไลฟ์" required></div>
    <div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="lv2" rows="2"></textarea></div>`, async () => {
    if (!$('lv1').value) return toast('กรุณากรอกชื่อไลฟ์','error');
    try {
      const d = await api('POST', '/livestreams', { page_id: pageId, title: $('lv1').value, description: $('lv2').value });
      toast(`เริ่มไลฟ์สดสำเร็จ! Stream Key: ${d.stream_key}`, 'success');
      closeModal();
    } catch (err) { toast(err.message,'error'); }
  });
}

// ── Chat ──────────────────────────────────────────────────────
async function renderChat() {
  layout(`<div class="wide-content"><div class="chat-layout">
    <div class="chat-sidebar"><div class="chat-sidebar-header"><i class="fas fa-comment-dots"></i> แชท</div><div id="chat-list"></div></div>
    <div class="chat-main" id="chat-main" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">
      <div style="text-align:center;"><i class="fas fa-comment-dots" style="font-size:56px;opacity:.2;margin-bottom:12px;display:block;"></i>เลือกการสนทนา</div>
    </div>
  </div></div>`, 'chat');
  await loadChatList();
  const room = new URLSearchParams(location.search).get('room');
  if (room) openChat(room);
}

async function loadChatList() {
  const list = $('chat-list'); if (!list) return;
  try {
    const d = await api('GET', '/chats');
    if (!d.rooms.length) { list.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">ยังไม่มีการสนทนา</div>'; return; }
    list.innerHTML = d.rooms.map(r=>`
      <div class="chat-item" onclick="openChat(${r.id})">
        <div class="avatar-placeholder" style="width:44px;height:44px;font-size:18px;">${(r.name||'C').charAt(0)}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escHtml(r.name||'การสนทนา')}</div>
          <div class="chat-item-last">${escHtml(r.last_message||'เริ่มต้นการสนทนา')}</div>
        </div>
        ${r.unread_count>0?`<div class="chat-unread">${r.unread_count}</div>`:''}
      </div>`).join('');
  } catch {}
}

async function openChat(roomId) {
  const main = $('chat-main'); if (!main) return;
  main.innerHTML = '<div class="loading-screen" style="height:100%;"><div class="loader"></div></div>';
  try {
    const d = await api('GET', `/chats/${roomId}/messages`);
    main.innerHTML = `
      <div class="chat-header"><div class="avatar-placeholder" style="width:36px;height:36px;font-size:14px;">💬</div><div style="flex:1;font-weight:700;">การสนทนา</div></div>
      <div class="chat-messages" id="msgs">
        ${d.messages.map(m=>`<div class="message-row${m.sender_id===currentUser?.id?' own':''}">
          ${m.sender_id!==currentUser?.id?`${m.avatar?`<img src="/uploads/avatars/${m.avatar}" class="message-avatar" onerror="this.style.display='none'">`:`<div class="avatar-placeholder message-avatar" style="width:30px;height:30px;font-size:12px;">${(m.first_name||'?').charAt(0)}</div>`}`:''}
          <div><div class="message-bubble">${escHtml(m.content)}</div><div class="message-time">${timeAgo(m.created_at)}</div></div>
        </div>`).join('')}
      </div>
      <div class="chat-input">
        <textarea id="msg-inp" placeholder="พิมพ์ข้อความ..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg(${roomId});}"></textarea>
        <button class="btn btn-primary" onclick="sendMsg(${roomId})"><i class="fas fa-paper-plane"></i></button>
      </div>`;
    const msgs = $('msgs'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
  } catch (err) { main.innerHTML=`<div style="padding:20px;color:var(--red);">${err.message}</div>`; }
}

async function sendMsg(roomId) {
  const inp = $('msg-inp'); if (!inp?.value.trim()) return;
  const txt = inp.value; inp.value = '';
  try { await api('POST', `/chats/${roomId}/messages`, { content: txt }); openChat(roomId); }
  catch (err) { toast(err.message,'error'); }
}

// ── Notifications ─────────────────────────────────────────────
async function renderNotifications() {
  layout(`<div class="page-content"><div class="card">
    <div class="card-header"><h2><i class="fas fa-bell"></i> การแจ้งเตือน</h2>
      <button class="btn btn-outline btn-sm" onclick="markAllRead()">อ่านทั้งหมด</button>
    </div>
    <div id="notif-list"></div>
  </div></div>`, 'notifications');
  try {
    const d = await api('GET', '/notifications');
    const list = $('notif-list');
    if (!d.notifications.length) { list.innerHTML='<div class="empty-state" style="padding:40px;"><i class="fas fa-bell-slash"></i><h3>ไม่มีการแจ้งเตือน</h3></div>'; return; }
    const icons = { follow:'fa-user-plus follow', like:'fa-heart like', comment:'fa-comment comment', donate:'fa-gift donate', kyc:'fa-shield-alt' };
    list.innerHTML = d.notifications.map(n=>`
      <div class="notif-item${n.is_read?'':' unread'}">
        <div class="notif-icon ${(icons[n.type]||'fa-bell').split(' ')[1]||''}"><i class="fas ${(icons[n.type]||'fa-bell').split(' ')[0]}"></i></div>
        <div class="notif-content">
          <div class="notif-title">${escHtml(n.title)}</div>
          ${n.body?`<div class="notif-body">${escHtml(n.body)}</div>`:''}
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');
  } catch (err) { toast(err.message,'error'); }
}

async function markAllRead() {
  try { await api('PUT', '/notifications/read-all'); toast('อ่านทั้งหมดแล้ว','success'); loadNotifBadge(); renderNotifications(); } catch {}
}

// ── Settings ──────────────────────────────────────────────────
async function renderSettings() {
  layout(`<div class="wide-content">
    <h2 style="margin-bottom:18px;"><i class="fas fa-cog"></i> ตั้งค่า</h2>
    <div class="settings-layout">
      <div class="settings-nav">
        <div class="settings-nav-item active" onclick="setPanel('account',this)"><i class="fas fa-user"></i> บัญชี</div>
        <div class="settings-nav-item" onclick="setPanel('notif',this)"><i class="fas fa-bell"></i> การแจ้งเตือน</div>
        <div class="settings-nav-item" onclick="setPanel('privacy',this)"><i class="fas fa-lock"></i> ความเป็นส่วนตัว</div>
        <div class="settings-nav-item" onclick="navigate('/kyc')"><i class="fas fa-shield-alt"></i> ยืนยันตัวตน KYC</div>
      </div>
      <div class="settings-panel"><div id="settings-body"></div></div>
    </div>
  </div>`, 'settings');
  setPanel('account', document.querySelector('.settings-nav-item'));
}

function setPanel(panel, el) {
  document.querySelectorAll('.settings-nav-item').forEach(i=>i.classList.remove('active'));
  if (el) el.classList.add('active');
  const body = $('settings-body'); if (!body) return;
  const u = currentUser;
  if (panel === 'account') {
    body.innerHTML = `<div class="settings-section"><div class="settings-section-title">ข้อมูลบัญชี</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        ${u?.avatar?`<img src="/uploads/avatars/${u.avatar}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`:
          `<div class="avatar-placeholder" style="width:80px;height:80px;font-size:32px;">${u?.first_name?.charAt(0)||'?'}</div>`}
        <div>
          <div style="font-weight:700;font-size:18px;">${escHtml((u?.first_name||'')+' '+(u?.last_name||''))}</div>
          <div style="color:var(--text-muted);">@${u?.username||''}</div>
          <div style="margin-top:6px;"><span class="tag ${u?.kyc_status==='verified'?'blue':''}">${u?.kyc_status==='verified'?'✓ ยืนยันตัวตนแล้ว':'ยังไม่ได้ยืนยันตัวตน'}</span></div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="editProfile()"><i class="fas fa-edit"></i> แก้ไขโปรไฟล์</button>
        <button class="btn btn-danger" onclick="logout()"><i class="fas fa-sign-out-alt"></i> ออกจากระบบ</button>
      </div>
    </div>`;
  } else if (panel === 'notif') {
    body.innerHTML = `<div class="settings-section"><div class="settings-section-title">การแจ้งเตือน</div>
      ${['post:โพสต์ใหม่:เมื่อมีคนโพสต์ในเพจที่ติดตาม','comment:ความคิดเห็น:เมื่อมีคนคอมเม้นท์โพสต์ของคุณ','follow:การติดตาม:เมื่อมีคนติดตามคุณ','message:ข้อความ:เมื่อได้รับข้อความใหม่'].map(t=>{
        const [id,label,desc]=t.split(':');
        return `<div class="toggle-row"><div><div class="toggle-label">${label}</div><div class="toggle-desc">${desc}</div></div>
          <label class="toggle"><input type="checkbox" id="nt-${id}" checked><span class="toggle-slider"></span></label></div>`;
      }).join('')}
      <button class="btn btn-primary" style="margin-top:16px;" onclick="saveNotifSettings()"><i class="fas fa-save"></i> บันทึก</button>
    </div>`;
  } else if (panel === 'privacy') {
    body.innerHTML = `<div class="settings-section"><div class="settings-section-title">ความเป็นส่วนตัว</div>
      <div class="form-group"><label>โปรไฟล์</label><select class="form-control" id="pv-prof"><option value="public">สาธารณะ</option><option value="friends">เพื่อนเท่านั้น</option><option value="private">ส่วนตัว</option></select></div>
      <div class="form-group"><label>โพสต์</label><select class="form-control" id="pv-post"><option value="public">สาธารณะ</option><option value="friends">เพื่อนเท่านั้น</option><option value="private">ส่วนตัว</option></select></div>
      <button class="btn btn-primary" onclick="savePrivacySettings()"><i class="fas fa-save"></i> บันทึก</button>
    </div>`;
  }
}

async function saveNotifSettings() {
  try {
    await api('PUT', '/settings', {
      notification_post:    $('nt-post')?.checked?1:0,
      notification_comment: $('nt-comment')?.checked?1:0,
      notification_follow:  $('nt-follow')?.checked?1:0,
      notification_message: $('nt-message')?.checked?1:0
    });
    toast('บันทึกการตั้งค่าแล้ว','success');
  } catch (err) { toast(err.message,'error'); }
}
async function savePrivacySettings() {
  try {
    await api('PUT', '/settings', { privacy_profile: $('pv-prof')?.value, privacy_posts: $('pv-post')?.value });
    toast('บันทึกการตั้งค่าแล้ว','success');
  } catch (err) { toast(err.message,'error'); }
}

// ── KYC ───────────────────────────────────────────────────────
function renderKYC() {
  layout(`<div class="page-content"><div class="card">
    <div class="card-header"><h2><i class="fas fa-shield-alt"></i> ยืนยันตัวตน (e-KYC)</h2></div>
    <div class="card-body">
      <p style="color:var(--text-muted);margin-bottom:24px;">ยืนยันตัวตนเพื่อรับเครื่องหมาย <i class="fas fa-circle-check verified-badge"></i> และเข้าถึงฟีเจอร์ทั้งหมด</p>

      <div class="kyc-step">
        <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">1</span> เลือกแพ็กเกจ</div>
        <div class="plan-cards">
          <div class="plan-card selected" id="plan-m" onclick="selPlan('m')"><div class="plan-price">฿330</div><div class="plan-period">/ เดือน</div></div>
          <div class="plan-card" id="plan-y" onclick="selPlan('y')"><div class="plan-price">฿2,000</div><div class="plan-period">/ ปี</div><div class="plan-save">ประหยัด ฿1,960</div></div>
        </div>
      </div>

      <div class="kyc-step">
        <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">2</span> สแกนใบหน้า</div>
        <label class="kyc-upload-area" for="kyc-face"><i class="fas fa-camera"></i><p>คลิกเพื่ออัปโหลดรูปใบหน้า</p><input type="file" id="kyc-face" accept="image/*" capture="user" style="display:none;" onchange="prevKyc(this,'kp-face')"></label>
        <img id="kp-face" class="kyc-preview">
      </div>

      <div class="kyc-step">
        <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">3</span> บัตรประชาชน</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label class="kyc-upload-area" for="kyc-idf"><i class="fas fa-id-card"></i><p>ด้านหน้า</p><input type="file" id="kyc-idf" accept="image/*" style="display:none;" onchange="prevKyc(this,'kp-idf')"></label>
          <label class="kyc-upload-area" for="kyc-idb"><i class="fas fa-id-card"></i><p>ด้านหลัง</p><input type="file" id="kyc-idb" accept="image/*" style="display:none;" onchange="prevKyc(this,'kp-idb')"></label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
          <img id="kp-idf" class="kyc-preview"><img id="kp-idb" class="kyc-preview">
        </div>
      </div>

      <div class="kyc-step">
        <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">4</span> Visa / Passport (ชาวต่างชาติ)</div>
        <label class="kyc-upload-area" for="kyc-pp"><i class="fas fa-passport"></i><p>อัปโหลด (ไม่บังคับสำหรับคนไทย)</p><input type="file" id="kyc-pp" accept="image/*" style="display:none;" onchange="prevKyc(this,'kp-pp')"></label>
        <img id="kp-pp" class="kyc-preview">
      </div>

      <div class="kyc-step">
        <div class="kyc-step-title"><span style="background:var(--primary);color:#fff;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">5</span> ผูกบัญชีคริปโต (ไม่บังคับ)</div>
        <div class="form-group"><label>Crypto Wallet Address</label><input class="form-control" id="kyc-wallet" placeholder="0x... หรือ wallet address ของคุณ"></div>
      </div>

      <button class="btn btn-primary btn-full" id="kyc-btn" onclick="submitKYC()" style="font-size:16px;padding:14px;">
        <i class="fas fa-shield-alt"></i> ส่งข้อมูลยืนยันตัวตน
      </button>
      ${currentUser?.kyc_status==='verified'?`<div style="margin-top:16px;padding:16px;background:#e8f5e9;border-radius:12px;color:#2e7d32;font-weight:700;text-align:center;"><i class="fas fa-circle-check"></i> บัญชีนี้ยืนยันตัวตนแล้ว</div>`:''}
    </div>
  </div></div>`, 'kyc');
  window._kycPlan = 'monthly';
}

function selPlan(p) {
  window._kycPlan = p === 'm' ? 'monthly' : 'yearly';
  $('plan-m')?.classList.toggle('selected', p==='m');
  $('plan-y')?.classList.toggle('selected', p==='y');
}

function prevKyc(input, prevId) {
  const prev = $(prevId); if (!prev || !input.files[0]) return;
  const r = new FileReader();
  r.onload = e => { prev.src = e.target.result; prev.style.display = 'block'; };
  r.readAsDataURL(input.files[0]);
}

async function submitKYC() {
  const btn = $('kyc-btn'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...';
  try {
    await api('POST', '/kyc/subscribe', { plan: window._kycPlan || 'monthly' });
    const form = new FormData();
    if ($('kyc-face')?.files[0])  form.append('face',         $('kyc-face').files[0]);
    if ($('kyc-idf')?.files[0])   form.append('id_front',     $('kyc-idf').files[0]);
    if ($('kyc-idb')?.files[0])   form.append('id_back',      $('kyc-idb').files[0]);
    if ($('kyc-pp')?.files[0])    form.append('passport_visa',$('kyc-pp').files[0]);
    if ($('kyc-wallet')?.value)   form.append('crypto_wallet', $('kyc-wallet').value);
    await api('POST', '/kyc/submit', form, true);
    await api('POST', '/kyc/approve', {});
    currentUser.kyc_status = 'verified';
    toast('ยืนยันตัวตนสำเร็จ! 🎉','success');
    renderKYC();
  } catch (err) { toast(err.message,'error'); btn.disabled=false; btn.innerHTML='<i class="fas fa-shield-alt"></i> ส่งข้อมูลยืนยันตัวตน'; }
}

// ── Create Page ───────────────────────────────────────────────
function renderCreatePage() {
  layout(`<div class="page-content"><div class="card">
    <div class="card-header"><h2><i class="fas fa-flag"></i> สร้างเพจใหม่</h2></div>
    <div class="card-body">
      <form id="cpf">
        <div class="form-group"><label>ชื่อเพจ *</label><input class="form-control" id="cp1" placeholder="ชื่อธุรกิจหรือแบรนด์" required></div>
        <div class="form-group"><label>คำอธิบาย</label><textarea class="form-control" id="cp2" rows="3" placeholder="เล่าเกี่ยวกับเพจของคุณ"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>หมวดหมู่</label>
            <select class="form-control" id="cp3">
              <option value="">-- เลือก --</option><option>ร้านอาหาร</option><option>แฟชั่น</option>
              <option>เทคโนโลยี</option><option>สุขภาพ/ความงาม</option><option>ท่องเที่ยว</option>
              <option>บันเทิง</option><option>กีฬา</option><option>ธุรกิจ</option><option>อื่นๆ</option>
            </select>
          </div>
          <div class="form-group"><label>เว็บไซต์</label><input class="form-control" id="cp4" type="url" placeholder="https://example.com"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>เบอร์โทร</label><input class="form-control" id="cp5" type="tel"></div>
          <div class="form-group"><label>ที่อยู่</label><input class="form-control" id="cp6" placeholder="ที่อยู่ร้าน"></div>
        </div>
        <button class="btn btn-primary btn-full" type="submit" id="cpb" style="font-size:16px;padding:13px;"><i class="fas fa-plus"></i> สร้างเพจ</button>
      </form>
    </div>
  </div></div>`);
  $('cpf').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('cpb'); btn.disabled=true; btn.textContent='กำลังสร้าง...';
    try {
      const d = await api('POST', '/pages', { name: $('cp1').value, description: $('cp2').value, category: $('cp3').value, website: $('cp4').value, phone: $('cp5').value, address: $('cp6').value });
      currentUser.pages = [...(currentUser.pages||[]), d.page];
      toast('สร้างเพจสำเร็จ! 🎉','success');
      navigate(`/page/${d.page.username}`);
    } catch (err) { toast(err.message,'error'); btn.disabled=false; btn.textContent='สร้างเพจ'; }
  });
}

// ── Donate ────────────────────────────────────────────────────
function showDonate(targetType, targetId) {
  modal('โดเนท 🎁',`
    <p style="color:var(--text-muted);margin-bottom:16px;">เลือกจำนวนที่ต้องการโดเนท</p>
    <div class="donate-amounts">
      ${[20,50,100,200,500,1000].map(a=>`<button class="donate-amount-btn" onclick="selAmt(${a},this)">฿${a}</button>`).join('')}
    </div>
    <div class="form-group"><label>จำนวนอื่นๆ (บาท)</label><input class="form-control" type="number" id="d-custom" placeholder="กรอกจำนวน" min="1" oninput="clearAmtSel()"></div>
    <div class="form-group"><label>ข้อความ</label><input class="form-control" id="d-msg" placeholder="ข้อความให้กำลังใจ..."></div>
    <input type="hidden" id="d-amt" value="20">`, async () => {
    const amt = parseFloat($('d-custom')?.value || $('d-amt')?.value || 0);
    if (!amt || amt < 1) return toast('กรุณาเลือกหรือกรอกจำนวน','error');
    try {
      await api('POST', '/donate', { target_type: targetType, target_id: targetId, amount: amt, message: $('d-msg')?.value });
      toast(`โดเนท ฿${amt} สำเร็จ! 🎉','success`); closeModal();
    } catch (err) { toast(err.message,'error'); }
  }, 'โดเนทเลย!');
}
function selAmt(a, btn) {
  document.querySelectorAll('.donate-amount-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  const inp = $('d-amt'); if (inp) inp.value = a;
  const c = $('d-custom'); if (c) c.value = '';
}
function clearAmtSel() { document.querySelectorAll('.donate-amount-btn').forEach(b=>b.classList.remove('selected')); }

// ── Modal ─────────────────────────────────────────────────────
function modal(title, body, onOk, okLabel = 'ยืนยัน') {
  const ov = el('div', 'modal-overlay');
  ov.id = 'modal-ov';
  ov.innerHTML = `<div class="modal">
    <div class="modal-header"><h2>${title}</h2><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">${body}</div>
    ${onOk?`<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="window._mok()">${okLabel}</button></div>`:''}
  </div>`;
  document.body.appendChild(ov);
  window._mok = onOk;
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
}
function closeModal() { $('modal-ov')?.remove(); }

// ── 404 ───────────────────────────────────────────────────────
function renderNotFound() {
  if (currentUser) {
    layout('<div class="empty-state" style="margin-top:60px;"><i class="fas fa-map-signs"></i><h3>404 — ไม่พบหน้านี้</h3><button class="btn btn-primary" style="margin-top:16px;" onclick="navigate(\'/\')"><i class="fas fa-home"></i> กลับหน้าหลัก</button></div>');
  } else { navigate('/login'); }
}

// ── Start ─────────────────────────────────────────────────────
init();
