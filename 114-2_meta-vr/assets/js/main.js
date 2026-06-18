/* ============================================================
   主互動腳本：導覽、捲動揭露、YouTube 延遲載入、相簿燈箱
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Nav ---------- */
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const links = document.querySelector('.nav__links');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }, { passive: true });
  if (toggle) toggle.addEventListener('click', () => links.classList.toggle('open'));
  links && links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') links.classList.remove('open');
  });

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* ---------- Lite YouTube facade ---------- */
  document.querySelectorAll('.lite-yt').forEach((el) => {
    const id = el.dataset.id;
    // 自訂縮圖（data-poster）優先，否則用 YouTube 預設縮圖
    el.style.backgroundImage = `url(${el.dataset.poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`})`;
    el.addEventListener('click', () => {
      // data-href：不內嵌，直接在 YouTube 新分頁開啟（用於 VR180／360，使用官方播放器拖曳環視）
      if (el.dataset.href) { window.open(el.dataset.href, '_blank', 'noopener'); return; }
      if (el.dataset.loaded) return;
      el.dataset.loaded = '1';
      const ifr = document.createElement('iframe');
      ifr.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      // accelerometer / gyroscope / xr-spatial-tracking：讓 VR180 / 360 影片可拖曳環視與支援動態感應
      ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; xr-spatial-tracking';
      ifr.allowFullscreen = true;
      ifr.title = el.getAttribute('aria-label') || 'YouTube 影片';
      el.appendChild(ifr);
    }, { once: false });
    // 鍵盤可及性：對外開啟型（data-href）支援 Enter / 空白鍵
    if (el.dataset.href) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    }
  });

  /* ---------- Galleries ---------- */
  const path = (date, sub, file) => `photos/${date}/${sub}/${file}`;

  let LB_SET = []; // 目前燈箱資料集

  /* 各教學階段的「精選」相簿——人工挑選、避免重複畫面。
     檔名前 4 碼即拍攝日期；少量照片可搭配 gallery.trio 做三欄呈現。 */
  const CURATED = {
    led: ['0306_001','0306_005','0306_006','0313_002','0313_008','0313_011','0313_015','0320_004','0320_006','0327_001','0327_009','0327_011'],
    works: ['0410_001','0410_020','0410_025','0410_030','0410_036','0410_045','0410_050','0410_064','0410_076','0410_080','0410_022','0410_011'],
    game: ['0417_002','0417_004','0417_005','0417_014','0417_016','0417_019','0417_021','0417_022','0417_013','0417_025','0417_031','0417_032'],
    vrteach: ['0508_003','0508_019','0508_001','0508_022','0508_026','0605_001','0605_004','0605_005','0605_002','0605_009','0605_011','0605_015'],
    vrshoot: ['0522_004','0522_008','0522_009','0522_006','0522_015','0522_012','0529_002','0529_009','0529_010','0529_003','0529_014','0529_016'],
    vrfinal: ['0612_001','0612_002','0612_003']
  };

  document.querySelectorAll('[data-set]').forEach((el) => {
    const list = CURATED[el.dataset.set] || [];
    const frag = document.createDocumentFragment();
    list.forEach((name) => {
      const d = name.slice(0, 4);
      const file = name + '.jpg';
      const div = document.createElement('div');
      div.className = 'g-item';
      const img = document.createElement('img');
      img.loading = 'lazy'; img.src = path(d, 'thumb', file); img.alt = '課堂現場照片';
      div.appendChild(img);
      div.dataset.full = path(d, 'full', file);
      div.addEventListener('click', () => openLightboxFrom(div));
      frag.appendChild(div);
    });
    el.appendChild(frag);
  });

  /* ---------- Lightbox ---------- */
  const lb = document.getElementById('lb');
  const lbImg = lb.querySelector('img');
  const lbCount = lb.querySelector('.lb__count');
  let lbIndex = 0;

  function collectSet(fromEl) {
    // 該元素所屬 gallery 內所有 g-item
    const gal = fromEl.closest('.gallery');
    const items = Array.from(gal.querySelectorAll('.g-item'));
    LB_SET = items.map((it) => it.dataset.full);
    return items.indexOf(fromEl);
  }
  function show(i) {
    if (!LB_SET.length) return;
    lbIndex = (i + LB_SET.length) % LB_SET.length;
    lbImg.src = LB_SET[lbIndex];
    lbCount.textContent = `${lbIndex + 1} / ${LB_SET.length}`;
  }
  function openLightboxFrom(el) {
    const i = collectSet(el);
    lb.classList.add('on');
    document.body.style.overflow = 'hidden';
    show(i);
  }
  function closeLb() { lb.classList.remove('on'); document.body.style.overflow = ''; }

  lb.querySelector('.lb__close').addEventListener('click', closeLb);
  lb.querySelector('.lb__nav.prev').addEventListener('click', () => show(lbIndex - 1));
  lb.querySelector('.lb__nav.next').addEventListener('click', () => show(lbIndex + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('on')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') show(lbIndex - 1);
    if (e.key === 'ArrowRight') show(lbIndex + 1);
  });

  /* ---------- year ---------- */
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
