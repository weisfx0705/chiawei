let generationController = null;
// ─── Voices ───
const VOICE_FEMALE = [
  'Zephyr','Kore','Leda','Aoede','Callirrhoe','Autonoe','Despina',
  'Erinome','Laomedeia','Achernar','Gacrux','Pulcherrima','Vindemiatrix','Sulafat'
];
const VOICE_MALE = [
  'Puck','Charon','Fenrir','Orus','Enceladus','Iapetus','Umbriel','Algieba',
  'Algenib','Rasalgethi','Alnilam','Schedar','Achird','Zubenelgenubi',
  'Sadachbia','Sadaltager'
];
function voiceGender(name) {
  if (VOICE_FEMALE.includes(name)) return 'female';
  if (VOICE_MALE.includes(name)) return 'male';
  return 'unknown';
}
// Short, optional styles are recommended for 3.8; do not force a prefix.
function withDefaultVoicePrompt(text = '') {
  return text.split('\n').filter(line => line.trim().toLowerCase() !== 'normal pitched and natural').join('\n').trim();
}
function setStyle(id, style) { document.getElementById(id).value = style; }


// Populate voice selects with gender grouping
function populateVoices() {
  ['voiceSelect','voice1Select','voice2Select','srtVoiceSelect'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    sel.innerHTML = '';

    const femaleGroup = document.createElement('optgroup');
    femaleGroup.label = '♀ 女聲 Female';
    VOICE_FEMALE.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      femaleGroup.appendChild(opt);
    });

    const maleGroup = document.createElement('optgroup');
    maleGroup.label = '♂ 男聲 Male';
    VOICE_MALE.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      maleGroup.appendChild(opt);
    });

    sel.appendChild(femaleGroup);
    sel.appendChild(maleGroup);

    if (idx === 0) sel.value = 'Kore';
    if (idx === 1) sel.value = 'Aoede';
    if (idx === 2) sel.value = 'Charon';
    if (idx === 3) sel.value = 'Kore';

    // Update gender badge on change
    sel.addEventListener('change', () => updateGenderBadge(sel));
    updateGenderBadge(sel);
  });
}

function updateGenderBadge(sel) {
  const gender = voiceGender(sel.value);
  const row = sel.closest('.voice-select-row');
  if (!row) return;
  let badge = row.querySelector('.gender-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'gender-badge';
    sel.insertAdjacentElement('beforebegin', badge);
  }
  badge.textContent = gender === 'female' ? '♀' : gender === 'male' ? '♂' : '';
  badge.className = `gender-badge gender-${gender}`;
}

populateVoices();


