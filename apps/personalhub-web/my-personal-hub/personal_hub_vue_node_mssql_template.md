# Personal Link/File Hub — Project Template (Vue 3 + Node.js + MSSQL)

> Mục tiêu: scaffold đầy đủ để bạn có mã nền (frontend + backend) nối với **Google Drive** làm nơi lưu file, **MSSQL** lưu metadata, và Vue frontend quản lý link/file.

---

## Cấu trúc dự án (gợi ý)

```
personal-hub/
├─ backend/
│  ├─ package.json
│  ├─ .env.example
│  ├─ src/
│  │  ├─ server.js
│  │  ├─ app.js
│  │  ├─ routes/
│  │  │  ├─ auth.routes.js
│  │  │  ├─ links.routes.js
│  │  │  └─ files.routes.js
│  │  ├─ controllers/
│  │  ├─ services/
│  │  │  ├─ mssql.service.js
│  │  │  └─ drive.service.js
│  │  ├─ middlewares/
│  │  └─ models/
│  │     └─ init.sql
│  └─ migrations/
│
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ src/
│  │  ├─ main.js
│  │  ├─ App.vue
│  │  ├─ router/index.js
│  │  ├─ stores/
│  │  ├─ views/
│  │  └─ components/
│  └─ public/
|
└─ README.md
```

---

## Backend — Node.js (Express) (important files included)

### `backend/package.json`

```json
{
  "name": "personal-hub-backend",
  "version": "0.1.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mssql": "^9.1.1",
    "dotenv": "^16.0.3",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "axios": "^1.4.0",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

---

### `.env.example`

```
PORT=4000
JWT_SECRET=your_jwt_secret_here
DB_USER=sa
DB_PASSWORD=your_db_password
DB_SERVER=localhost
DB_DATABASE=PersonalHub
DB_PORT=1433
DRIVE_CLIENT_ID=your_google_client_id
DRIVE_CLIENT_SECRET=your_google_client_secret
DRIVE_REDIRECT_URI=http://localhost:4000/api/auth/drive/callback
DRIVE_REFRESH_TOKEN=optional_refresh_token
BASE_URL=http://localhost:4000
```

---

### `backend/src/server.js`

```js
require('dotenv').config();
const app = require('./app');
const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
```

---

### `backend/src/app.js`

```js
const express = require('express');
const cors = require('cors');
const mssqlService = require('./services/mssql.service');

const authRoutes = require('./routes/auth.routes');
const linksRoutes = require('./routes/links.routes');
const filesRoutes = require('./routes/files.routes');

const app = express();
app.use(cors());
app.use(express.json());

// initialize DB connection pool
mssqlService.init();

app.use('/api/auth', authRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/files', filesRoutes);

app.get('/', (req, res) => res.send('Personal Hub Backend'));

module.exports = app;
```

---

### `backend/src/services/mssql.service.js`

```js
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  port: parseInt(process.env.DB_PORT || '1433')
};

let pool;

module.exports = {
  init: async () => {
    try {
      pool = await sql.connect(config);
      console.log('MSSQL connected');
    } catch (err) {
      console.error('MSSQL connection error', err);
      process.exit(1);
    }
  },
  getPool: () => pool,
  sql
};
```

---

### `backend/src/services/drive.service.js` (Google Drive upload / link creator — skeleton)

```js
// this file contains helper functions to upload to Google Drive, create shareable links.
const { google } = require('googleapis');
const drive = google.drive('v3');

const oauth2Client = new google.auth.OAuth2(
  process.env.DRIVE_CLIENT_ID,
  process.env.DRIVE_CLIENT_SECRET,
  process.env.DRIVE_REDIRECT_URI
);

if (process.env.DRIVE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
}

async function uploadFile(buffer, name, mimeType, folderId) {
  const res = await drive.files.create({
    auth: oauth2Client,
    requestBody: {
      name,
      mimeType,
      parents: folderId ? [folderId] : []
    },
    media: {
      mimeType,
      body: buffer
    }
  });
  return res.data; // includes id
}

async function createPublicPermission(fileId) {
  await drive.permissions.create({
    auth: oauth2Client,
    fileId,
    requestBody: { role: 'reader', type: 'anyone' }
  });
  const result = await drive.files.get({ auth: oauth2Client, fileId, fields: 'webViewLink, webContentLink' });
  return result.data;
}

module.exports = { uploadFile, createPublicPermission };
```

> **Chú ý**: việc upload từ `buffer` trong Node thường cần stream; trên ví dụ trên là skeleton. Bạn cần cài `googleapis` (dev) và làm flow OAuth để lấy `DRIVE_REFRESH_TOKEN`.

---

### `backend/src/routes/links.routes.js` (tích hợp cơ bản)

```js
const express = require('express');
const router = express.Router();
const pool = require('../services/mssql.service').getPool();
const sql = require('../services/mssql.service').sql;

