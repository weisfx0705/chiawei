(() => {
const BOOT = window.FILM_BOOT;
BOOT.update(82, '正在準備地圖', '正在建立繪圖環境與角色。');
const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const F = window.FILM, COH = window.FILM_COHORTS;
const ROLE = {}; F.ROLES.forEach(r => ROLE[r.id] = r);
const ISL = {}; F.ISLANDS.forEach(i => ISL[i.id] = i);
const Y = F.YEARS;
const SLOT_NAME = { head: '頭上', eyes: '眼睛', ears: '耳朵', neck: '胸前', handR: '右手', handL: '左手', back: '背上', belt: '腰間', body: '身上', feet: '腳上', wrist: '手腕', prop: '身旁', pet: '隨身夥伴' };
const CAT_TAG = { gen: '通識核心', col: '院必修', cole: '院選修', req: '系必修', ele: '系選修' };
const CREDIT = `<p class="credit">開發人員：<a href="${F.meta.deptUrl}" target="_blank" rel="noopener">義守大學電影與電視學系</a> <a href="${F.meta.developer.url}" target="_blank" rel="noopener">${F.meta.developer.name}</a></p>`;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const ytag = y => `<span class="ytag" style="background:${Y[y].tile}">${Y[y].em} ${Y[y].name}</span>`;
const gearOf = id => F.GEAR[id] || { n: '徽章', e: '⭐', slot: null, m: null, tier: 0, role: null };

/* ───────────── 狀態 ───────────── */
const KEY = 'film-island-v2';
const S = { cohort: null, look: 'auto', name: '', music: true, sfx: true, helpSeen: false, year: 0, sel: null, route: null, preview: null, P: {} };
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d) return;
    Object.assign(S, { cohort: d.cohort || null, look: d.look || 'auto', name: d.name || '', music: d.music !== false, sfx: d.sfx !== false, helpSeen: !!d.helpSeen });
    Object.keys(d.P || {}).forEach(k => { const p = d.P[k]; S.P[k] = { done: new Set(p.done || []), boya: p.boya | 0, cross: p.cross | 0, checks: new Set(p.checks || []), work: p.work || '' }; });
  } catch (e) {}
}
function save() {
  try {
    const P = {}; Object.keys(S.P).forEach(k => { const p = S.P[k]; P[k] = { done: [...p.done], boya: p.boya, cross: p.cross, checks: [...p.checks], work: p.work || '' }; });
    localStorage.setItem(KEY, JSON.stringify({ cohort: S.cohort, look: S.look, name: S.name, music: S.music, sfx: S.sfx, helpSeen: S.helpSeen, P }));
  } catch (e) {}
}
// 播放示範時用一份暫時的修課紀錄（課程、博雅、跨域），不會動到學生自己的紀錄
let DEMO = null;
const realPR = () => S.P[S.cohort] || (S.P[S.cohort] = { done: new Set(), boya: 0, cross: 0, checks: new Set(), work: '' });
const PR = () => DEMO || realPR();
const DONE = () => PR().done;

// 目前學年度的課程與職務路線
let CO = null, BY = {}, TRACK = {};
function useCohort(y) {
  CO = COH[y]; BY = {};
  CO.courses.forEach(c => BY[c.id] = c);
  TRACK = {};
  F.ROLES.forEach(r => {
    const t = CO.tracks[r.id], codes = new Set(), rowOf = {};
    t.years.forEach(row => row.codes.forEach(id => { codes.add(id); if (!rowOf[id]) rowOf[id] = row.y; }));
    const total = [...codes].reduce((a, id) => a + (BY[id] ? BY[id].cr : 0), 0);
    TRACK[r.id] = { ...t, codes, rowOf, total, ...buildRoute(t) };
  });
}
// 職務路線＝每個人都要修的必修（照官方年級、學期）＋這個職務推薦的選修（照養成研究的年級）
const isReq = c => c.cat === 'gen' || c.cat === 'col' || c.cat === 'req';
// 核心必修：主島／入學港／學院島上、對應某個職務的必修課（依裝備所屬職務）
const coreReq = role => CO.courses.filter(c => isReq(c) && gearOf(c.id).role === role);
const TERM_RANK = { '上': 0, '下': 1, '上下': 1.5, '-': 2 };
const ISL_RANK = { gen: 0, col: 1, req: 2 };
function buildRoute(t) {
  const route = [], routeYear = {};
  for (let y = 1; y <= 4; y++) {
    const reqs = CO.courses.filter(c => isReq(c) && c.y === y)
      .sort((a, b) => (TERM_RANK[a.t] - TERM_RANK[b.t]) || (ISL_RANK[a.cat] - ISL_RANK[b.cat]));
    const add = (c, req, phase) => { route.push({ id: c.id, y, req, phase }); routeYear[c.id] = y; };
    reqs.filter(c => !c.gate).forEach(c => add(c, true, c.t === '上' ? 'up' : 'down'));
    const row = t.years.find(r => r.y === y);
    (row ? row.codes : []).forEach(id => { if (!routeYear[id] && !isReq(BY[id])) add(BY[id], false, 'ele'); });
    reqs.filter(c => c.gate).forEach(c => add(c, true, 'gate')); // 英語、資訊／跨域能力放在最後
  }
  return { route, routeYear, routeCodes: new Set(Object.keys(routeYear)) };
}
// 四年 128 學分怎麼湊：必修＋職務選修之外，博雅照年級分配，剩下的彈性空間用跨域（至多 20）或多修系選修補滿
function creditPlan(rid) {
  const t = TRACK[rid], need = k => CO.credits.find(x => x.k === k).need;
  const reqCr = CO.courses.filter(isReq).reduce((a, c) => a + c.cr, 0);
  const eleRoute = t.route.filter(x => !x.req).reduce((a, x) => a + BY[x.id].cr, 0);
  const boyaNeed = need('boya'), eleMin = need('ele'), crossMax = need('cross');
  const boya = [0, 2, 4, 4, Math.max(0, boyaNeed - 10)];
  const room = Math.max(0, 128 - reqCr - boyaNeed - Math.max(eleRoute, eleMin));
  const crossTotal = Math.min(crossMax, room);
  const cross = [0, 0, Math.ceil(crossTotal * .3), Math.ceil(crossTotal * .4), 0]; cross[4] = crossTotal - cross[2] - cross[3];
  return { reqCr, eleRoute, eleMin, eleShort: Math.max(0, eleMin - eleRoute), extraEle: Math.max(0, room - crossMax), boyaNeed, crossMax, crossTotal, boya, cross };
}
const yearMatch = (c, y) => !y || c.y === y || (c.alsoY || []).includes(y);

/* ───────────── 合成音樂與音效（Web Audio，無外部音檔） ───────────── */
const AU = (() => {
  let ctx = null, master, musicBus, sfxBus, noiseBuf, next = 0, step = 0, intense = false;
  let scheduler = null;
  const pending = [];
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const STEP = 60 / 100 / 4;
  const CH = [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [55, 59, 62]], [48, [60, 64, 67]], [45, [57, 60, 64]], [50, [57, 62, 65]], [43, [55, 59, 62]]];
  const _ = null;
  const MEL = [[76, _, 79, _, 81, 79, 76, _], [84, _, 81, _, 79, _, 76, _], [77, _, 81, 84, _, 81, 79, _], [74, _, 79, _, _, _, _, _],
    [76, 79, 84, _, 86, 84, 81, 79], [76, _, 81, _, 84, _, 81, _], [77, _, 74, 77, 81, _, 79, 77], [76, _, 74, _, 71, _, _, _]];
  const MUSIC_VOL = .55, SFX_VOL = .7;
  function init() {
    if (ctx && ctx.state !== 'closed') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    // iPhone 以媒體播放方式處理音訊，避免被鈴聲靜音開關一起關閉。
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .9;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = S.music ? MUSIC_VOL : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = S.sfx ? SFX_VOL : 0; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    next = ctx.currentTime + .1;
    clearInterval(scheduler); scheduler = setInterval(schedule, 25);
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') { flush(); schedule(); }
      renderAudioBtns();
    });
  }
  function flush() {
    if (!ctx || ctx.state !== 'running') return;
    const now = performance.now();
    pending.splice(0).forEach(p => { if (S.sfx && now - p.at < 1000) SFX[p.name](ctx.currentTime + .02); });
  }
  function unlock() {
    if (!S.music && !S.sfx) return Promise.resolve(false);
    try {
      init();
      if (!ctx || document.hidden) return Promise.resolve(false);
      const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      return resumed.then(() => { flush(); renderAudioBtns(); return ctx.state === 'running'; })
        .catch(() => { renderAudioBtns(); return false; });
    } catch { renderAudioBtns(); return Promise.resolve(false); }
  }
  function tone(f, t, dur, o = {}) {
    const { type = 'square', gain = .1, a = .005, r = .08, bus = sfxBus, lp = 0, to = 0 } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.setValueAtTime(gain, t + Math.max(a, dur - r)); g.gain.linearRampToValueAtTime(0, t + dur);
    let node = osc;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + dur + .02);
  }
  function noise(t, dur, { gain = .1, hp = 0, bp = 0, lp = 0, bus = sfxBus } = {}) {
    const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = noiseBuf;
    let node = src;
    if (hp || bp || lp) { const fl = ctx.createBiquadFilter(); fl.type = bp ? 'bandpass' : hp ? 'highpass' : 'lowpass'; fl.frequency.value = bp || hp || lp; src.connect(fl); node = fl; }
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    node.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + .02);
  }
  function schedule() {
    if (ctx.state !== 'running') return;
    if (next < ctx.currentTime - .5) next = ctx.currentTime + .05;
    while (next < ctx.currentTime + .12) {
      if (S.music) playStep(step, next);
      next += STEP; step = (step + 1) % 256;
    }
  }
  // 前 8 小節有旋律，後 8 小節換成琶音，輪流播放比較不膩
  function playStep(s, t) {
    const bar = (s >> 4) % 8, i = s % 16, withMelody = s < 128, mb = musicBus;
    const [root, chord] = CH[bar];
    if (i === 0) chord.forEach(m => tone(mf(m), t, STEP * 16, { type: 'triangle', gain: .035, a: .25, r: .5, bus: mb, lp: 1400 }));
    if (i === 0 || i === 8) tone(mf(root), t, STEP * 3, { type: 'triangle', gain: .16, r: .1, bus: mb });
    if (i === 14 && bar % 2) tone(mf(root + 7), t, STEP * 2, { type: 'triangle', gain: .1, bus: mb });
    if (i % 2 === 0) {
      if (withMelody) { const n = MEL[bar][i / 2]; if (n) tone(mf(n - 12), t, STEP * 1.8, { gain: .045, r: .06, bus: mb, lp: 2400 }); }
      else { const ns = [...chord, chord[0] + 12]; tone(mf(ns[(i / 2) % 4] + 12), t, STEP * 1.5, { type: 'triangle', gain: .035, bus: mb }); }
    }
    if (i % 4 === 2) noise(t, .025, { gain: intense ? .05 : .018, hp: 7000, bus: mb }); // 放映機的喀啦聲
    if (intense) {
      if (i === 0 || i === 8) tone(130, t, .14, { type: 'sine', gain: .32, to: 45, r: .1, bus: mb });
      if (i === 4 || i === 12) noise(t, .12, { gain: .09, bp: 1800, bus: mb });
    }
  }
  const SFX = {
    click: t => tone(880, t, .07, { gain: .06, to: 1320 }),
    gear: t => { [72, 76, 79, 84].forEach((m, k) => tone(mf(m), t + k * .06, .14, { gain: .07 })); tone(mf(96), t + .24, .3, { type: 'sine', gain: .05 }); },
    levelUp: t => { t += .3; [67, 72, 76].forEach((m, k) => tone(mf(m), t + k * .09, .1, { gain: .08 })); [79, 84, 88].forEach(m => tone(mf(m), t + .27, .45, { gain: .045, r: .25 })); },
    hop: t => tone(260, t, .2, { type: 'sine', gain: .1, to: 620 }),
    glide: t => { noise(t, 1.1, { gain: .07, lp: 900 }); tone(330, t, .5, { type: 'sine', gain: .06, to: 880 }); },
    land: t => { tone(160, t, .12, { type: 'sine', gain: .18, to: 70 }); noise(t, .08, { gain: .06, lp: 500 }); },
    undo: t => tone(620, t, .14, { gain: .06, to: 280 }),
    clap: t => { noise(t, .05, { gain: .35, hp: 1200 }); noise(t + .07, .07, { gain: .45, hp: 900 }); tone(180, t + .07, .12, { type: 'sine', gain: .15, to: 90 }); },
    coin: t => { tone(mf(83), t, .07, { gain: .06 }); tone(mf(88), t + .07, .22, { gain: .06, r: .15 }); },
    shimmer: t => [84, 88, 91, 96].forEach((m, k) => tone(mf(m), t + k * .045, .2, { type: 'sine', gain: .045, r: .15 })),
    alarm: t => { [0, .22, .44].forEach(d => { tone(988, t + d, .1, { gain: .07 }); tone(740, t + d + .1, .1, { gain: .07 }); }); },
    grow: t => [60, 64, 67, 72, 76].forEach((m, k) => tone(mf(m), t + k * .08, .18, { type: 'triangle', gain: .09 })),
    grad: t => { [60, 64, 67, 72, 67, 72].forEach((m, k) => tone(mf(m), t + k * .13, .14, { gain: .08 })); [72, 76, 79, 84].forEach(m => tone(mf(m), t + .8, 1.2, { gain: .04, r: .7 })); tone(mf(48), t + .8, 1.2, { type: 'triangle', gain: .15, r: .7 }); },
  };
  function play(name) {
    if (!S.sfx || !SFX[name] || document.hidden) return;
    if (ctx && ctx.state === 'running') SFX[name](ctx.currentTime + .01);
    else { pending.push({ name, at: performance.now() }); if (pending.length > 8) pending.shift(); }
  }
  function setMusic(on) { S.music = on; if (ctx) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, ctx.currentTime, .1); }
  function setSfx(on) { S.sfx = on; if (ctx) sfxBus.gain.setTargetAtTime(on ? SFX_VOL : 0, ctx.currentTime, .05); }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else unlock();
  });
  window.addEventListener('pageshow', () => { if (ctx) unlock(); });
  // 觸控在放開手指時才取得有效啟動；同時支援滑鼠與鍵盤。
  function rememberAudioIntent(e) {
    const button = e.target.closest && e.target.closest('#musicBtn, #sfxBtn');
    if (button) button.dataset.enableOnTap = !ctx || ctx.state !== 'running' ? 'true' : 'false';
  }
  document.addEventListener('pointerdown', e => { rememberAudioIntent(e); if (e.pointerType === 'mouse') unlock(); }, true);
  document.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') unlock(); }, true);
  document.addEventListener('touchend', unlock, { capture: true, passive: true });
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') { rememberAudioIntent(e); unlock(); } }, true);
  return { play, setMusic, setSfx, unlock, running: () => !!ctx && ctx.state === 'running', setIntense: v => intense = v };
})();

/* ───────────── 計算 ───────────── */
function credits() {
  const r = { gen: 0, col: 0, cole: 0, req: 0, ele: 0 };
  DONE().forEach(id => { const c = BY[id]; if (c) r[c.cat] += c.cr; });
  // 113 學年度院選修（科技藝術走讀）依系上認定計入系選修
  const p = PR(); r.ele += r.cole; r.boya = p.boya; r.cross = p.cross;
  r.total = r.gen + r.col + r.req + r.ele + r.boya + Math.min(20, r.cross);
  return r;
}
function levels(done = DONE()) {
  const L = {};
  F.ROLES.forEach(r => {
    const t = TRACK[r.id]; let d = 0, ele = 0;
    t.codes.forEach(id => { if (done.has(id) && BY[id]) { d += BY[id].cr; if (BY[id].cat === 'ele') ele += BY[id].cr; } });
    const f = t.total ? d / t.total : 0;
    L[r.id] = { done: d, ele, total: t.total, f, lv: d <= 0 ? 0 : f >= .8 ? 3 : f >= .5 ? 2 : 1 };
  });
  return L;
}
// 主身分：選修投入優先（那是學生自己的選擇），其次總學分
const roleScore = o => o.ele * 10 + o.done + o.f;
const ranked = L => {
  const rk = F.ROLES.filter(r => L[r.id].done > 0).sort((a, b) => roleScore(L[b.id]) - roleScore(L[a.id]));
  // 播放示範時，主身分跟著正在播放的職務走
  const i = DEMO && S.route ? rk.findIndex(r => r.id === S.route) : -1;
  if (i > 0) rk.unshift(rk.splice(i, 1)[0]);
  return rk;
};
function graduated(cr = credits()) {
  const p = PR();
  const capstones = ['A19033', 'A19034'].filter(id => BY[id]);
  return CO.credits.every(k => k.kind === 'max' || cr[k.k] >= k.need) && cr.total >= 128 &&
    capstones.every(id => p.done.has(id)) &&
    CO.courses.filter(c => c.gate).every(c => p.done.has(c.id)) && CO.extraChecks.every(x => p.checks.has(x));
}
const GRAD_WORKS = [
  { id: 'short', icon: '🎬', name: '短片' },
  { id: 'thesis', icon: '📖', name: '論文' },
  { id: 'script', icon: '📜', name: '劇本' },
];
function gradGateItems() {
  const p = PR();
  return [
    ...CO.courses.filter(c => c.gate).map(c => ({ key: c.id, label: c.name, done: p.done.has(c.id), type: 'course' })),
    ...CO.extraChecks.map(x => ({ key: x, label: x, done: p.checks.has(x), type: 'check' })),
  ];
}
const gateIcon = s => s.includes('英語') ? '🔤' : s.includes('資訊') ? '💾' : s.includes('跨域') ? '🛂' : s.includes('外院') ? '🏛️' : s.includes('經典') ? '🎞️' : s.includes('展演') ? '🎭' : '✓';
function primaryGradGates() {
  const all = gradGateItems(), used = new Set(), out = [];
  ['英語', '資訊|跨域', '外院'].forEach(pat => {
    const re = new RegExp(pat), item = all.find(x => re.test(x.label) && !used.has(x.key));
    if (item) { out.push(item); used.add(item.key); }
  });
  return out;
}
function gradRole() {
  if (ROLE[S.look]) return ROLE[S.look];
  if (S.route && ROLE[S.route]) return ROLE[S.route];
  const top = ranked(levels())[0];
  return top ? ROLE[top.id] : null;
}
function gradWorkLabel() {
  const w = GRAD_WORKS.find(x => x.id === PR().work), r = gradRole();
  return `${r ? r.name : '所選職務'} × ${w ? w.name : '短片／論文／劇本'}`;
}