// ─── Local API service ───
const apiStatus = document.getElementById('apiStatus');
let serviceReady = false;
const hostedMode = !['127.0.0.1', 'localhost'].includes(location.hostname);
document.getElementById('bridgePortLabel').classList.toggle('hidden', !hostedMode);
try {
  const savedPort = localStorage.getItem('tts_local_port');
  const linkedPort = new URLSearchParams(location.hash.slice(1)).get('port');
  const port = Number(linkedPort || savedPort || 8765);
  if (Number.isInteger(port) && port > 0 && port <= 65535) document.getElementById('bridgePort').value = port;
} catch (_) {}
function saveBridgePort() {
  serviceReady = false;
  apiStatus.classList.remove('connected');
  try { localStorage.setItem('tts_local_port', document.getElementById('bridgePort').value); } catch (_) {}
  document.getElementById('connectionLabel').textContent = '請重新連接本機服務';
}
function serviceUrl(path) {
  if (!hostedMode) return path;
  const port = Number(document.getElementById('bridgePort').value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('請填入有效的本機連接埠。');
  return `http://127.0.0.1:${port}${path}`;
}
// Remove the old browser copy without reading its value.
try { localStorage.removeItem('gemini_api_key'); } catch (_) {}

async function checkConnection() {
  const label = document.getElementById('connectionLabel');
  const help = document.getElementById('connectionHelp');
  serviceReady = false;
  try {
    const response = await fetch(serviceUrl('/api/health'), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    serviceReady = data.ready === true;
    label.textContent = serviceReady ? '本機 Keychain 服務可用' : '尚未設定 Keychain wrapper';
    help.textContent = serviceReady ? '' : '請先設定 ~/.local/bin/with-gemini-key，再重新檢查連線。';
  } catch (_) {
    label.textContent = '請啟動本機服務';
    help.textContent = hostedMode
      ? '先雙擊「啟動 TTS.command」，填入終端機顯示的本機埠，再按重新連線。瀏覽器詢問本機網路權限時請允許；也可使用終端機顯示的本機網址。'
      : '在專案目錄執行 python3 server.py --open，或雙擊「啟動 TTS.command」。';
  }
  apiStatus.classList.toggle('connected', serviceReady);
  apiStatus.title = label.textContent + '（憑證與模型權限於第一次請求確認）';
}
function requireService() {
  if (!serviceReady) showToast('請先啟動本機服務並確認 Keychain wrapper', 'error');
  return serviceReady;
}
function updateModelGuide() {
  const model = document.getElementById('modelSelect').value;
  document.getElementById('modelGuide').textContent = model === 'gemini-3.8-flash-tts'
    ? 'Flash：適合角色表演、複雜雙人對話與高品質旁白。先用原聲，再加簡短語氣。'
    : model === 'gemini-3.8-flash-lite-tts'
    ? 'Flash-Lite：適合一般朗讀、大量 SRT 配音；優先考慮速度與成本。'
    : '3.1 Preview：供既有流程相容使用；擴充語音庫與自訂語音請選 3.8。';
  document.getElementById('customVoice').disabled = model.endsWith('preview');
  document.getElementById('loadVoicesBtn').disabled = model.endsWith('preview');
  document.getElementById('moreVoicesBtn').disabled = model.endsWith('preview');
}
async function apiRequest(path, payload, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 205000);
  try {
    const response = await fetch(serviceUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || `請求失敗（HTTP ${response.status}）`);
      error.httpStatus = response.status;
      error.retryAfter = Number(data.retry_after) || 0;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' && !signal?.aborted) {
      const timeoutError = new Error('請求逾時，請縮短內容後重試。');
      timeoutError.httpStatus = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('已取消', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('已取消', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
async function requestSpeech(payload, signal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return TtsCore.decodeAudio((await apiRequest('/api/tts', payload, signal)).audio); }
    catch (error) {
      if (error.name === 'AbortError' || ![429, 500, 502, 503].includes(error.httpStatus) || attempt === 2) throw error;
      const wait = Math.max(error.retryAfter * 1000, (error.httpStatus === 429 ? 15000 : 1500) * 2 ** attempt);
      document.getElementById('generationStatus').textContent = `${Math.round(wait / 1000)} 秒後重試…`;
      await delay(wait, signal);
    }
  }
}
let libraryPage = '';
let libraryLanguage = '';
async function loadVoiceLibrary(more = false) {
  if (!requireService()) return;
  const button = document.getElementById('loadVoicesBtn');
  const language = document.getElementById('voiceLanguage').value;
  if (language !== libraryLanguage) more = false;
  button.disabled = true;
  document.getElementById('moreVoicesBtn').disabled = true;
  try {
    const data = await apiRequest('/api/voices', { language_code: language, page_token: more ? libraryPage : '' });
    if (!more) document.querySelectorAll('optgroup[data-library]').forEach(group => group.remove());
    for (const id of ['voiceSelect', 'srtVoiceSelect']) {
      const select = document.getElementById(id);
      const group = document.createElement('optgroup');
      group.label = '擴充／已儲存語音'; group.dataset.library = 'true';
      for (const voice of data.voices || []) {
        if ([...select.options].some(option => option.value === voice.id)) continue;
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = [voice.display_name || voice.id, voice.language_code, voice.accent].filter(Boolean).join(' · ');
        group.appendChild(option);
      }
      select.appendChild(group);
    }
    libraryPage = data.next_page_token || ''; libraryLanguage = language;
    document.getElementById('moreVoicesBtn').classList.toggle('hidden', !libraryPage);
    showToast(`已載入 ${data.voices?.length || 0} 種語音。固定口音請使用區域語音。`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { updateModelGuide(); }
}
function selectedVoice(id) {
  const custom = id === 'voiceSelect' && !document.getElementById('customVoice').disabled
    ? document.getElementById('customVoice').value.trim() : '';
  if (custom && !/^voice_[A-Za-z0-9_-]+$/.test(custom)) throw new Error('自訂語音請填入已儲存的 voice_ ID。');
  return custom || document.getElementById(id).value;
}
updateModelGuide();
if (hostedMode) {
  document.getElementById('connectionLabel').textContent = '請連接本機語音服務';
  document.getElementById('connectionHelp').textContent = '線上版可編輯稿件；生成語音前，先啟動「啟動 TTS.command」並按右上角重新連線。';
} else checkConnection();
document.getElementById('singleText').addEventListener('input', event => {
  document.getElementById('textCount').textContent = `${Array.from(event.target.value).length.toLocaleString()} 字`;
});


// ─── Tabs ───
let currentTab = 'single';
function switchTab(tab) {
  if (generationController) return;
  currentTab = tab;
  document.querySelector('.main').classList.toggle('with-chat', tab === 'multi');
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('singleContent').classList.toggle('hidden', tab !== 'single');
  document.getElementById('multiContent').classList.toggle('hidden', tab !== 'multi');
  document.getElementById('srtContent').classList.toggle('hidden', tab !== 'srt');
  document.getElementById('singleConfig').classList.toggle('hidden', tab !== 'single');
  document.getElementById('chatPanel').classList.toggle('hidden', tab !== 'multi');
  if (tab === 'multi') requestAnimationFrame(() => document.querySelectorAll('.line-text').forEach(autoResize));
}

// ─── View Toggle (Script / Editor) ───
let currentView = 'editor';

function switchView(view) {
  if (generationController) return;
  if (currentView === 'script' && view === 'editor') {
    const script = document.getElementById('scriptTextarea').value.trim();
    if (script && !parseDialogueText(script)) return;
  }
  currentView = view;
  document.getElementById('viewBtnEditor').classList.toggle('active', view === 'editor');
  document.getElementById('viewBtnScript').classList.toggle('active', view === 'script');
  document.getElementById('editorView').classList.toggle('hidden', view !== 'editor');
  document.getElementById('scriptView').classList.toggle('hidden', view !== 'script');
  if (view === 'editor') requestAnimationFrame(() => document.querySelectorAll('.line-text').forEach(autoResize));

  if (view === 'script') {
    // Sync editor → script textarea
    syncEditorToScript();
  }
}

function syncEditorToScript() {
  const s1 = document.getElementById('speaker1Name').value || 'Speaker 1';
  const s2 = document.getElementById('speaker2Name').value || 'Speaker 2';
  const tone = document.getElementById('multiToneInput').value.trim();
  let text = tone ? `語氣/風格指令:\n${withDefaultVoicePrompt(tone)}\n\n` : '';
  dialogueLines.forEach(l => {
    if (!l.text.trim() && !l.emotion) return;
    const name = l.speaker === 1 ? s1 : s2;
    const emotionTag = l.emotion ? ` [${l.emotion}]` : '';
    text += `${name}:${emotionTag} ${l.text}\n\n`;
  });
  document.getElementById('scriptTextarea').value = text.trimEnd();
  updateScriptLineCount();
}

function parseScriptAndSwitch() {
  const scriptText = document.getElementById('scriptTextarea').value.trim();
  if (!scriptText) { showToast('請先貼上對話稿', 'error'); return; }
  switchView('editor');
}

function updateScriptLineCount() {
  const text = document.getElementById('scriptTextarea').value;
  const lines = text.split('\n').filter(l => /^.+?:\s*(\[.+?\])?\s*.+/.test(l.trim()));
  document.getElementById('scriptLineCount').textContent = `${lines.length} 行對話`;
}

// Auto-parse on paste in script view
document.addEventListener('DOMContentLoaded', () => {
  const scriptTa = document.getElementById('scriptTextarea');
  if (scriptTa) {
    scriptTa.addEventListener('paste', () => {
      // Wait for paste content to populate
      setTimeout(() => {
        updateScriptLineCount();
        // Auto-preview: parse and show count
        const text = scriptTa.value.trim();
        if (text) {
          const lines = text.split('\n').filter(l => /^.+?:\s*(\[.+?\])?\s*.+/.test(l.trim()));
          if (lines.length >= 2) {
            showToast(`偵測到 ${lines.length} 行對話，點擊「解析」或直接切回編輯器`, 'success');
          }
        }
      }, 50);
    });
    scriptTa.addEventListener('input', () => updateScriptLineCount());
  }
});

// ─── Dialogue Lines ───
let dialogueLines = [];
let lineIdCounter = 0;

function addDialogueLine(speaker, emotion = '', text = '') {
  if (generationController) return;
  const id = ++lineIdCounter;
  dialogueLines.push({ id, speaker, emotion, text });
  renderDialogue();
  // Focus new line
  setTimeout(() => {
    const el = document.querySelector(`[data-line-id="${id}"] .line-text`);
    if (el) el.focus();
  }, 50);
}

function removeDialogueLine(id) {
  if (generationController) return;
  dialogueLines = dialogueLines.filter(l => l.id !== id);
  renderDialogue();
}

function toggleSpeaker(id) {
  if (generationController) return;
  const line = dialogueLines.find(l => l.id === id);
  if (line) { line.speaker = line.speaker === 1 ? 2 : 1; renderDialogue(); }
}

function renderDialogue() {
  const area = document.getElementById('dialogueArea');
  area.innerHTML = '';
  dialogueLines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'dialogue-line';
    div.dataset.lineId = line.id;
    const badgeColor = line.speaker === 1 ? '#ea4335' : '#4285f4';
    div.innerHTML = `
      <div class="line-badge s${line.speaker}" style="background:${badgeColor};color:white;" onclick="toggleSpeaker(${line.id})" title="點擊切換講者">
        S${line.speaker}
      </div>
      <div class="line-content">
        <div class="line-emotion">
          <input type="text" value="${escHtml(line.emotion)}" placeholder="情緒 e.g. eager"
            oninput="updateLine(${line.id},'emotion',this.value)">
        </div>
        <textarea class="line-text" placeholder="輸入對話..."
          oninput="updateLine(${line.id},'text',this.value); autoResize(this)"
          onkeydown="handleLineKeydown(event, ${line.id})">${escHtml(line.text)}</textarea>
      </div>
      <div class="line-actions">
        <button onclick="moveLineUp(${line.id})" title="上移"><span class="material-icons-round">arrow_upward</span></button>
        <button onclick="moveLineDown(${line.id})" title="下移"><span class="material-icons-round">arrow_downward</span></button>
        <button onclick="removeDialogueLine(${line.id})" title="刪除"><span class="material-icons-round">close</span></button>
      </div>
    `;
    area.appendChild(div);
    // Auto resize text
    const ta = div.querySelector('.line-text');
    autoResize(ta);
  });
  area.scrollTop = area.scrollHeight;
}

function updateLine(id, field, value) {
  const line = dialogueLines.find(l => l.id === id);
  if (line) line[field] = value;
}

function handleLineKeydown(e, id) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    const line = dialogueLines.find(l => l.id === id);
    addDialogueLine(line.speaker === 1 ? 2 : 1);
  }
}

function moveLineUp(id) {
  const idx = dialogueLines.findIndex(l => l.id === id);
  if (idx > 0) { [dialogueLines[idx-1], dialogueLines[idx]] = [dialogueLines[idx], dialogueLines[idx-1]]; renderDialogue(); }
}
function moveLineDown(id) {
  const idx = dialogueLines.findIndex(l => l.id === id);
  if (idx < dialogueLines.length - 1) { [dialogueLines[idx+1], dialogueLines[idx]] = [dialogueLines[idx], dialogueLines[idx+1]]; renderDialogue(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Init with a couple lines
addDialogueLine(1, 'eager', '');
addDialogueLine(2, '', '');

// ─── Import/Export ───
function exportDialogue() {
  const s1 = document.getElementById('speaker1Name').value || 'Speaker 1';
  const s2 = document.getElementById('speaker2Name').value || 'Speaker 2';
  const tone = document.getElementById('multiToneInput').value.trim();
  let text = tone ? `語氣/風格指令:\n${withDefaultVoicePrompt(tone)}\n\n` : '';
  dialogueLines.forEach(l => {
    const name = l.speaker === 1 ? s1 : s2;
    const emotionTag = l.emotion ? ` [${l.emotion}]` : '';
    text += `${name}:${emotionTag} ${l.text}\n\n`;
  });
  // Copy to clipboard
  navigator.clipboard.writeText(text.trim()).then(() => {
    showToast('對話稿已複製到剪貼簿', 'success');
  });
}

function parseTonePrefixLine(line) {
  const cleaned = line
    .trim()
    .replace(/^[-*#>\s]+/, '')
    .replace(/^tune\s+/i, '')
    .trim();
  const match = cleaned.match(/^(?:語氣\s*\/\s*風格指令|語氣風格指令|Multi-Speaker\s+Prompt\s+Prefix|Prompt\s+Prefix)(?:\s*[（(][^）)]*[）)])?\s*[:：-]?\s*(.*)$/i);
  if (!match) return null;
  return (match[1] || '').trim();
}

function isLikelyDialogueLine(line) {
  return /^(?:Speaker\s*[12]|S[12])\s*[:：]/i.test(line)
    || /^.+?[:：]\s*\[.+?\]\s*.+/.test(line);
}

function parseDialogueText(text) {
  const parsed = [];
  const names = [];
  const tone = [];
  let collectingTone = false;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const prefix = parseTonePrefixLine(line);
    if (prefix !== null && !parsed.length) { collectingTone = true; if (prefix) tone.push(prefix); continue; }
    const match = line.match(/^([^:：]{1,80})[:：]\s*(?:\[([^\]]+)\])?\s*(.+)$/);
    if (collectingTone && !parsed.length && !match) {
      tone.push(line); continue;
    }
    if (match) {
      const name = match[1].trim();
      if (!names.includes(name)) names.push(name);
      parsed.push({ name, emotion: match[2] || '', text: match[3] });
      collectingTone = false;
    } else if (!parsed.length) tone.push(line);
    else parsed[parsed.length - 1].text += '\n' + raw; // Preserve multiline dialogue.
  }
  if (!parsed.length || names.length > 2) {
    showToast(names.length > 2 ? '雙人模式最多支援兩位講者；請拆成兩人稿件。' : '無法解析對話格式，原稿已保留。', 'error');
    return false;
  }
  dialogueLines = parsed.map(line => ({ id: ++lineIdCounter, speaker: names.indexOf(line.name) + 1, emotion: line.emotion, text: line.text }));
  document.getElementById('speaker1Name').value = names[0];
  document.getElementById('speaker2Name').value = names[1] || (names[0] === 'Speaker 2' ? 'Speaker 1' : 'Speaker 2');
  document.getElementById('multiToneInput').value = withDefaultVoicePrompt(tone.join('\n'));
  renderDialogue();
  return true;
}


// ─── Preview, generation and audio lifecycle ───
let previewAudio = null;
let previewUrl = null;
let previewButton = null;
let previewController = null;
const previewCache = new Map();
let currentAudioBlob = null;
let currentAudioUrl = null;
let currentAudioTab = 'single';

function stopPreview() {
  previewController?.abort(); previewController = null;
  previewAudio?.pause(); previewAudio = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  if (previewButton) {
    previewButton.classList.remove('loading', 'playing');
    previewButton.querySelector('.material-icons-round').textContent = 'play_circle';
  }
  previewButton = null;
}
async function previewVoice(selectId, button) {
  if (!requireService()) return;
  if (previewButton === button) { stopPreview(); return; }
  stopPreview();
  const controller = new AbortController();
  previewController = controller; previewButton = button;
  button.classList.add('loading');
  button.querySelector('.material-icons-round').textContent = 'hourglass_top';
  try {
    const voice = selectedVoice(selectId);
    const model = document.getElementById('modelSelect').value;
    const key = `${model}:${voice}`;
    let blob = previewCache.get(key);
    if (!blob) {
      blob = (await requestSpeech({ model, turns: [{ text: '你好，很高興為你服務。希望你喜歡我的聲音。' }],
        speakers: [{ speaker: 'Speaker 1', voice }], format: 'wav' }, controller.signal)).blob;
      previewCache.set(key, blob);
      if (previewCache.size > 12) previewCache.delete(previewCache.keys().next().value);
    }
    if (controller.signal.aborted) return;
    previewUrl = URL.createObjectURL(blob); previewAudio = new Audio(previewUrl);
    button.classList.remove('loading'); button.classList.add('playing');
    button.querySelector('.material-icons-round').textContent = 'stop_circle';
    previewAudio.onended = stopPreview;
    await previewAudio.play();
  } catch (error) {
    if (error.name !== 'AbortError') showToast(`試聽失敗：${error.message}`, 'error');
    if (previewController === controller) stopPreview();
  }
}
function setAudio(blob, tab, autoplay = false) {
  const player = document.getElementById('audioPlayer');
  player.pause();
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioBlob = blob; currentAudioTab = tab;
  currentAudioUrl = URL.createObjectURL(blob); player.src = currentAudioUrl;
  document.getElementById('audioPlayerWrapper').classList.remove('hidden');
  if (autoplay) player.play().catch(() => {});
}
function clearAudio() {
  const player = document.getElementById('audioPlayer');
  player.pause(); player.removeAttribute('src'); player.load();
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioBlob = null; currentAudioUrl = null;
  document.getElementById('audioPlayerWrapper').classList.add('hidden');
}
function setGenerationBusy(busy) {
  document.getElementById('generateBtn').disabled = busy;
  document.getElementById('generateBtnText').textContent = busy ? '生成中…' : '生成語音';
  document.getElementById('cancelBtn').classList.toggle('hidden', !busy);
  // Freeze inputs so the active request cannot become stale while it is generating.
  document.querySelectorAll('.content-area input, .content-area textarea, .content-area select, .content-area button, .config-bar input, .config-bar select, .config-bar button, #modelSelect').forEach(element => { element.disabled = busy; });
  if (!busy) updateModelGuide();
}
function cancelGeneration() {
  generationController?.abort();
  document.getElementById('generationStatus').textContent = '已取消後續生成；已送出的請求仍可能計費。';
}
async function generateSpeech() {
  if (generationController || !requireService()) return;
  if (currentTab === 'srt') return generateSrtSpeech();
  let jobs;
  const model = document.getElementById('modelSelect').value;
  const tab = currentTab;
  try {
    if (tab === 'single') {
      const text = document.getElementById('singleText').value;
      if (!text.trim()) throw new Error('請輸入朗讀文字。');
      if (text.length > 60000) throw new Error('長文上限為 60,000 字，請分次生成。');
      const style = document.getElementById('toneInput').value.trim();
      const voice = selectedVoice('voiceSelect');
      jobs = TtsCore.splitTranscript(text).map(part => ({ model, turns: [{ text: part, style }], speakers: [{ speaker: 'Speaker 1', voice }], format: 'pcm' }));
    } else {
      if (currentView === 'script' && !parseDialogueText(document.getElementById('scriptTextarea').value)) return;
      const names = [document.getElementById('speaker1Name').value.trim(), document.getElementById('speaker2Name').value.trim()];
      if (!names[0] || !names[1] || names[0] === names[1]) throw new Error('兩位講者的名稱不可空白或相同。');
      const tone = document.getElementById('multiToneInput').value.trim();
      const turns = dialogueLines.filter(line => line.text.trim()).map(line => ({ text: line.text,
        speaker: names[line.speaker - 1], style: [tone, line.emotion.trim()].filter(Boolean).join(', ') }));
      if (!turns.length) throw new Error('請輸入對話內容。');
      jobs = [{ model, turns, speakers: names.map((speaker, i) => ({ speaker, voice: document.getElementById(`voice${i + 1}Select`).value })), format: 'wav' }];
    }
  } catch (error) { showToast(error.message, 'error'); return; }
  const controller = new AbortController(); generationController = controller;
  stopPreview(); setGenerationBusy(true);
  const parts = [];
  try {
    for (let i = 0; i < jobs.length; i++) {
      document.getElementById('generationStatus').textContent = `生成第 ${i + 1} / ${jobs.length} 段…`;
      const audio = await requestSpeech(jobs[i], controller.signal);
      parts.push(audio.pcm);
    }
    setAudio(TtsCore.pcmToWav(TtsCore.concatPcm(parts)), tab, true);
    document.getElementById('generationStatus').textContent = `完成 ${jobs.length} 段 · AI 生成語音`;
    showToast('語音生成成功！', 'success');
  } catch (error) {
    if (parts.length) setAudio(TtsCore.pcmToWav(TtsCore.concatPcm(parts)), tab);
    const partial = parts.length ? `已保留 ${parts.length} / ${jobs.length} 段，可下載部分音檔。` : '';
    document.getElementById('generationStatus').textContent = error.name === 'AbortError' ? '已取消後續生成。' + partial : '生成失敗。' + partial;
    if (error.name !== 'AbortError') showToast(error.message, 'error');
  } finally { generationController = null; setGenerationBusy(false); }
}
function downloadAudio() {
  if (!currentAudioBlob) return;
  const link = document.createElement('a');
  const url = URL.createObjectURL(currentAudioBlob); link.href = url;
  link.download = `tts-${currentAudioTab}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0,19)}.wav`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.addEventListener('pagehide', () => { stopPreview(); if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl); });


// ─── Chat (LLM Script Assistant) ───
let currentChatMode = 'generate';
let chatHistories = {
  generate: [],
  format: []
};

const CHAT_MODES = {
  generate: {
    intro: 'AI 對話稿助手 — 幫你產生適合 TTS 的雙人對話稿<br>輸入你的想法，AI 會生成符合格式的對話稿',
    placeholder: '描述你想要的對話場景...',
    temperature: 0.9,
    prompt: `你是一個專業的 TTS 對話稿助手。你的工作是幫用戶創建適合 Text-to-Speech 系統的雙人對話稿。

你產生的對話稿必須嚴格遵循以下格式：

1. 開頭必須有語氣/風格描述（1-2行），語氣請簡短，可留空
2. 對話格式為：Speaker 1: [情緒] 對話文字
3. 情緒標籤用方括號 [] 包裹，例如 [eager], [confused], [shouting]
4. 每行一句對話
5. Speaker 1 和 Speaker 2 交替出現

範例格式：
casual and friendly

Speaker 1: [eager] 你今天想吃什麼？
Speaker 2: [thinking] 嗯...我想想看...
Speaker 1: [impatient] 快點啦！我好餓！
Speaker 2: [excited] 我知道了！吃火鍋！

重要規則：
- 對話要自然、口語化，像真人對話
- 僅在需要時加入簡短的情緒標籤。不要在語氣欄位指定年齡、性別、固定口音或聲線一致性
- 笑聲、嘆氣與停頓使用英文尖括號標籤：<laugh>、<sigh>、<short pause>，不要加入非人聲音效
- 用繁體中文（台灣用語）
- 如果用戶提供場景或主題，據此創作
- 直接輸出對話稿，不要加額外的解釋或 markdown 格式
- 當用戶說「先不做回應」或「等待指令」時，簡短確認即可`
  },
  format: {
    intro: '整理稿件模式 — 貼上既有對話稿，AI 只補 TTS 格式與情緒標籤<br>台詞文字會保留，不進行改寫',
    placeholder: '貼上既有對話稿，將整理成 Speaker 1: [emotion] 台詞 的格式...',
    temperature: 0.2,
    prompt: `你是一個專業的 TTS 對話稿格式整理助手。你的工作是把用戶提供的既有對話稿整理成適合 Text-to-Speech 系統的雙人對話稿格式。

你必須嚴格遵守「不修改台詞」原則：
- 不改寫、不潤飾、不翻譯、不增刪台詞中的任何文字
- 不改變台詞順序
- 不合併或拆分台詞，除非原稿明顯把同一句台詞斷成多行
- 可以新增 Speaker 標示與 [情緒] 標籤
- 可以把括號中的舞台提示、語氣提示轉換成英文情緒標籤，但台詞正文要保持原樣
- 這個工具主要支援雙人 TTS；如果原稿已有兩位說話者，盡量保留原名稱
- 如果原稿沒有說話者名稱，使用 Speaker 1 / Speaker 2 交替標示
- 若原稿已有 [emotion] 標籤，可保留或補足，但不要改動後面的台詞

輸出格式：
1. 開頭必須標注語氣/風格指令區塊，格式固定為：
   語氣/風格指令 (語氣設定):
   接著放 1-2 行適合 TTS 的整體語氣/風格描述，使用簡短的情境語氣，不加入固定音高指令
2. 如果原稿已有語氣、場景、舞台提示或風格描述，放進上述區塊；如果沒有，請依原稿氣氛補一個簡短、保守的整體朗讀風格
3. 對話每行格式為：Speaker 1: [emotion] 台詞文字
4. 情緒標籤用英文，放在方括號 [] 中，例如 [calm], [angry], [nervous], [excited]
5. 直接輸出整理後的對話稿，不要加額外解釋、註解或 markdown 格式

範例：
輸入：
A：你怎麼現在才來？
B：路上塞車啊。

輸出：
語氣/風格指令 (語氣設定):
casual and friendly

Speaker 1: [angry] 你怎麼現在才來？
Speaker 2: [apologetic] 路上塞車啊。`
  }
};

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  if (!requireService()) return;

  input.value = '';
  input.style.height = 'auto';

  const requestMode = currentChatMode;
  const mode = CHAT_MODES[requestMode];
  const chatHistory = chatHistories[requestMode];

  // Add user message
  chatHistory.push({ role: 'user', parts: [{ text: msg }] });
  appendChatMsg('user', msg);

  const sendBtn = document.getElementById('chatSendBtn');
  sendBtn.disabled = true;

  try {
    const data = await apiRequest('/api/chat', { instruction: mode.prompt, contents: chatHistory,
      temperature: mode.temperature });
    const reply = data.text;

    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    if (currentChatMode === requestMode) {
      appendChatMsg('assistant', reply, hasDialogueFormat(reply));
    }

  } catch (err) {
    if (currentChatMode === requestMode) {
      chatHistory.pop();
      renderChatHistory();
      appendChatMsg('system', `錯誤: ${err.message}（未送出的輸入已保留）`);
      input.value = msg;
    }
  } finally {
    sendBtn.disabled = false;
  }
}

function setChatMode(mode) {
  if (!CHAT_MODES[mode] || currentChatMode === mode) return;
  currentChatMode = mode;

  document.getElementById('chatModeGenerate').classList.toggle('active', mode === 'generate');
  document.getElementById('chatModeFormat').classList.toggle('active', mode === 'format');
  document.getElementById('chatModeGenerate').setAttribute('aria-selected', mode === 'generate' ? 'true' : 'false');
  document.getElementById('chatModeFormat').setAttribute('aria-selected', mode === 'format' ? 'true' : 'false');

  const input = document.getElementById('chatInput');
  input.placeholder = CHAT_MODES[mode].placeholder;
  input.value = '';
  input.style.height = 'auto';
  renderChatHistory();
}

function renderChatHistory() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = `<div class="chat-msg system">${CHAT_MODES[currentChatMode].intro}</div>`;

  chatHistories[currentChatMode].forEach(item => {
    const text = item.parts?.[0]?.text || '';
    if (item.role === 'user') {
      appendChatMsg('user', text);
    } else if (item.role === 'model') {
      appendChatMsg('assistant', text, hasDialogueFormat(text));
    }
  });
}

function hasDialogueFormat(text) {
  // Check if text contains speaker dialogue format
  return /Speaker\s*[12][:：]/i.test(text) || /^.+?[:：]\s*\[.+?\]/m.test(text);
}

function appendChatMsg(role, text, showApply = false) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  // Simple formatting
  let html = escHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
  // Inline code
  html = html.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;">$1</code>');

  div.innerHTML = html;

  if (showApply && role === 'assistant') {
    const btn = document.createElement('button');
    btn.className = 'apply-btn';
    btn.innerHTML = '<span class="material-icons-round" style="font-size:14px;">arrow_forward</span> 套用到對話編輯器';
    btn.onclick = () => applyDialogue(text);
    div.appendChild(btn);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function applyDialogue(text) {
  // Switch to multi tab + editor view
  switchTab('multi');
  if (currentView === 'script') switchView('editor');
  parseDialogueText(text);
  showToast('已套用對話稿到編輯器', 'success');
}

function clearChat() {
  chatHistories[currentChatMode] = [];
  renderChatHistory();
}

// ─── Toast ───
function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  while (container.children.length > 3) container.firstElementChild.remove();
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ─── Auto-resize chat input ───
const chatInputEl = document.getElementById('chatInput');
let isComposing = false;
chatInputEl.addEventListener('compositionstart', () => { isComposing = true; });
chatInputEl.addEventListener('compositionend', () => { isComposing = false; });
chatInputEl.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
    e.preventDefault();
    sendChat();
  }
}

