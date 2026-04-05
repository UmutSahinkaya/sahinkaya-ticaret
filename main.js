/* ============================================================
   Şahinkaya Ticaret — Ana JavaScript Dosyası
   Three.js 3D Hero Sahnesi + GSAP Animasyonları + API Entegrasyonu
   ============================================================ */

'use strict';

// GSAP ScrollTrigger eklentisini kaydet
gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────
// 1. THREE.JS HERO YAPIKLESİ 3D SAHNESİ
// ─────────────────────────────────────────────
function initHeroScene() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const ACCENT_HEX = 0xf97316;
  const DIM_HEX    = 0x2a2a2a;

  // Renderer ayarları
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // Şeffaf arka plan — CSS rengi görünür

  // Sahne ve kamera
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.5, 12);
  camera.lookAt(0, 0, 0);

  // ── Bina yapısı: kat kat wireframe kutular ──
  const buildingGroup = new THREE.Group();

  const floors = [
    { w: 5.0, h: 0.9, d: 3.5, y: -2.2 },
    { w: 4.4, h: 0.9, d: 3.1, y: -1.2 },
    { w: 3.8, h: 0.9, d: 2.7, y: -0.2 },
    { w: 3.2, h: 0.9, d: 2.3, y:  0.8 },
    { w: 2.6, h: 0.9, d: 1.9, y:  1.8 },
    { w: 1.8, h: 1.4, d: 1.4, y:  3.0 }, // Çatı bloğu
  ];

  floors.forEach((floor, i) => {
    const geo   = new THREE.BoxGeometry(floor.w, floor.h, floor.d);
    const edges = new THREE.EdgesGeometry(geo);
    const mat   = new THREE.LineBasicMaterial({
      color:       i === 0 ? ACCENT_HEX : DIM_HEX,
      transparent: true,
      opacity:     i === 0 ? 0.85 : Math.max(0.15, 0.55 - i * 0.06),
    });
    const mesh = new THREE.LineSegments(edges, mat);
    mesh.position.y = floor.y;
    buildingGroup.add(mesh);
  });

  // ── Büyük dış çerçeve (dönen kübik tel kafes) ──
  const outerGeo   = new THREE.BoxGeometry(7, 9, 5.5);
  const outerEdges = new THREE.EdgesGeometry(outerGeo);
  const outerMat   = new THREE.LineBasicMaterial({ color: ACCENT_HEX, transparent: true, opacity: 0.1 });
  const outerMesh  = new THREE.LineSegments(outerEdges, outerMat);
  outerMesh.position.y = 0.4;
  buildingGroup.add(outerMesh);

  // Çevresinde dönen küçük dekoratif küreler (inşaat ışıkları gibi)
  const orbCount  = 6;
  const orbRadius = 5.5;
  for (let i = 0; i < orbCount; i++) {
    const angle  = (i / orbCount) * Math.PI * 2;
    const orbGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const orbMat = new THREE.MeshBasicMaterial({ color: ACCENT_HEX });
    const orb    = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(Math.cos(angle) * orbRadius, (i % 2 === 0 ? 1 : -1), Math.sin(angle) * orbRadius);
    orb.userData.angle  = angle;
    orb.userData.index  = i;
    buildingGroup.add(orb);
  }

  // Bina grubunu sahneye ekle (sağa kaydır, sol taraf içerik için boş kalsın)
  buildingGroup.position.set(4, -0.5, 0);
  scene.add(buildingGroup);

  // ── Zemin ızgarası ──
  const gridHelper = new THREE.GridHelper(30, 30, 0x1a1a1a, 0x141414);
  gridHelper.position.y = -3.2;
  scene.add(gridHelper);

  // ── Partikül bulutu ──
  const PARTICLE_COUNT = 900;
  const positions      = new Float32Array(PARTICLE_COUNT * 3);
  const pColors        = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 28;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;

    // %35 turuncu, geri kalan koyu gri
    const isAccent       = Math.random() < 0.35;
    pColors[i * 3]       = isAccent ? 0.976 : 0.18;
    pColors[i * 3 + 1]   = isAccent ? 0.451 : 0.18;
    pColors[i * 3 + 2]   = isAccent ? 0.086 : 0.18;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));

  const particleMat = new THREE.PointsMaterial({
    size:         0.06,
    vertexColors: true,
    transparent:  true,
    opacity:      0.75,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // ── Fare parallax için bağlam ──
  let targetRotX = 0;
  let targetRotY = 0;
  let currentRotX = 0;
  let currentRotY = 0;

  document.addEventListener('mousemove', (e) => {
    targetRotY =  (e.clientX / window.innerWidth  - 0.5) * 0.4;
    targetRotX = -(e.clientY / window.innerHeight - 0.5) * 0.15;
  });

  // ── Pencere yeniden boyutlandırma ──
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Animasyon döngüsü ──
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    // Fare parallax yumuşak geçiş
    currentRotY += (targetRotY - currentRotY) * 0.04;
    currentRotX += (targetRotX - currentRotX) * 0.04;

    // Bina grubu dönsün + fare tepkisi
    buildingGroup.rotation.y = t * 0.12 + currentRotY;
    buildingGroup.rotation.x = currentRotX;

    // Dış çerçeve ters dönsün
    outerMesh.rotation.y = -t * 0.2;

    // Partiküller çok yavaş dönsün
    particles.rotation.y = t * 0.018;
    particles.rotation.x = Math.sin(t * 0.08) * 0.04;

    // Dekoratif küreler yörüngede dönsün
    buildingGroup.children.forEach((child) => {
      if (child.userData.angle !== undefined) {
        const angle = child.userData.angle + t * 0.45;
        const r     = orbRadius;
        child.position.x = Math.cos(angle) * r;
        child.position.z = Math.sin(angle) * r;
        child.position.y = Math.sin(t * 1.2 + child.userData.index) * 0.6;
      }
    });

    renderer.render(scene, camera);
  }

  animate();
}