/* ───────────── three.js 基礎 ───────────── */
const canvas = $('#world');
const mapSurface = $('#mapSurface');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
BOOT.update(87, '正在建立角色', '地圖資源已下載完成。');
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd6ecee, 90, 190);
const camera = new THREE.PerspectiveCamera(38, 1, .1, 500);
const HOME = { t: new THREE.Vector3(0, 0, 4), p: new THREE.Vector3(0, 46, 53) };
camera.position.copy(HOME.p);
const controls = new THREE.OrbitControls(camera, mapSurface);
controls.target.copy(HOME.t);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.maxPolarAngle = 1.22; controls.minDistance = 7; controls.maxDistance = 120; controls.screenSpacePanning = false;
// 手指直接搬動地圖；雙指捏合縮放並平移，不改變觀看角度。
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
controls.addEventListener('start', () => { fly = null; follow = false; });
function addLights(sc, shadow, span = 38) {
  sc.add(new THREE.HemisphereLight(0xfff1dc, 0x7aa9b8, .75));
  const sun = new THREE.DirectionalLight(0xffe2b8, .95);
  sun.position.set(-28, 46, 22);
  if (shadow) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = c.bottom = -span; c.right = c.top = span; c.near = 1; c.far = 160; sun.shadow.bias = -.0008;
  }
  sc.add(sun); return sun;
}
addLights(scene, true);

/* ───────────── 幾何小工具 ───────────── */
const MATS = new Map();
function mat(c, o) {
  const k = c + (o ? JSON.stringify(o) : '');
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: c, flatShading: true, roughness: .78, metalness: 0 }, o || {})));
  return MATS.get(k);
}
const glow = c => mat(c, { emissive: c, emissiveIntensity: .7 });
const gold = () => mat('#E8B923', { metalness: .55, roughness: .32, emissive: '#7a5a00', emissiveIntensity: .25 });
function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
const B = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const Cy = (rt, rb, h, m, x, y, z, s = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), m, x, y, z);
const Sp = (r, m, x, y, z, s = 12) => mesh(new THREE.SphereGeometry(r, s, Math.max(6, s * .7 | 0)), m, x, y, z);
const Co = (r, h, m, x, y, z, s = 12) => mesh(new THREE.ConeGeometry(r, h, s), m, x, y, z);
const To = (r, t, m, x, y, z, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(r, t, 6, 20, arc), m, x, y, z);
const Hemi = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z);
function G(...ch) { const g = new THREE.Group(); ch.forEach(o => o && g.add(o)); return g; }
function R(o, x = 0, y = 0, z = 0) { o.rotation.set(x, y, z); return o; }
function Sc(o, x, y, z) { o.scale.set(x, y, z); return o; }
function rod(a, b, r, m) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const o = Cy(r, r, A.distanceTo(Bv), m, 0, 0, 0, 6);
  o.position.copy(A).add(Bv).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
  return o;
}
function mix(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ───────────── 裝備模型（各自以掛點為原點） ───────────── */
const SKIN = '#F2C9A0', HAIR = '#3A2A22';
const GM = {
  beret: () => G(Sc(R(Sp(.31, '#2b2730', .04, .05, -.03, 14), 0, 0, .28), 1, .36, 1), Cy(.02, .02, .07, '#2b2730', .02, .14, -.02)),
  cap: c => G(Hemi(.35, c, 0, -.28, 0), B(.3, .025, .24, c, 0, -.27, -.43), Sp(.035, c, 0, .07, 0)),
  tophat: () => R(G(Cy(.37, .37, .03, '#1d1b22', 0, .03, 0, 18), Cy(.22, .24, .38, '#1d1b22', 0, .22, 0, 16), Cy(.247, .247, .07, '#b0283a', 0, .09, 0, 16)), 0, 0, -.12),
  fedora: () => R(G(Cy(.43, .43, .025, '#6b4f3a', 0, .01, 0, 18), Cy(.21, .26, .2, '#6b4f3a', 0, .11, 0, 14), Cy(.265, .265, .05, '#2b2018', 0, .05, 0, 14)), .1, 0, .08),
  explorer: () => G(Hemi(.36, '#C8B27A', 0, -.26, 0), Cy(.5, .5, .02, '#bba26a', 0, -.13, 0, 18), Cy(.37, .37, .05, '#5b4a2c', 0, -.12, 0, 14), R(Cy(.05, .05, .06, '#e6e6e6', 0, -.07, .36), Math.PI / 2, 0, 0), R(Cy(.04, .04, .01, glow('#fff6b0'), 0, -.07, .395), Math.PI / 2, 0, 0)),
  chefhat: () => G(Cy(.27, .29, .2, '#fafafa', 0, .02, 0, 14), Sc(Sp(.3, '#ffffff', 0, .24, 0, 12), 1, .75, 1), Sp(.16, '#ffffff', -.18, .2, 0, 8), Sp(.16, '#ffffff', .18, .2, 0, 8), Cy(.292, .292, .04, '#D6457F', 0, -.06, 0, 14)),
  gradcap: () => G(R(B(.64, .035, .64, '#1b1b22', 0, .09, 0), 0, Math.PI / 4, 0), Cy(.25, .27, .13, '#1b1b22', 0, .02, 0), Sp(.025, '#F3C623', 0, .115, 0), rod([0, .11, 0], [.34, .08, .1], .008, '#F3C623'), Cy(.012, .02, .14, '#F3C623', .34, .0, .1, 6)),
  glasses: () => G(To(.075, .012, '#3a2a1e', -.11, 0, .03), To(.075, .012, '#3a2a1e', .11, 0, .03), B(.07, .012, .012, '#3a2a1e', 0, .01, .03)),
  sunglasses: () => G(B(.17, .1, .03, '#111', -.11, 0, .03), B(.17, .1, .03, '#111', .11, 0, .03), B(.07, .025, .02, '#111', 0, .03, .03), B(.05, .015, .005, '#fff', -.15, .025, .047)),
  vr: () => G(B(.48, .2, .17, '#2c2f36', 0, 0, .05), B(.42, .14, .01, glow('#5ff0ff'), 0, 0, .14), R(To(.34, .02, '#2c2f36', 0, 0, -.31), Math.PI / 2, 0, 0)),
  headphones: c => G(To(.37, .03, '#333', 0, 0, 0, Math.PI), R(Cy(.11, .11, .08, c, -.37, -.02, 0), 0, 0, Math.PI / 2), R(Cy(.11, .11, .08, c, .37, -.02, 0), 0, 0, Math.PI / 2), R(Cy(.08, .08, .02, '#222', -.33, -.02, 0), 0, 0, Math.PI / 2), R(Cy(.08, .08, .02, '#222', .33, -.02, 0), 0, 0, Math.PI / 2)),
  headset: () => G(To(.36, .018, '#333', 0, 0, 0, Math.PI), R(Cy(.09, .09, .06, '#333', .36, -.02, 0), 0, 0, Math.PI / 2), R(Cy(.09, .09, .06, '#333', -.36, -.02, 0), 0, 0, Math.PI / 2), rod([.35, -.08, .04], [.12, -.16, .32], .012, '#333'), Sp(.035, '#222', .11, -.16, .33)),
  studentId: () => G(rod([-.11, .02, .1], [0, -.2, .17], .01, '#3D6DB5'), rod([.11, .02, .1], [0, -.2, .17], .01, '#3D6DB5'), B(.13, .17, .012, '#fff', 0, -.29, .17), B(.13, .04, .014, '#3D6DB5', 0, -.22, .17)),
  pass: () => G(rod([-.11, .02, .1], [0, -.2, .17], .01, '#E4572E'), rod([.11, .02, .1], [0, -.2, .17], .01, '#E4572E'), B(.14, .18, .012, '#F3C623', 0, -.3, .17), B(.12, .035, .014, '#1d1b22', 0, -.33, .17)),
  viewfinder: () => G(rod([-.11, .02, .1], [-.02, -.18, .18], .009, '#222'), rod([.11, .02, .1], [.02, -.18, .18], .009, '#222'), R(Cy(.045, .06, .2, '#222', 0, -.23, .22), Math.PI / 2, 0, 0), R(Cy(.04, .04, .01, glow('#9fd8ff'), 0, -.23, .325), Math.PI / 2, 0, 0)),
  scarf: c => G(R(To(.19, .065, c, 0, -.01, 0), Math.PI / 2, 0, 0), R(B(.1, .32, .04, c, .09, -.2, .17), 0, 0, .12), R(B(.09, .24, .04, c, -.02, -.17, .19), 0, 0, -.1)),
  schoolbag: () => G(B(.38, .42, .15, '#34508a', 0, 0, -.08), B(.28, .15, .03, '#2a3f6e', 0, -.1, -.17), B(.05, .03, .36, '#2a3f6e', -.14, .23, .1), B(.05, .03, .36, '#2a3f6e', .14, .23, .1)),
  travelpack: () => G(B(.44, .56, .22, '#6d7a3d', 0, .03, -.13), R(Cy(.09, .09, .5, '#c95b3c', 0, .38, -.13), 0, 0, Math.PI / 2), B(.3, .16, .04, '#5b6631', 0, -.1, -.25), B(.05, .03, .36, '#4a5428', -.14, .23, .1), B(.05, .03, .36, '#4a5428', .14, .23, .1)),
  cape: c => G(R(B(.6, .82, .03, c, 0, -.14, -.04), .14, 0, 0), R(B(.57, .78, .01, '#F3C623', 0, -.13, -.02), .14, 0, 0), R(To(.2, .045, c, 0, .24, .02), Math.PI / 2, 0, 0)),
  gown: () => G(B(.58, .98, .36, '#1b1b22', 0, -.3, 0), B(.12, .5, .37, '#F3C623', 0, -.05, 0)),
  toolbelt: () => G(B(.53, .07, .33, '#3b2a20'), B(.1, .14, .08, '#5a4632', -.2, -.06, .16), B(.1, .12, .08, '#5a4632', .2, -.05, .16), R(To(.05, .025, '#d8d8d8', .28, -.02, .04), 0, Math.PI / 2, 0), R(Cy(.025, .03, .15, '#e2b93b', -.28, -.05, .06), .2, 0, 0)),
  recorder: () => G(rod([.2, .52, .16], [-.27, -.02, .1], .015, '#222'), B(.19, .14, .11, '#2a2a30', -.31, -.04, .06), Cy(.015, .015, .03, '#bbb', -.36, .04, .08, 6), Cy(.015, .015, .03, '#bbb', -.28, .04, .08, 6), B(.03, .02, .01, glow('#ff3b3b'), -.25, -.02, .12)),
  keys: () => G(B(.53, .06, .33, '#3b2a20'), To(.04, .01, '#c8c8c8', .25, -.06, .17), B(.018, .08, .01, '#E8B923', .23, -.13, .17), B(.018, .07, .01, '#c8c8c8', .27, -.12, .17)),
  apron: () => G(B(.47, .54, .02, '#d9c7a3', 0, -.05, .16), B(.22, .12, .012, '#c4ae84', 0, -.14, .175), Sp(.03, '#E4572E', -.12, .05, .17, 6), Sp(.025, '#2E86AB', .1, -.02, .17, 6), Sp(.025, '#E8A33D', .06, .1, .17, 6)),
  vest: () => G(B(.535, .48, .325, '#F28C28', 0, 0, 0), B(.54, .045, .33, mat('#e9eef2', { emissive: '#9aa8b5', emissiveIntensity: .3 }), 0, -.1, 0), B(.54, .045, .33, mat('#e9eef2', { emissive: '#9aa8b5', emissiveIntensity: .3 }), 0, .08, 0)),
  popcorn: () => G(Cy(.1, .075, .2, '#d94040', 0, .08, 0, 10), Cy(.102, .1, .05, '#fff', 0, .14, 0, 10), ...[[0, .21, 0], [.05, .2, .03], [-.05, .2, -.02], [.02, .22, -.05], [-.03, .21, .05]].map(p => Sp(.045, '#FFF1B8', ...p, 6))),
  camHand: () => G(B(.14, .14, .26, '#2b2d33', 0, .08, .05), R(Cy(.05, .062, .1, '#111', 0, .09, .23), Math.PI / 2, 0, 0), R(Cy(.042, .042, .01, glow('#7cc8ff'), 0, .09, .28), Math.PI / 2, 0, 0), B(.03, .03, .16, '#2b2d33', 0, .17, .03), Sp(.015, glow('#ff3b3b'), .05, .13, .17, 6)),
  clapper: () => { const top = G(B(.29, .055, .03, '#fafafa', .145, 0, 0), ...[.04, .12, .2, .27].map(x => R(B(.03, .056, .032, '#1d1d1d', x, 0, 0), 0, 0, .5))); top.position.set(-.145, .255, .02); top.rotation.z = .3;
    return G(B(.29, .21, .025, '#1d1d1d', 0, .12, .02), B(.26, .006, .027, '#fff', 0, .14, .02), B(.26, .006, .027, '#fff', 0, .08, .02), B(.006, .17, .027, '#fff', 0, .11, .02), B(.29, .04, .03, '#fafafa', 0, .23, .02), top); },
  megaphone: () => G(rod([0, 0, 0], [.2, .36, .0], .022, '#c33'), R(mesh(new THREE.ConeGeometry(.14, .32, 14, 1, true), mat('#f4f4f4', { side: THREE.DoubleSide }), .25, .38, 0), -Math.PI / 2, 0, 0), To(.14, .02, '#c33', .25, .38, .16)),
  walkie: () => G(B(.075, .17, .045, '#222', 0, .1, .02), Cy(.01, .01, .13, '#222', .02, .25, .02, 6), B(.05, .035, .005, glow('#9cff9c'), 0, .14, .046)),
  camShoulder: () => G(B(.18, .23, .5, '#2b2d33', .07, .16, -.36), R(Cy(.075, .085, .18, '#111', .07, .17, -.03), Math.PI / 2, 0, 0), R(Cy(.065, .065, .01, glow('#7cc8ff'), .07, .17, .065), Math.PI / 2, 0, 0), B(.24, .2, .03, '#111', .07, .17, .09), R(Cy(.12, .12, .07, '#3b3e46', .07, .38, -.45), 0, 0, Math.PI / 2), B(.05, .05, .14, '#2b2d33', .07, .31, -.25)),
  boom: () => G(rod([0, -.05, 0], [.35, .78, .8], .018, '#9aa0a8'), R(Cy(.075, .075, .32, '#8d8d8d', .37, .72, .86), Math.PI / 2, 0, 0), Sc(Sp(.08, '#9a9a9a', .37, .72, 1.02), 1, 1, .8)),
  brush: () => G(Cy(.012, .016, .2, '#2b2b2b', 0, .08, 0, 6), Cy(.02, .016, .04, '#c8c8c8', 0, .2, 0, 8), Sc(Sp(.04, '#EBA2B8', 0, .25, 0, 8), 1, 1.4, 1)),
  phone: () => G(B(.085, .16, .015, '#1d1d1d', 0, .11, .02), B(.07, .13, .002, glow('#ffb36b'), 0, .11, .029)),
  trophy: () => { const g = gold(); return G(B(.13, .05, .13, '#6b4a1d', 0, .02, 0), Cy(.022, .035, .09, g, 0, .09, 0, 8), Cy(.1, .045, .14, g, 0, .2, 0, 12), R(To(.045, .012, g, -.1, .21, 0), 0, Math.PI / 2, 0), R(To(.045, .012, g, .1, .21, 0), 0, Math.PI / 2, 0), Sp(.03, glow('#fff3a0'), 0, .3, 0, 6)); },
  mask: () => G(Cy(.01, .01, .16, '#6b4a1d', 0, .04, 0, 6), R(Cy(.09, .09, .02, '#F3C623', -.02, .16, .03, 14), Math.PI / 2, 0, -.2), R(Cy(.08, .08, .02, '#5A8FD6', .07, .11, .05, 14), Math.PI / 2, 0, .3), B(.025, .012, .01, '#222', -.05, .18, .05), B(.025, .012, .01, '#222', .0, .18, .05)),
  clipboard: () => R(G(B(.2, .27, .02, '#a8794a', 0, .13, .03), B(.17, .21, .006, '#fff', 0, .11, .043), B(.07, .03, .02, '#c8c8c8', 0, .255, .045), B(.12, .008, .002, '#888', 0, .15, .047), B(.12, .008, .002, '#888', 0, .12, .047)), -.25, 0, 0),
  script: () => R(G(B(.18, .25, .035, '#c0392b', 0, .12, .03), B(.165, .235, .03, '#fff8e7', .012, .12, .036), Sp(.012, '#E8B923', -.06, .2, .05, 6), Sp(.012, '#E8B923', -.06, .05, .05, 6)), -.2, 0, .1),
  tablet: () => R(G(B(.26, .18, .015, '#222', 0, .1, .04), B(.23, .15, .003, glow('#9fd8ff'), 0, .1, .049)), -.5, 0, 0),
  palette: () => R(G(Sc(Cy(.15, .15, .015, '#c99a5b', 0, 0, 0, 16), 1.25, 1, 1), Sp(.025, '#E4572E', -.08, .012, -.05, 6), Sp(.025, '#2E86AB', -.02, .012, -.09, 6), Sp(.025, '#F3C623', .06, .012, -.08, 6), Sp(.025, '#3E9B57', .12, .012, -.02, 6), Sp(.025, '#fff', .08, .012, .06, 6)), Math.PI / 2 - .35, 0, 0),
  laptop: () => { const g = G(B(.32, .016, .21, '#b8bcc4', -.22, .02, -.04)); const sc = G(B(.32, .21, .012, '#b8bcc4', 0, .105, 0), B(.29, .18, .002, glow('#2d3a55'), 0, .105, .007), B(.12, .02, .002, glow('#E4572E'), -.06, .07, .009), B(.18, .02, .002, glow('#16A3A0'), .03, .1, .009), B(.09, .02, .002, glow('#F3C623'), -.03, .13, .009)); sc.position.set(-.22, .03, -.145); sc.rotation.x = -.25; g.add(sc); return g; },
  storyboard: () => R(G(B(.28, .2, .015, '#fafafa', 0, .12, .04), ...[-.085, 0, .085].flatMap(x => [B(.075, .055, .003, '#e6e0d4', x, .16, .049), B(.075, .055, .003, '#e6e0d4', x, .09, .049)]), R(Cy(.01, .01, .28, '#888', 0, .225, .04, 6), 0, 0, Math.PI / 2)), -.3, 0, 0),
  book: () => R(G(B(.17, .23, .05, '#5b3a29', 0, .12, .03), B(.155, .215, .045, '#f5ecd7', .012, .12, .03), B(.1, .025, .052, '#E8B923', 0, .17, .03)), -.2, 0, .12),
  briefcase: () => G(B(.3, .21, .08, '#2b2320', 0, -.14, 0), To(.045, .012, '#2b2320', 0, -.03, 0, Math.PI), B(.04, .025, .085, '#E8B923', 0, -.06, 0)),
  watch: () => G(B(.075, .03, .075, '#222'), Cy(.026, .026, .012, glow('#7fe3ff'), 0, .018, 0, 10)),
  chair: c => { const w = '#6b4a1d'; return G(rod([-.2, 0, -.15], [-.2, .45, .15], .018, w), rod([-.2, 0, .15], [-.2, .45, -.15], .018, w), rod([.2, 0, -.15], [.2, .45, .15], .018, w), rod([.2, 0, .15], [.2, .45, -.15], .018, w), B(.42, .03, .34, c, 0, .46, 0), B(.04, .03, .36, w, -.21, .62, 0), B(.04, .03, .36, w, .21, .62, 0), Cy(.015, .015, .5, w, -.21, .7, -.17, 6), Cy(.015, .015, .5, w, .21, .7, -.17, 6), B(.42, .17, .02, c, 0, .84, -.17), B(.3, .035, .022, '#fff', 0, .84, -.165)); },
  drone: c => G(B(.2, .07, .2, '#eef2f6'), Sp(.04, glow('#5ff0ff'), 0, 0, .1, 8), rod([-.15, .02, -.15], [.15, .02, .15], .012, '#bbb'), rod([-.15, .02, .15], [.15, .02, -.15], .012, '#bbb'), ...[[-.15, -.15], [.15, .15], [-.15, .15], [.15, -.15]].map(([x, z]) => Cy(.075, .075, .01, '#333', x, .05, z, 10)), R(To(.22, .008, glow(c), 0, -.12, 0), Math.PI / 2, 0, 0)),
};
const POSE = { megaphone: -1.3, camShoulder: -1.6, boom: -2.5, trophy: -2.7, brush: -.9, phone: -1.1, laptop: -1.0, briefcase: -.05, mask: -.75, clipboard: -.7, script: -.7, tablet: -.8, palette: -.75, storyboard: -.75, book: -.7, walkie: -.7, popcorn: -.6, clapper: -.75, camHand: -.8 };
const ANCHOR = { head: [0, 1.7, 0], eyes: [0, 1.44, .31], ears: [0, 1.44, 0], neck: [0, 1.08, 0], back: [0, .85, -.17], belt: [0, .56, 0], body: [0, .8, 0], prop: [.9, 0, .05], pet: [-.72, 1.9, .15] };

/* ───────────── 角色 ───────────── */
function makeGlider() {
  // 滑翔傘：一道彩色弧形傘翼，加幾條傘繩
  const g = new THREE.Group(), r = 1.6, span = 1.9, n = 6;
  const strips = [];
  for (let i = 0; i < n; i++) {
    const geo = new THREE.CylinderGeometry(r, r, .95, 3, 1, true, Math.PI - span / 2 + i * span / n, span / n);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ color: i % 2 ? '#fffaf1' : '#E4572E', side: THREE.DoubleSide, flatShading: true, roughness: .7 });
    const s = new THREE.Mesh(geo, m); s.castShadow = true; g.add(s); strips.push(m);
  }
  const ex = r * Math.sin(span / 2), ey = -r * Math.cos(span / 2);
  [[-ex, ey], [ex, ey], [-ex * .5, ey + .55], [ex * .5, ey + .55]].forEach(([x, y]) => g.add(rod([x, y, 0], [Math.sign(x) * .28, -1.55 + 1.06, 0], .006, '#555')));
  g.position.y = 1.9 + .45;
  g.visible = false;
  return { g, strips };
}
function buildCharacter() {
  const root = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: '#F4F1EA', flatShading: true, roughness: .8 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#3b3b46', flatShading: true, roughness: .8 });
  const stripeM = new THREE.MeshStandardMaterial({ color: '#E4572E', flatShading: true });
  const stripes = [];
  const mkLeg = x => { const l = new THREE.Group(); l.position.set(x, .52, 0); const st = B(.185, .025, .2, stripeM, 0, -.47, .03); stripes.push(st);
    l.add(B(.16, .42, .18, '#3E5C8A', 0, -.21, 0), B(.18, .1, .27, shoe, 0, -.47, .03), st); return l; };
  const legL = mkLeg(-.11), legR = mkLeg(.11);
  root.add(legL, legR, B(.5, .56, .3, shirt, 0, .8, 0), Cy(.07, .08, .08, SKIN, 0, 1.11, 0, 8));
  root.add(Sp(.33, SKIN, 0, 1.42, 0, 16), R(mesh(new THREE.SphereGeometry(.35, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), HAIR, 0, 1.43, -.01), -.32, 0, 0), B(.5, .28, .1, HAIR, 0, 1.36, -.25),
    Sp(.042, '#1d1b22', -.11, 1.42, .3, 8), Sp(.042, '#1d1b22', .11, 1.42, .3, 8),
    Sc(Sp(.05, '#f4a3a3', -.19, 1.34, .26, 8), 1, .6, .5), Sc(Sp(.05, '#f4a3a3', .19, 1.34, .26, 8), 1, .6, .5), B(.07, .018, .02, '#9b4a3a', 0, 1.3, .32));
  const mkArm = (x, side) => { const a = new THREE.Group(); a.position.set(x, 1.04, 0); a.add(B(.12, .46, .13, shirt, 0, -.2, 0), Sp(.075, SKIN, 0, -.48, 0, 8)); a.rotation.set(-.45, 0, side * .12); return a; };
  const armR = mkArm(-.31, -1), armL = mkArm(.31, 1);
  root.add(armR, armL);
  const gear = new THREE.Group(); root.add(gear);
  const glider = makeGlider(); root.add(glider.g);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, shirt, shoe, stripes, armR, armL, legL, legR, gear, glider };
}
const handPos = (arm, len = .48) => new THREE.Vector3(0, -len, 0).applyEuler(arm.rotation).add(arm.position);

