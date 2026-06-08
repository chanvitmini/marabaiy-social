require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
const uploadDirs = ['uploads/avatars','uploads/covers','uploads/posts','uploads/kyc','uploads/marketplace','uploads/livestream'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup - separate instances per upload type
function makeUpload(dir) {
  const s = multer.diskStorage({
    destination: (req, file, cb) => cb(null, `uploads/${dir}`),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
  });
  return multer({ storage: s, limits: { fileSize: 10 * 1024 * 1024 } });
}
const uploadPost = makeUpload('posts');
const uploadAvatar = makeUpload('avatars');
const uploadKyc = makeUpload('kyc');
const uploadMarket = makeUpload('marketplace');
const uploadLive = makeUpload('livestream');
const upload = makeUpload('posts'); // default

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============================================================
// AUTH ROUTES
// ============================================================

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { first_name, last_name, email, phone_code, phone, birthdate, occupation, address, nationality, language } = req.body;
    if (!first_name || !last_name || !email) return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' });

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });

    const uuid = uuidv4();
    const verify_token = uuidv4();
    const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 9999);

    db.prepare(`INSERT INTO users (uuid, first_name, last_name, email, phone_code, phone, birthdate, occupation, address, nationality, language, username, email_verify_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid, first_name, last_name, email, phone_code || '+66', phone, birthdate, occupation, address, nationality, language || 'th', username, verify_token);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(user.id);

    // Simulate email sending (in prod, use nodemailer)
    const verifyLink = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email?token=${verify_token}`;
    const passwordLink = `${process.env.BASE_URL || 'http://localhost:3000'}/set-password?token=${verify_token}`;

    res.json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ กรุณายืนยันอีเมล',
      verify_link: verifyLink,
      password_link: passwordLink,
      uuid
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

// Verify email
app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query;
  const user = db.prepare('SELECT * FROM users WHERE email_verify_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Token ไม่ถูกต้อง' });
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);
  res.json({ success: true, message: 'ยืนยันอีเมลสำเร็จ' });
});

