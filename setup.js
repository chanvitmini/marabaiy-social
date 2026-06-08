/**
 * ============================================================
 * SOCIALCONNECT — ไฟล์ติดตั้งฐานข้อมูล
 * ============================================================
 * วิธีใช้: node setup.js
 *
 * สคริปต์นี้จะ:
 *  1. สร้างไฟล์ฐานข้อมูล social.db (SQLite)
 *  2. สร้างตารางทั้งหมด
 *  3. สร้างโฟลเดอร์สำหรับเก็บไฟล์อัปโหลด
 *  4. เพิ่มข้อมูลตัวอย่าง (demo user + page)
 * ============================================================
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'social.db');
const UPLOAD_DIRS = ['uploads/avatars', 'uploads/posts', 'uploads/kyc', 'uploads/marketplace', 'uploads/livestream', 'uploads/covers'];

console.log('🚀 SocialConnect — เริ่มติดตั้ง...\n');

// ── 1. สร้างโฟลเดอร์ uploads ──────────────────────────────
console.log('📁 สร้างโฟลเดอร์ uploads...');
UPLOAD_DIRS.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`   ✓ ${dir}`);
  } else {
    console.log(`   - ${dir} (มีอยู่แล้ว)`);
  }
});

// ── 2. สร้างฐานข้อมูล ─────────────────────────────────────
console.log('\n🗄️  สร้างฐานข้อมูล...');
if (fs.existsSync(DB_PATH)) {
  console.log('   ⚠️  พบไฟล์ social.db อยู่แล้ว — จะ reset ฐานข้อมูลทั้งหมด');
  fs.unlinkSync(DB_PATH);
  console.log('   ✓ ลบไฟล์เก่าแล้ว');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 3. สร้างตาราง ─────────────────────────────────────────
console.log('\n📋 สร้างตาราง...');

db.exec(`
  -- ผู้ใช้
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    phone_code  TEXT DEFAULT '+66',
    phone       TEXT,
    birthdate   TEXT,
    occupation  TEXT,
    address     TEXT,
    nationality TEXT DEFAULT 'ไทย',
    language    TEXT DEFAULT 'th',
    bio         TEXT,
    avatar      TEXT,
    cover_photo TEXT,
    kyc_status  TEXT DEFAULT 'unverified',
    crypto_wallet TEXT,
    email_verified INTEGER DEFAULT 0,
    email_token    TEXT,
    password_token TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- เพจธุรกิจ
  CREATE TABLE IF NOT EXISTS pages (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username    TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT,
    avatar      TEXT,
    cover_photo TEXT,
    website     TEXT,
    phone       TEXT,
    address     TEXT,
    kyc_status  TEXT DEFAULT 'unverified',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- การติดตาม
  CREATE TABLE IF NOT EXISTS follows (
    id          TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK(target_type IN ('user','page')),
    target_id   TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(follower_id, target_type, target_id)
  );

  -- โพสต์
  CREATE TABLE IF NOT EXISTS posts (
    id          TEXT PRIMARY KEY,
    author_type TEXT NOT NULL CHECK(author_type IN ('user','page')),
    author_id   TEXT NOT NULL,
    content     TEXT,
    media       TEXT,
    views       INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- ถูกใจ
  CREATE TABLE IF NOT EXISTS likes (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id  TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, post_id)
  );

  -- ความคิดเห็น
  CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- แชร์
  CREATE TABLE IF NOT EXISTS shares (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- โดเนท
  CREATE TABLE IF NOT EXISTS donations (
    id          TEXT PRIMARY KEY,
    sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id   TEXT NOT NULL,
    amount      REAL NOT NULL,
    message     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- ห้องแชท
  CREATE TABLE IF NOT EXISTS chat_rooms (
    id         TEXT PRIMARY KEY,
    name       TEXT,
    type       TEXT DEFAULT 'direct',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- สมาชิกห้องแชท
  CREATE TABLE IF NOT EXISTS chat_members (
    id      TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, user_id)
  );

  -- ข้อความแชท
  CREATE TABLE IF NOT EXISTS chat_messages (
    id         TEXT PRIMARY KEY,
    room_id    TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    is_read    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- สินค้ามาร์เก็ตเพลส
  CREATE TABLE IF NOT EXISTS marketplace (
    id          TEXT PRIMARY KEY,
    page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    price       REAL NOT NULL,
    images      TEXT,
    category    TEXT,
    condition   TEXT DEFAULT 'new',
    stock       INTEGER DEFAULT 1,
    status      TEXT DEFAULT 'active',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  -- ไลฟ์สด
  CREATE TABLE IF NOT EXISTS livestreams (
    id           TEXT PRIMARY KEY,
    page_id      TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    thumbnail    TEXT,
    stream_key   TEXT UNIQUE,
    status       TEXT DEFAULT 'live',
    viewer_count INTEGER DEFAULT 0,
    started_at   TEXT DEFAULT (datetime('now')),
    ended_at     TEXT
  );

  -- การแจ้งเตือน
  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT,
    link       TEXT,
    is_read    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- เอกสาร KYC
  CREATE TABLE IF NOT EXISTS kyc_documents (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    face_image      TEXT,
    id_card_front   TEXT,
    id_card_back    TEXT,
    passport_visa   TEXT,
    crypto_wallet   TEXT,
    status          TEXT DEFAULT 'pending',
    submitted_at    TEXT DEFAULT (datetime('now')),
    reviewed_at     TEXT
  );

  -- แพ็กเกจ KYC
  CREATE TABLE IF NOT EXISTS kyc_subscriptions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan       TEXT NOT NULL CHECK(plan IN ('monthly','yearly')),
    amount     REAL NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  -- การตั้งค่าผู้ใช้
  CREATE TABLE IF NOT EXISTS user_settings (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_post     INTEGER DEFAULT 1,
    notification_comment  INTEGER DEFAULT 1,
    notification_follow   INTEGER DEFAULT 1,
    notification_message  INTEGER DEFAULT 1,
    privacy_profile       TEXT DEFAULT 'public',
    privacy_posts         TEXT DEFAULT 'public',
    theme                 TEXT DEFAULT 'light',
    updated_at            TEXT DEFAULT (datetime('now'))
  );
`);

console.log('   ✓ สร้างตารางทั้งหมดแล้ว (16 ตาราง)');

// ── 4. ข้อมูลตัวอย่าง ──────────────────────────────────────
console.log('\n🌱 เพิ่มข้อมูลตัวอย่าง...');

const now = new Date().toISOString();

// Demo user 1
const user1Id = uuidv4();
const user1Pass = bcrypt.hashSync('demo1234', 10);
db.prepare(`
  INSERT INTO users (id, username, email, password, first_name, last_name, phone_code, phone, birthdate, occupation, nationality, language, bio, email_verified, kyc_status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'verified', ?)
`).run(user1Id, 'demo_user', 'demo@socialconnect.com', user1Pass, 'Demo', 'User', '+66', '0812345678', '1995-01-15', 'นักพัฒนาซอฟต์แวร์', 'ไทย', 'th', 'บัญชีทดสอบ SocialConnect 🎉', now);

db.prepare(`INSERT INTO user_settings (id, user_id) VALUES (?, ?)`).run(uuidv4(), user1Id);

// Demo user 2
const user2Id = uuidv4();
const user2Pass = bcrypt.hashSync('demo1234', 10);
db.prepare(`
  INSERT INTO users (id, username, email, password, first_name, last_name, phone_code, phone, birthdate, nationality, language, bio, email_verified, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
`).run(user2Id, 'jane_smith', 'jane@example.com', user2Pass, 'Jane', 'Smith', '+1', '5551234567', '1998-06-20', 'อเมริกัน', 'en', 'Hello from SocialConnect! 🌟', now);

db.prepare(`INSERT INTO user_settings (id, user_id) VALUES (?, ?)`).run(uuidv4(), user2Id);

// Demo page
const pageId = uuidv4();
db.prepare(`
  INSERT INTO pages (id, owner_id, username, name, description, category, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(pageId, user1Id, 'demo_shop', 'Demo Shop 🛍️', 'ร้านค้าตัวอย่างสำหรับทดสอบระบบมาร์เก็ตเพลสและไลฟ์สด', 'ธุรกิจ', now);

// Follow
db.prepare(`INSERT INTO follows (id, follower_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), user2Id, 'user', user1Id, now);
db.prepare(`INSERT INTO follows (id, follower_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), user2Id, 'page', pageId, now);

// Posts
const post1Id = uuidv4();
db.prepare(`INSERT INTO posts (id, author_type, author_id, content, views, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(post1Id, 'user', user1Id, 'สวัสดีทุกคน! 👋 ยินดีต้อนรับสู่ SocialConnect แพลตฟอร์มโซเชียลมีเดียแห่งใหม่ มาเชื่อมต่อกันได้เลย!', 42, now);

const post2Id = uuidv4();
db.prepare(`INSERT INTO posts (id, author_type, author_id, content, views, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(post2Id, 'page', pageId, '🎉 Demo Shop เปิดแล้ว! เรามีสินค้าหลากหลายให้เลือก ติดตามเพจเพื่อรับข่าวสารและโปรโมชั่นพิเศษ', 18, now);

// Likes
db.prepare(`INSERT INTO likes (id, user_id, post_id, created_at) VALUES (?, ?, ?, ?)`).run(uuidv4(), user2Id, post1Id, now);

// Comments
db.prepare(`INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), post1Id, user2Id, 'ยินดีต้อนรับด้วยนะ! แพลตฟอร์มดูดีมากเลย 🔥', now);

// Marketplace items
db.prepare(`INSERT INTO marketplace (id, page_id, title, description, price, category, condition, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), pageId, 'iPhone 15 Pro Max 256GB', 'เครื่องใหม่ยังไม่แกะกล่อง ประกันศูนย์ไทย', 49900, 'อิเล็กทรอนิกส์', 'new', 5, now);

db.prepare(`INSERT INTO marketplace (id, page_id, title, description, price, category, condition, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), pageId, 'กระเป๋า Leather Tote สีน้ำตาล', 'หนังแท้ 100% งานคุณภาพ มีหลายสีให้เลือก', 1290, 'แฟชั่น', 'new', 20, now);

db.prepare(`INSERT INTO marketplace (id, page_id, title, description, price, category, condition, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), pageId, 'MacBook Air M2 มือสอง', 'ใช้มา 6 เดือน สภาพ 95% แบตเตอรีดีมาก', 34000, 'อิเล็กทรอนิกส์', 'used', 1, now);

// Notifications
db.prepare(`INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), user1Id, 'follow', 'มีคนใหม่ติดตามคุณ', 'Jane Smith เริ่มติดตามคุณแล้ว', now);
db.prepare(`INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), user1Id, 'like', 'มีคนถูกใจโพสต์ของคุณ', 'Jane Smith ถูกใจโพสต์ของคุณ', now);
db.prepare(`INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), user1Id, 'comment', 'มีคนคอมเม้นท์โพสต์ของคุณ', 'Jane Smith: ยินดีต้อนรับด้วยนะ!', now);

db.close();

console.log('   ✓ เพิ่มข้อมูลตัวอย่างแล้ว');

// ── สรุป ───────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════╗
║  ✅ ติดตั้งเสร็จสมบูรณ์!                          ║
╠══════════════════════════════════════════════════╣
║  📧 บัญชีทดสอบ:                                  ║
║     อีเมล   : demo@socialconnect.com             ║
║     รหัสผ่าน: demo1234                           ║
║                                                   ║
║  🚀 เริ่มใช้งาน:                                  ║
║     npm start                                     ║
║     เปิด: http://localhost:3000                   ║
╚══════════════════════════════════════════════════╝
`);