// 依造型決定每個部位穿什麼（done 可換成「預覽」用的假想修課集合）
function lookItems(look, done = DONE()) {
  const L = levels(done), rk = ranked(L);
  const score = {}; rk.forEach((r, i) => score[r.id] = 100 - i);
  let items = [...done].filter(id => BY[id] && gearOf(id).slot).map(id => { const g = gearOf(id); return { id, slot: g.slot, m: g.m, tier: g.tier, role: g.role }; });
  if (ROLE[look]) items = items.filter(it => it.role === look || !it.role || TRACK[look].codes.has(it.id));
  items.sort((a, b) => {
    const sa = a.role ? (a.role === look ? 1000 : score[a.role] || 0) : 0, sb = b.role ? (b.role === look ? 1000 : score[b.role] || 0) : 0;
    return (sb - sa) || (b.tier - a.tier);
  });
  if (look === 'grad') items.unshift({ slot: 'head', m: 'gradcap', tier: 9 }, { slot: 'body', m: 'gown', tier: 9 });
  items.push({ slot: 'neck', m: 'studentId', tier: -1 }, { slot: 'back', m: 'schoolbag', tier: -1 });
  const used = {}, out = [];
  items.forEach(it => { if (!used[it.slot]) { used[it.slot] = 1; out.push(it); } });
  if (look === 'grad' && done.has('A19034')) { const i = out.findIndex(o => o.slot === 'handR'); const t = { slot: 'handR', m: 'trophy', tier: 9, role: 'mkt' }; i >= 0 ? out[i] = t : out.push(t); }
  const primary = look === 'auto' ? rk[0] && rk[0].id : ROLE[look] ? look : null;
  return { items: out, primary };
}
function dress(ch, look, done) {
  const { items, primary } = lookItems(look, done);
  ch.gear.clear();
  const col = primary ? ROLE[primary].color : '#E4572E';
  ch.shirt.color.set(primary ? mix(col, '#ffffff', .18) : '#F4F1EA');
  ch.glider.strips.forEach((m, i) => m.color.set(i % 2 ? '#fffaf1' : col));
  ch.armR.rotation.x = -.45; ch.armL.rotation.x = -.45;
  const sneakers = items.some(i => i.m === 'sneakers');
  ch.shoe.color.set(sneakers ? '#fafafa' : '#3b3b46'); ch.stripes.forEach(s => s.visible = sneakers);
  items.forEach(it => {
    if (it.slot === 'feet' || !GM[it.m]) return;
    const o = GM[it.m](it.role ? ROLE[it.role].color : '#E4572E');
    if (it.slot === 'handR' || it.slot === 'handL') {
      const arm = it.slot === 'handR' ? ch.armR : ch.armL;
      arm.rotation.x = POSE[it.m] ?? -.45;
      o.position.copy(handPos(arm));
      if (it.slot === 'handL' && it.m !== 'laptop' && it.m !== 'briefcase') o.scale.x = -1;
    } else if (it.slot === 'wrist') o.position.copy(handPos(ch.armL, .4));
    else o.position.set(...ANCHOR[it.slot]);
    if (it.slot === 'pet') o.userData.bob = true;
    o.traverse(m => { if (m.isMesh) m.castShadow = true; });
    ch.gear.add(o);
  });
  return primary;
}

/* ───────────── 海洋 ───────────── */
const waterGeo = new THREE.PlaneGeometry(400, 400, 96, 96); waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#63BCD0', flatShading: true, roughness: .35, metalness: .05, transparent: true, opacity: .93 }));
water.receiveShadow = true; scene.add(water);
const wPos = waterGeo.attributes.position, wBase = Float32Array.from(wPos.array);

/* ───────────── 系徽貼圖 ───────────── */
const TEX = {};
function logoTexture(style) {
  if (TEX[style]) return TEX[style];
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');
  const tex = TEX[style] = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
  const draw = img => {
    g.fillStyle = style === 'screen' ? '#191514' : '#2b2622'; g.fillRect(0, 0, 1024, 512);
    if (style === 'sign') { g.fillStyle = '#fffaf1'; for (let x = 20; x < 1024; x += 56) { g.fillRect(x, 16, 30, 22); g.fillRect(x, 474, 30, 22); } }
    else { const rg = g.createRadialGradient(512, 256, 40, 512, 256, 560); rg.addColorStop(0, 'rgba(255,236,200,.22)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 1024, 512); }
    if (img) { g.imageSmoothingQuality = 'high'; const w = 780, h = w * img.height / img.width; g.drawImage(img, (1024 - w) / 2, (512 - h) / 2, w, h); }
    else { g.fillStyle = '#fffaf1'; g.textAlign = 'center'; g.font = 'bold 84px "PingFang TC","Noto Sans TC",sans-serif'; g.fillText('義守電影與電視學系', 512, 290); }
    tex.needsUpdate = true;
  };
  draw(null);
  // 直接用 file:// 開啟時，瀏覽器不允許把本機圖片當貼圖，就保留文字版
  if (location.protocol !== 'file:') { const img = new Image(); img.onload = () => draw(img); img.src = 'logo.png'; }
  return tex;
}

/* ───────────── 島嶼 ───────────── */
const SQ3 = Math.sqrt(3);
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function hexRing(k) { if (!k) return [[0, 0]]; const out = []; let q = -k, r = k; for (let i = 0; i < 6; i++) for (let j = 0; j < k; j++) { out.push([q, r]); q += DIRS[i][0]; r += DIRS[i][1]; } return out; }
const hx = (q, r) => [SQ3 * (q + r / 2), 1.5 * r];
const RING_R = 23;
const RING_N = F.ISLANDS.filter(i => i.ring !== undefined).length;

let WORLD = null, BLD = {}, ISLAND_OBJ = {}, rand = rng(1);
const TILES = [], LANDMARKS = [], pickables = [];

function tileMesh(top, sideCol, topCol) {
  const h = top + .7;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.97, .97, h, 6), [mat(sideCol), mat(topCol), mat(sideCol)]);
  m.position.y = top - h / 2; m.castShadow = true; m.receiveShadow = true;
  return m;
}
function ownMats(g) { g.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => { const c = m.clone(); c.userData.own = 1; return c; }) : Object.assign(o.material.clone(), { userData: { own: 1 } }); o.castShadow = true; o.receiveShadow = true; } }); }

// 島心畢業成果殿堂：兩門大四總結課、職務型作品與三道畢業門最後匯聚成桂冠。
function graduationHall() {
  const gm = gold(), dark = '#2b2622', blue = '#5E9CD8';
  const cupParts = [
    Cy(.3, .16, .28, gm, 0, .78, 0, 12), Cy(.07, .09, .25, gm, 0, .52, 0, 10), Cy(.25, .3, .08, gm, 0, .36, 0, 12),
    R(To(.25, .035, gm, -.27, .81, 0, Math.PI), 0, Math.PI, Math.PI / 2), R(To(.25, .035, gm, .27, .81, 0, Math.PI), 0, 0, -Math.PI / 2),
  ];
  const cup = G(...cupParts);
  const crown = G(
    B(.65, .1, .12, gm, 0, 1.38, 0),
    ...[-.27, -.135, 0, .135, .27].map((x, i) => Co(.075, i === 2 ? .3 : .22, gm, x, 1.53 + (i === 2 ? .04 : 0), 0, 6)),
    ...[-.27, 0, .27].map(x => Sp(.045, glow('#fff3a0'), x, 1.69 + (x ? 0 : .05), 0, 8))
  );
  crown.visible = false; crown.userData.spin = true;
  const halo = R(To(.72, .035, glow('#F3C623'), 0, 1.16, 0), Math.PI / 2, 0, 0); halo.visible = false;
  const gates = [-.65, 0, .65].map((x, i) => {
    const light = Sp(.075, glow('#8b8172'), x, .66, -.42, 8);
    const p = G(Cy(.055, .065, .42, '#e9dfcd', x, .3, -.42, 8), light, B(.22, .08, .16, i === 0 ? '#7C93AE' : i === 1 ? '#5F86AE' : '#8A6248', x, .08, -.42));
    p.userData.light = light; return p;
  });
  const film = G(B(.28, .2, .04, dark, -.62, .35, .26), B(.22, .13, .02, '#fff7da', -.62, .35, .285));
  const book = G(B(.27, .05, .22, '#8A6248', .62, .26, .27), B(.25, .035, .2, '#fff7da', .62, .31, .27));
  const scroll = G(Cy(.035, .035, .3, '#f1d9a4', 0, .25, .42, 8), Cy(.055, .055, .04, '#6b4a1d', 0, .09, .42, 8), Cy(.055, .055, .04, '#6b4a1d', 0, .41, .42, 8)); scroll.rotation.z = Math.PI / 2;
  const g = G(
    Cy(.96, 1.04, .16, dark, 0, .08, 0, 14),
    B(1.62, .1, .64, blue, 0, .18, .2), B(1.48, .08, .55, '#F3C623', 0, .27, .2),
    cup, crown, halo, film, book, scroll, ...gates
  );
  return { g, grad: { cupParts, crown, halo, gates } };
}

function building(c) {
  const g0 = gearOf(c.id);
  const col = g0.role ? ROLE[g0.role].color : c.cat === 'gen' ? '#7C93AE' : '#5F86AE';
  const wall = '#FBF6EC';
  let g, grad = null;
  if (c.gate) {
    g = G(Cy(.06, .07, .75, col, -.3, .37, 0, 8), Cy(.06, .07, .75, col, .3, .37, 0, 8), B(.85, .09, .12, col, 0, .76, 0), B(.66, .06, .1, col, 0, .62, 0), B(.3, .16, .02, '#fff', 0, .48, .06));
  } else if (c.id === 'A19034') {
    const hall = graduationHall(); g = hall.g; grad = hall.grad;
  } else if (c.cat === 'req') {
    const roof = new THREE.CylinderGeometry(.36, .36, .88, 10, 1, false, 0, Math.PI); roof.rotateZ(Math.PI / 2);
    g = G(B(.86, .42, .72, wall, 0, .21, 0), mesh(roof, col, 0, .42, 0), B(.3, .3, .02, col, 0, .15, .365), B(.5, .05, .02, '#2b2622', 0, .36, .365));
  } else if (c.cat === 'gen' || c.cat === 'col' || c.cat === 'cole') {
    const roof = c.cat === 'gen' ? (() => { const r = new THREE.CylinderGeometry(.44, .44, .76, 3); r.rotateZ(Math.PI / 2); r.rotateX(-Math.PI / 2); return mesh(r, col, 0, .64, 0); })() : R(Co(.56, .42, col, 0, .63, 0, 4), 0, Math.PI / 4, 0);
    g = G(B(.7, .42, .56, wall, 0, .21, 0), roof, B(.18, .26, .02, col, 0, .13, .285), B(.14, .12, .02, '#bfe0f0', -.2, .26, .285), B(.14, .12, .02, '#bfe0f0', .2, .26, .285));
  } else {
    const kind = { cam: 'tower', pro: 'tower', snd: 'dome', edt: 'dome' }[g0.role] || 'house';
    if (kind === 'tower') g = G(B(.5, .86, .5, wall, 0, .43, 0), B(.58, .1, .58, col, 0, .91, 0), B(.36, .08, .02, '#bfe0f0', 0, .62, .255), B(.36, .08, .02, '#bfe0f0', 0, .42, .255), B(.2, .24, .02, col, 0, .12, .255), g0.role === 'cam' ? R(Cy(.1, .12, .18, '#2b2d33', 0, .75, .3, 10), Math.PI / 2, 0, 0) : Cy(.015, .015, .4, '#999', .15, 1.15, 0, 6));
    else if (kind === 'dome') g = G(Cy(.4, .44, .34, wall, 0, .17, 0, 12), Hemi(.4, col, 0, .34, 0), B(.2, .22, .02, col, 0, .11, .43), Cy(.012, .012, .35, '#888', 0, .9, 0, 6), Sp(.04, glow(col), 0, 1.08, 0, 8));
    else { const r = new THREE.CylinderGeometry(.44, .44, .76, 3); r.rotateZ(Math.PI / 2); r.rotateX(-Math.PI / 2);
      g = G(B(.7, .44, .54, wall, 0, .22, 0), mesh(r, col, 0, .66, 0), B(.18, .26, .02, col, 0, .13, .275), B(.14, .12, .02, '#bfe0f0', -.2, .28, .275), B(.14, .12, .02, '#bfe0f0', .2, .28, .275)); }
  }
  const flag = G(Cy(.014, .014, .55, '#ddd', 0, .27, 0, 6), B(.22, .13, .012, glow('#F3C623'), .11, .48, 0));
  flag.position.set(.34, 0, .22); g.add(flag);
  const ring = R(To(.62, .045, glow('#ffffff'), 0, .03, 0), Math.PI / 2, 0, 0); ring.visible = false; g.add(ring);
  ownMats(g);
  g.userData = { course: c.id, flag, ring, grad };
  return g;
}
function special(kind) {
  const g = kind === 'BOYA'
    ? G(Cy(.36, .42, .3, '#FBF6EC', 0, .15, 0, 8), Cy(.3, .34, .3, '#FBF6EC', 0, .45, 0, 8), Co(.38, .35, '#6FB7C9', 0, .77, 0, 8), ...[0, 1, 2, 3].map(i => B(.06, .1, .02, '#bfe0f0', Math.sin(i * 1.57) * .36, .2, Math.cos(i * 1.57) * .36)))
    : G(B(.9, .06, .5, '#8b6a45', 0, .06, .1), Cy(.04, .04, .4, '#6b4a1d', -.4, .1, .32, 6), Cy(.04, .04, .4, '#6b4a1d', .4, .1, .32, 6), B(.6, .2, .3, '#E4572E', 0, .2, -.1), Co(.42, .4, '#fff', 0, .5, -.1, 4), Cy(.02, .02, .6, '#ddd', .25, .5, -.1, 6), B(.25, .15, .01, '#6FB7C9', .38, .7, -.1));
  ownMats(g); g.userData = { special: kind };
  return g;
}
function landmark(isl) {
  let g;
  if (isl.role) {
    const m = { dir: 'clapper', pro: 'walkie', cam: 'camHand', art: 'palette', snd: 'headphones', edt: 'drone', mkt: 'megaphone', res: 'book' }[isl.role];
    const item = GM[m](ROLE[isl.role].color);
    const ctr = new THREE.Box3().setFromObject(item).getCenter(new THREE.Vector3());
    item.position.sub(ctr);
    const holder = G(item); holder.scale.setScalar({ headphones: 1.9, drone: 2.4, megaphone: 2.4 }[m] || 3.2);
    holder.position.y = 1.35; holder.userData.spin = true;
    g = G(Cy(.55, .65, .3, '#efe4cf', 0, .15, 0, 6), Cy(.04, .04, .6, '#ccc', 0, .55, 0, 6), holder);
  } else if (isl.id === 'port') {
    g = G(Cy(.3, .42, 1.6, '#fafafa', 0, .8, 0, 10), Cy(.31, .36, .25, '#E4572E', 0, .55, 0, 10), Cy(.31, .33, .25, '#E4572E', 0, 1.15, 0, 10), Cy(.24, .24, .3, glow('#fff3b0'), 0, 1.75, 0, 8), Co(.34, .35, '#E4572E', 0, 2.07, 0, 10));
  } else if (isl.id === 'college') {
    g = G(B(1, .9, .7, '#FBF6EC', 0, .45, 0), R(Co(.8, .5, '#5F86AE', 0, 1.15, 0, 4), 0, Math.PI / 4, 0), B(.8, .14, .02, '#5F86AE', 0, .7, .36), ...[-.3, 0, .3].map(x => B(.16, .2, .02, '#bfe0f0', x, .35, .36)));
  } else {
    g = G(Cy(.22, .3, .5, '#E4572E', 0, .25, 0, 8), Cy(.12, .2, .5, '#fafafa', 0, .7, 0, 8), Sp(.12, glow('#fff3b0'), 0, 1.02, 0, 8));
    g.userData.bobBuoy = true;
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// 四季樹：大一櫻花、大二綠樹、大三楓紅、大四雪松
function tree(x, z, top, y) {
  const trunk = Cy(.04, .05, .2, '#7a5534', 0, .1, 0, 6);
  let g;
  if (y === 1) g = G(trunk, Sp(.21, mix('#F7A9C4', '#FFD3E2', rand()), 0, .38, 0, 7), Sp(.12, '#FFE3EC', .1, .48, .04, 6));
  else if (y === 2) g = rand() < .5 ? G(trunk, Co(.22, .5, mix('#3f9a4f', '#7cc35a', rand()), 0, .42, 0, 7)) : G(trunk, Sp(.21, mix('#58aa4c', '#93c95a', rand()), 0, .37, 0, 7));
  else if (y === 3) g = rand() < .5 ? G(trunk, Co(.22, .48, mix('#E2702A', '#F2B13A', rand()), 0, .42, 0, 7)) : G(trunk, Sp(.2, mix('#D9542B', '#F09A3A', rand()), 0, .37, 0, 7));
  else if (y === 4) g = G(trunk, Co(.23, .45, '#2f6b55', 0, .38, 0, 7), Co(.14, .2, '#ffffff', 0, .56, 0, 7));
  else g = rand() < .7 ? G(trunk, Co(.2, .48, mix('#4f9a5a', '#86b85b', rand()), 0, .42, 0, 7)) : G(Sc(Sp(.14, '#b8b0a4', 0, .06, 0, 6), 1.3, .6, 1));
  g.position.set(x, top, z); g.rotation.y = rand() * 6;
  return g;
}
function disposeWorld() {
  if (!WORLD) return;
  scene.remove(WORLD);
  WORLD.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.userData && m.userData.own && m.dispose()); });
  WORLD = null;
}