// ─── SRT Functions ───
let srtEntries = [];
let srtGenerating = false;

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('srtUploadZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.srt')) {
      readSrtFile(file);
    } else {
      showToast('請上傳 .srt 格式檔案', 'error');
    }
  });
});

function handleSrtFile(event) {
  const file = event.target.files[0];
  if (file) readSrtFile(file);
}

function readSrtFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    document.getElementById('srtPasteArea').value = text;
    parseSrtText(text);
  };
  reader.readAsText(file, 'utf-8');
}

function parseSrtFromPaste() {
  const text = document.getElementById('srtPasteArea').value.trim();
  if (!text) { showToast('請先貼上或上傳 SRT 內容', 'error'); return; }
  parseSrtText(text);
}

function parseSrtText(text) {
  if (srtGenerating) return;
  const parsed = [];
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  try {
    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.trim().split('\n');
      const index = lines.findIndex(line => line.includes('-->'));
      if (index < 0) throw new Error('有字幕缺少時間碼，請檢查格式。');
      const match = lines[index].match(/^\s*(\d{1,2}:\d{2}:\d{2}[,.:]\d{2,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.:]\d{2,3})(?:\s+.*)?$/);
      if (!match) throw new Error('字幕時間碼格式錯誤。');
      const textContent = lines.slice(index + 1).join('\n').trim();
      const startMs = tcToMs(match[1]); const endMs = tcToMs(match[2]);
      if (!textContent || endMs <= startMs) throw new Error('字幕台詞不可空白，結束時間必須晚於開始時間。');
      parsed.push({ index: parsed.length + 1, startTC: match[1], endTC: match[2], startMs, endMs, text: textContent, status: 'pending' });
    }
    if (!parsed.length) throw new Error('無法解析 SRT 內容。');
    const offset = document.getElementById('srtShiftHour').checked ? Math.floor(Math.min(...parsed.map(entry => entry.startMs)) / 3600000) * 3600000 : 0;
    if (Math.max(...parsed.map(entry => entry.endMs)) - offset > TtsCore.MAX_TIMELINE_MS) throw new Error('時間軸上限為 30 分鐘；一小時起點的稿件請勾選「扣除整小時起點」後重新匯入。');
    if (offset) parsed.forEach(entry => { entry.startMs -= offset; entry.endMs -= offset; entry.startTC = msToTC(entry.startMs); entry.endTC = msToTC(entry.endMs); });
    srtEntries = parsed; clearAudio();
    renderSrtEntries();
    document.getElementById('srtEntryCount').textContent = `${srtEntries.length} 條字幕`;
    showToast(`已解析 ${srtEntries.length} 條字幕${offset ? '（已扣除整小時起點）' : ''}`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}
function tcToMs(tc) { return TtsCore.tcToMs(tc, Number(document.getElementById('srtFps').value)); }

function msToTC(ms) {
  const h = Math.floor(ms / 3600000);
  ms %= 3600000;
  const m = Math.floor(ms / 60000);
  ms %= 60000;
  const s = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(millis).padStart(3,'0')}`;
}

function renderSrtEntries() {
  const container = document.getElementById('srtEntries');
  container.innerHTML = '';

  const hasErrors = srtEntries.some(e => e.status === 'error');

  // Merge bar at the top (always present when entries loaded)
  if (srtEntries.length > 0) {
    const mergeBar = document.createElement('div');
    mergeBar.className = 'srt-merge-bar';
    mergeBar.innerHTML = `
      <label class="srt-entry-cb" style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:var(--text-secondary);">
        <input type="checkbox" id="srtSelectAll" onchange="srtToggleSelectAll(this.checked)"> 全選
      </label>
      <button class="icon-btn" onclick="srtMergeSelected()" title="合併所選字幕的 timecode 與文字">
        <span class="material-icons-round" style="font-size:16px;">merge</span> 合併所選
      </button>
      <span class="merge-info" id="srtSelectionInfo">已選 0 條</span>
    `;
    container.appendChild(mergeBar);
  }

  srtEntries.forEach(entry => {
    const div = document.createElement('div');
    div.className = `srt-entry ${entry.status}`;
    div.id = `srt-entry-${entry.index}`;

    let statusHtml = '';
    switch (entry.status) {
      case 'pending': statusHtml = '<span class="material-icons-round" style="color:var(--text-secondary)">schedule</span>'; break;
      case 'generating': statusHtml = '<div class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(255,167,38,0.3);border-top-color:var(--warning);"></div>'; break;
      case 'done': statusHtml = '<span class="material-icons-round" style="color:var(--success)">check_circle</span>'; break;
      case 'error': statusHtml = `<button class="srt-retry-btn" onclick="retrySingleEntry(${entry.index})" title="重新生成此條"><span class="material-icons-round" style="font-size:18px;">refresh</span></button>`; break;
    }

    // Escape text for textarea value
    const escapedText = entry.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    div.innerHTML = `
      <div class="srt-entry-cb">
        <input type="checkbox" data-srt-cb="${entry.index}" onchange="srtUpdateSelectionInfo()">
      </div>
      <div class="srt-entry-index">#${entry.index}</div>
      <div class="srt-entry-tc">${escHtml(entry.startTC)} → ${escHtml(entry.endTC)}</div>
      <div class="srt-entry-text">
        <textarea rows="1" oninput="srtUpdateText(${entry.index}, this.value); srtAutoResize(this)"
          onfocus="srtAutoResize(this)">${escapedText}</textarea>
      </div>
      <div class="srt-entry-actions">
        <button onclick="srtDeleteEntry(${entry.index})" title="刪除此條"><span class="material-icons-round" style="font-size:18px;">close</span></button>
      </div>
      <div class="srt-entry-status">${statusHtml}</div>
    `;
    container.appendChild(div);

    // Auto-resize textarea after append
    const ta = div.querySelector('.srt-entry-text textarea');
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  });

  // Show/hide retry-all button
  let retryAllBtn = document.getElementById('srtRetryAllBtn');
  if (hasErrors && !srtGenerating) {
    if (!retryAllBtn) {
      retryAllBtn = document.createElement('button');
      retryAllBtn.id = 'srtRetryAllBtn';
      retryAllBtn.className = 'icon-btn';
      retryAllBtn.style.cssText = 'margin-top:10px;background:var(--accent);border-color:var(--accent);color:white;';
      retryAllBtn.innerHTML = '<span class="material-icons-round">replay</span> 重新生成所有失敗的音檔';
      retryAllBtn.onclick = retryAllFailed;
      container.parentElement.insertBefore(retryAllBtn, container.nextSibling);
    }
  } else if (retryAllBtn) {
    retryAllBtn.remove();
  }

  // Hide paste area when entries are loaded
  document.getElementById('srtPasteArea').style.display = srtEntries.length > 0 ? 'none' : '';
  document.getElementById('srtUploadZone').style.display = srtEntries.length > 0 ? 'none' : '';
}

// ─── SRT Edit / Merge / Delete ───
function srtAutoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function srtUpdateText(entryIndex, newText) {
  const entry = srtEntries.find(e => e.index === entryIndex);
  if (entry) {
    if (srtGenerating) return;
    entry.text = newText;
    clearAudio();
    // If it was already generated, mark as pending since text changed
    if (entry.status === 'done') {
      entry.status = 'pending';
      delete entry.audio; delete entry.audioKey;
      updateSrtEntryUI(entry);
    }
  }
}

function srtDeleteEntry(entryIndex) {
  if (srtGenerating) return;
  clearAudio();
  srtEntries = srtEntries.filter(e => e.index !== entryIndex);
  // Re-number
  srtEntries.forEach((e, i) => { e.index = i + 1; });
  renderSrtEntries();
  document.getElementById('srtEntryCount').textContent = `${srtEntries.length} 條字幕`;
}

function srtToggleSelectAll(checked) {
  document.querySelectorAll('[data-srt-cb]').forEach(cb => { cb.checked = checked; });
  srtUpdateSelectionInfo();
}

function srtUpdateSelectionInfo() {
  const checked = document.querySelectorAll('[data-srt-cb]:checked');
  const info = document.getElementById('srtSelectionInfo');
  if (info) info.textContent = `已選 ${checked.length} 條`;
}

function srtGetSelectedIndices() {
  const indices = [];
  document.querySelectorAll('[data-srt-cb]:checked').forEach(cb => {
    indices.push(parseInt(cb.dataset.srtCb));
  });
  return indices;
}

function srtMergeSelected() {
  if (srtGenerating) return;
  const selected = srtGetSelectedIndices();
  if (selected.length < 2) {
    showToast('請至少勾選 2 條字幕來合併', 'error');
    return;
  }

  // Find the actual entries (in their current order)
  const toMerge = srtEntries.filter(e => selected.includes(e.index));
  if (toMerge.length < 2) return;

  // Sort by current order (index)
  toMerge.sort((a, b) => a.index - b.index);

  // Merged result: earliest start → latest end, text concatenated
  const mergedEntry = {
    index: toMerge[0].index,
    startTC: msToTC(Math.min(...toMerge.map(entry => entry.startMs))),
    endTC: msToTC(Math.max(...toMerge.map(entry => entry.endMs))),
    startMs: Math.min(...toMerge.map(entry => entry.startMs)),
    endMs: Math.max(...toMerge.map(entry => entry.endMs)),
    text: toMerge.map(e => e.text).join('\n'),
    status: 'pending'
  };

  clearAudio();

  // Replace in array: remove all merged entries, insert merged one at the first position
  const firstIdx = srtEntries.indexOf(toMerge[0]);
  const removeIndices = new Set(toMerge.map(e => e.index));
  srtEntries = srtEntries.filter(e => !removeIndices.has(e.index));
  srtEntries.splice(firstIdx, 0, mergedEntry);

  // Re-number
  srtEntries.forEach((e, i) => { e.index = i + 1; });

  renderSrtEntries();
  document.getElementById('srtEntryCount').textContent = `${srtEntries.length} 條字幕`;
  showToast(`已合併 ${toMerge.length} 條字幕`, 'success');
}

function clearSrt() {
  if (srtGenerating) return;
  clearAudio();
  srtEntries = [];
  document.getElementById('srtEntries').innerHTML = '';
  document.getElementById('srtPasteArea').value = '';
  document.getElementById('srtPasteArea').style.display = '';
  document.getElementById('srtUploadZone').style.display = '';
  document.getElementById('srtProgressBar').classList.add('hidden');
  document.getElementById('srtEntryCount').textContent = '尚未載入';
  document.getElementById('srtFileInput').value = '';
  const retryBtn = document.getElementById('srtRetryAllBtn');
  if (retryBtn) retryBtn.remove();
}

// ─── Resumable SRT generation ───
function srtSettings() {
  return { model: document.getElementById('modelSelect').value, voice: selectedVoice('srtVoiceSelect'),
    style: document.getElementById('srtToneInput').value.trim() };
}
function srtAudioKey(entry, settings) { return JSON.stringify([settings.model, settings.voice, settings.style, entry.text]); }
async function runSrtBatch(entries) {
  if (generationController || !requireService()) return;
  let settings;
  try { settings = srtSettings(); } catch (error) { showToast(error.message, 'error'); return; }
  const controller = new AbortController(); generationController = controller; srtGenerating = true;
  stopPreview(); clearAudio(); setGenerationBusy(true);
  for (const entry of srtEntries) {
    if (entry.audioKey !== srtAudioKey(entry, settings)) { delete entry.audio; delete entry.audioKey; entry.status = 'pending'; }
  }
  renderSrtEntries(); setGenerationBusy(true);
  document.getElementById('srtProgressBar').classList.remove('hidden');
  let processed = 0;
  try {
    for (const entry of entries) {
      if (controller.signal.aborted) break;
      if (entry.audio && entry.audioKey === srtAudioKey(entry, settings)) { processed++; continue; }
      entry.status = 'generating'; updateSrtEntryUI(entry);
      updateSrtProgress(processed, entries.length, `正在生成 #${entry.index}…`);
      document.getElementById('generationStatus').textContent = `字幕 ${processed + 1} / ${entries.length}`;
      try {
        const audio = await requestSpeech({ model: settings.model, turns: [{ text: entry.text, style: settings.style }],
          speakers: [{ speaker: 'Speaker 1', voice: settings.voice }], format: 'pcm' }, controller.signal);
        entry.audio = audio.pcm; entry.audioKey = srtAudioKey(entry, settings); entry.status = 'done'; delete entry.errorMsg;
      } catch (error) {
        if (error.name === 'AbortError') { entry.status = 'pending'; break; }
        entry.status = 'error'; entry.errorMsg = error.message;
        // Fail fast on credentials, unavailable models or quota; preserve completed audio.
        if ([401, 403, 404, 429].includes(error.httpStatus)) { showToast(error.message, 'error'); break; }
      }
      processed++; updateSrtEntryUI(entry);
      updateSrtProgress(processed, entries.length, `已處理 ${processed} / ${entries.length}`);
      if (processed < entries.length) await delay(350, controller.signal);
    }
  } catch (error) {
    if (error.name !== 'AbortError') showToast(error.message, 'error');
  } finally {
    srtGenerating = false; generationController = null;
    finalizeSrtAudio(controller.signal.aborted);
    renderSrtEntries(); setGenerationBusy(false);
  }
}
async function generateSrtSpeech() {
  if (!srtEntries.length) { showToast('請先載入 SRT 字幕。', 'error'); return; }
  return runSrtBatch(srtEntries);
}
async function retrySingleEntry(index) {
  const entry = srtEntries.find(item => item.index === index);
  if (!entry || srtGenerating) return;
  const settings = srtSettings();
  if (srtEntries.some(item => item.audio && item.audioKey !== srtAudioKey(item, settings))) {
    showToast('語音或風格已變更，請按「生成語音」重新生成整份稿件。', 'error'); return;
  }
  return runSrtBatch([entry]);
}
async function retryAllFailed() { return runSrtBatch(srtEntries); }
function finalizeSrtAudio(cancelled = false) {
  const completed = srtEntries.filter(entry => entry.audio && entry.status === 'done');
  const failed = srtEntries.filter(entry => entry.status === 'error').length;
  const pending = srtEntries.length - completed.length - failed;
  if (completed.length) {
    try {
      const result = TtsCore.assembleTimeline(completed.map(entry => ({ startMs: entry.startMs, endMs: entry.endMs, pcmData: entry.audio })),
        { mode: document.getElementById('srtTimingMode').value, endMs: Math.max(...srtEntries.map(entry => entry.endMs)) });
      setAudio(result.blob, 'srt');
      const timing = result.overruns ? `；${result.overruns} 句超出字幕時長` : '';
      const shifted = result.shifted ? `；${result.shifted} 句已順延` : '';
      const message = `${cancelled ? '已取消。' : ''}${completed.length} 成功 / ${failed} 失敗 / ${pending} 待生成${timing}${shifted}`;
      updateSrtProgress(completed.length, srtEntries.length, message);
      document.getElementById('generationStatus').textContent = message;
      showToast(message, failed || pending || result.overruns ? '' : 'success');
    } catch (error) { showToast(`音訊合併失敗：${error.message}`, 'error'); }
  } else {
    const message = cancelled ? '已取消，可按生成語音繼續。' : '尚無可用音訊，請修正錯誤後重試。';
    updateSrtProgress(0, srtEntries.length, message);
    document.getElementById('generationStatus').textContent = message;
  }
}


