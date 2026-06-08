# SocialConnect — Social Media Platform

## ขั้นตอนติดตั้ง (3 คำสั่ง)

```bash
# 1. ติดตั้ง packages
npm install

# 2. ติดตั้งฐานข้อมูล (สร้างตาราง + ข้อมูลตัวอย่าง)
npm run setup

# 3. เริ่มเซิร์ฟเวอร์
npm start
```

เปิด browser: **http://localhost:3000**

### บัญชีทดสอบ
| อีเมล | รหัสผ่าน |
|-------|----------|
| demo@socialconnect.com | demo1234 |

---

## โครงสร้างไฟล์

```
project/
├── index.html       ← SPA หน้าหลัก
├── style.css        ← CSS ทั้งหมด
├── app.js           ← Frontend JavaScript
├── server.js        ← Express API server
├── setup.js         ← ไฟล์ติดตั้งฐานข้อมูล ★
├── package.json
├── .env             ← ค่า config
├── social.db        ← SQLite (สร้างโดย setup.js)
└── uploads/         ← ไฟล์ที่อัปโหลด
    ├── avatars/
    ├── posts/
    ├── covers/
    ├── marketplace/
    ├── livestream/
    └── kyc/
```

---

## ฟีเจอร์ทั้งหมด

### 🔐 ระบบบัญชี
- สมัครสมาชิก: ชื่อ, นามสกุล, อีเมล, เบอร์โทร (country code), วันเกิด, อาชีพ, ที่อยู่, สัญชาติ, ภาษา
- ยืนยันอีเมล (verify link)
- ตั้งรหัสผ่าน (set-password link)
- เข้าสู่ระบบ (JWT 7 วัน)

### 🛡️ e-KYC
- แพ็กเกจ ฿330/เดือน หรือ ฿2,000/ปี
- สแกนใบหน้า (face scan)
- บัตรประชาชนด้านหน้า/หลัง
- Visa/Passport (ชาวต่างชาติ)
- ผูก Crypto Wallet
- เครื่องหมาย ✓ verified badge

### 👤 Profile (บัญชีส่วนตัว)
- Custom URL, แชร์โปรไฟล์
- ติดตาม/ยกเลิกติดตาม
- โพสต์ (รูป/วิดีโอ) + ถูกใจ, คอมเม้นท์, แชร์, วิว, โดเนท
- แชทกับผู้ใช้
- **ดู** มาร์เก็ตเพลส (ซื้อได้ ลงขายไม่ได้)
- **ดู** ไลฟ์สด (ดูได้ ไลฟ์เองไม่ได้)

### 🏪 Page (บัญชีธุรกิจ)
- ทุกอย่างเหมือน Profile +
- **ลงสินค้า** ในมาร์เก็ตเพลส ✓
- **เริ่มไลฟ์สด** ✓

### 💬 Chat
- แชทส่วนตัว (DM)
- ประวัติข้อความ

### 🛍️ Marketplace
- แสดงสินค้าจากทุกเพจ
- กรองตามหมวดหมู่
- รูปสินค้า, ราคา, สภาพ (ใหม่/มือสอง)

### 📺 Livestream
- แสดงไลฟ์ที่กำลังออกอากาศ
- Stream Key สำหรับเชื่อมต่อ OBS

### 🔔 Notifications
- แจ้งเตือน follow, like, comment, donate, KYC

### ⚙️ Settings
- แก้ไขโปรไฟล์ + เปลี่ยนรูป/ภาพปก
- ตั้งค่าการแจ้งเตือน
- ความเป็นส่วนตัว

---

## ความต้องการ
- **Node.js v18+** — https://nodejs.org