function islandCourses(id) {
  return CO.courses.filter(c => {
    if (id === 'port') return c.cat === 'gen';
    if (id === 'college') return c.cat === 'col' || c.cat === 'cole';
    if (id === 'main') return c.cat === 'req';
    if (ISL[id].role) return c.cat === 'ele' && gearOf(c.id).role === id;
    return false;
  }).sort((a, b) => a.y - b.y || (a.t === '下') - (b.t === '下'));
}

async function buildWorld(report) {
  disposeWorld();
  WORLD = new THREE.Group(); scene.add(WORLD);
  BLD = {}; ISLAND_OBJ = {}; TILES.length = 0; LANDMARKS.length = 0; pickables.length = 0;
  rand = rng(+S.cohort);
  const now = performance.now();
  for (const [idx, isl] of F.ISLANDS.entries()) {
    const grp = new THREE.Group();
    let ang = 0;
    if (isl.ring !== undefined) { ang = isl.ring / RING_N * Math.PI * 2; grp.position.set(Math.sin(ang) * RING_R, 0, Math.cos(ang) * RING_R); grp.rotation.y = ang; }
    WORLD.add(grp); grp.updateMatrixWorld();
    const courses = islandCourses(isl.id);
    const side = '#d8bd8a';
    const slots = [];
    if (isl.id === 'main') {
      // 外圈大一 → 內圈大四，紅毯螺旋上山
      const H = [2.25, 1.8, 1.35, .9, .5];
      for (let k = 0; k <= 4; k++) hexRing(k).forEach(([q, r], i) => slots.push({ q, r, k, i, top: H[k], y: k ? 5 - k : 4 }));
      const ringOf = y => 5 - y;
      const pick = (k, list, off) => { const ring = slots.filter(s => s.k === k); list.forEach((c, i) => { ring[(Math.round(i * ring.length / list.length) + off) % ring.length].course = c; }); };
      [1, 2, 3].forEach(y => pick(ringOf(y), courses.filter(c => c.y === y), y));
      pick(1, courses.filter(c => c.y === 4 && c.id !== 'A19034'), 0);
      const show = courses.find(c => c.id === 'A19034'); if (show) slots[0].course = show;
    } else {
      const yrs = isl.id === 'port' ? [1, 2] : isl.id === 'college' ? [1] : isl.id === 'sea' ? [] : [1, 2, 3, 4];
      const per = {}; yrs.forEach(y => per[y] = courses.filter(c => c.y === y).length + 1);
      const need = Math.max(7, 1 + Object.values(per).reduce((a, b) => a + b, 0) + (isl.id === 'sea' ? 3 : 0));
      let all = [];
      for (let k = 0; all.length < need; k++) {
        const ring = hexRing(k).map(([q, r]) => ({ q, r, k }));
        if (all.length + ring.length > need) ring.sort((a, b) => hx(b.q, b.r)[1] - hx(a.q, a.r)[1]);
        all = all.concat(ring.slice(0, need - all.length));
      }
      slots.push(...all);
      const rest = slots.slice(1).map(s => { const [x, z] = hx(s.q, s.r); s.a = (Math.atan2(x, -z) + Math.PI * 2) % (Math.PI * 2); return s; }).sort((a, b) => a.a - b.a);
      // 依角度切成四等份：每一年一塊扇形
      const total = yrs.reduce((a, y) => a + per[y], 0) || 1;
      let cursor = 0;
      yrs.forEach((y, yi) => {
        const n = yi === yrs.length - 1 ? rest.length - cursor : Math.max(per[y], Math.round(per[y] / total * rest.length));
        const run = rest.slice(cursor, cursor + n); cursor += n;
        const list = courses.filter(c => c.y === y);
        run.forEach((s, i) => { s.y = y; if (list[i]) s.course = list[i]; });
      });
      if (isl.id === 'sea') { rest[0].special = 'BOYA'; rest[1].special = 'CROSS'; }
      slots.forEach(s => { s.top = .42 + rand() * .1 + (s.y ? s.y * .05 : 0); });
      slots[0].top = .62;
    }
    let maxD = 0;
    slots.forEach(s => {
      const [x, z] = hx(s.q, s.r);
      maxD = Math.max(maxD, Math.hypot(x, z));
      const topCol = s.y ? Y[s.y].tile : isl.id === 'sea' ? '#bfe6e6' : '#e8dcbc';
      const t = tileMesh(s.top, side, topCol);
      t.position.x = x; t.position.z = z; t.userData.island = isl.id; s.mesh = t;
      grp.add(t); pickables.push(t);
      const w = grp.localToWorld(new THREE.Vector3(x, s.top, z));
      TILES.push({ x: w.x, z: w.z, top: s.top, isl: isl.id });
      s.world = w;
      if (s.course) {
        const b = building(s.course); b.position.set(x, s.top, z); b.rotation.y = -ang;
        grp.add(b); pickables.push(b);
        if (b.userData.grad) LANDMARKS.push(b);
        BLD[s.course.id] = { grp: b, base: w.clone(), island: isl.id };
      } else if (s.special) {
        const b = special(s.special); b.position.set(x, s.top, z); b.rotation.y = -ang; grp.add(b); pickables.push(b);
        BLD[s.special] = { grp: b, base: w.clone(), island: isl.id };
      } else if (isl.id !== 'main' && s.k === 0) {
        const lm = landmark(isl); lm.position.set(x, s.top, z); lm.rotation.y = -ang; grp.add(lm); LANDMARKS.push(lm);
        lm.userData.island = isl.id; pickables.push(lm);
      } else {
        const n = isl.id === 'main' ? (rand() < .55 ? 1 : 0) : 1 + (rand() < .5 ? 1 : 0);
        for (let i = 0; i < n; i++) grp.add(tree(x + (rand() - .5) * .9, z + (rand() - .5) * .9, s.top, s.y));
      }
    });
    const beach = Cy(maxD + 1.35, maxD + 1.75, .5, '#ecd9a6', 0, -.12, 0, 18); beach.castShadow = false; grp.add(beach);
    const shallow = new THREE.Mesh(new THREE.CircleGeometry(maxD + 3.4, 24), new THREE.MeshBasicMaterial({ color: '#a8e3e6', transparent: true, opacity: .55 }));
    shallow.rotation.x = -Math.PI / 2; shallow.position.y = .02; grp.add(shallow);
    ISLAND_OBJ[isl.id] = { grp, center: grp.localToWorld(new THREE.Vector3(0, 0, 0)), top: isl.id === 'main' ? 4.4 : 3, slots, radius: maxD + 1.5 };
    if (isl.id === 'main') buildCarpet(slots, grp);
    if (isl.id === 'port') addLogoSign(grp, maxD + 1.1);
    if (isl.id === 'sea') buildSeaFx(grp, slots, maxD);
    // 島嶼從海裡長出來
    grp.scale.set(1, .01, 1); grp.userData.grow = now + 120 + (isl.ring === undefined ? 0 : (isl.ring + 1) * 90);
    await report(Math.round((idx + 1) / F.ISLANDS.length * 85), `正在建立${isl.name}`);
  }
  AU.play('grow');
}
/* ───────────── 博雅跨域警報 ─────────────
 * 大二起，博雅還沒修滿、跨域（或多修的系選修）也還沒補上剩下的選修空間 → 外海閃紅燈
 * 兩者都安排好了 → 外海變成開滿花的綠地 */
let SEA = null;
const SEA_BASE = new THREE.Color('#bfe6e6'), SEA_WARN = new THREE.Color('#ff7d6e'), SEA_OK = new THREE.Color('#93d67c');
function buildSeaFx(grp, slots, maxD) {
  const tops = [];
  slots.forEach(s => { if (!s.mesh) return; s.mesh.material = s.mesh.material.map(m => { const c = m.clone(); c.userData.own = 1; return c; }); tops.push(s.mesh.material[1]); });
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#ff3b30', emissive: '#ff3b30', emissiveIntensity: 1 }); beaconMat.userData.own = 1;
  const beacon = Sp(.2, beaconMat, 0, 1.3, 0, 10); beacon.visible = false;
  const lm = LANDMARKS.find(l => l.userData.island === 'sea'); if (lm) lm.add(beacon);
  const waveMat = new THREE.MeshBasicMaterial({ color: '#ff5a4e', transparent: true, opacity: 0, side: THREE.DoubleSide }); waveMat.userData.own = 1;
  const wave = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), waveMat); wave.rotation.x = -Math.PI / 2; wave.position.y = .14; grp.add(wave);
  const flowers = new THREE.Group();
  slots.forEach(s => {
    if (!s.mesh || s.special || s.k === 0) return;
    const [x, z] = hx(s.q, s.r);
    for (let i = 0; i < 5; i++) { const fx = x + (rand() - .5) * 1.2, fz = z + (rand() - .5) * 1.2; flowers.add(Cy(.012, .012, .18, '#4f9a5a', fx, s.top + .09, fz, 5), Sp(.065, ['#ff8fb1', '#ffd35a', '#ffffff', '#c99bff', '#ff9d5c'][i], fx, s.top + .2, fz, 6)); }
  });
  flowers.visible = false; grp.add(flowers);
  SEA = { tops, beacon, beaconMat, wave, waveMat, flowers, maxD, state: null };
}
function seaStatus() {
  const p = PR(), cr = credits();
  const need = k => CO.credits.find(x => x.k === k).need;
  let yr = 0; DONE().forEach(id => { const c = BY[id]; if (c && !c.gate && c.y > yr) yr = c.y; });
  const boyaLeft = Math.max(0, need('boya') - p.boya);
  const eleExtra = Math.max(0, cr.ele - need('ele'));
  const crossOK = p.cross > 0 || eleExtra >= need('cross');
  return { state: !boyaLeft && crossOK ? 'ok' : yr >= 2 ? 'warn' : 'idle', yr, boyaLeft, crossOK, boyaNeed: need('boya'), crossMax: need('cross') };
}
function refreshSea() {
  if (!SEA || !CO) return;
  const st = seaStatus(), prev = SEA.state;
  SEA.state = st.state;
  $('#passBtn').classList.toggle('alert', st.state === 'warn');
  if (prev && prev !== st.state) {
    if (st.state === 'warn') setTimeout(() => { AU.play('alarm'); toast(`⚠ 已經${Y[st.yr].name}了，博雅跨域外海亮紅燈<small>${st.boyaLeft ? `博雅還差 ${st.boyaLeft} 學分` : ''}${st.boyaLeft && !st.crossOK ? '・' : ''}${st.crossOK ? '' : '跨域選修還沒開始規劃'}</small>`); }, 700); // 等裝備、升級訊息先跳完
    if (st.state === 'ok') { AU.play('coin'); toast('🌼 博雅與跨域都安排好了，外海開滿花', 'up'); }
  }
}
function seaFrame(t) {
  if (!SEA) return;
  const st = SEA.state;
  if (st === 'warn') {
    const k = (Math.sin(t * 6) + 1) / 2, w = (t * .6) % 1;
    SEA.tops.forEach(m => m.color.copy(SEA_BASE).lerp(SEA_WARN, .25 + k * .6));
    SEA.beacon.visible = true; SEA.beaconMat.color.set('#ff3b30'); SEA.beaconMat.emissive.set('#ff3b30'); SEA.beaconMat.emissiveIntensity = .2 + k * 1.6;
    SEA.wave.scale.setScalar(SEA.maxD + 1.6 + w * 6); SEA.waveMat.opacity = (1 - w) * .75;
    SEA.flowers.visible = false;
  } else {
    SEA.tops.forEach(m => m.color.copy(st === 'ok' ? SEA_OK : SEA_BASE));
    SEA.beacon.visible = st === 'ok'; SEA.beaconMat.color.set('#4cd964'); SEA.beaconMat.emissive.set('#4cd964'); SEA.beaconMat.emissiveIntensity = .7;
    SEA.waveMat.opacity = 0; SEA.flowers.visible = st === 'ok';
  }
}
function seaBox() {
  const st = seaStatus();
  if (st.state === 'warn') return `<div class="sea-box warn"><b>⚠ 警報：你已經是${Y[st.yr].name}了</b>${st.boyaLeft ? `博雅還差 <b style="display:inline">${st.boyaLeft}</b> 學分（需 ${st.boyaNeed}）。` : ''}${st.crossOK ? '' : `剩下的 ${st.crossMax} 學分選修空間還沒安排：可修跨域選修，或多修系選修補滿。`}${CO.year === 115 ? '115 學年度另須完成「跨域能力」（輔系、雙主修或學程）。' : ''}</div>`;
  if (st.state === 'ok') return `<div class="sea-box ok"><b>🌼 安全！</b>博雅已修滿，跨域／選修空間也有安排。</div>`;
  return `<div class="sea-box idle"><b>🌊 提醒</b>從大二開始，如果博雅還沒修滿、跨域也還沒規劃，這片外海會開始閃紅燈。現在就可以先看下面的建議。</div>`;
}

function buildCarpet(slots, grp) {
  const seq = slots.filter(s => s.course).sort((a, b) => (b.k - a.k) || (a.i - b.i));
  const pts = seq.map(s => grp.worldToLocal(new THREE.Vector3(s.world.x, s.top + .06, s.world.z + .62)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .3), 300, .07, 5, false), mat('#c0392b', { emissive: '#5a0d0d', emissiveIntensity: .3 }));
  tube.castShadow = true; grp.add(tube);
}
function addLogoSign(grp, z) {
  const dark = '#2b2622', wood = '#6b4a1d';
  const face = new THREE.MeshBasicMaterial({ map: logoTexture('sign') });
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, .08), [mat(dark), mat(dark), mat(dark), mat(dark), face, mat(dark)]);
  board.position.y = 1.6; board.castShadow = true;
  const sign = G(board, Cy(.07, .08, 1.7, wood, -1.25, .85, -.06, 8), Cy(.07, .08, 1.7, wood, 1.25, .85, -.06, 8),
    B(3.32, .07, .12, gold(), 0, 2.42, 0), B(3.32, .07, .12, gold(), 0, .78, 0), ...[-1, 0, 1].map(x => R(Co(.09, .2, glow('#fff3b0'), x, 2.6, .12, 8), .5, 0, 0)));
  sign.userData.url = F.meta.deptUrl;
  sign.position.set(0, .13, z);
  grp.add(sign); pickables.push(sign);
}

/* ───────────── 主角：走路與滑翔 ───────────── */
const hero = buildCharacter();
hero.root.scale.setScalar(.52);
const heroRing = new THREE.Mesh(new THREE.RingGeometry(.32, .42, 24), new THREE.MeshBasicMaterial({ color: '#F3C623', transparent: true, opacity: .85 }));
heroRing.rotation.x = -Math.PI / 2;
const heroWrap = G(hero.root, heroRing);
scene.add(heroWrap);
let heroIsl = 'port';
const mover = { mode: null };