// ─────────────────────────────────────────────
// 2. NAVBAR — Kaydırmada arka plan efekti
// ─────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

// ─────────────────────────────────────────────
// 3. HAMBURGEr — Mobil menü aç/kapat
// ─────────────────────────────────────────────
function initHamburger() {
  const btn   = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Bir linke tıklanınca menüyü kapat
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

// ─────────────────────────────────────────────
// 4. GSAP SCROLL ANİMASYONLARI
// ─────────────────────────────────────────────
function initScrollAnimations() {
  if (typeof gsap === 'undefined') return;

  // Hizmet kartları
  gsap.from('.card', {
    scrollTrigger: {
      trigger: '#hizmetler',
      start: 'top 75%',
    },
    y: 60,
    opacity: 0,
    duration: 0.7,
    stagger: 0.12,
    ease: 'power3.out',
    onComplete: () => {
      document.querySelectorAll('.card').forEach((c) => c.classList.add('animated'));
    },
  });

  // Ürün kartları
  gsap.from('.product-card', {
    scrollTrigger: {
      trigger: '#urunler',
      start: 'top 75%',
    },
    y: 60,
    opacity: 0,
    duration: 0.7,
    stagger: 0.1,
    ease: 'power3.out',
    onComplete: () => {
      document.querySelectorAll('.product-card').forEach((c) => c.classList.add('animated'));
    },
  });

  // Bölüm başlıkları
  gsap.utils.toArray('.section-header').forEach((header) => {
    gsap.from(header, {
      scrollTrigger: { trigger: header, start: 'top 80%' },
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    });
  });

  // CTA bölümü
  gsap.from('.cta-text', {
    scrollTrigger: { trigger: '#iletisim', start: 'top 75%' },
    x: -50,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
  });

  gsap.from('.cta-form', {
    scrollTrigger: { trigger: '#iletisim', start: 'top 75%' },
    x: 50,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
  });

  // İstatistik kartları
  gsap.from('.stat-card', {
    scrollTrigger: { trigger: '#referanslar', start: 'top 75%' },
    scale: 0.9,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: 'back.out(1.4)',
  });
}

// ─────────────────────────────────────────────
// 5. SAYAÇ ANİMASYONU
// ─────────────────────────────────────────────
function initCounters() {
  const counters = document.querySelectorAll('.counter');
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const el     = entry.target;
        const target = parseInt(el.dataset.target, 10);
        const dur    = 2000; // ms
        const step   = 50;
        const inc    = Math.ceil(target / (dur / step));
        let   current = 0;

        const tick = setInterval(() => {
          current += inc;
          if (current >= target) {
            el.textContent = target.toLocaleString('tr-TR');
            clearInterval(tick);
          } else {
            el.textContent = current.toLocaleString('tr-TR');
          }
        }, step);
      });
    },
    { threshold: 0.3 }
  );

  counters.forEach((c) => observer.observe(c));
}

