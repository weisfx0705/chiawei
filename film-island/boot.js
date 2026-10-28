/* 顯示實際下載與初始化進度；依序執行相依的程式，避免重複下載。 */
(() => {
  const $ = id => document.getElementById(id);
  let progress = 0, failed = false, finished = false;
  const requests = new Set();
  function update(value, label, detail) {
    if (failed || finished) return;
    progress = Math.max(progress, Math.min(100, Math.round(value)));
    $('bootProgress').value = progress;
    $('bootPercent').textContent = `${progress}%`;
    $('bootLabel').textContent = label;
    if (detail) $('bootDetail').textContent = detail;
  }
  function fail() {
    if (finished || failed) return;
    failed = true;
    requests.forEach(xhr => xhr.abort());
    $('boot').hidden = false;
    $('boot').setAttribute('aria-busy', 'false');
    $('bootLabel').textContent = '暫時無法完成載入';
    $('bootDetail').textContent = location.protocol === 'file:'
      ? '請使用 open.command 啟動本機伺服器，再開啟課程島。'
      : '請確認網路連線後重試；若仍無法開啟，請使用最新版 Safari 或 Chrome。';
    $('bootRetry').hidden = false;
  }
  function finish() {
    if (failed || finished) return;
    update(100, '準備完成', '可以選擇入學年度了。');
    finished = true;
    $('boot').setAttribute('aria-busy', 'false');
    $('boot').hidden = true;
  }
  window.FILM_BOOT = { update, fail, finish };
  $('bootRetry').addEventListener('click', () => location.reload());
  window.addEventListener('error', () => { if (!finished) fail(); });
  window.addEventListener('unhandledrejection', () => { if (!finished) fail(); });

  const assets = [
    { src: 'vendor/three.min.js', label: '3D 繪圖程式' },
    { src: 'vendor/OrbitControls.js', label: '地圖操作' },
    { src: 'cohorts.js', label: '各學年度課程' },
    { src: 'data.js', label: '島嶼與裝備資料' },
    { src: 'app.js', label: '課程島' },
  ];
  const ratios = assets.map(() => 0);
  function download(asset, index) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      requests.add(xhr);
      xhr.open('GET', asset.src);
      xhr.timeout = 45000;
      xhr.onprogress = event => {
        if (event.lengthComputable) ratios[index] = Math.min(.99, event.loaded / event.total);
        const done = ratios.filter(r => r === 1).length;
        update(ratios.reduce((a, b) => a + b, 0) / assets.length * 68,
          `正在載入${asset.label}`, `已完成 ${done} / ${assets.length} 項資源`);
      };
      xhr.onload = () => {
        requests.delete(xhr);
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error('Asset unavailable'));
        ratios[index] = 1;
        update(ratios.reduce((a, b) => a + b, 0) / assets.length * 68,
          '正在載入課程島資源', `已完成 ${ratios.filter(r => r === 1).length} / ${assets.length} 項資源`);
        resolve(xhr.responseText);
      };
      xhr.onerror = xhr.ontimeout = xhr.onabort = () => {
        requests.delete(xhr);
        reject(new Error('Asset transfer failed'));
      };
      xhr.send();
    });
  }
  function execute(source) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => { URL.revokeObjectURL(url); script.remove(); resolve(); };
      script.onerror = () => { URL.revokeObjectURL(url); script.remove(); reject(new Error('Script unavailable')); };
      document.body.appendChild(script);
    });
  }
  async function start() {
    try {
      // 先讓載入畫面完成繪製，再啟動下載與初始化。
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const sources = await Promise.all(assets.map(download));
      for (let i = 0; i < sources.length; i++) {
        if (failed) return;
        update(68 + i / sources.length * 12, `正在準備${assets[i].label}`);
        await execute(sources[i]);
      }
    } catch { fail(); }
  }
  start();
})();
