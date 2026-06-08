const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'social.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      phone_code TEXT DEFAULT '+66',
      phone TEXT,
      birthdate TEXT,
      occupation TEXT,
      address TEXT,
      nationality TEXT,
      language TEXT DEFAULT 'th',
      username TEXT UNIQUE,
      avatar TEXT,
      cover_photo TEXT,
      bio TEXT,
      email_verified INTEGER DEFAULT 0,
      email_verify_token TEXT,
      password_reset_token TEXT,
      kyc_status TEXT DEFAULT 'none',
      kyc_subscription TEXT DEFAULT 'none',
      kyc_subscription_expires TEXT,
      crypto_wallet TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Pages table
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      description TEXT,
      category TEXT,
      avatar TEXT,
      cover_photo TEXT,
      website TEXT,
      phone TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    -- Follows table (users following users or pages)
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('user','page')),
      target_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(follower_id, target_type, target_id),
      FOREIGN KEY (follower_id) REFERENCES users(id)
    );

    -- Posts table
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      author_type TEXT NOT NULL CHECK(author_type IN ('user','page')),
      author_id INTEGER NOT NULL,
      content TEXT,
      media TEXT,
      post_type TEXT DEFAULT 'normal',
      views INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Likes table
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('post','comment')),
      target_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, target_type, target_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Comments table
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      parent_id INTEGER,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Shares table
    CREATE TABLE IF NOT EXISTS shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    );

    -- Donations table
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('user','page','post','live')),
      target_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'THB',
      message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (from_user_id) REFERENCES users(id)
    );

    -- Chat rooms table
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      room_type TEXT NOT NULL CHECK(room_type IN ('direct','group')),
      name TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Chat room members
    CREATE TABLE IF NOT EXISTS chat_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Chat messages table
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      media TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    -- Marketplace listings table
    CREATE TABLE IF NOT EXISTS marketplace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      page_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'THB',
      category TEXT,
      images TEXT,
      stock INTEGER DEFAULT 0,
      condition TEXT DEFAULT 'new',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id)
    );

    -- Livestreams table
    CREATE TABLE IF NOT EXISTS livestreams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      page_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail TEXT,
      stream_key TEXT UNIQUE,
      status TEXT DEFAULT 'offline' CHECK(status IN ('offline','live','ended')),
      viewer_count INTEGER DEFAULT 0,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id)
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- KYC documents table
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      face_image TEXT,
      id_card_front TEXT,
      id_card_back TEXT,
      passport_visa TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      reviewed_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- KYC subscriptions table
    CREATE TABLE IF NOT EXISTS kyc_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL CHECK(plan IN ('monthly','yearly')),
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'THB',
      status TEXT DEFAULT 'active',
      started_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      notification_post INTEGER DEFAULT 1,
      notification_comment INTEGER DEFAULT 1,
      notification_follow INTEGER DEFAULT 1,
      notification_message INTEGER DEFAULT 1,
      privacy_profile TEXT DEFAULT 'public',
      privacy_posts TEXT DEFAULT 'public',
      language TEXT DEFAULT 'th',
      theme TEXT DEFAULT 'light',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  console.log('Database initialized successfully');
}

initDB();

module.exports = db;
