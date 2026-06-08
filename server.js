require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'socialconnect-secret-change-in-production';
const DB_PATH = path.join(__dirname, 'social.db');

// ── Database ───────────────────────────────────────────────
function getDb() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ ไม่พบฐานข้อมูล! กรุณารัน: node setup.js ก่อน');
    process.exit(1);
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
const db = getDb();

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, { index: 'index.html' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Upload dirs auto-create ────────────────────────────────
['uploads/avatars','uploads/covers','uploads/posts','uploads/kyc','uploads/marketplace','uploads/livestream']
  .forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Multer factories ───────────────────────────────────────
function makeUpload(dir) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, `uploads/${dir}`),
      filename:    (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
  });
}
const uploadPost   = makeUpload('posts');
const uploadAvatar = makeUpload('avatars');
const uploadCover  = makeUpload('covers');
const uploadKyc    = makeUpload('kyc');
const uploadMarket = makeUpload('marketplace');
const uploadLive   = makeUpload('livestream');

// ── Auth middleware ────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' }); }
}

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

// สมัครสมาชิก
app.post('/api/auth/register', (req, res) => {
  try {
    const { first_name, last_name, email, phone_code, phone, birthdate, occupation, address, nationality, language } = req.body;
    if (!first_name || !last_name || !email) return res.status(400).json({ error: 'กรุณากรอกชื่อ นามสกุล และอีเมล' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });

    const userId = uuidv4();
    const emailToken = uuidv4();
    const passwordToken = uuidv4();
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4);

    db.prepare(`
      INSERT INTO users (id, username, email, first_name, last_name, phone_code, phone, birthdate, occupation, address, nationality, language, email_token, password_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, first_name, last_name, phone_code||'+66', phone||'', birthdate||'', occupation||'', address||'', nationality||'ไทย', language||'th', emailToken, passwordToken);

    db.prepare('INSERT INTO user_settings (id, user_id) VALUES (?, ?)').run(uuidv4(), userId);

    const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
    res.json({
      message: 'สมัครสมาชิกสำเร็จ',
      verify_link: `${BASE}/verify-email?token=${emailToken}`,
      password_link: `${BASE}/set-password?token=${passwordToken}`
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ยืนยันอีเมล
app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query;
  const user = db.prepare('SELECT id FROM users WHERE email_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Token ไม่ถูกต้อง' });
  db.prepare('UPDATE users SET email_verified = 1, email_token = NULL WHERE id = ?').run(user.id);
  res.json({ message: 'ยืนยันอีเมลสำเร็จ' });
});

// ตั้งรหัสผ่าน
app.post('/api/auth/set-password', (req, res) => {
  const { token, password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
  const user = db.prepare('SELECT id FROM users WHERE password_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Token ไม่ถูกต้อง' });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ?, password_token = NULL, email_verified = 1 WHERE id = ?').run(hash, user.id);
  res.json({ message: 'ตั้งรหัสผ่านสำเร็จ' });
});

// เข้าสู่ระบบ
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !user.password) return res.status(400).json({ error: 'ไม่พบบัญชีนี้ หรือยังไม่ได้ตั้งรหัสผ่าน' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ดึงข้อมูลตัวเอง
app.get('/api/auth/me', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT id,username,email,first_name,last_name,phone_code,phone,birthdate,occupation,address,nationality,language,bio,avatar,cover_photo,kyc_status,crypto_wallet,created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const pages = db.prepare('SELECT id,username,name,avatar,description FROM pages WHERE owner_id = ?').all(req.user.id);
    res.json({ user, pages });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// USER ROUTES
// ════════════════════════════════════════════════════════════

// ดึงโปรไฟล์ผู้ใช้
app.get('/api/users/:username', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT id,username,email,first_name,last_name,bio,avatar,cover_photo,kyc_status,occupation,address,created_at FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const stats = {
      posts:     db.prepare("SELECT COUNT(*) as c FROM posts WHERE author_type='user' AND author_id=?").get(user.id).c,
      followers: db.prepare("SELECT COUNT(*) as c FROM follows WHERE target_type='user' AND target_id=?").get(user.id).c,
      following: db.prepare("SELECT COUNT(*) as c FROM follows WHERE follower_id=?").get(user.id).c
    };
    res.json({ user, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// แก้ไขโปรไฟล์
app.put('/api/users/me', auth, uploadAvatar.fields([{name:'avatar',maxCount:1},{name:'cover',maxCount:1}]), (req, res) => {
  try {
    const { username, bio, address, occupation, first_name, last_name } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    if (username && username !== user.username) {
      const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
      if (taken) return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }

    const avatar = req.files?.avatar?.[0]?.filename || user.avatar;
    const cover  = req.files?.cover?.[0]?.filename  || user.cover_photo;

    db.prepare(`
      UPDATE users SET username=?, bio=?, address=?, occupation=?, first_name=?, last_name=?, avatar=?, cover_photo=?, updated_at=datetime('now') WHERE id=?
    `).run(
      username||user.username, bio??user.bio, address??user.address,
      occupation??user.occupation, first_name||user.first_name, last_name||user.last_name,
      avatar, cover, req.user.id
    );

    const updated = db.prepare('SELECT id,username,email,first_name,last_name,bio,avatar,cover_photo,kyc_status,occupation,address FROM users WHERE id=?').get(req.user.id);
    res.json({ user: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ค้นหา
app.get('/api/search', auth, (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const users = db.prepare("SELECT id,username,first_name,last_name,avatar,kyc_status FROM users WHERE (first_name LIKE ? OR last_name LIKE ? OR username LIKE ?) LIMIT 8").all(q, q, q);
    const pages = db.prepare("SELECT id,username,name,avatar FROM pages WHERE name LIKE ? OR username LIKE ? LIMIT 8").all(q, q);
    res.json({ users, pages });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// PAGE ROUTES
// ════════════════════════════════════════════════════════════

// สร้างเพจ
app.post('/api/pages', auth, (req, res) => {
  try {
    const { name, description, category, website, phone, address } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณากรอกชื่อเพจ' });
    const pageId = uuidv4();
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    db.prepare(`
      INSERT INTO pages (id, owner_id, username, name, description, category, website, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pageId, req.user.id, username, name, description||'', category||'', website||'', phone||'', address||'');
    const page = db.prepare('SELECT * FROM pages WHERE id=?').get(pageId);
    res.json({ page });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ดึงข้อมูลเพจ
app.get('/api/pages/:username', auth, (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE username=?').get(req.params.username);
    if (!page) return res.status(404).json({ error: 'ไม่พบเพจ' });
    const stats = {
      posts:     db.prepare("SELECT COUNT(*) as c FROM posts WHERE author_type='page' AND author_id=?").get(page.id).c,
      followers: db.prepare("SELECT COUNT(*) as c FROM follows WHERE target_type='page' AND target_id=?").get(page.id).c
    };
    res.json({ page, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// แก้ไขเพจ
app.put('/api/pages/:id', auth, uploadAvatar.fields([{name:'avatar',maxCount:1},{name:'cover',maxCount:1}]), (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
    if (!page) return res.status(404).json({ error: 'ไม่พบเพจหรือไม่มีสิทธิ์' });
    const { name, description, category, website, phone, address } = req.body;
    const avatar = req.files?.avatar?.[0]?.filename || page.avatar;
    const cover  = req.files?.cover?.[0]?.filename  || page.cover_photo;
    db.prepare(`UPDATE pages SET name=?,description=?,category=?,website=?,phone=?,address=?,avatar=?,cover_photo=?,updated_at=datetime('now') WHERE id=?`
    ).run(name||page.name, description??page.description, category||page.category, website||page.website, phone||page.phone, address||page.address, avatar, cover, page.id);
    res.json({ page: db.prepare('SELECT * FROM pages WHERE id=?').get(page.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// FOLLOW ROUTES
// ════════════════════════════════════════════════════════════

app.post('/api/follow', auth, (req, res) => {
  try {
    const { target_type, target_id } = req.body;
    if (!['user','page'].includes(target_type)) return res.status(400).json({ error: 'target_type ไม่ถูกต้อง' });
    const existing = db.prepare('SELECT id FROM follows WHERE follower_id=? AND target_type=? AND target_id=?').get(req.user.id, target_type, target_id);
    if (existing) {
      db.prepare('DELETE FROM follows WHERE id=?').run(existing.id);

      // Notify
      if (target_type === 'user') {
        const follower = db.prepare('SELECT first_name,last_name FROM users WHERE id=?').get(req.user.id);
        db.prepare("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)").run(
          uuidv4(), target_id, 'follow', 'ยกเลิกการติดตาม', `${follower?.first_name} ยกเลิกการติดตามคุณ`);
      }
      return res.json({ followed: false });
    }
    db.prepare('INSERT INTO follows (id,follower_id,target_type,target_id) VALUES (?,?,?,?)').run(uuidv4(), req.user.id, target_type, target_id);

    if (target_type === 'user') {
      const follower = db.prepare('SELECT first_name,last_name FROM users WHERE id=?').get(req.user.id);
      db.prepare("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)").run(
        uuidv4(), target_id, 'follow', 'มีคนใหม่ติดตามคุณ', `${follower?.first_name} ${follower?.last_name} เริ่มติดตามคุณ`);
    }
    res.json({ followed: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/follow/check', auth, (req, res) => {
  const { target_type, target_id } = req.query;
  const row = db.prepare('SELECT id FROM follows WHERE follower_id=? AND target_type=? AND target_id=?').get(req.user.id, target_type, target_id);
  res.json({ following: !!row });
});

// ════════════════════════════════════════════════════════════
// POST ROUTES
// ════════════════════════════════════════════════════════════

// ดึงโพสต์
app.get('/api/posts', auth, (req, res) => {
  try {
    const { author_type, author_id } = req.query;
    let rows;
    if (author_type && author_id) {
      rows = db.prepare(`SELECT p.*, GROUP_CONCAT(l.id) as like_ids,
        COUNT(DISTINCT l.id) as like_count, COUNT(DISTINCT c.id) as comment_count, COUNT(DISTINCT s.id) as share_count
        FROM posts p LEFT JOIN likes l ON l.post_id=p.id LEFT JOIN comments c ON c.post_id=p.id LEFT JOIN shares s ON s.post_id=p.id
        WHERE p.author_type=? AND p.author_id=? GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50`).all(author_type, author_id);
    } else {
      // feed: posts from followed users/pages + own
      const followedUsers = db.prepare("SELECT target_id FROM follows WHERE follower_id=? AND target_type='user'").all(req.user.id).map(r => r.target_id);
      const followedPages = db.prepare("SELECT target_id FROM follows WHERE follower_id=? AND target_type='page'").all(req.user.id).map(r => r.target_id);
      const allUserIds  = [req.user.id, ...followedUsers];
      const allPageIds  = followedPages;

      const placeholdersU = allUserIds.map(()=>'?').join(',');
      const queryParts = [`(author_type='user' AND author_id IN (${placeholdersU}))`];
      const params = [...allUserIds];
      if (allPageIds.length) {
        queryParts.push(`(author_type='page' AND author_id IN (${allPageIds.map(()=>'?').join(',')}))`);
        params.push(...allPageIds);
      }
      rows = db.prepare(`
        SELECT p.*, COUNT(DISTINCT l.id) as like_count, COUNT(DISTINCT c.id) as comment_count, COUNT(DISTINCT s.id) as share_count
        FROM posts p LEFT JOIN likes l ON l.post_id=p.id LEFT JOIN comments c ON c.post_id=p.id LEFT JOIN shares s ON s.post_id=p.id
        WHERE ${queryParts.join(' OR ')} GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50
      `).all(...params);
    }

    const posts = rows.map(p => {
      let author = null;
      if (p.author_type === 'user') {
        author = db.prepare('SELECT id,username,first_name,last_name,avatar,kyc_status FROM users WHERE id=?').get(p.author_id);
      } else {
        author = db.prepare('SELECT id,username,name,avatar FROM pages WHERE id=?').get(p.author_id);
      }
      const userLiked = db.prepare('SELECT id FROM likes WHERE user_id=? AND post_id=?').get(req.user.id, p.id);
      db.prepare('UPDATE posts SET views=views+1 WHERE id=?').run(p.id);
      return { ...p, author, user_liked: !!userLiked };
    });

    res.json({ posts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// สร้างโพสต์
app.post('/api/posts', auth, uploadPost.array('media', 10), (req, res) => {
  try {
    const { content, author_type, author_id } = req.body;
    if (!content && (!req.files || !req.files.length)) return res.status(400).json({ error: 'กรุณากรอกเนื้อหาหรืออัปโหลดรูปภาพ' });

    if (author_type === 'page') {
      const page = db.prepare('SELECT id FROM pages WHERE id=? AND owner_id=?').get(author_id, req.user.id);
      if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์โพสต์ในเพจนี้' });
    }

    const media = req.files?.length ? JSON.stringify(req.files.map(f => f.filename)) : null;
    const postId = uuidv4();
    db.prepare('INSERT INTO posts (id,author_type,author_id,content,media) VALUES (?,?,?,?,?)').run(
      postId, author_type||'user', author_id||req.user.id, content||'', media
    );
    const post = db.prepare('SELECT * FROM posts WHERE id=?').get(postId);
    res.json({ post });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ถูกใจ
app.post('/api/posts/:id/like', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM likes WHERE user_id=? AND post_id=?').get(req.user.id, req.params.id);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE id=?').run(existing.id);
      return res.json({ liked: false });
    }
    db.prepare('INSERT INTO likes (id,user_id,post_id) VALUES (?,?,?)').run(uuidv4(), req.user.id, req.params.id);

    const post = db.prepare('SELECT author_type,author_id FROM posts WHERE id=?').get(req.params.id);
    if (post?.author_type === 'user' && post.author_id !== req.user.id) {
      const liker = db.prepare('SELECT first_name,last_name FROM users WHERE id=?').get(req.user.id);
      db.prepare("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)").run(
        uuidv4(), post.author_id, 'like', 'มีคนถูกใจโพสต์ของคุณ', `${liker?.first_name} ${liker?.last_name} กดถูกใจโพสต์ของคุณ`);
    }
    res.json({ liked: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ดึงคอมเม้นท์
app.get('/api/posts/:id/comments', auth, (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT c.*, u.first_name, u.last_name, u.avatar FROM comments c
      JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at ASC
    `).all(req.params.id);
    res.json({ comments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// เพิ่มคอมเม้นท์
app.post('/api/posts/:id/comments', auth, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'กรุณากรอกความคิดเห็น' });
    const commentId = uuidv4();
    db.prepare('INSERT INTO comments (id,post_id,user_id,content) VALUES (?,?,?,?)').run(commentId, req.params.id, req.user.id, content);

    const post = db.prepare('SELECT author_type,author_id FROM posts WHERE id=?').get(req.params.id);
    if (post?.author_type === 'user' && post.author_id !== req.user.id) {
      const commenter = db.prepare('SELECT first_name,last_name FROM users WHERE id=?').get(req.user.id);
      db.prepare("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)").run(
        uuidv4(), post.author_id, 'comment', 'มีคนคอมเม้นท์โพสต์ของคุณ', `${commenter?.first_name}: ${content.substring(0,50)}`);
    }
    res.json({ comment: db.prepare('SELECT * FROM comments WHERE id=?').get(commentId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// แชร์
app.post('/api/posts/:id/share', auth, (req, res) => {
  try {
    db.prepare('INSERT INTO shares (id,post_id,user_id) VALUES (?,?,?)').run(uuidv4(), req.params.id, req.user.id);
    res.json({ shared: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// MARKETPLACE ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/marketplace', auth, (req, res) => {
  try {
    const { category, page_id } = req.query;
    let query = `SELECT m.*, p.name as page_name, p.avatar as page_avatar FROM marketplace m JOIN pages p ON p.id=m.page_id WHERE m.status='active'`;
    const params = [];
    if (category) { query += ` AND m.category=?`; params.push(category); }
    if (page_id)  { query += ` AND m.page_id=?`;  params.push(page_id); }
    query += ` ORDER BY m.created_at DESC LIMIT 50`;
    res.json({ items: db.prepare(query).all(...params) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/marketplace', auth, uploadMarket.array('images', 10), (req, res) => {
  try {
    const { page_id, title, description, price, category, condition, stock } = req.body;
    if (!page_id || !title || !price) return res.status(400).json({ error: 'กรุณากรอกข้อมูลสินค้าให้ครบ' });

    const page = db.prepare('SELECT id FROM pages WHERE id=? AND owner_id=?').get(page_id, req.user.id);
    if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์ลงสินค้าในเพจนี้' });

    const images = req.files?.length ? JSON.stringify(req.files.map(f => f.filename)) : null;
    const itemId = uuidv4();
    db.prepare(`INSERT INTO marketplace (id,page_id,title,description,price,images,category,condition,stock) VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(itemId, page_id, title, description||'', parseFloat(price), images, category||'', condition||'new', parseInt(stock)||1);
    res.json({ item: db.prepare('SELECT * FROM marketplace WHERE id=?').get(itemId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// LIVESTREAM ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/livestreams', auth, (req, res) => {
  try {
    const streams = db.prepare(`
      SELECT l.*, p.name as page_name, p.avatar as page_avatar FROM livestreams l
      JOIN pages p ON p.id=l.page_id WHERE l.status='live' ORDER BY l.viewer_count DESC
    `).all();
    res.json({ livestreams: streams });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/livestreams', auth, (req, res) => {
  try {
    const { page_id, title, description } = req.body;
    if (!page_id || !title) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    const page = db.prepare('SELECT id FROM pages WHERE id=? AND owner_id=?').get(page_id, req.user.id);
    if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์ไลฟ์สดในเพจนี้' });
    const liveId = uuidv4();
    const streamKey = uuidv4().replace(/-/g,'').substring(0,16);
    db.prepare('INSERT INTO livestreams (id,page_id,title,description,stream_key) VALUES (?,?,?,?,?)').run(liveId, page_id, title, description||'', streamKey);
    res.json({ livestream: db.prepare('SELECT * FROM livestreams WHERE id=?').get(liveId), stream_key: streamKey });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/livestreams/:id/end', auth, (req, res) => {
  try {
    db.prepare("UPDATE livestreams SET status='ended', ended_at=datetime('now') WHERE id=?").run(req.params.id);
    res.json({ ended: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// CHAT ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/chats', auth, (req, res) => {
  try {
    const rooms = db.prepare(`
      SELECT r.*, cm2.user_id as other_user_id,
        (SELECT content FROM chat_messages WHERE room_id=r.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM chat_messages WHERE room_id=r.id AND sender_id!=? AND is_read=0) as unread_count
      FROM chat_rooms r
      JOIN chat_members cm ON cm.room_id=r.id AND cm.user_id=?
      LEFT JOIN chat_members cm2 ON cm2.room_id=r.id AND cm2.user_id!=?
      ORDER BY r.created_at DESC
    `).all(req.user.id, req.user.id, req.user.id);
    res.json({ rooms });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chats/direct', auth, (req, res) => {
  try {
    const { target_user_id } = req.body;
    // ตรวจสอบว่ามีห้องอยู่แล้วหรือไม่
    const existing = db.prepare(`
      SELECT r.id FROM chat_rooms r
      JOIN chat_members m1 ON m1.room_id=r.id AND m1.user_id=?
      JOIN chat_members m2 ON m2.room_id=r.id AND m2.user_id=?
      WHERE r.type='direct' LIMIT 1
    `).get(req.user.id, target_user_id);
    if (existing) return res.json({ room: existing });

    const roomId = uuidv4();
    db.prepare("INSERT INTO chat_rooms (id,type) VALUES (?,'direct')").run(roomId);
    db.prepare('INSERT INTO chat_members (id,room_id,user_id) VALUES (?,?,?)').run(uuidv4(), roomId, req.user.id);
    db.prepare('INSERT INTO chat_members (id,room_id,user_id) VALUES (?,?,?)').run(uuidv4(), roomId, target_user_id);
    res.json({ room: { id: roomId } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/chats/:id/messages', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM chat_members WHERE room_id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงห้องแชทนี้' });
    const messages = db.prepare(`
      SELECT m.*, u.first_name, u.last_name, u.avatar FROM chat_messages m
      JOIN users u ON u.id=m.sender_id WHERE m.room_id=? ORDER BY m.created_at ASC LIMIT 100
    `).all(req.params.id);
    db.prepare('UPDATE chat_messages SET is_read=1 WHERE room_id=? AND sender_id!=?').run(req.params.id, req.user.id);
    res.json({ messages });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chats/:id/messages', auth, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'กรุณากรอกข้อความ' });
    const member = db.prepare('SELECT id FROM chat_members WHERE room_id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
    const msgId = uuidv4();
    db.prepare('INSERT INTO chat_messages (id,room_id,sender_id,content) VALUES (?,?,?,?)').run(msgId, req.params.id, req.user.id, content);
    res.json({ message: db.prepare('SELECT * FROM chat_messages WHERE id=?').get(msgId) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/notifications', auth, (req, res) => {
  try {
    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json({ notifications });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// SETTINGS ROUTES
// ════════════════════════════════════════════════════════════

app.get('/api/settings', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(req.user.id);
  res.json({ settings: s || {} });
});

app.put('/api/settings', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM user_settings WHERE user_id=?').get(req.user.id);
    const fields = ['notification_post','notification_comment','notification_follow','notification_message','privacy_profile','privacy_posts','theme'];
    if (existing) {
      const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f}=?`).join(',');
      const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
      if (updates) db.prepare(`UPDATE user_settings SET ${updates}, updated_at=datetime('now') WHERE user_id=?`).run(...vals, req.user.id);
    } else {
      db.prepare('INSERT INTO user_settings (id,user_id) VALUES (?,?)').run(uuidv4(), req.user.id);
    }
    res.json({ settings: db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(req.user.id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// KYC ROUTES
// ════════════════════════════════════════════════════════════

app.post('/api/kyc/subscribe', auth, (req, res) => {
  try {
    const { plan } = req.body;
    if (!['monthly','yearly'].includes(plan)) return res.status(400).json({ error: 'แพ็กเกจไม่ถูกต้อง' });
    const amount = plan === 'monthly' ? 330 : 2000;
    const expires = new Date();
    plan === 'monthly' ? expires.setMonth(expires.getMonth()+1) : expires.setFullYear(expires.getFullYear()+1);
    db.prepare('INSERT INTO kyc_subscriptions (id,user_id,plan,amount,expires_at) VALUES (?,?,?,?,?)').run(uuidv4(), req.user.id, plan, amount, expires.toISOString());
    res.json({ subscribed: true, plan, amount, expires_at: expires.toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/kyc/submit', auth,
  uploadKyc.fields([
    {name:'face',maxCount:1}, {name:'id_front',maxCount:1},
    {name:'id_back',maxCount:1}, {name:'passport_visa',maxCount:1}
  ]),
  (req, res) => {
    try {
      const { crypto_wallet } = req.body;
      const kycId = uuidv4();
      db.prepare(`
        INSERT INTO kyc_documents (id,user_id,face_image,id_card_front,id_card_back,passport_visa,crypto_wallet)
        VALUES (?,?,?,?,?,?,?)
      `).run(
        kycId, req.user.id,
        req.files?.face?.[0]?.filename || null,
        req.files?.id_front?.[0]?.filename || null,
        req.files?.id_back?.[0]?.filename || null,
        req.files?.passport_visa?.[0]?.filename || null,
        crypto_wallet || null
      );
      if (crypto_wallet) db.prepare('UPDATE users SET crypto_wallet=? WHERE id=?').run(crypto_wallet, req.user.id);
      res.json({ submitted: true, kyc_id: kycId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// อนุมัติ KYC (auto-approve สำหรับ demo)
app.post('/api/kyc/approve', auth, (req, res) => {
  try {
    db.prepare("UPDATE users SET kyc_status='verified' WHERE id=?").run(req.user.id);
    db.prepare("UPDATE kyc_documents SET status='approved', reviewed_at=datetime('now') WHERE user_id=? AND status='pending'").run(req.user.id);
    db.prepare("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)").run(
      uuidv4(), req.user.id, 'kyc', 'ยืนยันตัวตนสำเร็จ! 🎉', 'บัญชีของคุณได้รับการยืนยันตัวตน e-KYC เรียบร้อยแล้ว');
    res.json({ approved: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// DONATE ROUTES
// ════════════════════════════════════════════════════════════

app.post('/api/donate', auth, (req, res) => {
  try {
    const { target_type, target_id, amount, message } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
    db.prepare('INSERT INTO donations (id,sender_id,target_type,target_id,amount,message) VALUES (?,?,?,?,?,?)').run(
      uuidv4(), req.user.id, target_type, target_id, parseFloat(amount), message||''
    );
    const sender = db.prepare('SELECT first_name,last_name FROM users WHERE id=?').get(req.user.id);
    if (target_type === 'user') {
      db.prepare("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,?,?,?)").run(
        uuidv4(), target_id, 'donate', `ได้รับโดเนท ฿${amount}!`, `${sender?.first_name} โดเนท ฿${amount} ${message?'— '+message:''}`);
    }
    res.json({ donated: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
// SPA FALLBACK
// ════════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ════════════════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀 SocialConnect เริ่มทำงานที่ http://localhost:${PORT}`);
  console.log(`   📁 ฐานข้อมูล: social.db`);
  console.log(`   🔑 กด Ctrl+C เพื่อหยุด\n`);
});