// Set password
app.post('/api/auth/set-password', (req, res) => {
  const { token, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email_verify_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Token ไม่ถูกต้อง' });
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ?, email_verify_token = NULL, password_reset_token = NULL WHERE id = ?').run(hashed, user.id);
  res.json({ success: true, message: 'ตั้งรหัสผ่านสำเร็จ' });
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: 'ไม่พบบัญชีนี้' });
    if (!user.password) return res.status(400).json({ error: 'กรุณาตั้งรหัสผ่านก่อน' });
    if (!user.email_verified) return res.status(400).json({ error: 'กรุณายืนยันอีเมลก่อน' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    const token = jwt.sign({ id: user.id, uuid: user.uuid, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, email_verify_token: __, ...safeUser } = user;
    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  const { password, email_verify_token, ...safeUser } = user;
  const pages = db.prepare('SELECT * FROM pages WHERE owner_id = ?').all(user.id);
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(user.id);
  res.json({ user: safeUser, pages, settings });
});

// ============================================================
// KYC ROUTES
// ============================================================

// Submit KYC documents
app.post('/api/kyc/submit', auth, uploadKyc.fields([
  { name: 'face', maxCount: 1 },
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 },
  { name: 'passport_visa', maxCount: 1 }
]), (req, res) => {
  try {
    const face = req.files?.face?.[0]?.filename;
    const id_front = req.files?.id_front?.[0]?.filename;
    const id_back = req.files?.id_back?.[0]?.filename;
    const passport_visa = req.files?.passport_visa?.[0]?.filename;
    const { crypto_wallet } = req.body;

    db.prepare(`INSERT OR REPLACE INTO kyc_documents (user_id, face_image, id_card_front, id_card_back, passport_visa, status)
      VALUES (?, ?, ?, ?, ?, 'pending')`).run(req.user.id, face, id_front, id_back, passport_visa);

    if (crypto_wallet) {
      db.prepare('UPDATE users SET crypto_wallet = ? WHERE id = ?').run(crypto_wallet, req.user.id);
    }

    res.json({ success: true, message: 'ส่งเอกสาร KYC สำเร็จ รอการตรวจสอบ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KYC subscription
app.post('/api/kyc/subscribe', auth, (req, res) => {
  try {
    const { plan } = req.body;
    if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'แผนไม่ถูกต้อง' });

    const amount = plan === 'monthly' ? 330 : 2000;
    const now = new Date();
    const expires = new Date(now);
    if (plan === 'monthly') expires.setMonth(expires.getMonth() + 1);
    else expires.setFullYear(expires.getFullYear() + 1);

    db.prepare(`INSERT INTO kyc_subscriptions (user_id, plan, amount, expires_at) VALUES (?, ?, ?, ?)`)
      .run(req.user.id, plan, amount, expires.toISOString());
    db.prepare(`UPDATE users SET kyc_subscription = ?, kyc_subscription_expires = ? WHERE id = ?`)
      .run(plan, expires.toISOString(), req.user.id);

    res.json({ success: true, message: `สมัครแพ็กเกจ ${plan === 'monthly' ? 'รายเดือน 330 บาท' : 'รายปี 2,000 บาท'} สำเร็จ` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve KYC (simulate admin)
app.post('/api/kyc/approve', auth, (req, res) => {
  try {
    const { user_id } = req.body;
    const targetId = user_id || req.user.id;
    db.prepare(`UPDATE kyc_documents SET status = 'approved', reviewed_at = datetime('now') WHERE user_id = ?`).run(targetId);
    db.prepare(`UPDATE users SET kyc_status = 'verified' WHERE id = ?`).run(targetId);
    res.json({ success: true, message: 'ยืนยัน KYC สำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// USER PROFILE ROUTES
// ============================================================

// Get user profile by username
app.get('/api/users/:username', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  const { password, email_verify_token, ...safeUser } = user;
  const followerCount = db.prepare("SELECT COUNT(*) as c FROM follows WHERE target_type='user' AND target_id=?").get(user.id);
  const followingCount = db.prepare("SELECT COUNT(*) as c FROM follows WHERE follower_id=?").get(user.id);
  const postCount = db.prepare("SELECT COUNT(*) as c FROM posts WHERE author_type='user' AND author_id=?").get(user.id);
  res.json({ user: safeUser, stats: { followers: followerCount.c, following: followingCount.c, posts: postCount.c } });
});

// Update profile
app.put('/api/users/me', auth, uploadAvatar.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  try {
    const { bio, address, occupation, username } = req.body;
    const avatar = req.files?.avatar?.[0]?.filename;
    const cover = req.files?.cover?.[0]?.filename;

    if (username) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
      if (existing) return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }

    const updates = [];
    const vals = [];
    if (bio !== undefined) { updates.push('bio=?'); vals.push(bio); }
    if (address !== undefined) { updates.push('address=?'); vals.push(address); }
    if (occupation !== undefined) { updates.push('occupation=?'); vals.push(occupation); }
    if (username) { updates.push('username=?'); vals.push(username); }
    if (avatar) { updates.push('avatar=?'); vals.push(avatar); }
    if (cover) { updates.push('cover_photo=?'); vals.push(cover); }

    if (updates.length) {
      vals.push(req.user.id);
      db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);
    }

    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    const { password, email_verify_token, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// FOLLOW ROUTES
// ============================================================

app.post('/api/follow', auth, (req, res) => {
  try {
    const { target_type, target_id } = req.body;
    const existing = db.prepare('SELECT id FROM follows WHERE follower_id=? AND target_type=? AND target_id=?').get(req.user.id, target_type, target_id);
    if (existing) {
      db.prepare('DELETE FROM follows WHERE follower_id=? AND target_type=? AND target_id=?').run(req.user.id, target_type, target_id);
      return res.json({ success: true, followed: false });
    }
    db.prepare('INSERT INTO follows (follower_id, target_type, target_id) VALUES (?,?,?)').run(req.user.id, target_type, target_id);
    // Create notification
    if (target_type === 'user') {
      db.prepare('INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)').run(target_id, 'follow', 'มีผู้ติดตามใหม่', `${req.user.email} ติดตามคุณ`);
    }
    res.json({ success: true, followed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/follow/check', auth, (req, res) => {
  const { target_type, target_id } = req.query;
  const existing = db.prepare('SELECT id FROM follows WHERE follower_id=? AND target_type=? AND target_id=?').get(req.user.id, target_type, target_id);
  res.json({ following: !!existing });
});

// ============================================================
// POSTS ROUTES
// ============================================================

// Create post
app.post('/api/posts', auth, uploadPost.array('media', 10), (req, res) => {
  try {
    const { content, author_type, author_id } = req.body;
    const media = req.files?.map(f => f.filename) || [];

    // Verify ownership
    if (author_type === 'page') {
      const page = db.prepare('SELECT id FROM pages WHERE id=? AND owner_id=?').get(author_id, req.user.id);
      if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์โพสต์ในเพจนี้' });
    }

    const uuid = uuidv4();
    db.prepare(`INSERT INTO posts (uuid, author_type, author_id, content, media) VALUES (?,?,?,?,?)`)
      .run(uuid, author_type || 'user', author_id || req.user.id, content, JSON.stringify(media));

    const post = db.prepare('SELECT * FROM posts WHERE uuid=?').get(uuid);
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get posts (feed)
app.get('/api/posts', auth, (req, res) => {
  try {
    const { author_type, author_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    let posts;

    if (author_type && author_id) {
      posts = db.prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        (SELECT COUNT(*) FROM shares WHERE post_id=p.id) as share_count
        FROM posts p WHERE p.author_type=? AND p.author_id=? AND p.is_active=1
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(author_type, author_id, parseInt(limit), offset);
    } else {
      posts = db.prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) as comment_count,
        (SELECT COUNT(*) FROM shares WHERE post_id=p.id) as share_count
        FROM posts p WHERE p.is_active=1
        ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(parseInt(limit), offset);
    }

    // Attach author info
    posts = posts.map(post => {
      db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id);
      if (post.author_type === 'user') {
        const author = db.prepare('SELECT id, first_name, last_name, username, avatar FROM users WHERE id=?').get(post.author_id);
        return { ...post, author };
      } else {
        const author = db.prepare('SELECT id, name, username, avatar FROM pages WHERE id=?').get(post.author_id);
        return { ...post, author };
      }
    });

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Like/Unlike post
app.post('/api/posts/:id/like', auth, (req, res) => {
  try {
    const existing = db.prepare("SELECT id FROM likes WHERE user_id=? AND target_type='post' AND target_id=?").get(req.user.id, req.params.id);
    if (existing) {
      db.prepare("DELETE FROM likes WHERE user_id=? AND target_type='post' AND target_id=?").run(req.user.id, req.params.id);
      return res.json({ liked: false });
    }
    db.prepare("INSERT INTO likes (user_id, target_type, target_id) VALUES (?,?,?)").run(req.user.id, 'post', req.params.id);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comment on post
app.post('/api/posts/:id/comments', auth, (req, res) => {
  try {
    const { content, parent_id } = req.body;
    db.prepare('INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?,?,?,?)').run(req.params.id, req.user.id, parent_id || null, content);
    const post = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
    if (post) {
      db.prepare('INSERT INTO notifications (user_id, type, title, body, data) VALUES (?,?,?,?,?)').run(post.author_id, 'comment', 'มีความคิดเห็นใหม่', `มีคนแสดงความคิดเห็นในโพสต์ของคุณ`, JSON.stringify({ post_id: post.id }));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get comments
app.get('/api/posts/:id/comments', (req, res) => {
  const comments = db.prepare(`SELECT c.*, u.first_name, u.last_name, u.username, u.avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id=? AND c.is_active=1 ORDER BY c.created_at ASC`).all(req.params.id);
  res.json({ comments });
});

// Share post
app.post('/api/posts/:id/share', auth, (req, res) => {
  try {
    db.prepare('INSERT INTO shares (user_id, post_id) VALUES (?,?)').run(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Donate
app.post('/api/donate', auth, (req, res) => {
  try {
    const { target_type, target_id, amount, message } = req.body;
    db.prepare('INSERT INTO donations (from_user_id, target_type, target_id, amount, message) VALUES (?,?,?,?,?)').run(req.user.id, target_type, target_id, amount, message);
    res.json({ success: true, message: `โดเนทสำเร็จ ${amount} บาท` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PAGE ROUTES
// ============================================================

// Create page
app.post('/api/pages', auth, (req, res) => {
  try {
    const { name, description, category, website, phone, address } = req.body;
    const uuid = uuidv4();
    const username = name.replace(/\s+/g, '_').toLowerCase() + '_' + Math.floor(Math.random() * 9999);
    db.prepare(`INSERT INTO pages (uuid, owner_id, name, username, description, category, website, phone, address) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uuid, req.user.id, name, username, description, category, website, phone, address);
    const page = db.prepare('SELECT * FROM pages WHERE uuid=?').get(uuid);
    res.json({ success: true, page });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get page
app.get('/api/pages/:username', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE username=?').get(req.params.username);
  if (!page) return res.status(404).json({ error: 'ไม่พบเพจ' });
  const followerCount = db.prepare("SELECT COUNT(*) as c FROM follows WHERE target_type='page' AND target_id=?").get(page.id);
  const postCount = db.prepare("SELECT COUNT(*) as c FROM posts WHERE author_type='page' AND author_id=?").get(page.id);
  const owner = db.prepare('SELECT first_name, last_name, username FROM users WHERE id=?').get(page.owner_id);
  res.json({ page, owner, stats: { followers: followerCount.c, posts: postCount.c } });
});

// Update page
app.put('/api/pages/:id', auth, uploadAvatar.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  try {
    const page = db.prepare('SELECT * FROM pages WHERE id=? AND owner_id=?').get(req.params.id, req.user.id);
    if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
    const { name, description, category, username } = req.body;
    const avatar = req.files?.avatar?.[0]?.filename;
    const cover = req.files?.cover?.[0]?.filename;
    const updates = [];
    const vals = [];
    if (name) { updates.push('name=?'); vals.push(name); }
    if (description !== undefined) { updates.push('description=?'); vals.push(description); }
    if (category) { updates.push('category=?'); vals.push(category); }
    if (username) { updates.push('username=?'); vals.push(username); }
    if (avatar) { updates.push('avatar=?'); vals.push(avatar); }
    if (cover) { updates.push('cover_photo=?'); vals.push(cover); }
    if (updates.length) {
      vals.push(req.params.id);
      db.prepare(`UPDATE pages SET ${updates.join(',')} WHERE id=?`).run(...vals);
    }
    res.json({ success: true, page: db.prepare('SELECT * FROM pages WHERE id=?').get(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MARKETPLACE ROUTES
// ============================================================

// Get marketplace listings
app.get('/api/marketplace', (req, res) => {
  const { page = 1, limit = 12, category } = req.query;
  const offset = (page - 1) * limit;
  let items;
  if (category) {
    items = db.prepare(`SELECT m.*, p.name as page_name, p.username as page_username, p.avatar as page_avatar FROM marketplace m JOIN pages p ON m.page_id=p.id WHERE m.is_active=1 AND m.category=? ORDER BY m.created_at DESC LIMIT ? OFFSET ?`).all(category, parseInt(limit), offset);
  } else {
    items = db.prepare(`SELECT m.*, p.name as page_name, p.username as page_username, p.avatar as page_avatar FROM marketplace m JOIN pages p ON m.page_id=p.id WHERE m.is_active=1 ORDER BY m.created_at DESC LIMIT ? OFFSET ?`).all(parseInt(limit), offset);
  }
  res.json({ items });
});

// Create listing (page only)
app.post('/api/marketplace', auth, uploadMarket.array('images', 5), (req, res) => {
  try {
    const { page_id, title, description, price, category, stock, condition } = req.body;
    const page = db.prepare('SELECT id FROM pages WHERE id=? AND owner_id=?').get(page_id, req.user.id);
    if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์ลงประกาศในเพจนี้' });
    const images = req.files?.map(f => f.filename) || [];
    const uuid = uuidv4();
    db.prepare(`INSERT INTO marketplace (uuid, page_id, title, description, price, category, images, stock, condition) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uuid, page_id, title, description, parseFloat(price), category, JSON.stringify(images), parseInt(stock) || 0, condition || 'new');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// LIVESTREAM ROUTES
// ============================================================

// Get live streams
app.get('/api/livestreams', (req, res) => {
  const lives = db.prepare(`SELECT l.*, p.name as page_name, p.username as page_username, p.avatar as page_avatar FROM livestreams l JOIN pages p ON l.page_id=p.id WHERE l.status='live' ORDER BY l.viewer_count DESC`).all();
  res.json({ livestreams: lives });
});

// Create livestream
app.post('/api/livestreams', auth, (req, res) => {
  try {
    const { page_id, title, description } = req.body;
    const page = db.prepare('SELECT id FROM pages WHERE id=? AND owner_id=?').get(page_id, req.user.id);
    if (!page) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
    const uuid = uuidv4();
    const stream_key = uuidv4();
    db.prepare(`INSERT INTO livestreams (uuid, page_id, title, description, stream_key, status, started_at) VALUES (?,?,?,?,?,'live',datetime('now'))`)
      .run(uuid, page_id, title, description, stream_key);
    res.json({ success: true, stream_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End livestream
app.put('/api/livestreams/:id/end', auth, (req, res) => {
  db.prepare(`UPDATE livestreams SET status='ended', ended_at=datetime('now') WHERE id=?`).run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// CHAT ROUTES
// ============================================================

// Get my chats
app.get('/api/chats', auth, (req, res) => {
  const rooms = db.prepare(`SELECT cr.*,
    (SELECT content FROM chat_messages WHERE room_id=cr.id ORDER BY created_at DESC LIMIT 1) as last_message,
    (SELECT created_at FROM chat_messages WHERE room_id=cr.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
    (SELECT COUNT(*) FROM chat_messages WHERE room_id=cr.id AND is_read=0 AND sender_id!=?) as unread_count
    FROM chat_rooms cr JOIN chat_members cm ON cr.id=cm.room_id WHERE cm.user_id=?
    ORDER BY last_message_time DESC`).all(req.user.id, req.user.id);
  res.json({ rooms });
});

// Start or get direct chat
app.post('/api/chats/direct', auth, (req, res) => {
  try {
    const { target_user_id } = req.body;
    // Check if room exists
    const existing = db.prepare(`SELECT cr.* FROM chat_rooms cr
      JOIN chat_members cm1 ON cr.id=cm1.room_id AND cm1.user_id=?
      JOIN chat_members cm2 ON cr.id=cm2.room_id AND cm2.user_id=?
      WHERE cr.room_type='direct'`).get(req.user.id, target_user_id);
    if (existing) return res.json({ room: existing });

    const uuid = uuidv4();
    db.prepare("INSERT INTO chat_rooms (uuid, room_type, created_by) VALUES (?,?,?)").run(uuid, 'direct', req.user.id);
    const room = db.prepare('SELECT * FROM chat_rooms WHERE uuid=?').get(uuid);
    db.prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?,?)').run(room.id, req.user.id);
    db.prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?,?)').run(room.id, target_user_id);
    res.json({ room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages in room
app.get('/api/chats/:room_id/messages', auth, (req, res) => {
  const member = db.prepare('SELECT id FROM chat_members WHERE room_id=? AND user_id=?').get(req.params.room_id, req.user.id);
  if (!member) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงแชทนี้' });
  const messages = db.prepare(`SELECT m.*, u.first_name, u.last_name, u.username, u.avatar FROM chat_messages m JOIN users u ON m.sender_id=u.id WHERE m.room_id=? ORDER BY m.created_at ASC`).all(req.params.room_id);
  db.prepare('UPDATE chat_messages SET is_read=1 WHERE room_id=? AND sender_id!=?').run(req.params.room_id, req.user.id);
  res.json({ messages });
});

// Send message
app.post('/api/chats/:room_id/messages', auth, (req, res) => {
  try {
    const member = db.prepare('SELECT id FROM chat_members WHERE room_id=? AND user_id=?').get(req.params.room_id, req.user.id);
    if (!member) return res.status(403).json({ error: 'ไม่มีสิทธิ์' });
    const { content } = req.body;
    db.prepare('INSERT INTO chat_messages (room_id, sender_id, content) VALUES (?,?,?)').run(req.params.room_id, req.user.id, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// NOTIFICATIONS ROUTES
// ============================================================

app.get('/api/notifications', auth, (req, res) => {
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json({ notifications: notifs });
});

app.put('/api/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ success: true });
});

// ============================================================
// SETTINGS ROUTES
// ============================================================

app.put('/api/settings', auth, (req, res) => {
  try {
    const { notification_post, notification_comment, notification_follow, notification_message, privacy_profile, privacy_posts, language, theme } = req.body;
    const updates = [];
    const vals = [];
    const fields = { notification_post, notification_comment, notification_follow, notification_message, privacy_profile, privacy_posts, language, theme };
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined) { updates.push(`${k}=?`); vals.push(v); }
    });
    if (updates.length) {
      vals.push(req.user.id);
      db.prepare(`UPDATE user_settings SET ${updates.join(',')} WHERE user_id=?`).run(...vals);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search users/pages
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ users: [], pages: [] });
  const users = db.prepare(`SELECT id, first_name, last_name, username, avatar FROM users WHERE (first_name LIKE ? OR last_name LIKE ? OR username LIKE ?) AND is_active=1 LIMIT 10`).all(`%${q}%`, `%${q}%`, `%${q}%`);
  const pages = db.prepare(`SELECT id, name, username, avatar FROM pages WHERE (name LIKE ? OR username LIKE ?) AND is_active=1 LIMIT 10`).all(`%${q}%`, `%${q}%`);
  res.json({ users, pages });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