function groundAt(x, z, fallback) {
  let best = null, bd = 1e9;
  TILES.forEach(t => { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } });
  return best && bd < .9 ? best.top : fallback;
}
function spotFor(id) {
  const b = BLD[id]; if (!b) return null;
  const x = b.base.x + .2, z = b.base.z + .66;
  return new THREE.Vector3(x, groundAt(x, z, b.base.y), z);
}
// 同一座島用走的，換島搭滑翔翼
function moveHeroTo(id, instant) {
  const target = spotFor(id); if (!target) return Promise.resolve(false);
  const isl = BLD[id].island;
  const wasGliding = mover.mode === 'glide';
  if (mover.resolve) mover.resolve(false);
  mover.resolve = null;
  if (instant) { heroWrap.position.copy(target); heroIsl = isl; mover.mode = null; hero.glider.g.visible = false; return Promise.resolve(true); }
  const from = heroWrap.position.clone(), d = Math.hypot(target.x - from.x, target.z - from.z);
  heroWrap.rotation.y = Math.atan2(target.x - from.x, target.z - from.z);
  return new Promise(res => {
    if (isl === heroIsl && !wasGliding) Object.assign(mover, { mode: 'walk', from, to: target, island: isl, t0: performance.now(), dur: Math.max(350, d / 2.6 * 1000) / SPEED, resolve: res });
    else { Object.assign(mover, { mode: 'glide', from, to: target, island: isl, t0: performance.now(), dur: Math.min(3800, 1300 + d * 70) / SPEED, h: 3 + d * .1, resolve: res }); hero.glider.g.visible = true; AU.play('glide'); }
    // 保險：分頁在背景時動畫會暫停，時間到就直接抵達，播放不會卡住
    const r = mover.resolve;
    setTimeout(() => { if (mover.resolve === r && mover.mode) { heroWrap.position.copy(mover.to); heroIsl = mover.island; hero.glider.g.visible = false; mover.mode = null; mover.resolve = null; r(true); } }, mover.dur + 600);
  });
}
function stepMover(now, t) {
  hero.legL.rotation.x = hero.legR.rotation.x = 0;
  hero.root.rotation.x = 0;
  if (!mover.mode) return;
  const k = Math.min(1, (now - mover.t0) / mover.dur);
  const p = heroWrap.position;
  if (mover.mode === 'walk') {
    p.x = mover.from.x + (mover.to.x - mover.from.x) * k; p.z = mover.from.z + (mover.to.z - mover.from.z) * k;
    const g = groundAt(p.x, p.z, mover.to.y); p.y += (g - p.y) * .35;
    const sw = Math.sin(t * 14) * .6; hero.legL.rotation.x = sw; hero.legR.rotation.x = -sw;
    hero.root.position.y = Math.abs(Math.sin(t * 14)) * .05;
  } else {
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    p.lerpVectors(mover.from, mover.to, e);
    p.y += Math.pow(Math.sin(Math.PI * k), .7) * mover.h;
    hero.root.rotation.x = .18; hero.legL.rotation.x = .5; hero.legR.rotation.x = .35;
    hero.glider.g.rotation.z = Math.sin(t * 2.6) * .07;
  }
  if (k >= 1) {
    p.copy(mover.to);
    heroIsl = mover.island;
    if (mover.mode === 'glide') { hero.glider.g.visible = false; AU.play('land'); }
    mover.mode = null; const r = mover.resolve; mover.resolve = null; r && r(true);
  }
}

/* ───────────── 肖像（一個畫布，在左上角與圖鑑之間搬家） ───────────── */
const pCanvas = document.createElement('canvas');
const pRenderer = new THREE.WebGLRenderer({ canvas: pCanvas, antialias: true, alpha: true });
pRenderer.setPixelRatio(Math.min(devicePixelRatio, 2)); pRenderer.shadowMap.enabled = true;
const pScene = new THREE.Scene();
const pSun = addLights(pScene, true, 3); pSun.position.set(-3, 6, 5); pSun.shadow.mapSize.set(1024, 1024);
const pCam = new THREE.PerspectiveCamera(30, 1, .1, 50);
const portrait = buildCharacter();
const pedestal = G(Cy(1.15, 1.2, .16, '#efe0c2', 0, -.08, 0, 6), Cy(1.22, 1.26, .06, '#d9c29a', 0, -.19, 0, 6));
pedestal.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
const pRoot = G(portrait.root, pedestal); pScene.add(pRoot);
let yaw = 0, drag = null;
pCanvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: yaw }; pCanvas.setPointerCapture(e.pointerId); });
pCanvas.addEventListener('pointermove', e => { if (drag) yaw = drag.y + (e.clientX - drag.x) * .012; });
pCanvas.addEventListener('pointerup', () => drag = null);
function mountPortrait(slot) { slot.appendChild(pCanvas); resizePortrait(); }
function resizePortrait() {
  const r = pCanvas.parentElement ? pCanvas.parentElement.getBoundingClientRect() : { width: 100, height: 100 };
  pRenderer.setSize(r.width, r.height, false);
  pCam.aspect = r.width / Math.max(1, r.height); pCam.updateProjectionMatrix();
  const big = r.height > 200;
  pCam.position.set(0, big ? 1.2 : 1.15, big ? 5.4 : 4.6); pCam.lookAt(0, big ? 1.0 : 1.05, 0);
}

/* ───────────── 標籤 ───────────── */
const labelsEl = $('#labels');
F.ISLANDS.forEach(isl => {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'isl-label'; el.dataset.island = isl.id;
  // 指標點擊由地圖統一判斷，拖曳即使從標籤開始也不會誤開課程。
  el.addEventListener('click', e => { if (e.detail === 0) { AU.play('click'); openIsland(isl.id, true); } });
  labelsEl.appendChild(el); isl.el = el;
});
const yrLabels = [1, 2, 3, 4].map(y => { const el = document.createElement('div'); el.className = 'yr-label'; el.style.background = Y[y].tile; el.textContent = `${Y[y].em} ${Y[y].name} ${Y[y].label}`; labelsEl.appendChild(el); return { el, y }; });
let cLabels = {}, stopLabels = [];
function clearCourseLabels() { Object.values(cLabels).forEach(e => e.remove()); cLabels = {}; }
const tmpV = new THREE.Vector3();
function toScreen(v) { tmpV.copy(v).project(camera); return { x: (tmpV.x + 1) / 2 * innerWidth, y: (1 - tmpV.y) / 2 * innerHeight, vis: tmpV.z < 1 }; }
function place(el, v) { const p = toScreen(v); el.style.display = p.vis ? '' : 'none'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }

function updateLabels() {
  if (!CO) return;
  const dist = camera.position.distanceTo(controls.target);
  F.ISLANDS.forEach(isl => { const o = ISLAND_OBJ[isl.id]; if (o) place(isl.el, tmpV.clone().copy(o.center).setY(o.top)); });
  const main = ISLAND_OBJ.main, nearMain = dist < 34 && controls.target.distanceTo(main.center) < 14;
  yrLabels.forEach(({ el, y }) => {
    if (!nearMain) { el.style.display = 'none'; return; }
    const k = 5 - y, s = main.slots.filter(s => s.k === k).reduce((m, s) => s.world.z > m.world.z ? s : m);
    place(el, new THREE.Vector3(s.world.x + 1.1, s.top + .3, s.world.z + .4));
  });
  const near = dist < 26;
  Object.keys(BLD).forEach(id => {
    const c = BY[id]; if (!c) return;
    const b = BLD[id];
    const show = near && b.base.distanceTo(controls.target) < 9 && visibleCourse(c);
    if (!show) { if (cLabels[id]) cLabels[id].style.display = 'none'; return; }
    const el = cLabels[id] || (cLabels[id] = Object.assign(document.createElement('div'), { className: 'c-label' }));
    if (!el.parentNode) labelsEl.appendChild(el);
    place(el, tmpV.clone().copy(b.base).setY(b.base.y + 1.05));
    const txt = (DONE().has(id) ? '✓ ' : Y[c.y].em + ' ') + c.name;
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle('done', DONE().has(id));
  });
  stopLabels.forEach(s => place(s.el, s.v));
}
function refreshIslandLabels() {
  F.ISLANDS.forEach(isl => {
    const list = islandCourses(isl.id);
    const vis = list.filter(visibleCourse);
    const done = list.filter(c => DONE().has(c.id)).length;
    let sub = isl.id === 'sea' ? `博雅 ${PR().boya}・跨域 ${PR().cross}` : `${done}/${list.length} 門・${isl.sub}`;
    if (isl.role) sub = `選修 ${done}/${list.length} 門・核心必修 ${coreReq(isl.role).length} 門`;
    if ((S.year || S.route) && isl.id !== 'sea') sub = `${S.route ? ROLE[S.route].name + '路線' : ''}${S.year ? Y[S.year].em + Y[S.year].name : ''} ${vis.length} 門`;
    isl.el.innerHTML = `<span class="dot" style="background:${isl.color}"></span>${esc(isl.name)}<small>${esc(sub)}</small>`;
    isl.el.classList.toggle('dim', (!!S.year || !!S.route) && isl.id !== 'sea' && !vis.length);
    if (isl.id === 'sea' && SEA) {
      const st = seaStatus();
      isl.el.classList.toggle('warn', st.state === 'warn'); isl.el.classList.toggle('ok', st.state === 'ok');
      if (st.state === 'warn') isl.el.innerHTML = `⚠ ${esc(isl.name)}<small>${st.boyaLeft ? `博雅還差 ${st.boyaLeft} 學分` : '跨域還沒規劃'}・點我看看</small>`;
      if (st.state === 'ok') isl.el.innerHTML = `🌼 ${esc(isl.name)}<small>博雅・跨域都安排好了</small>`;
    }
  });
}

/* ───────────── 地圖狀態：旗子、篩選、路線 ───────────── */
const visibleCourse = c => {
  if (!S.route) return yearMatch(c, S.year);
  const t = TRACK[S.route];
  return t.routeCodes.has(c.id) && (!S.year || t.routeYear[c.id] === S.year);
};
function refreshGradHub() {
  const b = BLD.A19034, hub = b && b.grp.userData.grad; if (!hub) return;
  const gates = primaryGradGates();
  hub.gates.forEach((p, i) => {
    const done = !!(gates[i] && gates[i].done), light = p.userData.light, col = done ? '#42b867' : '#8b8172';
    light.material.color.set(col); light.material.emissive.set(col); light.material.emissiveIntensity = done ? 1.2 : .12;
    light.scale.setScalar(done ? 1.3 : .85);
  });
  const done = graduated();
  hub.crown.visible = done; hub.halo.visible = done;
  hub.cupParts.forEach(o => {
    const m = o.material; m.color.set(done ? '#F3C623' : '#b99b55');
    if (m.emissive) { m.emissive.set(done ? '#8b6200' : '#2b2622'); m.emissiveIntensity = done ? .55 : .08; }
  });
}
function refreshWorld() {
  Object.keys(BLD).forEach(id => {
    const c = BY[id]; if (!c) return;
    const g = BLD[id].grp, on = visibleCourse(c), inRoute = S.route && TRACK[S.route].routeCodes.has(id);
    g.userData.flag.visible = DONE().has(id);
    const core = !S.route && LINK.ids.has(id);
    g.userData.ring.visible = (!!inRoute && on) || core;
    const rc = inRoute ? Y[TRACK[S.route].routeYear[id]].color : core ? ROLE[LINK.role].color : null;
    if (rc) { g.userData.ring.material.color.set(rc); g.userData.ring.material.emissive.set(rc); }
    g.traverse(o => {
      if (!o.isMesh || o === g.userData.ring) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.transparent = !on; m.opacity = on ? 1 : .2; m.depthWrite = on; });
    });
    g.scale.setScalar(S.sel && S.sel.type === 'course' && S.sel.id === id ? 1.18 : 1);
  });
  refreshGradHub();
}
const routeGroup = new THREE.Group(); scene.add(routeGroup);
// 職務島 ↔ 核心必修：選到職務島（或某門核心必修）時，一串彩色小珠從島上的地標飛到主島那幾棟建築
const linkGroup = new THREE.Group(); scene.add(linkGroup);
const LINK = { role: null, ids: new Set() };
function drawLinks() {
  linkGroup.children.slice().forEach(o => { linkGroup.remove(o); o.geometry && o.geometry.dispose(); });
  LINK.role = null; LINK.ids = new Set();
  if (S.route || !S.sel || !CO) return;
  let role = null, ids = [];
  if (S.sel.type === 'island' && ISL[S.sel.id] && ISL[S.sel.id].role) { role = ISL[S.sel.id].role; ids = coreReq(role).map(c => c.id); }
  else if (S.sel.type === 'course' && BY[S.sel.id] && isReq(BY[S.sel.id])) { role = gearOf(S.sel.id).role; ids = role ? [S.sel.id] : []; }
  if (!role || !ISLAND_OBJ[role]) return;
  LINK.role = role; LINK.ids = new Set(ids);
  const col = ROLE[role].color, from = ISLAND_OBJ[role].center.clone().setY(3.1);
  const bead = new THREE.SphereGeometry(.1, 8, 6), m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .6 });
  ids.forEach(id => {
    const b = BLD[id]; if (!b) return;
    const to = b.base.clone().setY(b.base.y + 1.1), mid = from.clone().add(to).multiplyScalar(.5);
    mid.y = Math.max(from.y, to.y) + 2.5 + from.distanceTo(to) * .12;
    new THREE.QuadraticBezierCurve3(from, mid, to).getSpacedPoints(Math.round(from.distanceTo(to) * 1.6)).forEach((p, i) => {
      const s = new THREE.Mesh(bead, m); s.position.copy(p); s.userData.bead = i; linkGroup.add(s);
    });
  });
}
const routeStops = r => TRACK[r].route.filter(s => BLD[s.id]);
// 播放用的完整步驟：每年先修必修與職務選修，再去外海修博雅、跨域，最後是畢業門檻
function tourSteps(rid) {
  const plan = creditPlan(rid), out = [];
  for (let y = 1; y <= 4; y++) {
    const yr = routeStops(rid).filter(s => s.y === y);
    out.push(...yr.filter(s => s.phase !== 'gate'));
    if (plan.boya[y] && BLD.BOYA) out.push({ id: 'BOYA', y, phase: 'boya', n: plan.boya[y], sea: true });
    if (plan.cross[y] && BLD.CROSS) out.push({ id: 'CROSS', y, phase: 'cross', n: plan.cross[y], sea: true });
    out.push(...yr.filter(s => s.phase === 'gate'));
  }
  return out;
}
function drawRoute() {
  routeGroup.children.slice().forEach(o => { routeGroup.remove(o); o.geometry && o.geometry.dispose(); });
  stopLabels.forEach(s => s.el.remove()); stopLabels = [];
  if (!S.route) return;
  const stops = routeStops(S.route).filter(s => !S.year || s.y === S.year);
  stops.forEach((s, i) => {
    const b = BLD[s.id];
    const el = document.createElement('div'); el.className = 'stop-label' + (s.req ? '' : ' ele'); el.textContent = i + 1; el.style.background = Y[s.y].color;
    labelsEl.appendChild(el); stopLabels.push({ el, v: b.base.clone().setY(b.base.y + 1.45).add(new THREE.Vector3(-.35, 0, 0)) });
    if (!i) return;
    const a = BLD[stops[i - 1].id], A = a.base.clone().setY(a.base.y + .95), Bv = b.base.clone().setY(b.base.y + .95);
    const d = A.distanceTo(Bv), same = a.island === b.island;
    const M = A.clone().add(Bv).multiplyScalar(.5); M.y = Math.max(A.y, Bv.y) + (same ? .5 + d * .08 : 3 + d * .12);
    const curve = new THREE.QuadraticBezierCurve3(A, M, Bv);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, same ? 20 : 48, s.req ? (same ? .045 : .06) : (same ? .07 : .085), 6, false),
      new THREE.MeshStandardMaterial({ color: Y[s.y].color, emissive: Y[s.y].color, emissiveIntensity: .45, transparent: true, opacity: .9 }));
    routeGroup.add(tube);
    const tip = Co(.13, .3, new THREE.MeshStandardMaterial({ color: Y[s.y].color, emissive: Y[s.y].color, emissiveIntensity: .5 }), 0, 0, 0, 8);
    tip.position.copy(curve.getPoint(.92)); tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(.92));
    routeGroup.add(tip);
  });
}

/* ───────────── 鏡頭 ───────────── */
let fly = null, follow = false;
function flyTo(target, dist, pos) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const eT = target.clone(), eP = pos ? pos.clone() : eT.clone().add(dir.multiplyScalar(dist));
  if (eP.y < 6) eP.y = 6;
  fly = { t0: performance.now(), dur: 900, sT: controls.target.clone(), sP: camera.position.clone(), eT, eP };
}
function homePosition() {
  const aspect = innerWidth / innerHeight;
  const distance = innerWidth <= 900 ? Math.max(70, 34 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect)) : 70;
  controls.maxDistance = Math.max(120, distance * 1.25);
  scene.fog.near = Math.max(90, distance + 20); scene.fog.far = Math.max(190, distance + 140);
  return HOME.p.clone().sub(HOME.t).normalize().multiplyScalar(distance).add(HOME.t);
}
const flyHome = () => flyTo(HOME.t, 0, homePosition());

/* ───────────── UI：左上角色 ───────────── */
function roleRows(L, look) {
  return F.ROLES.map(r => { const o = L[r.id];
    return `<div class="role-row ${look === r.id ? 'on' : ''}" data-look="${r.id}"><span class="ic">${r.icon}</span><span class="nm">${r.name}</span>
      <span class="lv">${o.lv ? r.titles[o.lv - 1] + ' Lv' + o.lv : `${o.done}/${o.total}`}</span>
      <div class="bar"><i style="width:${Math.round(o.f * 100)}%;background:${r.color}"></i></div></div>`; }).join('');
}
function lookChips(L, look) {
  return `<button class="chip ${look === 'auto' ? 'on' : ''}" data-look="auto">✨ 混搭</button>` +
    F.ROLES.map(r => `<button class="chip ${look === r.id ? 'on' : ''}" data-look="${r.id}" ${L[r.id].done ? '' : 'disabled'} title="${esc(r.name)}">${r.icon} ${r.name.replace('組', '')}</button>`).join('') +
    `<button class="chip ${look === 'grad' ? 'on' : ''}" data-look="grad" ${graduated() ? '' : 'disabled'} title="完成畢業資格後解鎖">🎓 畢業</button>`;
}
function titleFor(L, look, primary) {
  const nm = '你';
  if (S.preview) return [`👀 ${ROLE[S.preview].titles[2]}`, `預覽：照${ROLE[S.preview].name}路線修完的樣子`];
  if (look === 'grad') return ['🎓 畢業啦', `${nm}完成 128 學分，帶著作品離島。`];
  if (!primary) return [`${CO.year} 新生`, `${nm}剛到入學港，背包裡只有學生證。`];
  const r = ROLE[primary], o = L[primary], rk = ranked(L);
  const others = rk.filter(x => x.id !== primary).slice(0, 2).map(x => ROLE[x.id].titles[L[x.id].lv - 1]);
  return [`${r.titles[o.lv - 1]}<small>${r.name} Lv${o.lv}</small>`, others.length ? `也是：${others.join('、')}` : `${nm}的第一個身分`];
}
function renderHero() {
  const L = levels();
  if (ROLE[S.look] && !L[S.look].done) S.look = 'auto';
  if (S.look === 'grad' && !graduated()) S.look = 'auto';
  let primary;
  if (S.preview) {
    const done = new Set([...DONE(), ...TRACK[S.preview].codes, ...CO.courses.filter(c => c.cat === 'req').map(c => c.id)]);
    dress(portrait, S.preview, done); primary = dress(hero, S.look);
  } else { primary = dress(hero, S.look); dress(portrait, S.look); }
  const [t, sub] = titleFor(L, S.look, primary);
  $('#heroTitle').innerHTML = t; $('#heroSub').textContent = sub;
  $('#looks').innerHTML = lookChips(L, S.look);
  $('#roles').innerHTML = roleRows(L, S.look);
  if ($('#gearPage').classList.contains('show')) renderGearPage();
}
function onLookClick(e) {
  const l = e.target.closest('[data-look]');
  if (!l || l.disabled) return false;
  if (S.look !== l.dataset.look) AU.play('shimmer');
  S.look = l.dataset.look; S.preview = null; save(); renderHero(); return true;
}
$('#hero').addEventListener('click', e => { if (e.target.closest('[data-reset]')) return resetFreshman(); if (e.target.closest('#heroToggle')) { $('#hero').classList.toggle('open'); $('#heroToggle').textContent = $('#hero').classList.contains('open') ? '收起 ▴' : '職能與造型 ▾'; return; } onLookClick(e); });