// create short link
router.post('/', async (req, res) => {
  const { shortCode, originalUrl, title, description, visibility, tags, userId } = req.body;
  const poolConn = pool;
  try {
    const result = await poolConn.request()
      .input('ShortCode', sql.NVarChar(50), shortCode)
      .input('OriginalURL', sql.NVarChar(500), originalUrl)
      .input('Title', sql.NVarChar(200), title)
      .input('Description', sql.NVarChar(500), description)
      .input('Visibility', sql.NVarChar(50), visibility || 'public')
      .input('Tags', sql.NVarChar(500), tags || '')
      .input('UserID', sql.Int, userId || null)
      .query(`INSERT INTO Links (ShortCode, OriginalURL, Title, Description, Visibility, Tags, UserID, CreatedAt)
              VALUES (@ShortCode, @OriginalURL, @Title, @Description, @Visibility, @Tags, @UserID, GETDATE())`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// redirect (simplified) — on production, implement with a dedicated route /:shortcode
router.get('/redirect/:shortcode', async (req, res) => {
  const short = req.params.shortcode;
  try {
    const result = await pool.request().input('ShortCode', sql.NVarChar(50), short)
      .query('SELECT * FROM Links WHERE ShortCode = @ShortCode');
    if (result.recordset.length === 0) return res.status(404).send('Not found');
    const row = result.recordset[0];
    // optionally log access
    res.redirect(row.OriginalURL);
  } catch (err) {
    res.status(500).send('error');
  }
});

module.exports = router;
```

---

### `backend/src/models/init.sql` (script tạo bảng cơ bản)

```sql
CREATE DATABASE PersonalHub;
GO
USE PersonalHub;
GO

CREATE TABLE Users (
  UserID INT IDENTITY(1,1) PRIMARY KEY,
  Username NVARCHAR(100) NOT NULL,
  Email NVARCHAR(255) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(255) NOT NULL,
  Role NVARCHAR(50) DEFAULT 'user',
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE Links (
  LinkID INT IDENTITY(1,1) PRIMARY KEY,
  ShortCode NVARCHAR(100) NOT NULL UNIQUE,
  OriginalURL NVARCHAR(1000) NOT NULL,
  Title NVARCHAR(255),
  Description NVARCHAR(1000),
  Tags NVARCHAR(1000),
  Visibility NVARCHAR(50) DEFAULT 'public',
  UserID INT NULL,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE Files (
  FileID INT IDENTITY(1,1) PRIMARY KEY,
  FileName NVARCHAR(255),
  DriveFileID NVARCHAR(255),
  MimeType NVARCHAR(100),
  Size BIGINT,
  Tags NVARCHAR(1000),
  Visibility NVARCHAR(50) DEFAULT 'private',
  UserID INT NULL,
  CreatedAt DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE AccessLogs (
  LogID INT IDENTITY(1,1) PRIMARY KEY,
  LinkID INT NULL,
  FileID INT NULL,
  AccessedAt DATETIME DEFAULT GETDATE(),
  IPAddress NVARCHAR(100),
  UserAgent NVARCHAR(1000)
);
GO
```

---

## Frontend — Vue 3 (Vite) (important files included)

### `frontend/package.json`

```json
{
  "name": "personal-hub-frontend",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.3.4",
    "vue-router": "^4.2.2",
    "pinia": "^2.0.33",
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "vite": "^5.1.0"
  }
}
```

---

### `frontend/src/main.js`

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

---

### `frontend/src/router/index.js` (skeleton)

```js
import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Dashboard from '../views/Dashboard.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/dashboard', component: Dashboard }
];

const router = createRouter({ history: createWebHistory(), routes });
export default router;
```

---

### `frontend/src/views/Dashboard.vue` (example)

```vue
<template>
  <div>
    <h1>Dashboard</h1>
    <!-- form tạo link -->
    <!-- list link -->
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const links = ref([]);
async function load() {
  const res = await axios.get(`${BASE}/links`);
  links.value = res.data;
}

load();
</script>
```

---

### `frontend/.env` example

```
VITE_API_BASE=http://localhost:4000/api
VITE_APP_BASE_URL=http://localhost:5173
```

---

## Flow OAuth Google Drive (tóm tắt)
1. Tạo Google Cloud Project, bật Google Drive API, tạo OAuth 2.0 Client ID (web). Set redirect URI tới `http://localhost:4000/api/auth/drive/callback`.
2. Backend có route `/api/auth/drive/url` để trả URL yêu cầu quyền.
3. Sau khi user authorize, Google redirect về `drive/callback` với code -> backend lấy access_token + refresh_token -> lưu refresh_token vào biến môi trường (hoặc DB)
4. Dùng `drive.service` với `oauth2Client.setCredentials({ refresh_token })` để upload & generate public link.

---

## Các lưu ý triển khai & bảo mật
- Không lưu `DRIVE_REFRESH_TOKEN` trong repo; dùng secrets/env.
- Hạn chế scope OAuth: `https://www.googleapis.com/auth/drive.file` (hoặc `drive` nếu cần full).
- Kiểm soát quyền: private/public, token JWT cho auth.
- Throttling/caching: hạn chế gọi Drive quá thường.

---

## Hướng dẫn nhanh để khởi động (dev)
1. Tạo DB trên MSSQL, chạy file `init.sql`.
2. Thiết lập `.env` cho backend và `.env` cho frontend.
3. Backend: `cd backend && npm i && npm run dev`.
4. Frontend: `cd frontend && npm i && npm run dev`.
5. Mở `http://localhost:5173` (frontend) và `http://localhost:4000` (backend).

---

## Tiếp theo mình có thể làm giúp bạn:
- Tạo repository GitHub scaffold sẵn (nếu bạn đồng ý).
- Viết các API endpoints chi tiết hơn (Auth, Search, Tags, Pagination).
- Viết component Vue chi tiết cho Dashboard (form, list, edit, preview).
- Tạo script tự động migrate DB.

Nếu bạn muốn, mình sẽ bắt đầu bằng cách tạo **repo scaffold** (các file trên đã sẵn sàng) hoặc mình có thể tạo **code chi tiết cho backend** (routes + controllers + service hoàn chỉnh). Chọn 1 trong 2 bước tiếp theo nhé.

