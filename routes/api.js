/* ============================================================
   API Route'ları — /api/*
   GET   /api/urunler         → Ürün listesi (JSON dosyasından)
   POST  /api/teklif          → Teklif formu → Supabase'e kaydet
   GET   /api/admin/teklifler → Admin: gelen teklifler (token gerekli)
   PATCH /api/admin/teklifler/:id → Durum güncelle
   ============================================================ */

'use strict';

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Ürünler statik JSON'dan okunur (sık değişmez)
const URUNLER_PATH = path.join(__dirname, '../data/urunler.json');

// Supabase client — env değişkenleri yoksa null döner, uygulama çökmez
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Yardımcı: JSON dosyasını güvenli oku ───
function readJSON(filePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/urunler
// ──────────────────────────────────────────────────────────────
router.get('/urunler', (_req, res) => {
  const urunler = readJSON(URUNLER_PATH, []);
  res.json(urunler);
});

// ──────────────────────────────────────────────────────────────
// GET /api/kategoriler
// ──────────────────────────────────────────────────────────────
router.get('/kategoriler', (_req, res) => {
  const urunler = readJSON(URUNLER_PATH, []);
  const kategoriler = [...new Set(urunler.map((u) => u.kategori))];
  res.json(kategoriler);
});

// ──────────────────────────────────────────────────────────────
// POST /api/teklif
// Body: { name, phone, project, message }
// ──────────────────────────────────────────────────────────────
router.post('/teklif', async (req, res) => {
  const { name, phone, project, message } = req.body;

  // Temel giriş doğrulaması (güvenlik sınırı)
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Geçerli bir ad soyad giriniz.' });
  }
  if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Geçerli bir telefon numarası giriniz.' });
  }
  if (!project || typeof project !== 'string') {
    return res.status(400).json({ error: 'Proje türü seçiniz.' });
  }

  const teklif = {
    ad:        name.trim(),
    telefon:   phone.trim(),
    projetipi: project.trim(),
    mesaj:     typeof message === 'string' ? message.trim().slice(0, 2000) : '',
    durum:     'yeni',
  };

  // Supabase'e kaydet
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Veritabanı bağlantısı yapılandırılmamış. Lütfen telefonla ulaşın.' });
  }

  const { error: dbError } = await supabase.from('teklifler').insert([teklif]);
  if (dbError) {
    return res.status(500).json({ error: 'Teklif kaydedilemedi. Lütfen telefonla ulaşın.' });
  }

  // E-posta bildirimi (MAIL_USER tanımlıysa)
  if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host:   process.env.MAIL_HOST || 'smtp.gmail.com',
        port:   parseInt(process.env.MAIL_PORT || '587', 10),
        secure: false,
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });

      await transporter.sendMail({
        from:    `"Şahinkaya Ticaret Web" <${process.env.MAIL_USER}>`,
        to:      process.env.MAIL_TO || process.env.MAIL_USER,
        subject: `🔔 Yeni Teklif Talebi — ${teklif.ad}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px">
            <h2 style="color:#f97316;margin-top:0">Yeni Teklif Talebi</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#555;width:140px"><b>Ad Soyad</b></td><td>${teklif.ad}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Telefon</b></td><td>${teklif.telefon}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Proje Türü</b></td><td>${teklif.projetipi}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Mesaj</b></td><td>${teklif.mesaj || '—'}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
            <p style="color:#999;font-size:12px">Şahinkaya Ticaret otomatik bildirim sistemi</p>
          </div>
        `,
      });
    } catch (_emailErr) {
      // E-posta başarısız olsa bile teklif kaydedildi — 200 döndür
    }
  }

  res.json({ success: true, message: 'Teklifiniz alındı. En kısa sürede sizi arayacağız.' });
});

// ──────────────────────────────────────────────────────────────
// GET /api/admin/teklifler
// Header: x-admin-token: <ADMIN_TOKEN>
// ──────────────────────────────────────────────────────────────
router.get('/admin/teklifler', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Yetkisiz erişim.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Veritabanı yapılandırılmamış.' });
  }

  const { data, error } = await supabase
    .from('teklifler')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Teklifler alınamadı.' });
  res.json(data);
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/admin/teklifler/:id — Durum güncelle
// ──────────────────────────────────────────────────────────────
router.patch('/admin/teklifler/:id', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Yetkisiz erişim.' });
  }

  const { durum } = req.body;
  const izinliDurumlar = ['yeni', 'aranıyor', 'tamamlandı', 'iptal'];
  if (!izinliDurumlar.includes(durum)) {
    return res.status(400).json({ error: 'Geçersiz durum değeri.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Veritabanı yapılandırılmamış.' });
  }

  const { data, error } = await supabase
    .from('teklifler')
    .update({ durum })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Durum güncellenemedi.' });
  res.json({ success: true, teklif: data });
});