/* ───────────── UI：道具圖鑑 ───────────── */
function renderGearPage() {
  const L = levels(), done = DONE();
  const [t, sub] = titleFor(L, S.look, lookItems(S.look).primary);
  $('#gpTitle').innerHTML = t; $('#gpSub').textContent = sub;
  $('#gpLooks').innerHTML = lookChips(L, S.look);
  $('#gpRoles').innerHTML = roleRows(L, S.look);
  const groups = [{ id: null, name: '共同與通識', icon: '🌍', color: '#7C93AE' }, ...F.ROLES];
  const got = CO.courses.filter(c => done.has(c.id)).length;
  $('#gpCount').textContent = `${CO.year} 學年度｜已收集 ${got} / ${CO.courses.length}`;
  $('#gpBody').innerHTML = groups.map(gr => {
    const list = CO.courses.filter(c => (gearOf(c.id).role || null) === gr.id).sort((a, b) => a.y - b.y);
    if (!list.length) return '';
    const n = list.filter(c => done.has(c.id)).length;
    return `<div class="gsec"><h3><span style="color:${gr.color}">${gr.icon}</span>${gr.name}<small>${n} / ${list.length}</small></h3><div class="ggrid">` +
      list.map(c => { const g = gearOf(c.id), has = done.has(c.id);
        return `<button class="gcard ${has ? '' : 'lock'}" data-course="${c.id}" title="${esc(c.name)}"><span class="y">${Y[c.y].em}</span><div class="e">${g.e}</div><b>${has ? esc(g.n) : '？？？'}</b><span>${esc(c.name)}</span><span>${g.slot ? SLOT_NAME[g.slot] : '背包徽章'}</span></button>`; }).join('') + '</div></div>';
  }).join('') + `<p class="note">裝備是本地圖的設計詮釋，用來表現修課後漸漸像哪一行的人。${CREDIT}</p>`;
}
function openGearPage() { $('#gearPage').classList.add('show'); mountPortrait($('#gearPortrait')); renderGearPage(); AU.play('click'); }
function closeGearPage() { $('#gearPage').classList.remove('show'); mountPortrait($('#heroPortrait')); }
$('#gearBtn').addEventListener('click', openGearPage);
$('#gpClose').addEventListener('click', closeGearPage);
$('#gearPage').addEventListener('click', e => {
  if (onLookClick(e)) return;
  const c = e.target.closest('[data-course]');
  if (c) { closeGearPage(); select({ type: 'course', id: c.dataset.course }, true); }
});

/* ───────────── UI：右側抽屜 ───────────── */
const drawer = $('#drawer');
// 同一個畫面重畫（例如勾了一門課、播放中又修了一門）時保留捲動位置；換到別的畫面才回到頂端
let drawerKey = '';
function openDrawer(html) {
  const key = JSON.stringify(S.sel), top = drawer.scrollTop;
  drawer.innerHTML = `<button class="close" data-x aria-label="關閉">×</button>` + html;
  drawer.classList.add('open');
  drawer.scrollTop = key === drawerKey ? top : 0;
  drawerKey = key;
  document.body.classList.add('drawer-open'); updateMapViewport();
}
function closeDrawer() { drawer.classList.remove('open'); document.body.classList.remove('drawer-open'); updateMapViewport(); S.sel = null; drawerKey = ''; drawLinks(); refreshWorld(); }
const termText = c => c.gate ? '畢業門檻' : c.t === '上下' ? '上下學期皆可能開課' : c.t + '學期';
const courseChip = id => { const c = BY[id]; return `<button data-course="${id}" class="${DONE().has(id) ? 'done' : ''}">${DONE().has(id) ? '✓' : Y[c.y].em} ${esc(c.name)}</button>`; };
function gradGateCard(x) {
  const attr = x.type === 'course' ? `data-toggle="${x.key}"` : `data-check="${esc(x.key)}"`;
  return `<label class="gate-card ${x.done ? 'done' : ''}"><span class="gi">${gateIcon(x.label)}</span><span><b>${x.done ? '已通過' : '必須完成'}</b>${esc(x.label)}</span><input type="checkbox" ${attr} ${x.done ? 'checked' : ''}></label>`;
}
function gradSanctum() {
  const p = PR(), cr = credits(), grad = graduated(cr), gates = gradGateItems();
  const c1 = BY.A19033, c2 = BY.A19034;
  const courseCard = c => `<label class="grad-course ${p.done.has(c.id) ? 'done' : ''}"><input type="checkbox" data-toggle="${c.id}" ${p.done.has(c.id) ? 'checked' : ''}><b>${p.done.has(c.id) ? '✅' : '⬜'} ${esc(c.name)}</b>${c.t === '上' ? '大四上學期' : '大四下學期'}・${c.cr} 學分</label>`;
  const role = gradRole(), ready = gates.filter(x => x.done).length;
  return `<section class="grad-sanctum ${grad ? 'complete' : ''}">
    <div class="grad-crown">♛</div>
    <div class="grad-title"><b>島心・畢業成果殿堂</b><span>兩門大四總結課＋職務型作品＋畢業門檻，全部在這裡集結</span></div>
    <div class="grad-work"><small>以你的職務為核心的畢業作品</small><b>${role ? role.icon + ' ' : ''}${esc(gradWorkLabel())}</b>
      <div class="work-types">${GRAD_WORKS.map(w => `<button class="${p.work === w.id ? 'on' : ''}" data-work="${w.id}">${w.icon} ${w.name}</button>`).join('')}</div></div>
    <div class="grad-courses">${courseCard(c1)}${courseCard(c2)}</div>
    <div class="grad-gate-title">三道畢業門與本屆檢核 <span>${ready} / ${gates.length} 通過</span></div>
    <div class="gate-grid">${gates.map(gradGateCard).join('')}</div>
    <div class="grad-state">${grad ? '🏆 全部完成：島心桂冠已升起' : `🔒 桂冠尚未解鎖・目前 ${cr.total} / 128 學分`}</div>
  </section>`;
}