// ─────────────────────────────────────────────
// 6. FORM — Backend API İle Teklif Gönderme
// ─────────────────────────────────────────────
function initForm() {
  const form = document.getElementById('ctaForm');
  if (!form) return;

  const nameInput    = form.querySelector('#name');
  const phoneInput   = form.querySelector('#phone');
  const projectInput = form.querySelector('#project');

  // Telefon girdisini otomatik formatla
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
      e.target.value = raw;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Tüm error sınıflarını temizle
    form.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));

    let hasError = false;
    if (!nameInput || nameInput.value.trim().length < 2) {
      nameInput && nameInput.classList.add('error');
      hasError = true;
    }
    if (!phoneInput || phoneInput.value.replace(/\D/g, '').length < 10) {
      phoneInput && phoneInput.classList.add('error');
      hasError = true;
    }
    if (!projectInput || !projectInput.value) {
      projectInput && projectInput.classList.add('error');
      hasError = true;
    }
    if (hasError) return;

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Gönderiliyor...';
      submitBtn.disabled    = true;
    }

    try {
      const res  = await fetch('/api/teklif', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:    nameInput.value.trim(),
          phone:   phoneInput.value.trim(),
          project: projectInput.value,
          message: form.querySelector('#message')?.value?.trim() || '',
        }),
      });
      let data;
      try { data = await res.json(); } catch (_) { data = {}; }

      if (res.ok && data.success) {
        if (submitBtn) {
          submitBtn.textContent      = 'Teklifiniz Alındı ✓';
          submitBtn.style.background = '#16a34a';
        }
        form.reset();
      } else {
        throw new Error(data.error || 'Sunucu hatası.');
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.textContent      = 'Teklif Talep Et';
        submitBtn.disabled         = false;
        submitBtn.style.background = '';
      }
      const errNote = document.getElementById('formApiError');
      if (errNote) {
        errNote.textContent = err.message === 'Failed to fetch'
          ? 'Sunucuya bağlanılamıyor. Lütfen telefonla ulaşın: 0 (212) 671 00 00'
          : err.message;
        errNote.style.display = 'block';
        setTimeout(() => (errNote.style.display = 'none'), 6000);
      }
    }
  });
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 7a. ÜRÜNLER — Kategori filtresi + Slider
// ─────────────────────────────────────────────

// Kategori bazlı Unsplash fotoğrafları (resimSinif -> URL)
const RESIM_MAP = {
  cement:     'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80&auto=format&fit=crop',
  iron:       'https://images.unsplash.com/photo-1565793979441-3bb16b878ac1?w=600&q=80&auto=format&fit=crop',
  gazbeton:   'https://images.unsplash.com/photo-1588392382834-a891154bca4d?w=600&q=80&auto=format&fit=crop',
  insulation: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80&auto=format&fit=crop',
};

