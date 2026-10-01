(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.TREE_CONFIG || {};
  let audioFile = null, audioUrl = '', recorder = null, stream = null, timer = null;
  let recording = false, finalizing = false, sending = false, elapsed = 0;
  let requestId = crypto.randomUUID(), pending = null;
  const MAX_AUDIO = 10 * 1024 * 1024;
  const messages = {
    empty: ['A few words or a voice message is enough to begin.', '寫幾句話，或留一段錄音，就可以開始。', 'Chỉ cần vài dòng hoặc một lời nhắn thoại để bắt đầu.'],
    unavailable: ['The sharing service is not connected yet. Your message has not been sent.', '收件服務尚未連接，內容尚未送出。', 'Dịch vụ chia sẻ chưa được kết nối. Lời nhắn chưa được gửi.'],
    failed: ['Not confirmed yet. Your message is still here; please try again.', '尚未確認收件，內容仍保留在這裡，請再試一次。', 'Chưa xác nhận nhận được. Nội dung vẫn còn ở đây; vui lòng thử lại.'],
    mic: ['Please allow microphone access, or upload an audio file instead.', '請允許使用麥克風，或改成上傳錄音檔。', 'Vui lòng cho phép dùng micrô hoặc tải tệp âm thanh lên.'],
    unsupported: ['Recording is unavailable here. You can upload audio or write instead.', '這個瀏覽器無法錄音，可上傳錄音檔或改用文字。', 'Trình duyệt này không hỗ trợ ghi âm. Bạn có thể tải âm thanh lên hoặc viết.'],
    file: ['Please choose an audio file up to 10 MB.', '請選擇 10 MB 以內的錄音檔。', 'Vui lòng chọn tệp âm thanh không quá 10 MB.'],
    form: ['Review and submit in Google Forms. Opening the form does not send your message.', '請在 Google 表單確認並送出；開啟表單並不代表已送出。', 'Hãy kiểm tra và gửi trong Google Forms. Mở biểu mẫu không có nghĩa là đã gửi.'],
    formAudio: ['Save your recording, then attach it in Google Forms. Uploading there requires Google sign-in.', '請先儲存錄音，再到 Google 表單上傳；上傳需要登入 Google。', 'Hãy lưu bản ghi, rồi đính kèm trong Google Forms. Tải tệp lên cần đăng nhập Google.']
  };
  function trio(element, texts) {
    element.replaceChildren();
    const wrap = document.createElement('span'); wrap.className = 'trio';
    ['en', 'zh-Hant', 'vi'].forEach((lang, i) => { const span = document.createElement('span'); span.lang = lang; span.textContent = texts[i]; wrap.append(span); });
    element.append(wrap);
  }
  function feedback(key, info = false) { const target = $('feedback'); trio(target, messages[key]); target.classList.toggle('info', info); target.hidden = false; }
  function clearFeedback() { $('feedback').hidden = true; }
  function changeStep(step) {
    $('step-share').hidden = step !== 1; $('identity-form').hidden = step !== 2; $('step-success').hidden = step !== 3;
    $('step-number').textContent = step === 3 ? '✓' : `0${step}`;
    const titles = {1: ['Your little message', '留一點心事', 'Lời nhắn của bạn'], 2: ['A little about you', '讓我認識你', 'Đôi điều về bạn'], 3: ['Safely received', '已經收到', 'Đã nhận được']};
    trio($('step-title'), titles[step]); clearFeedback();
    if (step === 2) {
      const connected = config.mode === 'google-form' ? validFormUrl(config.googleFormUrl) : validScriptUrl(config.appsScriptUrl);
      $('connection-note').hidden = !!connected;
      if (!connected) trio($('connection-note'), messages.unavailable);
      $('identity-heading').focus({preventScroll: true});
      if (config.mode === 'google-form') trio($('send'), ['Review in Google Forms', '前往表單確認', 'Kiểm tra trong Google Forms']);
    }
    if (step === 3) $('success-heading').focus({preventScroll: true});
    if (step !== 1) $('share').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
  }
  function setMode(mode, focus = false) {
    if (recording) stopRecording();
    ['write', 'speak'].forEach(value => { const tab = $(`tab-${value}`); const active = value === mode; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; $(`panel-${value}`).hidden = !active; });
    if (focus) $(`tab-${mode}`).focus();
  }
  ['write', 'speak'].forEach(mode => {
    const tab = $(`tab-${mode}`); tab.addEventListener('click', () => setMode(mode));
    tab.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setMode(event.key === 'Home' ? 'write' : event.key === 'End' ? 'speak' : mode === 'write' ? 'speak' : 'write', true); } });
  });
  function updateAttachments() { $('both-note').hidden = !(audioFile && $('message').value.trim()); }
  $('message').addEventListener('input', () => { $('char-count').textContent = `${$('message').value.length.toLocaleString()} / 10,000`; updateAttachments(); });
  function setAudio(file) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioFile = file; audioUrl = file ? URL.createObjectURL(file) : '';
    $('audio-player').src = audioUrl; $('audio-preview').hidden = !file; updateAttachments();
  }
  $('remove-audio').addEventListener('click', () => { $('audio-player').pause(); setAudio(null); });
  $('audio-file').addEventListener('change', event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return; clearFeedback();
    if (!file.size || file.size > MAX_AUDIO || !(file.type.startsWith('audio/') || /\.(mp3|m4a|mp4|wav|webm|ogg|aac|flac)$/i.test(file.name))) { feedback('file'); return; }
    setAudio(file);
  });
  function recordState(active) {
    recording = active; $('record-space').classList.toggle('is-recording', active);
    trio($('record-button'), active ? ['Stop recording', '結束錄音', 'Dừng ghi âm'] : ['Record a message', '開始錄音', 'Ghi lời nhắn']);
    $('continue').disabled = active || finalizing; $('audio-file').disabled = active || finalizing;
    if (!active) { clearInterval(timer); timer = null; }
  }
  function stopRecording() {
    if (recorder?.state === 'recording') { finalizing = true; recorder.stop(); }
    recordState(false); stream?.getTracks().forEach(track => track.stop());
  }
  $('record-button').addEventListener('click', async () => {
    if (recording) { stopRecording(); return; } if (finalizing) return;
    clearFeedback();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { feedback('unsupported'); return; }
    $('record-button').disabled = true; $('continue').disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(value => MediaRecorder.isTypeSupported(value));
      recorder = new MediaRecorder(stream, mime ? {mimeType: mime} : undefined); const chunks = [];
      recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener('stop', () => {
        const type = recorder.mimeType || mime || 'audio/webm'; const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(chunks, `voice-message.${ext}`, {type});
        if (file.size && file.size <= MAX_AUDIO) setAudio(file); else feedback('file');
        stream?.getTracks().forEach(track => track.stop()); finalizing = false; recordState(false); $('record-button').disabled = false;
      }, {once: true});
      recorder.addEventListener('error', () => { stopRecording(); feedback('mic'); });
      setAudio(null); elapsed = 0; $('record-time').textContent = '0:00'; recorder.start(1000); recordState(true);
      timer = setInterval(() => { elapsed++; $('record-time').textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`; if (elapsed >= 180) stopRecording(); }, 1000);
    } catch { stream?.getTracks().forEach(track => track.stop()); recordState(false); feedback('mic'); }
    finally { $('record-button').disabled = false; if (!recording && !finalizing) $('continue').disabled = false; }
  });
  $('continue').addEventListener('click', () => {
    if (recording || finalizing) return;
    if (!$('message').value.trim() && !audioFile) { feedback('empty'); return; }
    changeStep(2);
  });
  $('back').addEventListener('click', () => { if (!sending) changeStep(1); });
  $('nationality').addEventListener('change', () => {
    const other = $('nationality').value === 'other'; $('other-nationality-field').hidden = !other; $('other-nationality').required = other;
    if ($('nationality').value.startsWith('Indonesia')) $('language').value = 'Bahasa Indonesia';
    if ($('nationality').value.startsWith('Vietnam')) $('language').value = 'Tiếng Việt';
  });
  function validScriptUrl(value) { try { const u = new URL(value); return u.origin === 'https://script.google.com' && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname); } catch { return false; } }
  function validFormUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' && (u.hostname === 'docs.google.com' && u.pathname.startsWith('/forms/') || u.hostname === 'forms.gle'); } catch { return false; } }
  function validLineUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' && ['line.me', 'line.naver.jp'].includes(u.hostname); } catch { return false; } }
  if (validLineUrl(config.lineCommunityUrl)) document.querySelectorAll('[data-community]').forEach(link => { link.href = config.lineCommunityUrl; });
  if (validLineUrl(config.lineGroupUrl)) { $('line-group').href = config.lineGroupUrl; $('line-group').hidden = false; }
  function collect() {
    return {requestId, origin: location.origin, name: $('name').value.trim(), email: $('email').value.trim(), nationality: $('nationality').value === 'other' ? $('other-nationality').value.trim() : $('nationality').value,
      studentId: $('studentId').value.trim(), language: $('language').value, mood: document.querySelector('[name="mood"]:checked')?.value || '', message: $('message').value.trim(), consent: $('consent').checked, consentVersion: '2026-10-01'};
  }
  function normalizedAudioType(file) {
    const aliases = {'audio/x-m4a':'audio/mp4','audio/wave':'audio/wav','audio/vnd.wave':'audio/wav'};
    if (file.type) return aliases[file.type] || file.type;
    return {mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',wav:'audio/wav',webm:'audio/webm',ogg:'audio/ogg',aac:'audio/aac',flac:'audio/flac'}[file.name.split('.').pop().toLowerCase()] || 'audio/webm';
  }
  function readAudio(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.addEventListener('error', reject, {once:true}); reader.addEventListener('load', () => resolve({name: file.name, mimeType: normalizedAudioType(file), base64: String(reader.result).split(',')[1]}), {once:true}); reader.readAsDataURL(file); }); }
  function setBusy(value) {
    sending = value; $('identity-form').classList.toggle('sending', value); $('back').disabled = value; $('send').disabled = value;
    $('identity-form').querySelectorAll('input,select').forEach(control => { control.disabled = value; });
    if (config.mode !== 'google-form') trio($('send'), value ? ['Sending…', '傳送中…', 'Đang gửi…'] : ['Send to the tree', '把心事送出', 'Gửi lời nhắn']);
  }
  function cleanupPending() { if (!pending) return; clearTimeout(pending.timeout); pending.frame.remove(); pending.form.remove(); pending = null; }
  function sendToScript(data) {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe'); frame.name = `tree-${requestId}`; frame.hidden = true; frame.title = 'Submission transport';
      const form = document.createElement('form'); form.method = 'POST'; form.action = config.appsScriptUrl; form.target = frame.name; form.hidden = true;
      const input = document.createElement('input'); input.type = 'hidden'; input.name = 'payload'; input.value = JSON.stringify(data); form.append(input);
      const timeout = setTimeout(() => { cleanupPending(); reject(new Error('not_confirmed')); }, 90000);
      pending = {frame, form, timeout, resolve, reject, requestId}; document.body.append(frame, form); form.submit();
    });
  }
  window.addEventListener('message', event => {
    if (!pending) return;
    let origin; try { origin = new URL(event.origin); } catch { return; }
    if (origin.protocol !== 'https:' || !(origin.hostname === 'script.google.com' || origin.hostname === 'script.googleusercontent.com' || origin.hostname.endsWith('-script.googleusercontent.com'))) return;
    const data = event.data;
    if (!data || data.type !== 'tree-hollow-result' || data.requestId !== pending.requestId) return;
    const {resolve, reject} = pending; cleanupPending();
    if (data.ok === true && typeof data.receipt === 'string' && /^TH-[A-Z0-9-]{4,40}$/.test(data.receipt)) resolve(data); else reject(new Error('not_confirmed'));
  });
  async function openGoogleForm(data) {
    if (!validFormUrl(config.googleFormUrl)) { feedback('unavailable'); return; }
    const url = new URL(config.googleFormUrl);
    for (const [key, entry] of Object.entries(config.formFields || {})) if (/^entry\.\d+$/.test(entry) && data[key] !== undefined) url.searchParams.set(entry, String(data[key]));
    if (audioFile) {
      const download = document.createElement('a'); download.href = audioUrl; download.download = `tree-message-${requestId.slice(0,8)}.${audioFile.name.split('.').pop() || 'webm'}`; download.click(); feedback('formAudio', true);
    } else feedback('form', true);
    window.open(url.href, '_blank', 'noopener,noreferrer');
  }
  $('identity-form').addEventListener('submit', async event => {
    event.preventDefault(); if (sending || recording || finalizing || !$('identity-form').reportValidity()) return;
    clearFeedback(); const data = collect();
    if (!data.name || !data.nationality || !$('consent').checked || (!data.message && !audioFile)) { feedback('empty'); return; }
    if (config.mode === 'google-form') { await openGoogleForm(data); return; }
    if (!validScriptUrl(config.appsScriptUrl)) { feedback('unavailable'); return; }
    setBusy(true);
    try {
      if (audioFile) data.audio = await readAudio(audioFile);
      const result = await sendToScript(data);
      $('receipt').textContent = result.receipt; $('success-email').textContent = data.email; changeStep(3);
    } catch { feedback('failed'); } finally { setBusy(false); }
  });
  $('another').addEventListener('click', () => {
    $('message').value = ''; $('char-count').textContent = '0 / 10,000'; document.querySelectorAll('[name="mood"]').forEach(input => { input.checked = false; });
    $('consent').checked = false; setAudio(null); elapsed = 0; $('record-time').textContent = '0:00'; requestId = crypto.randomUUID(); changeStep(1);
  });
  window.addEventListener('pagehide', () => { if (recording) stopRecording(); stream?.getTracks().forEach(track => track.stop()); if (audioUrl) URL.revokeObjectURL(audioUrl); cleanupPending(); });
  // Browser agents can stage a draft, but only the visible form can submit it.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    try { Promise.resolve(document.modelContext.registerTool({name:'stage_tree_hollow_message', title:'Prepare a message', description:'Fill the visible text draft without sending. The student must review the form and consent.', inputSchema:{type:'object',properties:{message:{type:'string',maxLength:10000}},required:['message'],additionalProperties:false}, annotations:{readOnlyHint:false,untrustedContentHint:false}, execute(input) { if (!input || typeof input.message !== 'string' || input.message.length > 10000) throw new Error('Invalid draft'); $('message').value = input.message; $('message').dispatchEvent(new Event('input')); setMode('write'); return {staged:true,submitted:false}; }}, {signal:lifecycle.signal})).catch(() => {}); } catch {}
    window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
  }
})();