function renderSide() {
  const s = S.sel;
  if (!s) return;
  if (s.type === 'course') renderCourse(BY[s.id]);
  else if (s.type === 'island') s.id === 'sea' ? renderSea() : renderIsland(ISL[s.id]);
  else if (s.type === 'pass') renderPassport();
  else if (s.type === 'route') renderRoute(s.id);
}
function renderCourse(c) {
  if (c.id === 'A19034') return renderGradHub();
  const g = gearOf(c.id), role = g.role ? ROLE[g.role] : null, col = role ? role.color : '#7C93AE';
  const done = DONE().has(c.id);
  const by = F.ROLES.filter(r => TRACK[r.id].codes.has(c.id));
  openDrawer(`<div class="code">${c.id}・${esc(ISL[BLD[c.id] ? BLD[c.id].island : 'main'].name)}</div>
    <h2>${esc(c.name)}</h2><div class="stripe" style="background:${Y[c.y].color}"></div>
    <div class="meta">${ytag(c.y)}${(c.alsoY || []).map(ytag).join('')}<span class="tag c" style="background:${c.cat === 'ele' ? '#6b6157' : '#2b2622'}">${CAT_TAG[c.cat]}</span>
      <span class="tag">${c.cr} 學分</span><span class="tag">${termText(c)}</span></div>
    ${c.note ? `<p class="note" style="margin-top:4px">📌 ${esc(c.note)}</p>` : ''}
    <div class="gear-box"><div class="em">${g.e}</div><div><b>${esc(g.n)}</b><span>修完獲得・${g.slot ? '穿戴在' + SLOT_NAME[g.slot] : '收進背包（徽章）'}</span></div></div>
    <button class="big-btn" style="background:${done ? '#eee3d0' : col};color:${done ? '#2b2622' : '#fff'}" data-toggle="${c.id}">${done ? '✓ 已修過（點一下取消）' : '標記為已修，拿裝備'}</button>
    ${isReq(c) && role && ISL[role.id] ? `<div class="core-box" style="border-color:${role.color}"><span>${role.icon}</span><div><b>${esc(ROLE[role.id].island)}的核心必修</b>這門必修開在${esc(ISL[BLD[c.id] ? BLD[c.id].island : 'main'].name)}，是${esc(role.name)}最重要的基礎資源之一。</div><button class="btn" data-island="${role.id}">去看看</button></div>` : ''}
    <h3>哪些職務推薦這門課</h3>
    <div class="links">${by.length ? by.map(r => `<button data-route="${r.id}">${r.icon} ${r.name}・${Y[TRACK[r.id].rowOf[c.id]].name}</button>`).join('') : '<span class="note" style="margin:0">養成研究中未特別列出，可依興趣選修。</span>'}</div>
    <p class="note">課程代碼、學分、年級學期依 ${CO.year} 學年度四年課程計畫；推薦職務依 ${CO.year} 學年度《電影職務四年課程養成研究》。課程內容請查閱<a href="${F.meta.planUrl}" target="_blank" rel="noopener">系上四年課程計畫</a>與課程大綱。</p>`);
}
function renderGradHub() {
  openDrawer(`<div class="code">❄️ 大四・全島最終集結點</div><h2>🏆 畢業成果殿堂</h2><div class="stripe" style="background:linear-gradient(90deg,#5E9CD8,#F3C623,#3E9B57)"></div>
    <p style="font-size:13px;line-height:1.7;margin:5px 0 8px">這不是單獨一門課，而是四年養成的島心：完成大四上的《畢業創作》、大四下的《畢業展演》，交出以主職務為核心的短片、論文或劇本，並通過本屆全部畢業檢核，才能戴上桂冠。</p>
    ${gradSanctum()}
    <div class="row-btns"><button class="btn" data-pass>🧾 查看完整學分護照</button></div>
    <p class="note">作品形式是生涯規劃標記，不取代系上正式的畢業製作規範。畢業資格與學分採計仍以學校最新公告及<a href="${CO.pdf}" target="_blank" rel="noopener">${CO.year} 學年度課程計畫</a>為準。</p>${CREDIT}`);
}
function islandRoleIntro(isl) {
  const r = ROLE[isl.role], t = TRACK[r.id];
  return `<p style="font-size:13px;line-height:1.7;margin:4px 0">${esc(t.intro)}</p>
    <div class="row-btns"><button class="btn dark" data-route="${r.id}">🗺 看${r.name}四年路線</button></div>`;
}
function renderIsland(isl) {
  const list = islandCourses(isl.id);
  const cr = list.reduce((a, c) => a + c.cr, 0), crDone = list.filter(c => DONE().has(c.id)).reduce((a, c) => a + c.cr, 0);
  let intro = '';
  if (isl.id === 'main') intro = `<p style="font-size:13px;line-height:1.7">系必修 50 學分。紅毯從外圈的 🌸 大一，繞過 🌿 大二、🍁 大三，一路走上山頂 ❄️ 大四的島心畢業成果殿堂。</p>
    <div class="core-box" style="border-color:#c8941d;background:#fff9df"><span>🏆</span><div><b>島心是四年的集結點</b>《畢業創作》＋《畢業展演》＋職務型畢業作品＋全部畢業檢核，完成後升起桂冠。</div><button class="btn" data-course="A19034">進入殿堂</button></div>`;
  else if (isl.id === 'port') intro = `<p style="font-size:13px;line-height:1.7">每位新生都從這裡上岸：通識核心 ${CO.credits.find(k => k.k === 'gen').need} 學分，大一、大二修完。</p>`;
  else if (isl.id === 'college') intro = '<p style="font-size:13px;line-height:1.7">傳播與設計學院的院必修，大一修完。數位繪圖與色彩學也是攝影、美術與調光的起點。</p>';
  else intro = islandRoleIntro(isl);
  const years = [1, 2, 3, 4].filter(y => list.some(c => c.y === y));
  const core = isl.role ? coreReq(isl.role) : [];
  const coreDone = core.filter(c => DONE().has(c.id)).reduce((a, c) => a + c.cr, 0), coreCr = core.reduce((a, c) => a + c.cr, 0);
  const coreHtml = core.length ? `<div class="core-list" style="border-color:${isl.color}">
      <h4>📌 核心必修・開在${[...new Set(core.map(c => ISL[BLD[c.id] ? BLD[c.id].island : 'main'].name))].join('、')}（每個人都要修）<small>${coreDone} / ${coreCr} 學分</small></h4>
      <p>這些必修不在這座島，但它們是這個職務最重要的基礎；地圖上那串 ${ROLE[isl.role].icon} 色小珠就是連到它們。</p>
      <ul class="clist">${core.map(c => courseLi(c, false, true)).join('')}</ul></div>` : '';
  openDrawer(`<div class="code">${esc(isl.sub)}</div><h2>${esc(isl.name)}</h2><div class="stripe" style="background:${isl.color}"></div>${intro}
    ${coreHtml}
    <div class="prog"><div class="row"><span>${isl.role ? '這座島的選修已修' : '這座島已修'}</span><b>${crDone} / ${cr} 學分</b></div><div class="track"><i style="width:${cr ? crDone / cr * 100 : 0}%;background:${isl.color}"></i></div></div>
    ${years.map(y => `<div class="yblock" style="border-color:${Y[y].color};background:${Y[y].tile}55"><h4><span>${Y[y].em} ${Y[y].name}</span></h4><ul class="clist">${list.filter(c => c.y === y).map(c => courseLi(c, false, !isl.role)).join('')}</ul></div>`).join('')}`);
}
const CAT_SHORT = { gen: '通識必修', col: '院必修', cole: '院選修', req: '系必修', ele: '系選修' };
function courseLi(c, star, badge) {
  const ele = c.cat === 'ele' || c.cat === 'cole', gr = gearOf(c.id).role;
  const bd = badge && gr && isReq(c) ? ` <span class="rb" style="background:${ROLE[gr].color}" title="${ROLE[gr].island}的核心必修">${ROLE[gr].icon}</span>` : '';
  return `<li><input type="checkbox" data-toggle="${c.id}" ${DONE().has(c.id) ? 'checked' : ''} aria-label="已修 ${esc(c.name)}"><span>${gearOf(c.id).e}</span>
    <span class="nm" data-course="${c.id}">${esc(c.name)}${star ? ' <span title="這個職務特別重視的必修">⭐</span>' : ''}${bd}</span><span class="req ${ele ? 'e' : ''}">${c.gate ? '畢業門檻' : CAT_SHORT[c.cat]}</span><span class="cr">${c.cr} 學分${c.t === '上' || c.t === '下' ? '・' + c.t : ''}</span></li>`;
}
function renderSea() {
  const p = PR(), boyaK = CO.credits.find(k => k.k === 'boya'), crossK = CO.credits.find(k => k.k === 'cross');
  openDrawer(`<div class="code">博雅選修・跨域選修</div><h2>博雅跨域外海</h2><div class="stripe" style="background:#6FB7C9"></div>${seaBox()}
    <p style="font-size:13px;line-height:1.7">這兩類學分沒有指定課號，在這裡記錄。養成研究強調：它們不是「非專業學分」，而是補足職務能力的地方。</p>
    <h3>📚 ${esc(boyaK.name)}（需 ${boyaK.need} 學分）</h3>
    <div class="stepper"><button data-step="boya" data-d="-1">−</button><b>${p.boya} / ${boyaK.need}</b><button data-step="boya" data-d="1">＋</button></div>
    <h3>⛴ ${esc(crossK.name)}（至多採計 ${crossK.need} 學分）</h3>
    <div class="stepper"><button data-step="cross" data-d="-1">−</button><b>${p.cross} 學分</b><button data-step="cross" data-d="1">＋</button></div>
    <div class="row-btns"><button class="btn" data-outer>ⓘ 外院、跨域學分怎麼算？</button></div>
    <h3>各職務怎麼選博雅與跨域（${CO.year} 學年度建議）</h3>
    <table class="sugg">${F.ROLES.map(r => `<tr><td>${r.icon} ${r.name}</td><td>📚 ${esc(TRACK[r.id].boya || '—')}<br>⛴ ${esc(TRACK[r.id].cross || '—')}</td></tr>`).join('')}</table>
    <p class="note">以上是能力領域建議，不是指定課名；請先確認外系課程能否認列、是否與通識重複計算。</p>`);
}
function renderPassport() {
  const cr = credits(), grad = graduated(cr);
  const row = k => { const v = cr[k.k], pct = Math.min(100, v / k.need * 100);
    return `<div class="prog ${k.kind === 'max' ? 'max' : ''}"><div class="row"><span>${esc(k.name)}</span><b>${v} ${k.kind === 'max' ? '（至多 ' + k.need + '）' : '/ ' + k.need}</b></div><div class="track"><i style="width:${pct}%"></i></div></div>`; };
  openDrawer(`<h2>🧾 學分護照</h2><p class="note" style="margin:0 0 10px">${CO.year} 學年度入學（${CO.entry}）・畢業 128 學分</p>
    <div class="total"><div class="num">${cr.total}<small> / 128</small></div><div style="font-size:12.5px;line-height:1.5">${grad ? '🎓 畢業資格全部達成！' : `還差 ${Math.max(0, 128 - cr.total)} 學分`}</div></div>
    ${seaStatus().state === 'warn' ? seaBox() + '<div class="row-btns"><button class="btn" data-island="sea">⛴ 去博雅跨域外海</button></div>' : ''}
    <h3>學分結構</h3>${CO.credits.map(row).join('')}
    <div class="row-btns"><button class="btn" data-step="boya" data-d="1">📚 博雅 +1</button><button class="btn" data-step="cross" data-d="1">⛴ ${CO.year <= 113 ? '其他' : '跨域'} +1</button></div>
    ${cr.cole ? `<p class="note" style="margin:0">院選修 ${cr.cole} 學分已計入系選修。</p>` : ''}
    <div class="row-btns"><button class="btn" data-outer>ⓘ 外院、跨域學分怎麼算？</button></div>
    ${gradSanctum()}
    <div class="row-btns"><button class="btn" data-reset>🔄 一鍵還原成 ${CO.year} 大一新生</button></div>
    <p class="note">畢業資格與學分採計以學校最新公告為準。官方課程計畫：<a href="${CO.pdf}" target="_blank" rel="noopener">${CO.year} 學年度 PDF</a></p>${CREDIT}`);
}
function renderRoute(rid) {
  const r = ROLE[rid], t = TRACK[rid], L = levels(), done = DONE();
  const sum = list => list.reduce((a, x) => a + BY[x.id].cr, 0), sumDone = list => sum(list.filter(x => done.has(x.id)));
  const reqs = t.route.filter(x => x.req), eles = t.route.filter(x => !x.req), plan = creditPlan(rid);
  const bar = (label, a, b, col) => `<div class="prog"><div class="row"><span>${label}</span><b>${a} / ${b} 學分</b></div><div class="track"><i style="width:${b ? a / b * 100 : 0}%;background:${col}"></i></div></div>`;
  openDrawer(`<div class="code">${CO.year} 學年度・職務路線</div><h2>${r.icon} ${esc(t.title)}</h2>
    <div class="stripe" style="background:${r.color}"></div>
    <div class="meta"><span class="tag c" style="background:${r.color}">${esc(r.sub)}</span><span class="tag">${L[rid].lv ? r.titles[L[rid].lv - 1] + ' Lv' + L[rid].lv : '尚未開始'}</span></div>
    <p style="font-size:13px;line-height:1.7;margin:6px 0">${esc(t.intro)}</p>
    <p class="note" style="margin:4px 0 8px">路線＝📌 每個人都要修的必修（通識、院、系）＋ 🎯 這個職務推薦的選修。⭐ 表示養成研究特別點名的必修。</p>
    ${bar('📌 必修已修', sumDone(reqs), sum(reqs), '#2b2622')}${bar(`🎯 ${r.name}推薦選修已修`, sumDone(eles), sum(eles), r.color)}
    ${bar('📚 通識博雅已修', PR().boya, plan.boyaNeed, '#6FB7C9')}
    <div class="plan128"><b>四年 128 學分怎麼湊</b>必修 ${plan.reqCr}＋職務選修 ${Math.max(plan.eleRoute, plan.eleMin)}${plan.eleShort ? `（推薦清單 ${plan.eleRoute}，再自選 ${plan.eleShort}）` : ''}＋📚 博雅 ${plan.boyaNeed}＋⛴ 跨域 ${plan.crossTotal}${plan.extraEle ? `＋多修系選修 ${plan.extraEle}` : ''} ＝ 128
      <button class="btn" data-outer>ⓘ 外院、跨域學分怎麼算？</button></div>
    <div class="row-btns"><button class="btn primary" data-tour>${tourRun ? '■ 停止播放' : '▶ 播放四年成長'}</button><button class="btn" data-preview="${rid}">${S.preview === rid ? '取消預覽' : '👀 預覽畢業造型'}</button></div>
    ${[1, 2, 3, 4].map(y => { const row = t.years.find(x => x.y === y), rq = reqs.filter(x => x.y === y), el = eles.filter(x => x.y === y);
      return `<div class="yblock" style="border-color:${Y[y].color};background:${Y[y].tile}66">
      <h4><span>${Y[y].em} ${Y[y].name}・${Y[y].label}</span><span style="font-weight:500;font-size:11.5px">${[...rq, ...el].filter(x => done.has(x.id)).length}/${rq.length + el.length} 已修</span></h4>
      ${rq.length ? `<div class="sub">📌 必修（每個人都要修）</div><ul class="clist">${rq.map(x => courseLi(BY[x.id], t.codes.has(x.id))).join('')}</ul>` : ''}
      ${el.length ? `<div class="sub">🎯 ${r.name}推薦選修</div><ul class="clist">${el.map(x => courseLi(BY[x.id])).join('')}</ul>` : ''}
      ${plan.boya[y] || plan.cross[y] ? `<div class="sub">🌊 博雅跨域外海</div><ul class="clist sea-plan">
        ${plan.boya[y] ? `<li><span>📚</span><span class="nm" data-island="sea">通識博雅・建議這年修 ${plan.boya[y]} 學分<small>${esc(t.boya || '人文與藝術、自然與科技、社會科學')}</small></span><span class="req e">博雅</span></li>` : ''}
        ${plan.cross[y] ? `<li><span>⛴</span><span class="nm" data-island="sea">跨院／跨系選修・這年可修 ${plan.cross[y]} 學分<small>${esc(t.cross || '外系或跨域學程')}</small></span><span class="req e">跨域</span></li>` : ''}</ul>` : ''}
      ${row ? `<div class="out">🏁 這一年要交出：${esc(row.outcome)}</div>` : ''}</div>`; }).join('')}
    <h3>📚 博雅建議（需 ${plan.boyaNeed} 學分）</h3><p style="font-size:12.5px;margin:0">${esc(t.boya || '—')}</p>
    <h3>⛴ 外系／跨域建議（至多採計 ${plan.crossMax} 學分）</h3><p style="font-size:12.5px;margin:0">${esc(t.cross || '—')}</p>
    ${t.extra.length ? `<h3>${esc(t.extraTitle)}</h3><ul style="font-size:12.5px;line-height:1.7;padding-left:18px;margin:0">${t.extra.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${t.supplement ? '<p class="note" style="background:#fff4d6;border-radius:8px;padding:6px 8px">🎨 系上養成研究沒有獨立的美術組章節；這條路線與每年的成果，是本地圖依課程計畫補充的建議。</p>' : ''}
    <p class="note">必修依 ${CO.year} 學年度四年課程計畫；推薦選修與階段成果依系上 ${CO.year} 學年度《電影職務四年課程養成研究》。選修是職能組合建議，不必全部修完，也不代表每學期必定開課。</p>`);
}
drawer.addEventListener('click', e => {
  if (e.target.closest('[data-x]')) return closeDrawer();
  if (e.target.closest('[data-reset]')) return resetFreshman();
  if (e.target.closest('[data-outer]')) return openOuter();
  if (e.target.closest('[data-pass]')) { AU.play('click'); return select({ type: 'pass' }); }
  const wk = e.target.closest('[data-work]');
  if (wk) { const p = PR(); p.work = wk.dataset.work; AU.play('shimmer'); save(); afterChange(); return; }
  const t = e.target.closest('[data-toggle]');
  if (t) { if (t.tagName === 'INPUT') return; e.preventDefault(); return toggle(t.dataset.toggle, true); }
  const ck = e.target.closest('[data-check]');
  if (ck) { const wasGrad = graduated(), p = PR(), k = ck.dataset.check; ck.checked ? p.checks.add(k) : p.checks.delete(k); AU.play(ck.checked ? 'coin' : 'undo'); save(); afterChange(); if (!wasGrad && graduated()) celebrate(); else if (ck.checked && k.includes('外院')) openOuter(); return; }
  const st = e.target.closest('[data-step]');
  if (st) { const wasGrad = graduated(), p = PR(), k = st.dataset.step, max = k === 'boya' ? CO.credits.find(x => x.k === 'boya').need : 30; const v = Math.max(0, Math.min(max, p[k] + +st.dataset.d)); AU.play(v > p[k] ? 'coin' : 'undo'); p[k] = v; save(); afterChange(); if (!wasGrad && graduated()) celebrate(); return; }
  const di = e.target.closest('[data-island]');
  if (di) return openIsland(di.dataset.island, true);
  const rt = e.target.closest('[data-route]');
  if (rt) return setRoute(rt.dataset.route);
  if (e.target.closest('[data-tour]')) return tour();
  const pv = e.target.closest('[data-preview]');
  if (pv) { S.preview = S.preview === pv.dataset.preview ? null : pv.dataset.preview; AU.play('shimmer'); renderHero(); renderSide(); return; }
  const c = e.target.closest('[data-course]');
  if (c) select({ type: 'course', id: c.dataset.course }, true);
});
drawer.addEventListener('change', e => {
  const t = e.target.closest('input[data-toggle]');
  if (t && t.checked !== DONE().has(t.dataset.toggle)) toggle(t.dataset.toggle, true);
});

/* ───────────── 選取、修課 ───────────── */
function select(sel, flyIt) {
  S.sel = sel;
  if (flyIt && sel) AU.play('click');
  if (flyIt && sel && sel.type === 'course' && BLD[sel.id]) flyTo(BLD[sel.id].base, 15);
  drawLinks(); renderSide(); refreshWorld();
}
function openIsland(id, flyIt) {
  select({ type: 'island', id });
  if (!flyIt) return;
  const o = ISLAND_OBJ[id];
  // 職務島：鏡頭往主島方向退一點，才看得到連到核心必修的那串小珠
  if (ISL[id].role && LINK.ids.size) flyTo(o.center.clone().lerp(ISLAND_OBJ.main.center, .38).setY(.5), 30);
  else flyTo(o.center.clone().setY(.5), id === 'main' ? 26 : 18);
}
const toastsEl = $('#toasts');
function toast(html, cls = '') {
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.innerHTML = html; toastsEl.appendChild(el);
  while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 2600);
}
function floater(txt) {
  const p = toScreen(heroWrap.position.clone().setY(heroWrap.position.y + 1.2));
  const el = document.createElement('div'); el.className = 'floater'; el.textContent = txt;
  el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
function toggle(id, animate) {
  if (DONE().has(id)) { DONE().delete(id); AU.play('undo'); save(); afterChange(); return; }
  complete(id, animate);
}
async function complete(id, animate) {
  const c = BY[id], g = gearOf(id); if (DONE().has(id)) return;
  const progress = PR(), cohort = S.cohort;
  const before = levels(), wasGrad = graduated();
  DONE().add(id); save();
  const after = levels();
  afterChange();
  const reward = () => {
    AU.play('gear'); floater(g.e); heroSpin = performance.now();
    toast(`${g.e} 獲得【${esc(g.n)}】<small>${Y[c.y].em} ${esc(c.name)}・${c.cr} 學分</small>`);
    F.ROLES.forEach(r => { if (after[r.id].lv > before[r.id].lv) { AU.play('levelUp'); toast(`⬆ ${r.icon} ${r.name}升級：${r.titles[after[r.id].lv - 1]}`, 'up'); } });
    if (!wasGrad && graduated()) celebrate();
  };
  if (animate && BLD[id]) {
    flyTo(BLD[id].base.clone().setY(.5), 18);
    const arrived = await moveHeroTo(id);
    if (!arrived || S.cohort !== cohort || PR() !== progress || !DONE().has(id)) return;
  }
  reward();
}
// 一鍵還原：清掉這個入學年度的所有勾選、博雅跨域學分與畢業檢核，回到剛入學的樣子
function openOuter() {
  const need = k => CO.credits.find(x => x.k === k), boya = need('boya'), cross = need('cross'), ele = need('ele');
  const reqCr = CO.courses.filter(isReq).reduce((a, c) => a + c.cr, 0), room = 128 - reqCr - boya.need - ele.need;
  $('#outerBody').innerHTML = `<ol>
    <li><b>🏛️ 外院共同基礎核心必修</b>：畢業前至少修畢一門外院的共同基礎核心必修。修畢的學分可以申請認列為「${esc(boya.name)}」，<b>最多 4 學分</b>。</li>
    <li><b>⛴ ${esc(cross.name)}</b>：外系課程、跨院系學分學程或微學分學程（114 起也包含合作大學選課），<b>最多採計 ${cross.need} 學分</b>；超過的部分不再計入畢業學分。</li>
    <li><b>🎯 彈性選修空間</b>：${CO.year} 學年度必修 ${reqCr}＋${esc(boya.name)} ${boya.need}＋系選修至少 ${ele.need} ＝ ${128 - room} 學分，還有 <b>${room} 學分</b>可以自由安排：修跨域（至多 ${cross.need}），或多修系選修，都可以補滿 128。</li>
    ${CO.year === 115 ? '<li><b>🛂 115 學年度跨域能力</b>：另須完成輔系、雙主修，或校內跨域學分學程／微學分學程，並取得修畢證明。</li>' : ''}
  </ol>
  <p>所以外院、外系的課不只是「額外」：在上限內都算數，還能補足職務需要的能力（例如製片修企管、聲音修音樂、行銷修大傳）。實際認列方式以學校規定為準。</p>`;
  $('#outerDlg').showModal(); AU.play('click');
}
// 瀏覽器裡有沒有存這一屆的紀錄
const hasData = p => !!p && (p.done.size || p.boya || p.cross || p.checks.size || p.work);
function savedText(p) { const parts = [`${p.done.size} 門課`]; if (p.boya) parts.push(`博雅 ${p.boya}`); if (p.cross) parts.push(`跨域 ${p.cross}`); return parts.join('・'); }
const savedBadge = y => hasData(S.P[y]) ? `<span class="saved">💾 已存 ${savedText(S.P[y])}</span>` : '';
function updateSaveChip() {
  const el = $('#saveChip'), p = CO && realPR();
  el.classList.toggle('show', hasData(p));
  if (hasData(p)) el.innerHTML = `💾 <span class="tx">已存 ${savedText(p)}</span><span class="rs">🔄 還原新生</span>`;
}
$('#saveChip').addEventListener('click', () => resetFreshman());
function resetFreshman() {
  const p = realPR();
  if (!hasData(p)) { toast('已經是大一新生了，什麼都還沒修'); return false; }
  if (!confirm(`要把 ${CO.year} 學年度存在這台電腦的修課紀錄全部清空，回到大一新生嗎？（其他學年度不受影響）`)) return false;
  stopTour();
  S.P[S.cohort] = { done: new Set(), boya: 0, cross: 0, checks: new Set(), work: '' };
  S.look = 'auto'; S.preview = null; save();
  moveHeroTo('A93A20', true);
  AU.play('undo'); afterChange();
  toast(`🔄 已還原成 ${CO.year} 學年度大一新生`);
  return true;
}
function celebrate() {
  S.look = 'grad'; save(); renderHero(); AU.play('grad');
  banner('🎓 畢業啦', `${'你'}帶著作品離島，下一站：業界與影展`);
  toast('🎓 解鎖「畢業」造型！', 'up');
}
function afterChange() { updateSaveChip(); refreshSea(); renderHero(); renderSide(); refreshWorld(); refreshIslandLabels(); }

/* ───────────── 年級篩選、職務路線 ───────────── */
const yearsEl = $('#years');
function renderYears() {
  yearsEl.innerHTML = `<button data-year="0" class="${S.year ? '' : 'on'}" style="background:#fff">全部</button>` +
    [1, 2, 3, 4].map(y => `<button data-year="${y}" class="${S.year === y ? 'on' : ''}" style="background:${Y[y].tile}" title="${Y[y].season}＝${Y[y].name}">${Y[y].em}<span class="yn"> ${Y[y].name}</span></button>`).join('');
}
yearsEl.addEventListener('click', e => { const b = e.target.closest('[data-year]'); if (!b) return; S.year = +b.dataset.year; AU.play('click'); renderYears(); refreshWorld(); refreshIslandLabels(); drawRoute(); });
const routePick = $('#routePick');
function renderRoutePick() {
  routePick.innerHTML = `<h3>選一個電影職務，看它四年怎麼修（${CO.year} 學年度）</h3><p class="note" style="margin:-4px 0 8px">路線會包含每個人都要修的必修，再加上這個職務推薦的選修。</p><div class="rgrid">` +
    F.ROLES.map(r => `<button class="rcard" data-route="${r.id}" style="border-left-color:${r.color}"><b>${r.icon} ${r.name}</b><span>${r.sub}</span></button>`).join('') + '</div>';
}
$('#routeBtn').addEventListener('click', () => { renderRoutePick(); routePick.classList.toggle('show'); AU.play('click'); });
let pendingPlay = false;
routePick.addEventListener('click', e => { const b = e.target.closest('[data-route]'); if (b) { routePick.classList.remove('show'); setRoute(b.dataset.route); if (pendingPlay) { pendingPlay = false; tour(); } } });
$('#playBtn').addEventListener('click', () => {
  if (tourRun) return stopTour();
  if (S.route) return tour();
  pendingPlay = true; renderRoutePick(); routePick.querySelector('h3').textContent = `▶ 選一個職務，看學生從大一走到大四（${CO.year} 學年度）`; routePick.classList.add('show'); AU.play('click');
});
$('#routeBtn').addEventListener('click', () => { pendingPlay = false; });
function setRoute(rid) {
  stopTour();
  S.route = rid; AU.play('shimmer');
  const r = ROLE[rid];
  $('#routeChip').innerHTML = rid ? `<button class="rchip" style="background:${r.color}" data-open>${r.icon} ${r.name}</button><button class="btn icon" data-clear title="取消路線">✕</button>` : '';
  S.sel = { type: 'route', id: rid };
  drawRoute(); drawLinks(); refreshWorld(); refreshIslandLabels(); renderSide();
  flyHome();
}
function clearRoute() { stopTour(); S.route = null; S.preview = null; $('#routeChip').innerHTML = ''; drawRoute(); drawLinks(); refreshWorld(); refreshIslandLabels(); renderHero(); if (S.sel && S.sel.type === 'route') closeDrawer(); }
$('#routeChip').addEventListener('click', e => {
  if (e.target.closest('[data-clear]')) return clearRoute();
  if (e.target.closest('[data-tour]')) return tour();
  if (e.target.closest('[data-open]')) { S.sel = { type: 'route', id: S.route }; renderSide(); }
});

let tourRun = null, SPEED = 1;
const PLAY_SPEED = 2; // 播放預設 2 倍速，可在播放列切換 1–3 倍
const sleep = ms => new Promise(res => setTimeout(res, ms / SPEED));
function stopTour() { if (tourRun) tourRun.stop = true; }
function banner(t, s) { $('#bannerT').textContent = t; $('#bannerS').textContent = s || ''; const b = $('#banner'); b.classList.add('show'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), 1900); }
function setPlayBtn() { $('#playBtn').innerHTML = tourRun ? '■ <span class="lbl">停止播放</span>' : '▶ <span class="lbl">播放四年成長</span>'; }
// 換年級時的大字卡：四季顏色，一看就知道現在是大幾
function yearCard(y, outcome) {
  const el = $('#yearCard');
  el.style.setProperty('--yc', Y[y].color); el.style.setProperty('--yt', Y[y].tile);
  el.innerHTML = `<div class="em">${Y[y].em}</div><div><b>${Y[y].name}</b><i>${Y[y].season}・${Y[y].label}</i>${outcome ? `<span>🏁 這一年要交出：${esc(outcome)}</span>` : ''}</div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(yearCard.t); yearCard.t = setTimeout(() => el.classList.remove('show'), 2700 / SPEED);
}
const PHASE = { up: '上學期・必修', down: '下學期・必修', ele: '職務選修', boya: '通識博雅', cross: '跨院／跨系選修', gate: '畢業門檻' };
function setHud(st, i, n) {
  const h = $('#playHud');
  if (!st) { h.classList.remove('show'); return; }
  h.classList.add('show');
  h.style.borderColor = Y[st.y].color;
  h.innerHTML = `<span class="yy" style="background:${Y[st.y].tile}">${Y[st.y].em} ${Y[st.y].name}</span><span>${PHASE[st.phase]}</span><span class="nn">第 ${i} / ${n} 站</span><button data-speed title="切換播放速度">⏩ ${SPEED}×</button>`;
  [...yearsEl.children].forEach(b => b.classList.toggle('now', +b.dataset.year === st.y));
}
$('#playHud').addEventListener('click', e => { if (e.target.closest('[data-speed]')) { SPEED = SPEED >= 3 ? 1 : SPEED + 1; AU.play('click'); e.target.closest('[data-speed]').textContent = `⏩ ${SPEED}×`; } });
async function seaStep(rid, st) {
  await moveHeroTo(st.id);
  const t = TRACK[rid], p = PR();
  p[st.phase] += st.n; heroSpin = performance.now(); AU.play('coin');
  floater(st.phase === 'boya' ? '📚' : '⛴');
  toast(st.phase === 'boya'
    ? `📚 通識博雅 +${st.n} 學分<small>${ROLE[rid].name}建議：${esc(t.boya || '人文與藝術、自然與科技、社會科學')}</small>`
    : `⛴ 跨院／跨系選修 +${st.n} 學分<small>${ROLE[rid].name}建議：${esc(t.cross || '外系或跨域學程')}・至多採計 ${creditPlan(rid).crossMax} 學分</small>`);
  afterChange();
}
// 播放四年成長：角色從大一走到大四，照學期修完必修、再修職務選修，沿路拿裝備、升級；播完恢復學生自己的紀錄
async function tour() {
  if (tourRun) return stopTour();
  if (!S.route) return;
  const rid = S.route, stops = tourSteps(rid), run = tourRun = { stop: false };
  const prevLook = S.look, prevSel = S.sel, prevYear = S.year;
  DEMO = { done: new Set(), boya: 0, cross: 0, checks: new Set(), work: '' }; S.look = 'auto'; S.preview = null; S.year = 0; SPEED = PLAY_SPEED; renderYears(); drawRoute();
  closeGearPage(); setPlayBtn();
  AU.setIntense(true); follow = true;
  moveHeroTo('A93A20', true);
  afterChange(); renderSide();
  flyTo(heroWrap.position.clone().setY(.5), 26);
  banner(`${ROLE[rid].icon} ${ROLE[rid].name}的四年`, `${CO.year} 學年度・必修 ${stops.filter(x => x.req).length} 門＋推薦選修 ${stops.filter(x => x.req === false).length} 門＋博雅與跨域（示範，不會改到你的紀錄）`); AU.play('clap');
  await sleep(2400);
  let curY = 0, curPhase = '';
  for (let i = 0; i < stops.length; i++) {
    const st = stops[i];
    if (run.stop || S.route !== rid) break;
    if (st.y !== curY) {
      curY = st.y; curPhase = st.phase; AU.play('clap'); setHud(st, i + 1, stops.length);
      const row = TRACK[rid].years.find(r => r.y === curY);
      yearCard(curY, row && row.outcome); await sleep(2800);
      if (run.stop) break;
    } else if (st.phase !== curPhase) {
      curPhase = st.phase; AU.play('coin');
      toast(`${Y[curY].em} ${Y[curY].name}・${PHASE[curPhase]}`, 'up');
    }
    setHud(st, i + 1, stops.length);
    if (st.sea) { await seaStep(rid, st); await sleep(1300); continue; }
    await complete(st.id, true);
    await sleep(st.req ? 380 : 900);
  }
  if (!run.stop) {
    const L = levels(), o = L[rid];
    banner(`🎓 ${ROLE[rid].titles[Math.max(0, o.lv - 1)]}`, `${ROLE[rid].name}路線走完：這就是四年後的樣子`);
    flyTo(heroWrap.position.clone().setY(.5), 14); AU.play('grad');
    await sleep(4500);
  }
  follow = false; AU.setIntense(false); tourRun = null; SPEED = 1; setHud(null);
  [...yearsEl.children].forEach(b => b.classList.remove('now'));
  DEMO = null; S.look = prevLook; S.year = prevYear; S.sel = prevSel && prevSel.type === 'route' ? prevSel : S.sel;
  const last = [...realPR().done].filter(id => BLD[id]).pop(); moveHeroTo(last || 'A93A20', true);
  setPlayBtn(); renderYears(); drawRoute(); afterChange();
  toast('示範結束，已回到你自己的修課紀錄');
  if (!run.stop) flyHome();
}

/* ───────────── 入學年度 ───────────── */
function renderIntro() {
  $('#cohortCards').innerHTML = [112, 113, 114, 115].map(y => { const c = COH[y];
    return `<button class="cohort" data-cohort="${y}"><div class="film"></div>${S.cohort == y ? '<span class="last">上次選擇</span>' : ''}<div class="num">${y}<small>學年度</small></div><div class="ad">${c.entry} 年入學</div><p>${esc(c.tagline)}</p>${savedBadge(y)}</button>`; }).join('');
}
$('#cohortCards').addEventListener('click', e => { const b = e.target.closest('[data-cohort]'); if (b) chooseCohort(b.dataset.cohort); });
let choosingCohort = false;
async function chooseCohort(y) {
  if (choosingCohort) return;
  choosingCohort = true;
  AU.unlock();
  const changed = String(S.cohort) !== String(y) || !WORLD;
  if (changed) {
    S.cohort = String(y); save();
    stopTour(); S.route = null; S.preview = null; S.year = 0; S.sel = null; $('#routeChip').innerHTML = ''; drawer.classList.remove('open');
    document.body.classList.remove('drawer-open'); updateMapViewport();
    useCohort(y);
  }
  renderHero();
  if (changed) showWelcome(y);
  $('#intro').classList.add('hide');
  try {
    await nextPaint();
    await enterIsland(y, changed);
    $('#welcome').classList.remove('show');
    mountPortrait($('#heroPortrait'));
    banner(`${y} 學年度`, `${COH[y].entry} 年入學・${COH[y].tagline}`);
    if (!S.helpSeen) $('#helpDlg').showModal();
  } catch {
    $('#wcStage').textContent = '暫時無法建立島嶼';
    $('#wcHint').textContent = '請重新載入，再試一次。';
    $('#wcRetry').hidden = false;
  } finally { choosingCohort = false; }
}
// 報到畫面同步顯示建圖進度，完成即入島，不再固定等待三秒或五秒。
function showWelcome(y) {
  const el = $('#welcome'), n = realPR().done.size, saved = hasData(realPR());
  $('#wcSaved').hidden = !saved;
  const [title] = titleFor(levels(), S.look, lookItems(S.look).primary);
  $('#wcKicker').textContent = saved ? '🎬 歡迎回來' : '🎒 新生報到';
  $('#wcTitle').textContent = `${y} 學年度入學`;
  $('#wcLine').innerHTML = n ? `你已經修了 ${n} 門課，現在的身分是「${title.replace(/<small>.*<\/small>/, '')}」。` : '你還沒有任何裝備，<br>只有一個書包和一張學生證。';
  $('#wcAsk').textContent = n ? '繼續你的四年吧！' : '準備開始了嗎？';
  $('#wcHint').textContent = '準備完成就會自動入島';
  $('#wcRetry').hidden = true;
  $('#wcProgress').value = 0; $('#wcPercent').textContent = '0%';
  $('#wcStage').textContent = '正在準備島嶼';
  mountPortrait($('#welcomePortrait'));
  el.classList.add('show');
  AU.play('shimmer');
}
$('#wcRetry').addEventListener('click', () => location.reload());
async function reportWorld(value, label) {
  $('#wcProgress').value = value; $('#wcPercent').textContent = `${value}%`;
  $('#wcStage').textContent = label;
  await nextPaint();
}
async function enterIsland(y, changed) {
  if (changed) {
    clearCourseLabels(); await buildWorld(reportWorld); drawRoute(); drawLinks();
    moveHeroTo('A93A20', true); heroIsl = 'port';
    const last = [...DONE()].filter(id => BLD[id]).pop(); if (last) moveHeroTo(last, true);
    camera.position.set(0, 80, 95); controls.target.copy(HOME.t); flyHome();
    $('#cohortBtn').textContent = `${y} 學年度入學 ⇄`;
    const src = $('#srcBtn'); src.href = COH[y].pdf; src.querySelector('span').textContent = `${y} 原始資料`; src.title = `開啟系上官方 ${y} 學年度四年課程計畫 PDF`; src.classList.add('show');
    renderYears(); afterChange();
    await reportWorld(90, '正在準備島嶼畫面');
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    await reportWorld(100, '準備完成，歡迎上島');
  }
}
$('#cohortBtn').addEventListener('click', () => { renderIntro(); $('#intro').classList.remove('hide'); });

/* ───────────── 清單、說明、護照、聲音開關 ───────────── */
function renderList() {
  $('#listTitle').textContent = `清單版｜${CO.year} 學年度四年課程計畫`;
  const groups = [['gen', '通識核心'], ['col', '院必修'], ['cole', '院選修'], ['req', '系必修'], ['ele', '系選修']];
  $('#listBody').innerHTML = groups.filter(([k]) => CO.courses.some(c => c.cat === k)).map(([k, t]) => `<h3>${t}</h3><table class="list"><thead><tr><th></th><th>代碼</th><th>課名</th><th class="n">學分</th><th>年級</th><th>學期</th><th>推薦職務</th><th>裝備</th></tr></thead><tbody>` +
    CO.courses.filter(c => c.cat === k).sort((a, b) => a.y - b.y).map(c => `<tr><td><input type="checkbox" data-toggle="${c.id}" ${DONE().has(c.id) ? 'checked' : ''} aria-label="已修 ${esc(c.name)}"></td><td>${c.id}</td><td>${esc(c.name)}</td><td class="n">${c.cr}</td><td>${ytag(c.y)}</td><td>${termText(c)}</td><td>${F.ROLES.filter(r => TRACK[r.id].codes.has(c.id)).map(r => r.icon).join('') || '—'}</td><td>${gearOf(c.id).e} ${esc(gearOf(c.id).n)}</td></tr>`).join('') + '</tbody></table>').join('') +
    `<p class="note">另需：${CO.credits.filter(k => k.k === 'boya' || k.k === 'cross').map(k => `${esc(k.name)} ${k.kind === 'max' ? '至多' : ''} ${k.need} 學分`).join('；')}；畢業門檻與檢核見學分護照。資料來源：<a href="${CO.pdf}" target="_blank" rel="noopener">${CO.year} 學年度四年課程計畫</a>。</p>${CREDIT}`;
}
$('#listBtn').addEventListener('click', () => { renderList(); $('#listDlg').showModal(); AU.play('click'); });
$('#listBody').addEventListener('change', e => { const t = e.target.closest('[data-toggle]'); if (t && t.checked !== DONE().has(t.dataset.toggle)) toggle(t.dataset.toggle, true); });
$('#helpBtn').addEventListener('click', () => $('#helpDlg').showModal());
$('#helpLegend').innerHTML = [1, 2, 3, 4].map(ytag).join('');
$('#passBtn').addEventListener('click', () => { AU.play('click'); select({ type: 'pass' }); });
document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('#helpDlg').addEventListener('close', () => { S.helpSeen = true; save(); });
function renderAudioBtns() {
  const m = $('#musicBtn'), x = $('#sfxBtn'), running = AU.running();
  m.textContent = S.music ? '🎵' : '🔇'; m.setAttribute('aria-pressed', S.music);
  m.title = !S.music ? '背景音樂：關（點一下開啟）' : running ? '背景音樂：播放中（點一下關閉）' : '背景音樂：等待啟用（點一下播放）';
  x.textContent = S.sfx ? '🔔' : '🔕'; x.setAttribute('aria-pressed', S.sfx);
  x.title = !S.sfx ? '音效：關（點一下開啟）' : running ? '音效：已啟用（點一下關閉）' : '音效：等待啟用（點一下播放）';
  [m, x].forEach(b => { b.setAttribute('aria-label', b.title); b.dataset.audioState = running ? 'running' : 'waiting'; });
  m.classList.toggle('audio-pending', S.music && !running); x.classList.toggle('audio-pending', S.sfx && !running);
  $('#audioEnable').hidden = running || (!S.music && !S.sfx);
}
$('#musicBtn').addEventListener('click', e => { if (!S.music || (e.currentTarget.dataset.enableOnTap !== 'true' && AU.running())) AU.setMusic(!S.music); delete e.currentTarget.dataset.enableOnTap; AU.unlock(); save(); renderAudioBtns(); });
$('#sfxBtn').addEventListener('click', e => { if (!S.sfx || (e.currentTarget.dataset.enableOnTap !== 'true' && AU.running())) AU.setSfx(!S.sfx); delete e.currentTarget.dataset.enableOnTap; AU.unlock(); save(); renderAudioBtns(); AU.play('click'); });
$('#audioEnable').addEventListener('click', () => { AU.unlock(); AU.play('click'); });

/* ───────────── 地圖點擊／滑過 ───────────── */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('#tip');
function hit(e) {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const h = ray.intersectObjects(pickables, true)[0];
  if (!h) return null;
  let o = h.object;
  while (o && !o.userData.course && !o.userData.special && !o.userData.island && !o.userData.url) o = o.parent;
  return o ? o.userData : null;
}
let down = null;
const mapPointers = new Set();
mapSurface.addEventListener('pointerdown', e => {
  mapPointers.add(e.pointerId);
  if (mapPointers.size === 1) down = { id: e.pointerId, x: e.clientX, y: e.clientY, dragged: false };
  else if (down) down.dragged = true;
  fly = null; follow = false; routePick.classList.remove('show');
});
mapSurface.addEventListener('pointermove', e => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.dragged = true;
});
function cancelMapPointer(e) { mapPointers.delete(e.pointerId); if (down) down.dragged = true; if (!mapPointers.size) down = null; }
mapSurface.addEventListener('pointercancel', cancelMapPointer);
mapSurface.addEventListener('lostpointercapture', cancelMapPointer);
mapSurface.addEventListener('pointerup', e => {
  mapPointers.delete(e.pointerId);
  const tap = down && down.id === e.pointerId && !down.dragged && mapPointers.size === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6;
  if (!mapPointers.size) down = null;
  if (!tap || !WORLD || choosingCohort) return;
  const label = e.target.closest('.isl-label');
  if (label) { AU.play('click'); openIsland(label.dataset.island, true); return; }
  const u = hit(e);
  if (!u) return;
  if (u.url) return window.open(u.url, '_blank', 'noopener');
  if (u.course) select({ type: 'course', id: u.course }, true);
  else if (u.special) openIsland('sea', true);
  else if (u.island) { AU.play('click'); openIsland(u.island, true); }
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || !CO) return;
  const u = hit(e);
  let txt = '';
  if (u && u.course) { const c = BY[u.course]; txt = `${Y[c.y].em} ${Y[c.y].name}｜${c.name}・${c.cr} 學分${DONE().has(c.id) ? '・已修' : ''}`; }
  else if (u && u.special) txt = u.special === 'BOYA' ? '📚 博雅選修' : '⛴ 跨域選修';
  else if (u && u.island) txt = ISL[u.island].name;
  else if (u && u.url) txt = '前往義守大學電影與電視學系網站 ↗';
  canvas.style.cursor = u ? 'pointer' : '';
  tip.style.display = txt ? 'block' : 'none';
  tip.textContent = txt; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 12 + 'px';
});
canvas.addEventListener('pointerleave', () => tip.style.display = 'none');

