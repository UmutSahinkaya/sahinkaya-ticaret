/* ============================================================
   Şahinkaya Ticaret — Express Sunucusu
   Başlatma: node server.js  (veya npm run dev geliştirme için)
   ============================================================ */

'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// ─── API Route'ları (statik dosyalardan ÖNCE olmalı) ───
app.use('/api', require('./routes/api'));

// ─── Admin paneli ───
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── Statik dosyalar (EN SONDA) ───
app.use(express.static(path.join(__dirname)));

// ─── 404 Yakalayıcı ───
app.use((_req, res) => {
  res.status(404).json({ error: 'Sayfa bulunamadı.' });
});

// ─── Sunucuyu Başlat ───
app.listen(PORT, () => {
  console.log(`\n  ✅  Şahinkaya Ticaret sunucusu çalışıyor`);
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  🔧  Admin        http://localhost:${PORT}/admin\n`);
});