async function loadProducts() {
  const catTabsEl  = document.getElementById('catTabs');
  const track      = document.getElementById('sliderTrack');
  const dotsEl     = document.getElementById('sliderDots');
  const prevBtn    = document.getElementById('sliderPrev');
  const nextBtn    = document.getElementById('sliderNext');
  if (!track) return;

  // API'den ürünleri çek
  let urunler = [];
  try {
    const res = await fetch('/api/urunler');
    if (res.ok) urunler = await res.json();
  } catch (_) {}
  if (!Array.isArray(urunler) || urunler.length === 0) return;

  let activeCat  = 'hepsi';
  let sliderPage = 0;

  function cpp() {
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640)  return 2;
    return 1;
  }

  function visible() {
    if (activeCat === 'hepsi') return urunler;
    return urunler.filter((u) => u.kategori === activeCat);
  }

  // Kategori tablarını oluştur
  if (catTabsEl) {
    const cats = [...new Set(urunler.map((u) => u.kategori))];
    catTabsEl.innerHTML =
      `<button class="cat-tab is-active" data-cat="hepsi">Tümü (${urunler.length})</button>` +
      cats.map((k) => `<button class="cat-tab" data-cat="${escHtml(k)}">${escHtml(k)}</button>`).join('');

    catTabsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-tab');
      if (!btn) return;
      activeCat = btn.dataset.cat;
      sliderPage = 0;
      catTabsEl.querySelectorAll('.cat-tab').forEach((t) => t.classList.toggle('is-active', t === btn));
      renderSlider();
    });
  }

  function renderSlider() {
    const list   = visible();
    const perPage = cpp();
    const pages   = Math.max(1, Math.ceil(list.length / perPage));
    sliderPage    = Math.min(sliderPage, pages - 1);

    // Kartları render et
    track.innerHTML = list.map((u) => {
      const img = RESIM_MAP[u.resimSinif] || '';
      return `
        <div class="product-card${u.enCokSatan ? ' product-card-featured' : ''}">
          ${u.enCokSatan ? '<div class="featured-tag">En Çok Satan</div>' : ''}
          <div class="product-img ${u.resimSinif || 'cement'}">
            ${img ? `<img src="${img}" alt="${escHtml(u.ad)}" loading="lazy" onerror="this.style.display='none'">` : ''}
          </div>
          <div class="product-info">
            <span class="product-cat">${escHtml(u.kategori)}</span>
            <h3>${escHtml(u.ad)}</h3>
            <span class="product-brand">${escHtml(u.marka)}</span>
            <p>${escHtml(u.aciklama)}</p>
            <span class="product-spec">${escHtml(u.ozellik || '')}</span>
            <a href="#iletisim" class="product-link">Fiyat Öğren →</a>
          </div>
        </div>`;
    }).join('');

    // Slider offset (px tabanlı)
    requestAnimationFrame(() => {
      const first = track.querySelector('.product-card');
      if (first) {
        const gap     = 24;
        const cardW   = first.offsetWidth;
        track.style.transform = `translateX(-${sliderPage * perPage * (cardW + gap)}px)`;
      }
    });

    // Dots
    if (dotsEl) {
      dotsEl.innerHTML = Array.from({ length: pages }, (_, i) =>
        `<button class="slider-dot${i === sliderPage ? ' is-active' : ''}" data-page="${i}" aria-label="Sayfa ${i + 1}"></button>`
      ).join('');
      dotsEl.querySelectorAll('.slider-dot').forEach((b) =>
        b.addEventListener('click', () => { sliderPage = +b.dataset.page; renderSlider(); })
      );
    }

    // Ok butonları
    if (prevBtn) prevBtn.disabled = sliderPage === 0;
    if (nextBtn) nextBtn.disabled = sliderPage >= pages - 1;

    // Giriş animasyonu
    if (window.gsap) {
      gsap.fromTo(
        track.querySelectorAll('.product-card'),
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: 'power2.out' }
      );
    }
  }

  prevBtn?.addEventListener('click', () => { if (sliderPage > 0) { sliderPage--; renderSlider(); } });
  nextBtn?.addEventListener('click', () => {
    const pages = Math.ceil(visible().length / cpp());
    if (sliderPage < pages - 1) { sliderPage++; renderSlider(); }
  });

  // Dokunmatik kaydırma
  let touchX = 0;
  const viewport = document.querySelector('.slider-viewport');
  if (viewport) {
    viewport.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
      const diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) < 50) return;
      const pages = Math.ceil(visible().length / cpp());
      if (diff > 0 && sliderPage < pages - 1) { sliderPage++; renderSlider(); }
      else if (diff < 0 && sliderPage > 0)     { sliderPage--; renderSlider(); }
    }, { passive: true });
  }

  // Ekran boyutu değişince sıfırla
  let rTimer;
  window.addEventListener('resize', () => {
    clearTimeout(rTimer);
    rTimer = setTimeout(() => { sliderPage = 0; renderSlider(); }, 200);
  });

  renderSlider();
}

// HTML injection güvenlik yardımcısı
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// 7. SMOOTH SCROLL — Anchor linkleri
// ─────────────────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      const navbarHeight = document.getElementById('navbar')?.offsetHeight ?? 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// ─────────────────────────────────────────────
// BAŞLATMA
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initHamburger();
  initHeroScene();
  initScrollAnimations();
  initCounters();
  initForm();
  initSmoothScroll();
  loadProducts(); // API varsa ürünleri dinamik yükle
});