/* ───────────── 尺寸與主迴圈 ───────────── */
function updateMapViewport() {
  if (innerWidth <= 900 && drawer.classList.contains('open')) {
    // 把觀看中心移到下方課程抽屜上方，讓勾課時的角色仍然看得見。
    const shift = Math.min(drawer.getBoundingClientRect().height / 2, innerHeight * .26);
    camera.setViewOffset(innerWidth, innerHeight, 0, shift, innerWidth, innerHeight);
  } else camera.clearViewOffset();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; updateMapViewport(); camera.updateProjectionMatrix(); resizePortrait(); }
addEventListener('resize', resize);
function zoomMap(factor) {
  fly = null; follow = false;
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * factor)));
  camera.position.copy(controls.target).add(offset); controls.update();
}
$('#zoomIn').addEventListener('click', () => zoomMap(.78));
$('#zoomOut').addEventListener('click', () => zoomMap(1.28));
$('#homeView').addEventListener('click', () => { follow = false; flyHome(); AU.play('click'); });
let heroSpin = 0;
const clock = new THREE.Clock();
function frame(now) {
  const t = clock.getElapsedTime();
  for (let i = 0; i < wPos.count; i++) { const x = wBase[i * 3], z = wBase[i * 3 + 2]; wPos.array[i * 3 + 1] = Math.sin(x * .35 + t * .9) * .07 + Math.cos(z * .3 + t * .7) * .07; }
  wPos.needsUpdate = true;
  if (WORLD) WORLD.children.forEach(g => { if (g.userData.grow) { const k = Math.min(1, Math.max(0, (now - g.userData.grow) / 650)); const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); g.scale.y = Math.max(.01, k ? e : .01); if (k >= 1) { g.scale.y = 1; delete g.userData.grow; } } });
  stepMover(now, t);
  const sp = heroSpin ? (now - heroSpin) / 500 : 1;
  hero.root.rotation.y = sp < 1 ? sp * Math.PI * 2 : 0; if (sp >= 1) heroSpin = 0;
  if (!mover.mode) hero.root.position.y = Math.abs(Math.sin(t * 2.4)) * .03;
  heroRing.visible = mover.mode !== 'glide';
  heroRing.material.opacity = .55 + Math.sin(t * 3) * .3;
  [hero, portrait].forEach(ch => ch.gear.children.forEach(o => { if (o.userData.bob) o.position.y = ANCHOR.pet[1] + Math.sin(t * 2.2) * .07; }));
  LANDMARKS.forEach(l => l.traverse(o => { if (o.userData.spin) o.rotation.y = t * .5; if (o.userData.bobBuoy) o.position.y = .45 + Math.sin(t * 1.6) * .06; }));
  linkGroup.children.forEach(o => { o.scale.setScalar(.75 + .45 * Math.max(0, Math.sin(t * 4 - o.userData.bead * .45))); });
  routeGroup.children.forEach((o, i) => { if (o.material) o.material.emissiveIntensity = .35 + Math.sin(t * 3 - i * .4) * .2; });
  seaFrame(t);
  if (fly) {
    const k = Math.min(1, (now - fly.t0) / fly.dur), e = 1 - Math.pow(1 - k, 3);
    controls.target.lerpVectors(fly.sT, fly.eT, e); camera.position.lerpVectors(fly.sP, fly.eP, e);
    if (k >= 1) fly = null;
  } else if (follow) {
    const goal = heroWrap.position.clone(); goal.y = .5;
    const delta = goal.sub(controls.target).multiplyScalar(.05);
    controls.target.add(delta); camera.position.add(delta);
  }
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  pRoot.rotation.y = yaw + (drag ? 0 : Math.sin(t * .6) * .35);
  portrait.root.position.y = Math.abs(Math.sin(t * 2.4)) * .03;
  if (pCanvas.offsetParent) pRenderer.render(pScene, pCam);
  requestAnimationFrame(frame);
}

/* ───────────── 啟動 ───────────── */
load();
mountPortrait($('#heroPortrait'));
renderAudioBtns(); renderIntro(); resize();
BOOT.update(96, '正在繪製第一個畫面', '馬上就能選擇入學年度。');
requestAnimationFrame(frame);
requestAnimationFrame(() => requestAnimationFrame(() => BOOT.finish()));
})();