module.exports = router;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// GET /api/urunler
// Ürün kategorilerini ve ürünleri döndür
// ──────────────────────────────────────────────────────────────
router.get('/urunler', (_req, res) => {
  const urunler = readJSON(URUNLER_PATH, []);
  res.json(urunler);
});

// ──────────────────────────────────────────────────────────────
// GET /api/kategoriler  (opsiyonel sadeleştirme)
// ──────────────────────────────────────────────────────────────
router.get('/kategoriler', (_req, res) => {
  const urunler = readJSON(URUNLER_PATH, []);
  const kategoriler = [...new Set(urunler.map((u) => u.kategori))];
  res.json(kategoriler);
});

// ──────────────────────────────────────────────────────────────
// POST /api/teklif
// Body: { name, phone, project, message }
// ──────────────────────────────────────────────────────────────
router.post('/teklif', async (req, res) => {
  const { name, phone, project, message } = req.body;

  // Temel giriş doğrulaması (güvenlik sınırı)
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Geçerli bir ad soyad giriniz.' });
  }
  if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Geçerli bir telefon numarası giriniz.' });
  }
  if (!project || typeof project !== 'string') {
    return res.status(400).json({ error: 'Proje türü seçiniz.' });
  }

  // Teklif kaydını oluştur
  const teklif = {
    id:        Date.now(),
    tarih:     new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    ad:        name.trim(),
    telefon:   phone.trim(),
    projetipi: project.trim(),
    mesaj:     typeof message === 'string' ? message.trim().slice(0, 2000) : '',
    durum:     'yeni',
  };

  // JSON dosyasına kaydet
  try {
    const teklifler = readJSON(TEKLIFLER_PATH, []);
    teklifler.push(teklif);
    writeJSON(TEKLIFLER_PATH, teklifler);
  } catch (_err) {
    return res.status(500).json({ error: 'Teklif kaydedilemedi. Lütfen telefon ile ulaşın.' });
  }

  // E-posta gönder (MAIL_USER tanımlıysa)
  if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host:   process.env.MAIL_HOST || 'smtp.gmail.com',
        port:   parseInt(process.env.MAIL_PORT || '587', 10),
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      await transporter.sendMail({
        from:    `"Şahinkaya Ticaret Web" <${process.env.MAIL_USER}>`,
        to:      process.env.MAIL_TO || process.env.MAIL_USER,
        subject: `🔔 Yeni Teklif Talebi — ${teklif.ad}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:8px">
            <h2 style="color:#f97316;margin-top:0">Yeni Teklif Talebi</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#555;width:140px"><b>Ad Soyad</b></td><td>${teklif.ad}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Telefon</b></td><td>${teklif.telefon}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Proje Türü</b></td><td>${teklif.projetipi}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Mesaj</b></td><td>${teklif.mesaj || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#555"><b>Tarih</b></td><td>${teklif.tarih}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
            <p style="color:#999;font-size:12px">Şahinkaya Ticaret otomatik bildirim sistemi</p>
          </div>
        `,
      });
    } catch (_emailErr) {
      // E-posta başarısız olsa bile teklif kaydedildi — 200 döndür
    }
  }

  res.json({ success: true, message: 'Teklifiniz alındı. En kısa sürede sizi arayacağız.' });
});

// ──────────────────────────────────────────────────────────────
// GET /api/admin/teklifler
// Header: x-admin-token: <ADMIN_TOKEN>
// ──────────────────────────────────────────────────────────────
router.get('/admin/teklifler', (req, res) => {
  const token = req.headers['x-admin-token'];

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Yetkisiz erişim.' });
  }

  // Sıralama: yeniden eskiye
  const teklifler = readJSON(TEKLIFLER_PATH, []).reverse();
  res.json(teklifler);
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/admin/teklifler/:id — Durum güncelle (arandı, tamamlandı vb.)
// ──────────────────────────────────────────────────────────────
router.patch('/admin/teklifler/:id', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Yetkisiz erişim.' });
  }

  const { durum } = req.body;
  const izinliDurumlar = ['yeni', 'aranıyor', 'tamamlandı', 'iptal'];
  if (!izinliDurumlar.includes(durum)) {
    return res.status(400).json({ error: 'Geçersiz durum değeri.' });
  }

  const id       = parseInt(req.params.id, 10);
  const teklifler = readJSON(TEKLIFLER_PATH, []);
  const idx       = teklifler.findIndex((t) => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Teklif bulunamadı.' });
  }

  teklifler[idx].durum = durum;
  writeJSON(TEKLIFLER_PATH, teklifler);
  res.json({ success: true, teklif: teklifler[idx] });
});

module.exports = router;