function updateSrtEntryUI(entry) {
  const el = document.getElementById(`srt-entry-${entry.index}`);
  if (!el) return;
  el.className = `srt-entry ${entry.status}`;
  const statusEl = el.querySelector('.srt-entry-status');
  switch (entry.status) {
    case 'pending': statusEl.innerHTML = '<span class="material-icons-round" style="color:var(--text-secondary)">schedule</span>'; break;
    case 'generating': statusEl.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(255,167,38,0.3);border-top-color:var(--warning);"></div>'; break;
    case 'done': statusEl.innerHTML = '<span class="material-icons-round" style="color:var(--success)">check_circle</span>'; break;
    case 'error': statusEl.innerHTML = `<button class="srt-retry-btn" onclick="retrySingleEntry(${entry.index})" title="重新生成此條"><span class="material-icons-round" style="font-size:18px;">refresh</span></button>`; break;
  }
  // Scroll to the generating entry
  if (entry.status === 'generating') {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updateSrtProgress(completed, total, text) {
  document.getElementById('srtProgressText').textContent = text;
  if (completed !== null && total !== null) {
    document.getElementById('srtProgressCount').textContent = `${completed} / ${total}`;
    const pct = total > 0 ? (completed / total * 100) : 0;
    document.getElementById('srtProgressFill').style.width = pct + '%';
  }
}
