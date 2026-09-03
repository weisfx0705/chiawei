'use strict';

const DEFAULT_PERSONA = `你是一位專業即席翻譯官。你的任務是協助講者在演講場景中進行中文、英文逐句翻譯。語氣要友善、帶有情感。

# 工作方式
- 進行逐句雙向翻譯：講者說中文時，你翻成英文；講者切換到英文時，你翻成中文。
- 每次僅翻譯一個句子，等講者說完一句後再翻譯。
- 只說出譯文，不要加引導語，也不要複誦原文。
- 保持自然、親切、對話式，避免冗長講解。`;

const DEFAULT_KNOWLEDGE = `# 詞彙表／專有名詞對照

義守大學 = I-Shou University
國際及兩岸事務處 = Office of International and Cross-Strait Affairs
主校區 = Main Campus
燕巢校區 = Yanchao Campus`;

const DEFAULT_INTERPRETER = {
  enabled: true,
  language_a: 'zh-TW',
  language_b: 'en',
  venue: '義守大學 I-Shou University',
  tone: 'warm',
  pacing: 'balanced',
  style: 'strict',
  show_source: true,
  notes: ''
};

const STORAGE_KEYS = {
  profile: 'talktwin.profile.v1',
  voice: 'talktwin.voice.v2',
  rate: 'talktwin.rate.v1',
  autoSpeak: 'talktwin.autoSpeak.v1',
  layout: 'talktwin.layout.v1',
  microphone: 'talktwin.microphone.v1',
  interpreter: 'talktwin.interpreter.v1'
};

const LAYOUT_MODES = ['default', 'focus', 'cinema'];
// Cinema hides the top bar, so it must never be restored from storage on load.
const RESTORABLE_LAYOUT_MODES = ['default', 'focus'];

const OPENAI_TTS_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'
];

// OpenAI 的文件只描述音色（warm、bright…），沒有標示性別。
// 這裡依一般聽感標註，純粹方便挑選，不是官方定義。
const VOICE_GENDER = {
  alloy: '👨', ash: '👨', ballad: '👨', coral: '👩', echo: '👨',
  fable: '👨', nova: '👩', onyx: '👨', sage: '👩', shimmer: '👩',
  verse: '👨', marin: '👩', cedar: '👨'
};

const state = {
  serverAvailable: false,
  status: null,
  profile: { persona: DEFAULT_PERSONA, knowledge: DEFAULT_KNOWLEDGE },
  interpreter: { ...DEFAULT_INTERPRETER, languages: [] },
  history: [],
  busy: false,
  lastReply: '',
  speechSession: 0,
  mouthTimer: null,
  recognition: null,
  listening: false,
  toastTimer: null,
  profileDirty: false,
  settings: null,
  blinkTimer: null,
  gazeTimer: null,
  tts: {
    objectUrl: '',
    requestController: null,
    audioContext: null,
    analyser: null,
    analyserFrame: null,
    source: null,
    env: { loud: 0, shape: 0 }
  },
  avatar: {
    is_custom: false,
    id: 'default',
    name: '預設角色',
    image_url: 'assets/avatar.jpeg',
    fit: 'cover',
    rig_mode: 'sophon',
    scale: 1,
    offset_x: 0,
    offset_y: 0,
    memory_opacity: 0.94,
    active_id: 'default',
    library: []
  },
  avatarDraftDataUrl: '',
  avatarDirty: false,
  orb: null,
  previewOrb: null,
  avatarFraming: { scale: 1, offsetX: 0, offsetY: 0, opacity: 0.94 },
  avatarDrag: null,
  pendingAvatarAutoFocus: false,
  autoPalette: null,
  currentOrbColors: null,
  microphone: {
    selectedId: '',
    activeLabel: '',
    devices: []
  },
  realtime: {
    connecting: false,
    connected: false,
    muted: false,
    peer: null,
    channel: null,
    localStream: null,
    audioContext: null,
    analyser: null,
    analyserFrame: null,
    outputActive: false,
    awaitingResponse: false,
    lastOutputAudioAt: 0,
    responseText: '',
    responseFinalized: false,
    typingNode: null,
    voiceDraft: null,
    lastUserItemId: '',
    sessionConfig: null,
    sessionReadyResolve: null,
    sessionReadyReject: null,
    sessionReadyTimer: null,
    soundContext: null,
    dialToneTimer: null,
    thinkingToneTimer: null,
    thinkingToneInterval: null,
    env: { loud: 0, shape: 0 }
  }
};

// Shared speech envelope tuning (Phase 1 smoothing). Attack is fast so the mouth
// opens promptly; release is slow so it closes gently instead of snapping shut.
const SPEECH = {
  ATTACK: 0.5,
  RELEASE: 0.16,
  FLOOR: 0.012,
  GAIN: 9,
  TALK_ON: 0.06,
  TALK_OFF: 0.028
};

const el = {
  enginePill: document.getElementById('enginePill'),
  engineLabel: document.getElementById('engineLabel'),
  statusDot: document.getElementById('statusDot'),
  settingsButton: document.getElementById('settingsButton'),
  modeTag: document.getElementById('modeTag'),
  layoutSwitch: document.getElementById('layoutSwitch'),
  layoutOptions: Array.from(document.querySelectorAll('.layout-option')),
  cinemaExitButton: document.getElementById('cinemaExitButton'),
  avatarArt: document.getElementById('avatarArt'),
  avatarImage: document.getElementById('avatarImage'),
  orbCanvas: document.getElementById('orbCanvas'),
  orbStateLabel: document.getElementById('orbStateLabel'),
  sourceChipImage: document.getElementById('sourceChipImage'),
  sourceChipName: document.getElementById('sourceChipName'),
  captionLabel: document.getElementById('captionLabel'),
  liveCaption: document.getElementById('liveCaption'),
  repeatButton: document.getElementById('repeatButton'),
  stopVoiceButton: document.getElementById('stopVoiceButton'),
  voiceSelect: document.getElementById('voiceSelect'),
  rateSlider: document.getElementById('rateSlider'),
  rateOutput: document.getElementById('rateOutput'),
  autoSpeakToggle: document.getElementById('autoSpeakToggle'),
  realtimeCard: document.getElementById('realtimeCard'),
  realtimeOrb: document.getElementById('realtimeOrb'),
  realtimeTitle: document.getElementById('realtimeTitle'),
  realtimeStatus: document.getElementById('realtimeStatus'),
  quickRealtimeVoiceSelect: document.getElementById('quickRealtimeVoiceSelect'),
  realtimeButton: document.getElementById('realtimeButton'),
  realtimeMuteButton: document.getElementById('realtimeMuteButton'),
  realtimeAudio: document.getElementById('realtimeAudio'),
  ttsAudio: document.getElementById('ttsAudio'),
  chatLog: document.getElementById('chatLog'),
  messageForm: document.getElementById('messageForm'),
  messageInput: document.getElementById('messageInput'),
  sendButton: document.getElementById('sendButton'),
  micButton: document.getElementById('micButton'),
  inputHint: document.getElementById('inputHint'),
  clearChatButton: document.getElementById('clearChatButton'),
  chatTab: document.getElementById('chatTab'),
  profileTab: document.getElementById('profileTab'),
  chatView: document.getElementById('chatView'),
  profileView: document.getElementById('profileView'),
  personaInput: document.getElementById('personaInput'),
  notesInput: document.getElementById('notesInput'),
  languageASelect: document.getElementById('languageASelect'),
  languageBSelect: document.getElementById('languageBSelect'),
  swapLanguagesButton: document.getElementById('swapLanguagesButton'),
  languagePairHint: document.getElementById('languagePairHint'),
  venueInput: document.getElementById('venueInput'),
  toneSelect: document.getElementById('toneSelect'),
  pacingSelect: document.getElementById('pacingSelect'),
  styleSelect: document.getElementById('styleSelect'),
  showSourceToggle: document.getElementById('showSourceToggle'),
  saveInterpreterButton: document.getElementById('saveInterpreterButton'),
  saveInterpreterButtonTop: document.getElementById('saveInterpreterButtonTop'),
  regeneratePromptButton: document.getElementById('regeneratePromptButton'),
  captionSource: document.getElementById('captionSource'),
  brandPair: document.getElementById('brandPair'),
  knowledgeInput: document.getElementById('knowledgeInput'),
  saveProfileButton: document.getElementById('saveProfileButton'),
  resetProfileButton: document.getElementById('resetProfileButton'),
  saveState: document.getElementById('saveState'),
  engineModeDetail: document.getElementById('engineModeDetail'),
  engineModelDetail: document.getElementById('engineModelDetail'),
  profileStorageDetail: document.getElementById('profileStorageDetail'),
  engineHelp: document.getElementById('engineHelp'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  settingsCloseButton: document.getElementById('settingsCloseButton'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  apiKeyState: document.getElementById('apiKeyState'),
  toggleApiKeyButton: document.getElementById('toggleApiKeyButton'),
  chatModelInput: document.getElementById('chatModelInput'),
  realtimeModelInput: document.getElementById('realtimeModelInput'),
  realtimeVoiceSelect: document.getElementById('realtimeVoiceSelect'),
  microphoneSelect: document.getElementById('microphoneSelect'),
  microphoneHelp: document.getElementById('microphoneHelp'),
  refreshMicrophonesButton: document.getElementById('refreshMicrophonesButton'),
  ttsModelInput: document.getElementById('ttsModelInput'),
  ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
  avatarFileInput: document.getElementById('avatarFileInput'),
  avatarPreviewImage: document.getElementById('avatarPreviewImage'),
  avatarPreviewFrame: document.getElementById('avatarPreviewFrame'),
  essencePreviewCanvas: document.getElementById('essencePreviewCanvas'),
  avatarRigModeSelect: document.getElementById('avatarRigModeSelect'),
  avatarZoomRange: document.getElementById('avatarZoomRange'),
  avatarZoomOutput: document.getElementById('avatarZoomOutput'),
  avatarOpacityRange: document.getElementById('avatarOpacityRange'),
  avatarOpacityOutput: document.getElementById('avatarOpacityOutput'),
  autoFocusAvatarButton: document.getElementById('autoFocusAvatarButton'),
  centerAvatarButton: document.getElementById('centerAvatarButton'),
  avatarFramingHint: document.getElementById('avatarFramingHint'),
  orbCustomColorToggle: document.getElementById('orbCustomColorToggle'),
  orbColorA: document.getElementById('orbColorA'),
  orbColorB: document.getElementById('orbColorB'),
  orbColorC: document.getElementById('orbColorC'),
  orbCandidateRow: document.getElementById('orbCandidateRow'),
  orbPaletteHint: document.getElementById('orbPaletteHint'),
  avatarSaveState: document.getElementById('avatarSaveState'),
  saveAvatarButton: document.getElementById('saveAvatarButton'),
  resetAvatarButton: document.getElementById('resetAvatarButton'),
  clearApiKeyButton: document.getElementById('clearApiKeyButton'),
  settingsSaveButton: document.getElementById('settingsSaveButton'),
  toast: document.getElementById('toast'),
  // Character library
  avatarLibrarySelect: document.getElementById('avatarLibrarySelect'),
  avatarLibraryHint: document.getElementById('avatarLibraryHint'),
  renameAvatarButton: document.getElementById('renameAvatarButton'),
  deleteAvatarButton: document.getElementById('deleteAvatarButton'),
};

init();

async function init() {
  setupOrb();
  bindEvents();
  loadPreferences();
  setupOpenAITTS();
  setupMicrophoneSelection();
  setupSpeechRecognition();
  setupExpressiveMotion();
  await detectServer();
  await loadSettings();
  await loadAvatarSettings();
  await loadInterpreterSettings();
  await loadProfile();
  updateEngineUI();
}

function bindEvents() {
  el.messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendCurrentMessage();
  });

  el.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendCurrentMessage();
    }
  });

  document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      el.messageInput.value = button.dataset.prompt || '';
      el.messageInput.focus();
    });
  });

  el.layoutOptions.forEach((button) => {
    button.addEventListener('click', () => setLayout(button.dataset.layout, { fromUser: true }));
  });
  el.cinemaExitButton.addEventListener('click', () => setLayout('default', { fromUser: true }));
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  // Safari dispatches the prefixed event; without this, leaving OS fullscreen
  // through the system UI would strand the page in the cinema CSS layout.
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.dataset.layout === 'cinema' && !el.settingsDialog.open) {
      setLayout('default', { fromUser: true });
    }
  });

  el.chatTab.addEventListener('click', () => switchTab('chat'));
  el.profileTab.addEventListener('click', () => switchTab('profile'));
  el.saveProfileButton.addEventListener('click', saveProfile);
  el.resetProfileButton.addEventListener('click', resetProfileDraft);
  el.personaInput.addEventListener('input', markProfileDirty);
  el.knowledgeInput.addEventListener('input', markProfileDirty);
  el.notesInput.addEventListener('input', markProfileDirty);
  el.venueInput.addEventListener('input', markProfileDirty);
  saveInterpreterButtons().forEach((button) => button.addEventListener('click', saveInterpreterAndGlossary));
  el.regeneratePromptButton.addEventListener('click', saveInterpreterAndGlossary);
  el.swapLanguagesButton.addEventListener('click', swapInterpreterLanguages);
  [el.languageASelect, el.languageBSelect].forEach((select) => {
    select.addEventListener('change', () => {
      updateInterpreterLabels();
      markProfileDirty();
    });
  });
  [el.toneSelect, el.pacingSelect, el.styleSelect, el.showSourceToggle].forEach((input) => {
    input.addEventListener('change', markProfileDirty);
  });

  el.repeatButton.addEventListener('click', () => {
    if (state.lastReply) speakText(state.lastReply);
  });
  el.stopVoiceButton.addEventListener('click', stopSpeaking);
  el.clearChatButton.addEventListener('click', clearChat);

  el.rateSlider.addEventListener('input', () => {
    const rate = Number(el.rateSlider.value || 1);
    el.rateOutput.value = `${rate.toFixed(2).replace(/0$/, '')}×`;
    safeLocalStorageSet(STORAGE_KEYS.rate, String(rate));
  });

  el.voiceSelect.addEventListener('change', () => {
    safeLocalStorageSet(STORAGE_KEYS.voice, el.voiceSelect.value);
  });

  el.autoSpeakToggle.addEventListener('change', () => {
    safeLocalStorageSet(STORAGE_KEYS.autoSpeak, el.autoSpeakToggle.checked ? '1' : '0');
  });

  el.micButton.addEventListener('click', toggleListening);
  el.realtimeButton.addEventListener('click', toggleRealtimeSession);
  el.realtimeMuteButton.addEventListener('click', toggleRealtimeMute);
  el.quickRealtimeVoiceSelect.addEventListener('change', saveQuickRealtimeVoice);
  el.settingsButton.addEventListener('click', openSettings);
  el.realtimeVoiceSelect.addEventListener('change', syncTTSVoiceWithRealtime);
  el.microphoneSelect.addEventListener('change', handleMicrophoneSelection);
  el.refreshMicrophonesButton.addEventListener('click', () => refreshMicrophoneDevices({ requestPermission: true }));
  el.settingsCloseButton.addEventListener('click', closeSettings);
  el.settingsForm.addEventListener('submit', saveOpenAISettings);
  el.clearApiKeyButton.addEventListener('click', clearSavedApiKey);
  el.toggleApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
  el.avatarFileInput.addEventListener('change', handleAvatarFile);
  el.avatarImage.addEventListener('load', updateOrbIdentity);
  el.avatarPreviewImage.addEventListener('load', handleAvatarPreviewImageLoad);
  el.avatarRigModeSelect.addEventListener('input', previewAvatarDraft);
  el.avatarZoomRange.addEventListener('input', () => {
    state.avatarFraming.scale = clampNumber(el.avatarZoomRange.value, 0.7, 3, 1);
    updateAvatarFramingPreview();
  });
  el.avatarOpacityRange.addEventListener('input', () => {
    state.avatarFraming.opacity = clampNumber(Number(el.avatarOpacityRange.value) / 100, 0.15, 1, 0.94);
    updateAvatarFramingPreview();
  });
  el.autoFocusAvatarButton.addEventListener('click', autoFocusAvatar);
  el.centerAvatarButton.addEventListener('click', centerAvatarFraming);
  setupAvatarPreviewGestures();
  el.orbCustomColorToggle.addEventListener('change', previewAvatarDraft);
  [el.orbColorA, el.orbColorB, el.orbColorC].forEach((input) => {
    input.addEventListener('input', () => {
      if (!el.orbCustomColorToggle.checked) el.orbCustomColorToggle.checked = true;
      previewAvatarDraft();
    });
  });
  el.orbCandidateRow.addEventListener('click', (event) => {
    const swatch = event.target.closest('button[data-color]');
    if (!swatch) return;
    const derived = window.orbPaletteFromAnchor?.(swatch.dataset.color);
    if (!derived) return;
    el.orbColorA.value = derived.a;
    el.orbColorB.value = derived.b;
    el.orbColorC.value = derived.c;
    el.orbCustomColorToggle.checked = true;
    previewAvatarDraft();
  });
  el.saveAvatarButton.addEventListener('click', saveAvatarSettings);
  el.resetAvatarButton.addEventListener('click', resetAvatarSettings);
  el.avatarLibrarySelect.addEventListener('change', () => selectAvatarEntry(el.avatarLibrarySelect.value));
  el.renameAvatarButton.addEventListener('click', renameActiveAvatar);
  el.deleteAvatarButton.addEventListener('click', deleteActiveAvatar);
  el.settingsDialog.addEventListener('click', (event) => {
    if (event.target === el.settingsDialog) closeSettings();
  });
  window.addEventListener('beforeunload', stopRealtimeSession);
}

function loadPreferences() {
  const storedRate = Number(safeLocalStorageGet(STORAGE_KEYS.rate));
  if (Number.isFinite(storedRate) && storedRate >= 0.7 && storedRate <= 1.3) {
    el.rateSlider.value = String(storedRate);
  }
  const rate = Number(el.rateSlider.value || 1);
  el.rateOutput.value = `${rate.toFixed(2).replace(/0$/, '')}×`;

  const storedAutoSpeak = safeLocalStorageGet(STORAGE_KEYS.autoSpeak);
  if (storedAutoSpeak === '0') el.autoSpeakToggle.checked = false;

  // Only the two layouts that keep the top bar reachable may be restored. This
  // also rescues devices that stored 'cinema' before it stopped being persisted.
  const storedLayout = safeLocalStorageGet(STORAGE_KEYS.layout);
  setLayout(RESTORABLE_LAYOUT_MODES.includes(storedLayout) ? storedLayout : 'default');
}

function setupMicrophoneSelection() {
  state.microphone.selectedId = safeLocalStorageGet(STORAGE_KEYS.microphone) || '';
  if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices?.getUserMedia) {
    el.microphoneSelect.disabled = true;
    el.refreshMicrophonesButton.disabled = true;
    el.microphoneHelp.textContent = '這個瀏覽器不支援麥克風裝置選擇。';
    return;
  }
  navigator.mediaDevices.addEventListener?.('devicechange', () => {
    refreshMicrophoneDevices();
  });
  refreshMicrophoneDevices();
}

async function refreshMicrophoneDevices({ requestPermission = false } = {}) {
  if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices?.getUserMedia) return;
  if (requestPermission && isRealtimeEngaged()) {
    showToast('請先結束目前的 Realtime 對話，再重新掃描麥克風。');
    return;
  }

  el.refreshMicrophonesButton.disabled = true;
  let probeStream = null;
  try {
    if (requestPermission) {
      probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    const devices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default');
    state.microphone.devices = devices;

    const preferredId = state.microphone.selectedId || safeLocalStorageGet(STORAGE_KEYS.microphone) || '';
    el.microphoneSelect.textContent = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '系統預設麥克風';
    el.microphoneSelect.appendChild(defaultOption);
    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `麥克風 ${index + 1}`;
      el.microphoneSelect.appendChild(option);
    });

    const preferredAvailable = preferredId
      && devices.some((device) => device.deviceId === preferredId);
    el.microphoneSelect.value = preferredAvailable ? preferredId : '';
    state.microphone.selectedId = el.microphoneSelect.value;
    safeLocalStorageSet(STORAGE_KEYS.microphone, state.microphone.selectedId);
    updateMicrophoneHelp();
  } catch (error) {
    console.warn('Could not list microphones.', error);
    if (requestPermission) {
      el.microphoneHelp.textContent = '無法讀取麥克風清單；請檢查瀏覽器的麥克風權限。';
      showToast(`麥克風掃描失敗：${microphoneErrorLabel(error)}`);
    }
  } finally {
    probeStream?.getTracks().forEach((track) => track.stop());
    el.refreshMicrophonesButton.disabled = isRealtimeEngaged();
  }
}

function handleMicrophoneSelection() {
  if (isRealtimeEngaged()) return;
  state.microphone.selectedId = el.microphoneSelect.value || '';
  safeLocalStorageSet(STORAGE_KEYS.microphone, state.microphone.selectedId);
  updateMicrophoneHelp();
}

function updateMicrophoneHelp() {
  const selected = el.microphoneSelect.selectedOptions[0];
  const name = selected?.textContent?.trim() || '系統預設麥克風';
  const hasNamedDevices = state.microphone.devices.some((device) => Boolean(device.label));
  el.microphoneHelp.textContent = hasNamedDevices
    ? `已選擇：${name}。會於下一次 Realtime 連線套用。`
    : '選擇會儲存在這個瀏覽器。若未顯示裝置名稱，請按「重新掃描」並允許麥克風。';
}

function buildRealtimeAudioConstraints() {
  const selectedId = state.microphone.selectedId || el.microphoneSelect.value || '';
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    ...(selectedId ? { deviceId: { exact: selectedId } } : {})
  };
}

async function getRealtimeMicrophoneStream() {
  const selectedId = state.microphone.selectedId || '';
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: buildRealtimeAudioConstraints()
    });
  } catch (error) {
    const unavailable = selectedId && ['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(error?.name);
    if (!unavailable) throw error;
    state.microphone.selectedId = '';
    el.microphoneSelect.value = '';
    safeLocalStorageSet(STORAGE_KEYS.microphone, '');
    updateMicrophoneHelp();
    showToast('原選擇的麥克風目前不可用，已改用系統預設麥克風。');
    return navigator.mediaDevices.getUserMedia({
      audio: buildRealtimeAudioConstraints()
    });
  }
}

function microphoneErrorLabel(error) {
  const labels = {
    NotAllowedError: '請允許瀏覽器使用麥克風',
    SecurityError: '瀏覽器的安全設定阻擋了麥克風',
    NotFoundError: '找不到可用的麥克風',
    DevicesNotFoundError: '找不到可用的麥克風',
    NotReadableError: '麥克風正被其他應用程式佔用',
    OverconstrainedError: '選擇的麥克風不可用'
  };
  return labels[error?.name] || error?.message || '未知錯誤';
}

function setLayout(mode, { fromUser = false } = {}) {
  const next = LAYOUT_MODES.includes(mode) ? mode : 'default';
  document.body.dataset.layout = next;
  el.layoutOptions.forEach((button) => {
    const active = button.dataset.layout === next;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  // Cinema is an action, not a preference — persisting it would reopen the app
  // in a chrome-less layout, which on touch devices there is no way out of.
  safeLocalStorageSet(STORAGE_KEYS.layout, next === 'cinema' ? 'default' : next);

  // The real Fullscreen API needs a user gesture, so only call it on a click.
  if (fromUser) {
    if (next === 'cinema') {
      requestBrowserFullscreen();
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      try {
        const result = exit?.call(document);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (error) {
        // Already out of fullscreen, or the browser refused; the layout is what matters.
      }
    }
  }
}

function requestBrowserFullscreen() {
  const target = document.documentElement;
  const request = target.requestFullscreen
    || target.webkitRequestFullscreen
    || target.msRequestFullscreen;
  if (!request) return;
  try {
    const result = request.call(target);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (error) {
    // Fullscreen can be blocked by the browser; the CSS cinema layout still applies.
  }
}

function handleFullscreenChange() {
  // Leaving OS fullscreen (e.g. pressing Esc) while in cinema returns to the work layout.
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (!active && document.body.dataset.layout === 'cinema') {
    setLayout('default');
  }
}

async function detectServer() {
  try {
    const response = await fetchWithTimeout('/api/status', { cache: 'no-store' }, 3500);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.status = await response.json();
    state.serverAvailable = true;
  } catch (error) {
    console.warn('Local server status unavailable; using browser demo.', error);
    state.serverAvailable = false;
    state.status = {
      provider: 'browser_demo',
      provider_label: '瀏覽器 Demo',
      model: '',
      configured: true,
      profile_storage: 'browser'
    };
  }
}

async function loadSettings() {
  if (!state.serverAvailable) {
    state.settings = {
      has_api_key: false,
      model: 'gpt-5.4-mini',
      realtime_model: 'gpt-realtime-2.1',
      realtime_voice: 'cedar',
      tts_model: 'gpt-4o-mini-tts',
      tts_voice: 'cedar',
      api_key_source: 'none'
    };
    updateSettingsForm();
    updateRealtimeUI();
    return;
  }

  try {
    const response = await fetchWithTimeout('/api/settings', { cache: 'no-store' }, 5000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    state.settings = payload;
  } catch (error) {
    console.warn('Could not load OpenAI settings.', error);
    state.settings = null;
    showToast(`讀不到 OpenAI 設定：${error.message}`);
  }
  updateSettingsForm();
  updateRealtimeUI();
}

function updateSettingsForm() {
  const settings = state.settings || {};
  el.apiKeyInput.value = '';
  el.apiKeyInput.type = 'password';
  el.toggleApiKeyButton.textContent = '顯示';
  el.apiKeyInput.placeholder = settings.has_api_key
    ? `${settings.api_key_hint || '••••'}（留白則保留）`
    : 'sk-…';
  el.chatModelInput.value = settings.model || 'gpt-5.4-mini';
  el.realtimeModelInput.value = settings.realtime_model || 'gpt-realtime-2.1';
  syncRealtimeVoiceControls(settings.realtime_voice || 'cedar');
  el.ttsModelInput.value = settings.tts_model || 'gpt-4o-mini-tts';
  syncTTSVoiceWithRealtime();
  const sharedVoice = el.ttsVoiceSelect.value || 'cedar';
  safeLocalStorageSet(STORAGE_KEYS.voice, sharedVoice);
  if ([...el.voiceSelect.options].some((option) => option.value === sharedVoice)) {
    el.voiceSelect.value = sharedVoice;
  }

  if (!state.serverAvailable) {
    el.apiKeyState.textContent = '瀏覽器儲存空間無法使用，請關閉無痕模式再試';
  } else if (settings.has_api_key) {
    el.apiKeyState.textContent = `已存在這個瀏覽器 ${settings.api_key_hint || ''}`.trim();
  } else {
    el.apiKeyState.textContent = '尚未設定';
  }
  el.clearApiKeyButton.disabled = !settings.has_api_key || settings.api_key_source === 'environment';
}

function syncTTSVoiceWithRealtime() {
  const realtimeVoice = el.realtimeVoiceSelect.value || 'cedar';
  const supported = [...el.ttsVoiceSelect.options].some((option) => option.value === realtimeVoice);
  el.ttsVoiceSelect.value = supported ? realtimeVoice : 'cedar';
}

function syncRealtimeVoiceControls(voice) {
  const selected = voice || 'cedar';
  [el.realtimeVoiceSelect, el.quickRealtimeVoiceSelect].forEach((select) => {
    if ([...select.options].some((option) => option.value === selected)) {
      select.value = selected;
    }
  });
}

async function saveQuickRealtimeVoice() {
  const previousVoice = state.settings?.realtime_voice || 'cedar';
  const selectedVoice = el.quickRealtimeVoiceSelect.value || previousVoice;

  if (!state.serverAvailable) {
    syncRealtimeVoiceControls(previousVoice);
    showToast('瀏覽器儲存空間無法使用，聲音設定無法保存。');
    return;
  }
  if (state.realtime.connected || state.realtime.connecting) {
    syncRealtimeVoiceControls(previousVoice);
    showToast('請先結束目前的即時對話，再選擇新的聲音。');
    return;
  }

  syncRealtimeVoiceControls(selectedVoice);
  el.quickRealtimeVoiceSelect.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realtime_voice: selectedVoice })
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.settings = result;
    syncRealtimeVoiceControls(result.realtime_voice || selectedVoice);
    syncTTSVoiceWithRealtime();
    const sharedVoice = el.ttsVoiceSelect.value || 'cedar';
    safeLocalStorageSet(STORAGE_KEYS.voice, sharedVoice);
    if ([...el.voiceSelect.options].some((option) => option.value === sharedVoice)) {
      el.voiceSelect.value = sharedVoice;
    }
    updateRealtimeUI();
    showToast(`${titleCase(result.realtime_voice || selectedVoice)} 已選好；下一次即時對話會使用這個聲音。`);
  } catch (error) {
    syncRealtimeVoiceControls(previousVoice);
    showToast(`Realtime 聲音儲存失敗：${error.message}`);
  } finally {
    updateRealtimeUI();
  }
}

function openSettings() {
  updateSettingsForm();
  refreshMicrophoneDevices();
  if (!state.avatarDirty) updateAvatarForm();
  if (typeof el.settingsDialog.showModal === 'function') {
    if (!el.settingsDialog.open) el.settingsDialog.showModal();
  } else {
    el.settingsDialog.setAttribute('open', '');
  }
  window.setTimeout(() => el.apiKeyInput.focus(), 80);
}

function closeSettings() {
  if (state.avatarDirty) updateAvatarForm();
  if (typeof el.settingsDialog.close === 'function' && el.settingsDialog.open) {
    el.settingsDialog.close();
  } else {
    el.settingsDialog.removeAttribute('open');
  }
}

function toggleApiKeyVisibility() {
  const showing = el.apiKeyInput.type === 'text';
  el.apiKeyInput.type = showing ? 'password' : 'text';
  el.toggleApiKeyButton.textContent = showing ? '顯示' : '隱藏';
  el.apiKeyInput.focus();
}

async function saveOpenAISettings(event) {
  event.preventDefault();
  if (!state.serverAvailable) {
    showToast('瀏覽器儲存空間無法使用，API Key 無法保存。');
    return;
  }

  const payload = {
    model: el.chatModelInput.value.trim(),
    realtime_model: el.realtimeModelInput.value.trim(),
    realtime_voice: el.realtimeVoiceSelect.value,
    tts_model: el.ttsModelInput.value.trim(),
    tts_voice: el.realtimeVoiceSelect.value
  };
  const apiKey = el.apiKeyInput.value.trim();
  if (apiKey) payload.api_key = apiKey;

  el.settingsSaveButton.disabled = true;
  try {
    if (state.realtime.connected || state.realtime.connecting) stopRealtimeSession();
    const response = await fetchWithTimeout('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.settings = result;
    if (result.tts_voice) safeLocalStorageSet(STORAGE_KEYS.voice, result.tts_voice);
    await detectServer();
    updateSettingsForm();
    updateEngineUI();
    updateRealtimeUI();
    closeSettings();
    showToast('OpenAI 設定已儲存，可以開始即時語音對話。');
  } catch (error) {
    console.error(error);
    showToast(`設定儲存失敗：${error.message}`);
  } finally {
    el.settingsSaveButton.disabled = false;
  }
}

async function clearSavedApiKey() {
  if (!state.serverAvailable || el.clearApiKeyButton.disabled) return;
  el.clearApiKeyButton.disabled = true;
  try {
    stopRealtimeSession();
    const response = await fetchWithTimeout('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_api_key: true })
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.settings = result;
    await detectServer();
    updateSettingsForm();
    updateEngineUI();
    updateRealtimeUI();
    showToast('已移除本機儲存的 API Key。');
  } catch (error) {
    showToast(`移除失敗：${error.message}`);
  } finally {
    el.clearApiKeyButton.disabled = !state.settings?.has_api_key || state.settings?.api_key_source === 'environment';
  }
}


async function loadAvatarSettings() {
  if (!state.serverAvailable) {
    applyAvatarSettings(state.avatar);
    updateAvatarForm();
    return;
  }
  try {
    const response = await fetchWithTimeout('/api/avatar', { cache: 'no-store' }, 5000);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    state.avatar = payload;
  } catch (error) {
    console.warn('Could not load avatar settings.', error);
    showToast(`讀不到角色圖片設定：${error.message}`);
  }
  applyAvatarSettings(state.avatar);
  updateAvatarForm();
}

// Legacy avatars were saved with rig_mode "simple" / "face"; every mode now
// maps onto one of the orb styles.
function normalizeOrbStyle(mode) {
  const styles = window.TALKTWIN_ORB_STYLES || ['sophon', 'aurora', 'ember'];
  return styles.includes(mode) ? mode : 'sophon';
}

function setupOrb() {
  state.orb = typeof window.createTalkOrb === 'function'
    ? window.createTalkOrb(el.orbCanvas)
    : null;
  state.previewOrb = typeof window.createTalkOrb === 'function'
    ? window.createTalkOrb(el.essencePreviewCanvas)
    : null;
  if (!state.orb) {
    el.avatarArt.classList.add('orb-no-webgl');
    console.warn('WebGL unavailable; using the CSS fallback orb.');
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function normalizeOrbColors(raw) {
  const colors = raw && typeof raw === 'object' ? raw : {};
  const pick = (value) => (HEX_COLOR.test(String(value || '')) ? String(value).toLowerCase() : '');
  const normalized = {
    mode: colors.mode === 'custom' ? 'custom' : 'auto',
    a: pick(colors.a),
    b: pick(colors.b),
    c: pick(colors.c)
  };
  if (normalized.mode === 'custom' && !(normalized.a && normalized.b && normalized.c)) {
    normalized.mode = 'auto';
  }
  return normalized;
}

// Feed the current source image into the orb: its dominant colors become the
// palette, the image itself becomes the refracted memory inside the sphere.
function updateOrbIdentity() {
  const image = el.avatarImage;
  const ready = Boolean(image && image.complete && image.naturalWidth > 0);
  let auto = null;
  if (state.orb) {
    auto = state.orb.setSourceImage(ready ? image : null);
  } else if (typeof window.extractOrbPalette === 'function') {
    auto = window.extractOrbPalette(ready ? image : null);
  }
  state.autoPalette = auto;
  renderOrbCandidates(auto?.candidates || []);
  applyEffectiveOrbColors();
}

function renderOrbCandidates(candidates) {
  el.orbCandidateRow.textContent = '';
  candidates.slice(0, 6).forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.dataset.color = color;
    swatch.style.background = color;
    swatch.title = `以 ${color} 重新配色`;
    swatch.setAttribute('aria-label', `以 ${color} 重新配色`);
    el.orbCandidateRow.appendChild(swatch);
  });
}

// Resolve auto-extracted vs. user-picked colors, push them into the orb,
// the frame CSS variables and the settings controls.
function applyEffectiveOrbColors() {
  const config = normalizeOrbColors(state.currentOrbColors);
  const custom = config.mode === 'custom';
  let palette = null;

  if (custom) {
    palette = state.orb
      ? state.orb.setPalette(config)
      : window.orbPaletteFromColors?.(config.a, config.b, config.c);
  } else if (state.autoPalette) {
    palette = state.autoPalette;
    // re-assert the auto palette in case a custom one was previewed before
    state.orb?.setPalette({ a: palette.cssA, b: palette.cssB, c: palette.cssC });
  }
  if (!palette) return;

  state.previewOrb?.setPalette({ a: palette.cssA, b: palette.cssB, c: palette.cssC });

  el.avatarArt.style.setProperty('--orb-a', palette.cssA);
  el.avatarArt.style.setProperty('--orb-b', palette.cssB);
  el.avatarArt.style.setProperty('--orb-c', palette.cssC);
  el.avatarArt.style.setProperty('--orb-base', palette.cssBase);

  el.orbCustomColorToggle.checked = custom;
  [el.orbColorA, el.orbColorB, el.orbColorC].forEach((input) => { input.disabled = !custom; });
  if (!custom) {
    el.orbColorA.value = palette.cssA;
    el.orbColorB.value = palette.cssB;
    el.orbColorC.value = palette.cssC;
  }
  el.orbPaletteHint.textContent = custom
    ? '自訂色彩已套用；關閉「自訂色彩」可回到圖片自動配色。'
    : (palette.vibrant
      ? '已從圖片萃取主色；點候選色可用該色配色，或開啟自訂微調。'
      : '圖片色彩偏灰階，改用預設星際色盤；可點候選色或自訂。');
}

function updateAvatarForm() {
  const avatar = state.avatar;
  state.avatarFraming = {
    scale: clampNumber(avatar.scale, 0.7, 3, 1),
    offsetX: clampNumber(avatar.offset_x, -40, 40, 0),
    offsetY: clampNumber(avatar.offset_y, -40, 40, 0),
    opacity: clampNumber(avatar.memory_opacity, 0.15, 1, 0.94)
  };
  syncAvatarFramingControls();
  el.avatarRigModeSelect.value = normalizeOrbStyle(avatar.rig_mode);
  const colors = normalizeOrbColors(avatar.orb_colors);
  el.orbCustomColorToggle.checked = colors.mode === 'custom';
  if (colors.a) el.orbColorA.value = colors.a;
  if (colors.b) el.orbColorB.value = colors.b;
  if (colors.c) el.orbColorC.value = colors.c;
  el.avatarPreviewImage.src = avatar.image_url || 'assets/avatar.jpeg';
  el.avatarFileInput.value = '';
  state.avatarDraftDataUrl = '';
  markAvatarClean(avatar.is_custom ? `已選：${avatar.name || '自訂角色'}` : '目前使用預設角色');
  populateAvatarLibrary(avatar);
  applyAvatarSettings(avatar);
}

function populateAvatarLibrary(avatar) {
  const library = Array.isArray(avatar.library) ? avatar.library : [];
  const activeId = avatar.active_id || (avatar.is_custom ? avatar.id : 'default');
  el.avatarLibrarySelect.textContent = '';
  library.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    const marks = [];
    option.textContent = `${entry.name}${marks.length ? ` ${marks.join('')}` : ''}`;
    el.avatarLibrarySelect.appendChild(option);
  });
  if (library.some((entry) => entry.id === activeId)) {
    el.avatarLibrarySelect.value = activeId;
  }
  const isDefault = activeId === 'default' || !avatar.is_custom;
  el.deleteAvatarButton.disabled = isDefault;
  el.renameAvatarButton.disabled = isDefault;
  el.avatarLibraryHint.textContent = isDefault
    ? '預設角色無法刪除；上傳圖片會新增一個角色。'
    : '可切換、重新命名或刪除此角色。';
}


async function selectAvatarEntry(entryId) {
  if (!entryId) return;
  const currentActive = state.avatar.active_id || (state.avatar.is_custom ? state.avatar.id : 'default');
  if (entryId === currentActive) return;
  if (!state.serverAvailable) {
    showToast('瀏覽器儲存空間無法使用，無法切換角色。');
    return;
  }
  el.avatarLibrarySelect.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/avatar/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entryId })
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.avatar = result;
    updateAvatarForm();
    showToast(result.is_custom ? `已切換到「${result.name}」。` : '已切換到預設角色。');
  } catch (error) {
    showToast(`切換角色失敗：${error.message}`);
    updateAvatarForm();
  } finally {
    el.avatarLibrarySelect.disabled = false;
  }
}

async function renameActiveAvatar() {
  if (!state.avatar.is_custom) return;
  const name = window.prompt('輸入角色名稱', state.avatar.name || '自訂角色');
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    showToast('角色名稱不能是空白。');
    return;
  }
  try {
    const response = await fetchWithTimeout('/api/avatar/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: state.avatar.id, name: trimmed })
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.avatar = result;
    updateAvatarForm();
    showToast('角色名稱已更新。');
  } catch (error) {
    showToast(`重新命名失敗：${error.message}`);
  }
}

async function deleteActiveAvatar() {
  if (!state.avatar.is_custom) return;
  if (!window.confirm(`確定要刪除角色「${state.avatar.name || '自訂角色'}」嗎？這會無法復原。`)) return;
  el.deleteAvatarButton.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/avatar/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: state.avatar.id })
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.avatar = result;
    updateAvatarForm();
    showToast('角色已刪除，已切回預設角色。');
  } catch (error) {
    showToast(`刪除角色失敗：${error.message}`);
    el.deleteAvatarButton.disabled = false;
  }
}

function avatarControlsFromForm() {
  return {
    is_custom: state.avatar.is_custom,
    id: state.avatar.id,
    name: state.avatar.name,
    active_id: state.avatar.active_id,
    library: state.avatar.library,
    image_url: state.avatarDraftDataUrl || state.avatar.image_url || 'assets/avatar.jpeg',
    rig_mode: normalizeOrbStyle(el.avatarRigModeSelect.value),
    orb_colors: normalizeOrbColors({
      mode: el.orbCustomColorToggle.checked ? 'custom' : 'auto',
      a: el.orbColorA.value,
      b: el.orbColorB.value,
      c: el.orbColorC.value
    }),
    fit: 'cover',
    scale: state.avatarFraming.scale,
    offset_x: state.avatarFraming.offsetX,
    offset_y: state.avatarFraming.offsetY,
    memory_opacity: state.avatarFraming.opacity
  };
}

function applyAvatarSettings(avatar) {
  const imageUrl = avatar.image_url || 'assets/avatar.jpeg';
  const style = normalizeOrbStyle(avatar.rig_mode);
  state.orb?.setStyle(style);
  state.previewOrb?.setStyle(style);
  el.avatarArt.dataset.orbStyle = style;
  applyAvatarFramingToOrbs(avatar);
  state.currentOrbColors = normalizeOrbColors(avatar.orb_colors);

  if (el.avatarImage.getAttribute('src') !== imageUrl) {
    el.avatarImage.src = imageUrl;      // load event re-derives palette + memory
  } else {
    updateOrbIdentity();
  }

  el.sourceChipImage.src = imageUrl;
  el.sourceChipName.textContent = avatar.is_custom ? (avatar.name || '自訂角色') : '預設角色';
  el.avatarPreviewImage.src = imageUrl;
}

function applyAvatarFramingToOrbs(avatar) {
  const scale = clampNumber(avatar?.scale, 0.7, 3, 1);
  const offsetX = clampNumber(avatar?.offset_x, -40, 40, 0);
  const offsetY = clampNumber(avatar?.offset_y, -40, 40, 0);
  const opacity = clampNumber(avatar?.memory_opacity, 0.15, 1, 0.94);
  state.orb?.setTextureTransform(scale, offsetX, offsetY);
  state.previewOrb?.setTextureTransform(scale, offsetX, offsetY);
  state.orb?.setMemoryOpacity(opacity);
  state.previewOrb?.setMemoryOpacity(opacity);
}

function syncAvatarFramingControls() {
  el.avatarZoomRange.value = String(state.avatarFraming.scale);
  el.avatarZoomOutput.value = `${Math.round(state.avatarFraming.scale * 100)}%`;
  const opacityPercent = Math.round(state.avatarFraming.opacity * 100);
  el.avatarOpacityRange.value = String(opacityPercent);
  el.avatarOpacityOutput.value = `${opacityPercent}%`;
}

function updateAvatarFramingPreview() {
  syncAvatarFramingControls();
  applyAvatarFramingToOrbs({
    scale: state.avatarFraming.scale,
    offset_x: state.avatarFraming.offsetX,
    offset_y: state.avatarFraming.offsetY,
    memory_opacity: state.avatarFraming.opacity
  });
  markAvatarDirty();
}

function centerAvatarFraming() {
  state.avatarFraming = { ...state.avatarFraming, scale: 1, offsetX: 0, offsetY: 0 };
  el.avatarFramingHint.textContent = '已回到圖片中央；仍可拖曳預覽或調整縮放。';
  updateAvatarFramingPreview();
}

function setupAvatarPreviewGestures() {
  const frame = el.avatarPreviewFrame;
  frame.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    frame.setPointerCapture(event.pointerId);
    state.avatarDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: state.avatarFraming.offsetX,
      offsetY: state.avatarFraming.offsetY
    };
    frame.classList.add('is-dragging');
  });
  frame.addEventListener('pointermove', (event) => {
    const drag = state.avatarDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = frame.getBoundingClientRect();
    state.avatarFraming.offsetX = clampNumber(drag.offsetX + ((event.clientX - drag.x) / rect.width) * 80, -40, 40, 0);
    state.avatarFraming.offsetY = clampNumber(drag.offsetY + ((event.clientY - drag.y) / rect.height) * 80, -40, 40, 0);
    updateAvatarFramingPreview();
  });
  const endDrag = (event) => {
    if (state.avatarDrag?.pointerId !== event.pointerId) return;
    state.avatarDrag = null;
    frame.classList.remove('is-dragging');
  };
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);
  frame.addEventListener('wheel', (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    state.avatarFraming.scale = clampNumber(state.avatarFraming.scale + direction * 0.08, 0.7, 3, 1);
    updateAvatarFramingPreview();
  }, { passive: false });
  frame.addEventListener('keydown', (event) => {
    const movement = event.shiftKey ? 4 : 1;
    const deltas = {
      ArrowLeft: [-movement, 0], ArrowRight: [movement, 0],
      ArrowUp: [0, -movement], ArrowDown: [0, movement]
    };
    if (!deltas[event.key]) return;
    event.preventDefault();
    state.avatarFraming.offsetX = clampNumber(state.avatarFraming.offsetX + deltas[event.key][0], -40, 40, 0);
    state.avatarFraming.offsetY = clampNumber(state.avatarFraming.offsetY + deltas[event.key][1], -40, 40, 0);
    updateAvatarFramingPreview();
  });
}

function handleAvatarPreviewImageLoad() {
  const image = el.avatarPreviewImage;
  if (state.previewOrb && image.complete && image.naturalWidth > 0) {
    state.previewOrb.setSourceImage(image);
    state.previewOrb.setStyle(normalizeOrbStyle(el.avatarRigModeSelect.value));
    applyAvatarFramingToOrbs({
      scale: state.avatarFraming.scale,
      offset_x: state.avatarFraming.offsetX,
      offset_y: state.avatarFraming.offsetY,
      memory_opacity: state.avatarFraming.opacity
    });
    applyEffectiveOrbColors();
  }
  if (state.pendingAvatarAutoFocus) {
    state.pendingAvatarAutoFocus = false;
    autoFocusAvatar();
  }
}

async function autoFocusAvatar() {
  const image = el.avatarPreviewImage;
  if (!image.complete || !image.naturalWidth) return;
  el.autoFocusAvatarButton.disabled = true;
  try {
    if ('FaceDetector' in window) {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      const faces = await detector.detect(image);
      const face = faces.sort((a, b) => (b.boundingBox.width * b.boundingBox.height) - (a.boundingBox.width * a.boundingBox.height))[0];
      if (face) {
        const box = face.boundingBox;
        const centerX = (box.x + box.width / 2) / image.naturalWidth;
        const centerY = (box.y + box.height / 2) / image.naturalHeight;
        const faceRatio = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
        state.avatarFraming.scale = clampNumber(0.52 / Math.max(faceRatio, 0.18), 1, 2.4, 1.25);
        state.avatarFraming.offsetX = clampNumber((0.5 - centerX) * 80, -40, 40, 0);
        state.avatarFraming.offsetY = clampNumber((0.48 - centerY) * 80, -40, 40, 0);
        el.avatarFramingHint.textContent = '已抓到最大的人臉並自動構圖；可再拖曳微調。';
        updateAvatarFramingPreview();
        return;
      }
    }
    state.avatarFraming.offsetX = 0;
    state.avatarFraming.offsetY = 0;
    el.avatarFramingHint.textContent = '這個瀏覽器沒有抓到人臉，已先置中；你可以直接拖曳調整。';
    updateAvatarFramingPreview();
  } catch (error) {
    console.warn('Face auto-focus unavailable.', error);
    el.avatarFramingHint.textContent = '自動抓臉暫時不可用，請直接拖曳預覽調整。';
  } finally {
    el.autoFocusAvatarButton.disabled = false;
  }
}


async function handleAvatarFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showToast('角色圖片只支援 PNG、JPEG 或 WebP。');
    el.avatarFileInput.value = '';
    return;
  }
  if (file.size > 8_000_000) {
    showToast('角色圖片不可超過 8 MB。');
    el.avatarFileInput.value = '';
    return;
  }
  try {
    state.avatarDraftDataUrl = await readFileAsDataUrl(file);
    state.avatarFraming = { scale: 1, offsetX: 0, offsetY: 0, opacity: 0.94 };
    state.pendingAvatarAutoFocus = true;
    syncAvatarFramingControls();
    previewAvatarDraft();
    showToast('已載入新圖片；能量體已換上它的色彩，記得按「儲存角色圖片」。');
  } catch (error) {
    showToast(`角色圖片讀取失敗：${error.message}`);
  }
}

function previewAvatarDraft() {
  const draft = avatarControlsFromForm();
  applyAvatarSettings(draft);
  markAvatarDirty();
}

function markAvatarDirty() {
  state.avatarDirty = true;
  el.avatarSaveState.textContent = '有尚未儲存的角色修改';
  el.avatarSaveState.classList.remove('saved');
  el.avatarSaveState.classList.add('dirty');
}

function markAvatarClean(label) {
  state.avatarDirty = false;
  el.avatarSaveState.textContent = label;
  el.avatarSaveState.classList.remove('dirty');
  el.avatarSaveState.classList.add('saved');
}

async function saveAvatarSettings() {
  if (!state.serverAvailable) {
    showToast('瀏覽器儲存空間無法使用，角色圖片無法保存。');
    return false;
  }
  if (!state.avatarDraftDataUrl && !state.avatar.is_custom) {
    showToast('請先選擇新的角色圖片。');
    return false;
  }
  const controls = avatarControlsFromForm();
  const payload = {
    rig_mode: controls.rig_mode,
    orb_colors: controls.orb_colors,
    fit: controls.fit,
    scale: controls.scale,
    offset_x: controls.offset_x,
    offset_y: controls.offset_y,
    memory_opacity: controls.memory_opacity
  };
  if (state.avatarDraftDataUrl) payload.image_data_url = state.avatarDraftDataUrl;
  el.saveAvatarButton.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 30000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.avatar = result;
    updateAvatarForm();
    showToast('新角色圖片已儲存在這個瀏覽器。');
    return true;
  } catch (error) {
    showToast(`角色圖片儲存失敗：${error.message}`);
    return false;
  } finally {
    el.saveAvatarButton.disabled = false;
  }
}

async function resetAvatarSettings() {
  if (!state.serverAvailable) {
    state.avatar = {
      is_custom: false,
      id: 'default',
      name: '預設角色',
      image_url: 'assets/avatar.jpeg',
      fit: 'cover',
      rig_mode: 'sophon',
      scale: 1,
      offset_x: 0,
      offset_y: 0,
      active_id: 'default',
      library: []
    };
    updateAvatarForm();
    return;
  }
  el.resetAvatarButton.disabled = true;
  try {
    const response = await fetchWithTimeout('/api/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true })
    }, 10000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.avatar = result;
    updateAvatarForm();
    showToast('已恢復預設角色圖片。');
  } catch (error) {
    showToast(`恢復預設角色失敗：${error.message}`);
  } finally {
    el.resetAvatarButton.disabled = false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

// --- 即席口譯設定 ----------------------------------------------------------
// The language pair lives on the local server so persona.md, the accent rules
// and the Realtime session config can never drift apart.

const FALLBACK_LANGUAGES = [
  { code: 'zh-TW', label: '中文（台灣）', native: '繁體中文' },
  { code: 'en', label: '英文 English', native: 'English' }
];

function interpreterPairLabel() {
  const info = state.interpreter || {};
  return info.pair_label || `${nativeNameFor(info.language_a)} ⇄ ${nativeNameFor(info.language_b)}`;
}

function nativeNameFor(code) {
  const list = state.interpreter?.languages?.length ? state.interpreter.languages : FALLBACK_LANGUAGES;
  return list.find((item) => item.code === code)?.native || code || '—';
}

function fillLanguageSelect(select, list, selected) {
  select.textContent = '';
  list.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.code;
    option.textContent = item.label;
    select.appendChild(option);
  });
  select.value = selected;
  if (select.value !== selected && list.length) select.value = list[0].code;
}

function applyInterpreterToForm(info) {
  const list = info.languages?.length ? info.languages : FALLBACK_LANGUAGES;
  fillLanguageSelect(el.languageASelect, list, info.language_a);
  fillLanguageSelect(el.languageBSelect, list, info.language_b);
  el.venueInput.value = info.venue || '';
  el.toneSelect.value = info.tone || 'warm';
  el.pacingSelect.value = info.pacing || 'balanced';
  el.styleSelect.value = info.style || 'strict';
  el.showSourceToggle.checked = info.show_source !== false;
  el.notesInput.value = info.notes || '';
  updateInterpreterLabels();
}

function readInterpreterForm() {
  return {
    enabled: true,
    language_a: el.languageASelect.value,
    language_b: el.languageBSelect.value,
    venue: el.venueInput.value.trim(),
    tone: el.toneSelect.value,
    pacing: el.pacingSelect.value,
    style: el.styleSelect.value,
    show_source: el.showSourceToggle.checked,
    notes: el.notesInput.value.trim()
  };
}

// 打字區的瀏覽器語音輸入跟著 A 語言走；固定 zh-TW 會讓非中文配對聽錯。
function speechRecognitionLang() {
  return el.languageASelect?.value || state.interpreter?.language_a || 'zh-TW';
}

function updateInterpreterLabels() {
  if (state.recognition) state.recognition.lang = speechRecognitionLang();
  const a = nativeNameFor(el.languageASelect.value || state.interpreter.language_a);
  const b = nativeNameFor(el.languageBSelect.value || state.interpreter.language_b);
  const pair = `${a} ⇄ ${b}`;
  if (el.brandPair) el.brandPair.textContent = pair;
  if (el.modeTag) el.modeTag.textContent = pair;
  if (el.languagePairHint) {
    el.languagePairHint.textContent = `講者說${a}就翻成${b}，切換到${b}就翻回${a}，逐句雙向。`;
  }
  document.title = `TalkTwin 即席口譯 — ${pair}`;
}

async function loadInterpreterSettings() {
  let loaded = null;
  if (state.serverAvailable) {
    try {
      const response = await fetchWithTimeout('/api/interpreter', { cache: 'no-store' }, 5000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      loaded = await response.json();
    } catch (error) {
      console.warn('Could not load interpreter settings.', error);
    }
  }
  if (!loaded) {
    const raw = safeLocalStorageGet(STORAGE_KEYS.interpreter);
    if (raw) {
      try {
        loaded = JSON.parse(raw);
      } catch (error) {
        console.warn('Invalid local interpreter JSON.', error);
      }
    }
  }
  state.interpreter = {
    ...DEFAULT_INTERPRETER,
    languages: FALLBACK_LANGUAGES,
    ...(loaded || {})
  };
  applyInterpreterToForm(state.interpreter);
}

async function saveInterpreterSettings() {
  const payload = readInterpreterForm();
  if (payload.language_a === payload.language_b) {
    showToast('兩邊必須選不同的語言，才能雙向翻譯。');
    return false;
  }
  saveInterpreterButtons().forEach((button) => { button.disabled = true; });
  try {
    if (!state.serverAvailable) {
      state.interpreter = { ...state.interpreter, ...payload };
      safeLocalStorageSet(STORAGE_KEYS.interpreter, JSON.stringify(state.interpreter));
      updateInterpreterLabels();
      markProfileClean('已存到瀏覽器');
      showToast('翻譯設定已存到這個瀏覽器。');
      return true;
    }

    const response = await fetchWithTimeout('/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 10000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    state.interpreter = { ...state.interpreter, ...data };
    safeLocalStorageSet(STORAGE_KEYS.interpreter, JSON.stringify(state.interpreter));
    applyInterpreterToForm(state.interpreter);

    // The server regenerated persona.md from the pair; mirror it into the UI.
    if (data.persona) {
      el.personaInput.value = data.persona;
      state.profile = { ...state.profile, persona: data.persona };
    }
    markProfileClean('已存到這個瀏覽器');

    const wasLive = state.realtime.connected || state.realtime.connecting;
    if (wasLive) stopRealtimeSession();
    showToast(wasLive
      ? `已切換為 ${interpreterPairLabel()}；原本的口譯已結束，重新開始即可套用。`
      : `已儲存：${interpreterPairLabel()} 逐句雙向口譯。`);
    return true;
  } catch (error) {
    console.error(error);
    markProfileDirty();
    showToast(`儲存失敗：${error.message}`);
    return false;
  } finally {
    saveInterpreterButtons().forEach((button) => { button.disabled = false; });
  }
}

function saveInterpreterButtons() {
  return [el.saveInterpreterButton, el.saveInterpreterButtonTop].filter(Boolean);
}

function swapInterpreterLanguages() {
  const a = el.languageASelect.value;
  el.languageASelect.value = el.languageBSelect.value;
  el.languageBSelect.value = a;
  updateInterpreterLabels();
  markProfileDirty();
}


async function loadProfile() {
  let loaded = null;

  if (state.serverAvailable) {
    try {
      const response = await fetchWithTimeout('/api/profile', { cache: 'no-store' }, 5000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      loaded = await response.json();
    } catch (error) {
      console.warn('Could not load server profile; falling back to browser storage.', error);
      showToast('讀不到伺服器的人格檔，暫時使用瀏覽器本機版本。');
    }
  }

  if (!loaded) {
    const raw = safeLocalStorageGet(STORAGE_KEYS.profile);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.persona === 'string' && typeof parsed.knowledge === 'string') loaded = parsed;
      } catch (error) {
        console.warn('Invalid local profile JSON.', error);
      }
    }
  }

  state.profile = {
    persona: loaded?.persona || DEFAULT_PERSONA,
    knowledge: loaded?.knowledge || DEFAULT_KNOWLEDGE
  };
  el.personaInput.value = state.profile.persona;
  el.knowledgeInput.value = state.profile.knowledge;
  markProfileClean('已載入');
}

async function saveProfile({ quiet = false } = {}) {
  const persona = el.personaInput.value.trim();
  const knowledge = el.knowledgeInput.value.trim();

  if (!persona) {
    showToast('人格 Prompt 不能是空白。');
    el.personaInput.focus();
    return;
  }

  state.profile = { persona, knowledge };
  el.saveProfileButton.disabled = true;

  try {
    if (state.serverAvailable) {
      const response = await fetchWithTimeout('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.profile)
      }, 10000);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      safeLocalStorageSet(STORAGE_KEYS.profile, JSON.stringify(state.profile));
      markProfileClean('已存到這個瀏覽器');
      const realtimeWasActive = state.realtime.connected || state.realtime.connecting;
      if (realtimeWasActive && !quiet) stopRealtimeSession();
      if (!quiet) {
        showToast(realtimeWasActive
          ? '提示詞與詞彙表已儲存；原本的口譯已結束，重新開始即可套用。'
          : '提示詞與詞彙表已儲存到本機。');
      }
    } else {
      safeLocalStorageSet(STORAGE_KEYS.profile, JSON.stringify(state.profile));
      markProfileClean('已存到瀏覽器');
      if (!quiet) showToast('提示詞與詞彙表已存到這個瀏覽器。');
    }
    return true;
  } catch (error) {
    console.error(error);
    markProfileDirty();
    showToast(`儲存失敗：${error.message}`);
    return false;
  } finally {
    el.saveProfileButton.disabled = false;
  }
}

// One button, one mental model: regenerate the prompt from the language pair,
// then persist that prompt together with the glossary.
async function saveInterpreterAndGlossary() {
  const saved = await saveInterpreterSettings();
  if (!saved) return false;
  await saveProfile({ quiet: true });
  return true;
}

function resetProfileDraft() {
  applyInterpreterToForm({ ...DEFAULT_INTERPRETER, languages: state.interpreter.languages });
  el.personaInput.value = DEFAULT_PERSONA;
  el.knowledgeInput.value = DEFAULT_KNOWLEDGE;
  markProfileDirty();
  showToast('已恢復預設的中文 ⇄ English 設定；按「儲存翻譯設定」才會生效。');
}

function markProfileDirty() {
  state.profileDirty = true;
  el.saveState.textContent = '有尚未儲存的修改';
  el.saveState.classList.remove('saved');
  el.saveState.classList.add('dirty');
}

function markProfileClean(label = '已儲存') {
  state.profileDirty = false;
  el.saveState.textContent = label;
  el.saveState.classList.remove('dirty');
  el.saveState.classList.add('saved');
}

function syncProfileFromInputs() {
  state.profile = {
    persona: el.personaInput.value.trim() || DEFAULT_PERSONA,
    knowledge: el.knowledgeInput.value.trim()
  };
}

function switchTab(tab) {
  const chatActive = tab === 'chat';
  el.chatTab.classList.toggle('is-active', chatActive);
  el.profileTab.classList.toggle('is-active', !chatActive);
  el.chatTab.setAttribute('aria-selected', String(chatActive));
  el.profileTab.setAttribute('aria-selected', String(!chatActive));
  el.chatView.classList.toggle('is-active', chatActive);
  el.profileView.classList.toggle('is-active', !chatActive);
  el.chatView.hidden = !chatActive;
  el.profileView.hidden = chatActive;
}

function updateEngineUI() {
  const status = state.status || {};
  const provider = status.provider || 'browser_demo';
  const configured = status.configured !== false;
  const isDemo = provider === 'demo' || provider === 'browser_demo';
  const label = status.provider_label || providerLabel(provider);
  const model = status.model || '—';

  el.engineLabel.textContent = configured ? label : `${label} 未完成設定`;
  el.statusDot.className = 'status-dot';
  if (!configured) el.statusDot.classList.add('error');
  else if (isDemo) el.statusDot.classList.add('demo');
  else el.statusDot.classList.add('online');

  el.modeTag.textContent = interpreterPairLabel();
  el.engineModeDetail.textContent = label;
  el.engineModelDetail.textContent = model;
  el.profileStorageDetail.textContent = state.serverAvailable
    ? '這個瀏覽器（localStorage / IndexedDB）'
    : '瀏覽器 localStorage';

  if (!state.serverAvailable) {
    el.autoSpeakToggle.checked = false;
    el.autoSpeakToggle.disabled = true;
    el.engineHelp.textContent = '瀏覽器儲存空間無法使用。請關閉無痕模式或允許網站儲存資料，再重新整理。';
  } else if (!configured) {
    el.engineHelp.textContent = status.message || '伺服器已啟動；請按右上角「設定」輸入 OpenAI API Key。';
  } else if (isDemo) {
    el.engineHelp.textContent = '按右上角「設定」輸入你自己的 OpenAI API Key 即可開始。';
  } else {
    el.autoSpeakToggle.disabled = false;
    const voice = titleCase(status.realtime_voice || state.settings?.realtime_voice || 'cedar');
    const ttsVoice = titleCase(status.tts_voice || state.settings?.tts_voice || 'cedar');
    el.engineHelp.textContent = `文字對話使用本機 RAG，朗讀使用 OpenAI TTS ${ttsVoice}；即時語音使用 ${voice}。API Key 不會送到瀏覽器。`;
  }
  updateRealtimeUI();
}

function providerLabel(provider) {
  const labels = {
    browser_demo: '免安裝 Demo',
    demo: '本機檢索 Demo',
    ollama: 'Ollama 本機模型',
    openai: 'OpenAI API'
  };
  return labels[provider] || provider;
}

async function sendCurrentMessage() {
  const message = el.messageInput.value.trim();
  if (!message || state.busy) return;

  if (state.realtime.connecting) {
    showToast('Realtime 正在連線，請等待連線完成後再送出。');
    return;
  }

  if (isRealtimeReady()) {
    sendRealtimeText(message);
    return;
  }

  syncProfileFromInputs();
  const priorHistory = state.history.slice(-12);
  state.history.push({ role: 'user', content: message });
  addMessage('user', message);
  el.messageInput.value = '';
  setBusy(true);
  setAvatarMode('thinking');
  setCaption('THINKING', '我正在比對人格設定與背景知識…');
  const typingNode = addTypingMessage();

  try {
    let result;
    if (state.serverAvailable) {
      const response = await fetchWithTimeout('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: priorHistory,
          persona: state.profile.persona,
          knowledge: state.profile.knowledge
        })
      }, 120000);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      result = payload;
    } else {
      await wait(420 + Math.random() * 480);
      result = browserDemoAnswer(message, state.profile.knowledge);
    }

    typingNode.remove();
    const answer = String(result.answer || '').trim() || '我目前沒有產生出回答。';
    state.history.push({ role: 'assistant', content: answer });
    state.lastReply = answer;
    el.repeatButton.disabled = isRealtimeEngaged();
    addMessage('assistant', answer, result.provider_label || providerLabel(result.provider || state.status?.provider));
    setCaption('ANSWER', answer);

    if (el.autoSpeakToggle.checked) {
      speakText(answer);
    } else {
      setAvatarMode('idle');
    }
  } catch (error) {
    console.error(error);
    typingNode.remove();
    const errorText = `目前無法取得回答：${error.message}`;
    addMessage('assistant', errorText, '連線錯誤', true);
    setCaption('ERROR', errorText);
    setAvatarMode('idle');
    showToast(errorText);
  } finally {
    setBusy(false);
    el.messageInput.focus();
  }
}

function browserDemoAnswer(message, knowledge) {
  const normalized = message.replace(/\s+/g, '');

  if (/^(嗨|哈囉|你好|早安|午安|晚安|hello|hi)/i.test(normalized)) {
    return {
      provider: 'browser_demo',
      provider_label: '免安裝 Demo',
      answer: '（Demo 模式）尚未連接 OpenAI，所以無法真的翻譯。請按右上角「設定」輸入 API Key，再回到「翻譯設定」選好兩種語言。'
    };
  }

  if (/能做什麼|可以做什麼|功能|現在能/.test(normalized)) {
    return {
      provider: 'browser_demo',
      provider_label: '免安裝 Demo',
      answer: '請按右上角「設定」輸入你自己的 OpenAI API Key，就能開始逐句雙向口譯。'
    };
  }

  if (/不知道|不確定|沒有答案|誠實/.test(normalized)) {
    return {
      provider: 'browser_demo',
      provider_label: '免安裝 Demo',
      answer: '當背景資料沒有答案時，我應該直接說這部分目前不在我的資料裡，而不是假裝知道。這個原型把「不編造個人經歷」放在系統規則裡。'
    };
  }

  const matches = retrieveKnowledge(message, knowledge, 3);
  if (!matches.length) {
    return {
      provider: 'browser_demo',
      provider_label: '免安裝 Demo',
      answer: '這部分目前不在我的背景知識庫裡。你可以到「人格與知識庫」頁籤補上資料；接上 AI 模型後，我也會維持同樣的誠實原則，不把猜測當成你的真實經歷。'
    };
  }

  const joined = matches
    .map((item) => item.text.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim())
    .map((text) => shorten(text, 230))
    .join('；');

  return {
    provider: 'browser_demo',
    provider_label: '免安裝 Demo',
    answer: `我在背景知識庫裡找到的相關內容是：${joined}。目前免安裝模式會直接呈現檢索結果；接上語言模型後，我會把這些資料整理成更像你本人說話的自然回答。`,
    retrieved: matches.length
  };
}

function retrieveKnowledge(query, knowledge, limit = 3) {
  if (!knowledge || !query) return [];
  const chunks = chunkKnowledge(knowledge);
  const queryTokens = tokenize(query);
  const normalizedQuery = normalizeText(query);

  return chunks
    .map((text, index) => {
      const normalizedChunk = normalizeText(text);
      const chunkTokens = tokenize(text);
      let score = 0;

      if (normalizedQuery.length >= 2 && normalizedChunk.includes(normalizedQuery)) score += 10;
      queryTokens.forEach((token) => {
        if (chunkTokens.has(token)) score += token.length >= 2 ? 2.2 : 0.55;
      });

      const headingBonus = text.startsWith('#') && [...queryTokens].some((token) => text.includes(token)) ? 2 : 0;
      score += headingBonus;
      return { text, score, index };
    })
    .filter((item) => item.score > 0.8)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);
}

function chunkKnowledge(text) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = '';
  for (const block of blocks) {
    if (!buffer) {
      buffer = block;
      continue;
    }
    if ((buffer.length + block.length) <= 680 && !block.startsWith('#')) {
      buffer += `\n\n${block}`;
    } else {
      chunks.push(buffer);
      buffer = block;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.slice(0, 500);
}

function tokenize(text) {
  const normalized = normalizeText(text);
  const tokens = new Set();
  const words = normalized.match(/[a-z0-9][a-z0-9_-]{1,}/g) || [];
  words.forEach((word) => tokens.add(word));

  const cjk = [...normalized].filter((char) => /[\u3400-\u9fff]/.test(char));
  const stop = new Set(['的','了','是','我','你','他','她','它','在','有','和','與','或','要','會','能','可以','這','那','一','個','嗎','呢','什','麼','請','說','做']);
  cjk.forEach((char) => { if (!stop.has(char)) tokens.add(char); });
  for (let index = 0; index < cjk.length - 1; index += 1) {
    const pair = cjk[index] + cjk[index + 1];
    if (![...pair].every((char) => stop.has(char))) tokens.add(pair);
  }
  return tokens;
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：「」『』（）()\[\]{}<>.,!?;:'"`~@#$%^&*+=|\\/-]/g, '');
}

function addMessage(role, text, label = '', isError = false) {
  const article = document.createElement('article');
  article.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
  if (isError) article.classList.add('error-message');

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'user' ? '\u{1F3A4}' : '\u21C4';

  const body = document.createElement('div');
  body.className = 'message-body';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  const meta = document.createElement('span');
  meta.className = 'message-meta';
  meta.textContent = `${label || (role === 'user' ? '原文' : '譯文')} · ${timeLabel()}`;
  body.append(paragraph, meta);
  article.append(avatar, body);
  el.chatLog.appendChild(article);
  scrollChatToBottom();
  return article;
}

function addTypingMessage() {
  const article = document.createElement('article');
  article.className = 'message assistant-message';
  article.innerHTML = '<div class="message-avatar" aria-hidden="true">\u21C4</div><div class="message-body"><div class="typing-dots" aria-label="正在思考"><span></span><span></span><span></span></div></div>';
  el.chatLog.appendChild(article);
  scrollChatToBottom();
  return article;
}

function clearChat() {
  stopSpeaking();
  if (state.realtime.connected || state.realtime.connecting) stopRealtimeSession();
  if (state.listening) stopListening();
  state.history = [];
  state.lastReply = '';
  el.repeatButton.disabled = true;
  el.chatLog.textContent = '';
  addMessage('assistant', '紀錄已清除。可以重新開始，也可以先到「翻譯設定」調整語言配對。', '口譯官');
  setCaption('READY', '可輸入文字，或開始 OpenAI Realtime 即時語音對話。');
  setAvatarMode('idle');
}

function setBusy(busy) {
  state.busy = busy;
  el.sendButton.disabled = busy;
  el.messageInput.disabled = busy;
  el.micButton.disabled = busy || state.realtime.connected || state.realtime.connecting || !state.recognition;
  el.sendButton.querySelector('span').textContent = busy ? '思考中' : '送出';
}

function setCaption(label, text) {
  el.captionLabel.textContent = label;
  el.liveCaption.textContent = shorten(String(text || ''), 520);
}

// The speaker's own words sit above the translation so both are readable at a
// glance from the stage.
function setSourceCaption(text) {
  if (!el.captionSource) return;
  const value = String(text || '').trim();
  el.captionSource.textContent = value ? `「${shorten(value, 260)}」` : '';
  el.captionSource.hidden = !value;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
  });
}

function timeLabel() {
  return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function setupOpenAITTS() {
  const previous = safeLocalStorageGet(STORAGE_KEYS.voice) || 'cedar';
  el.voiceSelect.textContent = '';
  OPENAI_TTS_VOICES.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice;
    option.textContent = `${VOICE_GENDER[voice] || '🧑'} ${titleCase(voice)}${voice === 'cedar' ? ' · 預設' : ''}`;
    el.voiceSelect.appendChild(option);
  });
  el.voiceSelect.value = OPENAI_TTS_VOICES.includes(previous) ? previous : 'cedar';
}

async function speakText(rawText) {
  if (!rawText) {
    setAvatarMode('idle');
    return;
  }
  // Realtime owns the audio output path for its entire connection lifecycle.
  // Never let a delayed auto-speak or a manual replay restart standard TTS.
  if (isRealtimeEngaged()) return;
  if (!state.serverAvailable || !(state.settings?.has_api_key || state.status?.configured)) {
    setAvatarMode('idle');
    showToast('OpenAI TTS 需要先設定 API Key。');
    openSettings();
    return;
  }
  const text = cleanForSpeech(rawText);
  if (!text) return;

  state.speechSession += 1;
  const session = state.speechSession;
  stopTTSPlayback();
  const requestController = new AbortController();
  state.tts.requestController = requestController;
  setAvatarMode('thinking');
  setCaption('VOICE', '正在產生 OpenAI 台灣華語語音…');
  el.stopVoiceButton.disabled = false;
  el.repeatButton.disabled = true;

  try {
    const response = await fetchWithTimeout('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: requestController.signal,
      body: JSON.stringify({
        text,
        voice: el.voiceSelect.value || state.settings?.tts_voice || 'cedar',
        rate: Number(el.rateSlider.value || 1)
      })
    }, 120000);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (session !== state.speechSession) return;
    if (state.tts.requestController === requestController) state.tts.requestController = null;
    state.tts.objectUrl = URL.createObjectURL(blob);
    el.ttsAudio.src = state.tts.objectUrl;
    el.ttsAudio.onended = () => finishSpeaking(session);
    el.ttsAudio.onerror = () => {
      if (session !== state.speechSession) return;
      finishSpeaking(session);
      showToast('OpenAI TTS 音訊無法播放。');
    };
    await startTTSAudioAnalysis();
    await el.ttsAudio.play();
    setCaption('SPEAKING', rawText);
  } catch (error) {
    if (session !== state.speechSession) return;
    console.error('OpenAI TTS error:', error);
    finishSpeaking(session);
    showToast(`OpenAI TTS 無法朗讀：${error.message}`);
  }
}

function finishSpeaking(session) {
  if (session !== state.speechSession) return;
  stopTTSPlayback();
  stopMouthAnimation();
  el.stopVoiceButton.disabled = true;
  el.repeatButton.disabled = isRealtimeEngaged() || !state.lastReply;
  el.captionLabel.textContent = 'READY';
}

function stopSpeaking() {
  state.speechSession += 1;
  stopTTSPlayback();
  if (state.realtime.outputActive && isRealtimeReady()) {
    try { state.realtime.channel.send(JSON.stringify({ type: 'response.cancel' })); } catch (error) { console.warn(error); }
    state.realtime.outputActive = false;
  }
  stopMouthAnimation();
  el.stopVoiceButton.disabled = true;
  el.repeatButton.disabled = isRealtimeEngaged() || !state.lastReply;
  if (el.captionLabel.textContent === 'SPEAKING') el.captionLabel.textContent = 'READY';
}

function stopTTSPlayback() {
  state.tts.requestController?.abort();
  state.tts.requestController = null;
  el.ttsAudio.pause();
  el.ttsAudio.removeAttribute('src');
  el.ttsAudio.load();
  if (state.tts.objectUrl) URL.revokeObjectURL(state.tts.objectUrl);
  state.tts.objectUrl = '';
  if (state.tts.analyserFrame) cancelAnimationFrame(state.tts.analyserFrame);
  state.tts.analyserFrame = null;
  setSpeechLevels(0);
  setMouthShape(0);
}

async function startTTSAudioAnalysis() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    startMouthAnimation();
    return;
  }
  if (!state.tts.audioContext) {
    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    const source = context.createMediaElementSource(el.ttsAudio);
    source.connect(analyser);
    analyser.connect(context.destination);
    state.tts.audioContext = context;
    state.tts.analyser = analyser;
    state.tts.source = source;
  }
  await state.tts.audioContext.resume().catch(() => {});
  const analyser = state.tts.analyser;
  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  state.tts.env = { loud: 0, shape: 0 };
  const frame = () => {
    if (el.ttsAudio.ended) return;
    if (el.ttsAudio.paused) {
      state.tts.analyserFrame = requestAnimationFrame(frame);
      return;
    }
    const { loud, shape } = analyseSpeechFrame(analyser, timeData, freqData, state.tts.env);
    setSpeechLevels(loud);
    if (loud > SPEECH.TALK_OFF) {
      setAvatarMode('talking');
      setMouthShape(shape * 3);
    } else {
      setMouthShape(0);
    }
    state.tts.analyserFrame = requestAnimationFrame(frame);
  };
  state.tts.analyserFrame = requestAnimationFrame(frame);
}

// Phase 1 smoothing: turn raw analyser data into a smoothed loudness envelope
// (attack fast / release slow) plus a spectral-centroid "openness" so closed
// vowels like 一/嗚 drive a smaller opening than open vowels like 啊/喔.
function vowelOpenness(analyser, freqData) {
  analyser.getByteFrequencyData(freqData);
  const sampleRate = analyser.context?.sampleRate || 44100;
  const binHz = sampleRate / analyser.fftSize;
  const maxBin = Math.min(freqData.length, Math.max(4, Math.floor(4000 / binHz)));
  let weighted = 0;
  let total = 0;
  for (let index = 1; index < maxBin; index += 1) {
    const magnitude = freqData[index];
    weighted += index * magnitude;
    total += magnitude;
  }
  if (total < 6) return 0.5;
  const centroidHz = (weighted / total) * binHz;
  const t = Math.max(0, Math.min(1, (centroidHz - 500) / 2100));
  return Math.max(0.12, 1 - t);
}

function analyseSpeechFrame(analyser, timeData, freqData, env) {
  analyser.getByteTimeDomainData(timeData);
  let sum = 0;
  for (let index = 0; index < timeData.length; index += 1) {
    const sample = (timeData[index] - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / timeData.length);
  const raw = Math.max(0, Math.min(1, (rms - SPEECH.FLOOR) * SPEECH.GAIN));
  env.loud += (raw - env.loud) * (raw > env.loud ? SPEECH.ATTACK : SPEECH.RELEASE);
  const openness = vowelOpenness(analyser, freqData);
  const targetShape = env.loud * (0.42 + 0.58 * openness);
  env.shape += (targetShape - env.shape) * (targetShape > env.shape ? SPEECH.ATTACK : SPEECH.RELEASE);
  return { loud: env.loud, shape: env.shape };
}

// --speech-level keeps a CSS hook for panel effects; the orb gets the raw value.
function setSpeechLevels(level) {
  const value = Math.max(0, Math.min(1, level));
  el.avatarArt.style.setProperty('--speech-level', value.toFixed(3));
  state.orb?.setAudio(value);
}

function cleanForSpeech(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' 程式碼內容略過。 ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function startMouthAnimation() {
  setAvatarMode('talking');
  clearTimeout(state.mouthTimer);
  let previous = -1;

  const next = () => {
    const weighted = [0, 1, 1, 2, 2, 2, 3];
    let shape = weighted[Math.floor(Math.random() * weighted.length)];
    if (shape === previous) shape = (shape + 1) % 4;
    previous = shape;
    setMouthShape(shape);
    const level = 0.28 + Math.random() * 0.7;
    setSpeechLevels(level);
    state.mouthTimer = window.setTimeout(next, 75 + Math.random() * 105);
  };
  next();
}

function stopMouthAnimation() {
  clearTimeout(state.mouthTimer);
  state.mouthTimer = null;
  setSpeechLevels(0);
  setMouthShape(0);
  if (!state.listening && !state.busy) setAvatarMode('idle');
}

// Vowel openness (0..3 legacy scale) shapes the orb's voice aperture.
function setMouthShape(value) {
  const openness = Math.max(0, Math.min(1, Number(value) / 3 || 0));
  state.orb?.setAudio(undefined, openness);
}

const ORB_STATE_LABELS = {
  idle: '待機',
  listening: '聆聽中',
  thinking: '思考中',
  talking: '說話中'
};

function setAvatarMode(mode) {
  el.avatarArt.classList.remove('talking', 'listening', 'thinking');
  if (mode && mode !== 'idle') el.avatarArt.classList.add(mode);
  state.orb?.setMode(mode && ORB_STATE_LABELS[mode] ? mode : 'idle');
  if (el.orbStateLabel) el.orbStateLabel.textContent = ORB_STATE_LABELS[mode] || ORB_STATE_LABELS.idle;
  if (mode === 'listening') setGaze(1, 1);
  if (mode === 'thinking') setGaze(-2, -1);
}

function setupExpressiveMotion() {
  const scheduleBlink = () => {
    clearTimeout(state.blinkTimer);
    state.blinkTimer = window.setTimeout(() => {
      blinkEyes();
      scheduleBlink();
    }, 2300 + Math.random() * 3600);
  };

  const scheduleGaze = () => {
    clearTimeout(state.gazeTimer);
    state.gazeTimer = window.setTimeout(() => {
      if (!state.listening && !state.busy && !state.realtime.outputActive) {
        setGaze((Math.random() - 0.5) * 4.4, (Math.random() - 0.5) * 2.6);
      }
      scheduleGaze();
    }, 1800 + Math.random() * 2600);
  };

  el.avatarArt.addEventListener('pointermove', (event) => {
    const rect = el.avatarArt.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    el.avatarArt.style.setProperty('--tilt-x', `${(x * 1.8).toFixed(2)}deg`);
    el.avatarArt.style.setProperty('--tilt-y', `${(-y * 1.45).toFixed(2)}deg`);
    if (!state.realtime.outputActive) setGaze(x * 2.8, y * 1.8);
  });
  el.avatarArt.addEventListener('pointerleave', () => {
    el.avatarArt.style.setProperty('--tilt-x', '0deg');
    el.avatarArt.style.setProperty('--tilt-y', '0deg');
  });

  scheduleBlink();
  scheduleGaze();
}

// The orb's blink: a light sweep across the sphere.
function blinkEyes() {
  state.orb?.shimmer();
}

// Callers still pass the legacy pixel-ish range (±3.2 / ±2.2); normalize for the orb.
function setGaze(x, y) {
  const limitedX = Math.max(-3.2, Math.min(3.2, Number(x) || 0));
  const limitedY = Math.max(-2.2, Math.min(2.2, Number(y) || 0));
  el.avatarArt.style.setProperty('--gaze-x', `${limitedX.toFixed(2)}px`);
  el.avatarArt.style.setProperty('--gaze-y', `${limitedY.toFixed(2)}px`);
  state.orb?.setGaze(limitedX / 3.2, limitedY / 2.2);
}

function isRealtimeReady() {
  return Boolean(
    state.realtime.connected
    && state.realtime.channel
    && state.realtime.channel.readyState === 'open'
  );
}

function isRealtimeEngaged() {
  return state.realtime.connecting || state.realtime.connected;
}

function updateRealtimeUI() {
  const realtime = state.realtime;
  const realtimeEngaged = isRealtimeEngaged();
  const configured = Boolean(state.serverAvailable && (state.settings?.has_api_key || state.status?.realtime_configured));
  const voice = titleCase(state.settings?.realtime_voice || state.status?.realtime_voice || 'cedar');
  el.realtimeCard.classList.remove('connecting', 'connected', 'error');

  if (realtime.connecting) {
    el.realtimeCard.classList.add('connecting');
    el.realtimeStatus.textContent = '正在建立安全的 WebRTC 語音連線…';
    el.realtimeButton.querySelector('span').textContent = '連線中…';
    el.realtimeButton.disabled = true;
  } else if (realtime.connected) {
    el.realtimeCard.classList.add('connected');
    const microphone = shorten(state.microphone.activeLabel || '系統預設麥克風', 34);
    el.realtimeStatus.textContent = realtime.muted
      ? `${microphone} 已靜音；口譯官暫時聽不到講者`
      : `${interpreterPairLabel()} · ${microphone} · 正在聆聽`;
    el.realtimeButton.querySelector('span').textContent = '結束即席口譯';
    el.realtimeButton.disabled = false;
  } else {
    el.realtimeStatus.textContent = configured
      ? `${interpreterPairLabel()} · ${voice} · 已可連線`
      : '設定 API Key 後，按右邊開始逐句雙向翻譯';
    el.realtimeButton.querySelector('span').textContent = '開始即席口譯';
    el.realtimeButton.disabled = false;
  }

  el.realtimeMuteButton.disabled = !realtime.connected;
  el.quickRealtimeVoiceSelect.disabled = !state.serverAvailable || realtime.connected || realtime.connecting;
  el.quickRealtimeVoiceSelect.title = realtime.connected || realtime.connecting
    ? '口譯進行中，請結束後再切換聲音'
    : '選擇下一次口譯使用的聲音';
  el.realtimeMuteButton.classList.toggle('is-muted', realtime.muted);
  el.realtimeMuteButton.textContent = realtime.muted ? '解除靜音' : '靜音';
  el.microphoneSelect.disabled = realtimeEngaged || !navigator.mediaDevices?.enumerateDevices;
  el.refreshMicrophonesButton.disabled = realtimeEngaged || !navigator.mediaDevices?.getUserMedia;
  el.voiceSelect.disabled = realtimeEngaged;
  el.rateSlider.disabled = realtimeEngaged;
  const ttsConfigured = Boolean(
    state.serverAvailable
    && !['demo', 'browser_demo'].includes(state.status?.provider)
    && (state.settings?.has_api_key || state.status?.configured)
  );
  el.autoSpeakToggle.disabled = realtimeEngaged || !ttsConfigured;
  el.repeatButton.disabled = realtimeEngaged || !state.lastReply;
  if (realtimeEngaged) {
    el.voiceSelect.title = 'Realtime 連線期間已停用一般 TTS。';
    el.rateSlider.title = 'Realtime 連線期間已停用一般 TTS。';
    el.autoSpeakToggle.title = 'Realtime 連線期間不會觸發文字回覆自動朗讀。';
  } else {
    el.voiceSelect.removeAttribute('title');
    el.rateSlider.removeAttribute('title');
    el.autoSpeakToggle.removeAttribute('title');
  }
  el.micButton.disabled = realtime.connected || realtime.connecting || state.busy || !state.recognition;
  if (realtime.connected) {
    el.inputHint.textContent = '口譯已連線；直接說話即可，也可輸入文字';
  } else if (!state.listening) {
    el.inputHint.textContent = state.recognition
      ? '可打字翻譯；現場口譯請按左側「開始即席口譯」'
      : '可打字翻譯；此瀏覽器未提供系統語音辨識';
  }
}

async function toggleRealtimeSession() {
  if (state.realtime.connected || state.realtime.connecting) {
    stopRealtimeSession({ playHangupTone: state.realtime.connected });
    showToast('即席口譯已結束。');
    return;
  }
  await startRealtimeSession();
}

async function startRealtimeSession() {
  if (!state.serverAvailable) {
    showToast('瀏覽器儲存空間無法使用，無法開始口譯。');
    openSettings();
    return;
  }
  if (!(state.settings?.has_api_key || state.status?.realtime_configured)) {
    showToast('請先輸入 OpenAI API Key。');
    openSettings();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    showToast('這個瀏覽器不支援 Realtime WebRTC 語音。');
    return;
  }
  if (state.busy) {
    showToast('請等文字回覆完成後，再開始 Realtime 對話。');
    return;
  }
  if (state.profileDirty) {
    const saved = await saveProfile();
    if (!saved) return;
  }

  stopSpeaking();
  if (state.listening) stopListening();
  state.realtime.connecting = true;
  state.realtime.muted = false;
  updateRealtimeUI();
  setAvatarMode('thinking');
  setCaption('CONNECTING', '正在建立 OpenAI Realtime 安全語音連線…');
  startRealtimeDialTone();

  try {
    const stream = await getRealtimeMicrophoneStream();
    const peer = new RTCPeerConnection();
    const channel = peer.createDataChannel('oai-events');

    state.realtime.localStream = stream;
    state.microphone.activeLabel = stream.getAudioTracks()[0]?.label
      || el.microphoneSelect.selectedOptions[0]?.textContent?.trim()
      || '系統預設麥克風';
    refreshMicrophoneDevices();
    state.realtime.peer = peer;
    state.realtime.channel = channel;
    // Do not send speech until OpenAI confirms that the persona/knowledge
    // session configuration has been applied.
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
      peer.addTrack(track, stream);
    });

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      el.realtimeAudio.srcObject = remoteStream;
      el.realtimeAudio.play().catch((error) => console.warn('Realtime audio autoplay:', error));
      startRealtimeAudioAnalysis(remoteStream);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        const wasConnected = state.realtime.connected;
        stopRealtimeSession();
        if (wasConnected) showToast('Realtime 語音連線已中斷。');
      }
    };
    channel.addEventListener('open', () => {
      const session = state.realtime.sessionConfig;
      if (!session) {
        rejectRealtimeSessionReady(new Error('Realtime 人格設定不存在。'));
        return;
      }
      setCaption('APPLYING', '連線已建立，正在套用人格與背景知識…');
      channel.send(JSON.stringify({
        event_id: `talktwin-session-${Date.now()}`,
        type: 'session.update',
        session
      }));
    });
    channel.addEventListener('message', handleRealtimeEvent);
    channel.addEventListener('close', () => {
      if (state.realtime.connected || state.realtime.connecting) stopRealtimeSession();
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const tokenResponse = await fetchWithTimeout('/api/realtime/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }, 60000);
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.value || !tokenData.session) {
      throw new Error(tokenData.error || `無法取得 Realtime client secret（HTTP ${tokenResponse.status}）`);
    }
    state.realtime.sessionConfig = tokenData.session;

    // Post SDP directly to OpenAI with the short-lived key. This avoids the
    // line-ending corruption seen when an SDP answer is proxied as text.
    const sdpResponse = await fetchWithTimeout('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.value}`,
        'Content-Type': 'application/sdp'
      },
      body: normalizeSdp(offer.sdp)
    }, 70000);
    const rawAnswerSdp = await sdpResponse.text();
    if (!sdpResponse.ok) {
      let detail = rawAnswerSdp;
      try { detail = JSON.parse(rawAnswerSdp).error?.message || rawAnswerSdp; } catch (error) { /* SDP/plain text */ }
      throw new Error(detail || `OpenAI Realtime HTTP ${sdpResponse.status}`);
    }
    const answerSdp = normalizeSdp(rawAnswerSdp);
    const sessionReady = waitForRealtimeSessionReady(15000);
    await Promise.all([
      peer.setRemoteDescription({ type: 'answer', sdp: answerSdp }),
      sessionReady
    ]);
    stream.getAudioTracks().forEach((track) => { track.enabled = true; });
    state.realtime.connecting = false;
    state.realtime.connected = true;
    stopRealtimeDialTone();
    playRealtimeConnectedTone();
    updateRealtimeUI();
    setAvatarMode('listening');
    setCaption('LIVE', '人格與背景知識已套用，直接開口說話即可。');
    showToast('Realtime 已連線；人格與背景知識已確認套用。');
  } catch (error) {
    if (error.message === 'Realtime 對話已結束。') return;
    console.error('Realtime connection failed:', error);
    stopRealtimeSession();
    el.realtimeCard.classList.add('error');
    el.realtimeStatus.textContent = 'Realtime 連線失敗，請檢查 Key、額度與模型權限';
    const detail = error?.name?.includes('Error') && error?.name !== 'Error'
      ? microphoneErrorLabel(error)
      : error.message;
    setCaption('ERROR', `即時語音連線失敗：${detail}`);
    showToast(`Realtime 連線失敗：${detail}`);
  }
}

function waitForRealtimeSessionReady(timeoutMs) {
  clearTimeout(state.realtime.sessionReadyTimer);
  return new Promise((resolve, reject) => {
    state.realtime.sessionReadyResolve = resolve;
    state.realtime.sessionReadyReject = reject;
    state.realtime.sessionReadyTimer = window.setTimeout(() => {
      rejectRealtimeSessionReady(new Error('Realtime 未確認人格與背景知識設定。'));
    }, timeoutMs);
  });
}

function resolveRealtimeSessionReady() {
  clearTimeout(state.realtime.sessionReadyTimer);
  const resolve = state.realtime.sessionReadyResolve;
  state.realtime.sessionReadyTimer = null;
  state.realtime.sessionReadyResolve = null;
  state.realtime.sessionReadyReject = null;
  if (resolve) resolve();
}

function rejectRealtimeSessionReady(error) {
  clearTimeout(state.realtime.sessionReadyTimer);
  const reject = state.realtime.sessionReadyReject;
  state.realtime.sessionReadyTimer = null;
  state.realtime.sessionReadyResolve = null;
  state.realtime.sessionReadyReject = null;
  if (reject) reject(error);
}

function normalizeSdp(value) {
  const text = String(value || '').replace(/^\uFEFF/, '').replace(/\0/g, '');
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (!lines.length || lines[0] !== 'v=0') {
    throw new Error('Realtime 回傳的 SDP 缺少 v=0 起始行。');
  }
  return `${lines.join('\r\n')}\r\n`;
}

function stopRealtimeSession({ playHangupTone = false } = {}) {
  const realtime = state.realtime;
  stopRealtimeCallSounds();
  if (playHangupTone) playRealtimeHangupTone();
  realtime.connecting = false;
  realtime.connected = false;
  realtime.outputActive = false;
  realtime.awaitingResponse = false;
  realtime.lastOutputAudioAt = 0;
  realtime.muted = false;
  state.microphone.activeLabel = '';
  realtime.responseText = '';
  realtime.responseFinalized = false;
  realtime.typingNode?.remove();
  realtime.typingNode = null;
  realtime.voiceDraft = null;
  realtime.sessionConfig = null;
  rejectRealtimeSessionReady(new Error('Realtime 對話已結束。'));

  if (realtime.analyserFrame) cancelAnimationFrame(realtime.analyserFrame);
  realtime.analyserFrame = null;
  realtime.analyser = null;
  if (realtime.audioContext) realtime.audioContext.close().catch(() => {});
  realtime.audioContext = null;
  realtime.localStream?.getTracks().forEach((track) => track.stop());
  realtime.localStream = null;
  try { realtime.channel?.close(); } catch (error) { console.warn(error); }
  try { realtime.peer?.close(); } catch (error) { console.warn(error); }
  realtime.channel = null;
  realtime.peer = null;
  el.realtimeAudio.pause();
  el.realtimeAudio.srcObject = null;
  setSpeechLevels(0);
  setMouthShape(0);
  if (state.busy) setBusy(false);
  if (!state.busy) setAvatarMode('idle');
  updateRealtimeUI();
}

function toggleRealtimeMute() {
  if (!state.realtime.localStream || !state.realtime.connected) return;
  state.realtime.muted = !state.realtime.muted;
  state.realtime.localStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.realtime.muted;
  });
  updateRealtimeUI();
}

// Realtime cues are synthesized locally. Keeping them in Web Audio avoids an
// extra network request (and means the interaction still works offline until
// the actual API connection begins). They are deliberately quiet: the sounds
// should feel like a phone state change, not compete with the conversation.
function getRealtimeSoundContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const realtime = state.realtime;
  if (!realtime.soundContext || realtime.soundContext.state === 'closed') {
    realtime.soundContext = new AudioContextClass();
  }
  if (realtime.soundContext.state === 'suspended') {
    realtime.soundContext.resume().catch(() => {});
  }
  return realtime.soundContext;
}

function playRealtimeTone(frequency, {
  delay = 0,
  duration = 0.1,
  volume = 0.07,
  type = 'sine',
  endFrequency = frequency
} = {}) {
  const context = getRealtimeSoundContext();
  if (!context) return;

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.025, duration * 0.28));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function startRealtimeDialTone() {
  stopRealtimeDialTone();
  const playPulse = () => {
    playRealtimeTone(392, { duration: 0.09, volume: 0.055, type: 'triangle', endFrequency: 410 });
    playRealtimeTone(494, { delay: 0.14, duration: 0.12, volume: 0.055, type: 'triangle', endFrequency: 512 });
  };
  playPulse();
  state.realtime.dialToneTimer = window.setInterval(playPulse, 1800);
}

function stopRealtimeDialTone() {
  if (state.realtime.dialToneTimer) window.clearInterval(state.realtime.dialToneTimer);
  state.realtime.dialToneTimer = null;
}

function playRealtimeConnectedTone() {
  playRealtimeTone(587, { duration: 0.09, volume: 0.075, type: 'sine', endFrequency: 610 });
  playRealtimeTone(784, { delay: 0.105, duration: 0.16, volume: 0.085, type: 'sine', endFrequency: 830 });
}

function playRealtimeHangupTone() {
  playRealtimeTone(554, { duration: 0.1, volume: 0.07, type: 'triangle', endFrequency: 470 });
  playRealtimeTone(370, { delay: 0.11, duration: 0.17, volume: 0.08, type: 'triangle', endFrequency: 270 });
}

function startRealtimeThinkingSound() {
  const realtime = state.realtime;
  if (realtime.thinkingToneTimer || realtime.thinkingToneInterval) return;

  // Fill perceptible conversational gaps without covering up fast replies.
  realtime.thinkingToneTimer = window.setTimeout(() => {
    realtime.thinkingToneTimer = null;
    if (!realtime.connected || realtime.outputActive) return;
    const playFlow = () => {
      playRealtimeTone(238, { duration: 0.28, volume: 0.045, type: 'sine', endFrequency: 300 });
      playRealtimeTone(332, { delay: 0.12, duration: 0.3, volume: 0.038, type: 'sine', endFrequency: 405 });
      playRealtimeTone(270, { delay: 0.29, duration: 0.24, volume: 0.032, type: 'sine', endFrequency: 345 });
    };
    playFlow();
    realtime.thinkingToneInterval = window.setInterval(playFlow, 1550);
  }, 280);
}

function stopRealtimeThinkingSound() {
  const realtime = state.realtime;
  if (realtime.thinkingToneTimer) window.clearTimeout(realtime.thinkingToneTimer);
  if (realtime.thinkingToneInterval) window.clearInterval(realtime.thinkingToneInterval);
  realtime.thinkingToneTimer = null;
  realtime.thinkingToneInterval = null;
}

function stopRealtimeCallSounds() {
  stopRealtimeDialTone();
  stopRealtimeThinkingSound();
}

function sendRealtimeText(message) {
  if (!isRealtimeReady() || state.busy) return;
  syncProfileFromInputs();
  state.history.push({ role: 'user', content: message });
  addMessage('user', message);
  el.messageInput.value = '';
  setBusy(true);
  setAvatarMode('thinking');
  setCaption('THINKING', 'Realtime 正在組織回答…');
  state.realtime.awaitingResponse = true;
  state.realtime.outputActive = false;
  state.realtime.lastOutputAudioAt = performance.now();
  startRealtimeThinkingSound();
  state.realtime.responseText = '';
  state.realtime.responseFinalized = false;
  state.realtime.typingNode = addTypingMessage();

  try {
    state.realtime.channel.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }]
      }
    }));
    state.realtime.channel.send(JSON.stringify({ type: 'response.create' }));
  } catch (error) {
    state.realtime.awaitingResponse = false;
    stopRealtimeThinkingSound();
    state.realtime.typingNode?.remove();
    state.realtime.typingNode = null;
    setBusy(false);
    showToast(`Realtime 文字送出失敗：${error.message}`);
  }
}

function handleRealtimeEvent(messageEvent) {
  let event;
  try {
    event = JSON.parse(messageEvent.data);
  } catch (error) {
    console.warn('Invalid Realtime event.', error);
    return;
  }

  const type = event.type || '';
  if (type === 'session.updated') {
    resolveRealtimeSessionReady();
    return;
  }
  if (type === 'session.created' && state.realtime.connecting) {
    setCaption('APPLYING', 'Realtime 已回應，正在確認人格與背景知識…');
    return;
  }
  if (type === 'input_audio_buffer.speech_started') {
    stopRealtimeThinkingSound();
    state.realtime.awaitingResponse = false;
    state.realtime.outputActive = false;
    setMouthShape(0);
    setAvatarMode('listening');
    setCaption('LISTENING', '正在聆聽講者…');
    setSourceCaption('');
    if (!state.realtime.voiceDraft) {
      state.realtime.voiceDraft = addMessage('user', '🎙️ 講者發言中…', '原文');
    }
    return;
  }
  if (type === 'input_audio_buffer.speech_stopped') {
    setAvatarMode('thinking');
    setCaption('THINKING', '正在翻譯…');
    state.realtime.awaitingResponse = true;
    state.realtime.outputActive = false;
    state.realtime.lastOutputAudioAt = performance.now();
    startRealtimeThinkingSound();
    return;
  }
  if (type === 'conversation.item.done' && event.item?.role === 'user') {
    updateRealtimeUserTranscript(event.item);
    return;
  }
  if (type === 'response.created') {
    if (state.realtime.voiceDraft) {
      const paragraph = state.realtime.voiceDraft.querySelector('.message-body p');
      if (paragraph) paragraph.textContent = '🎙️ 原文（未辨識）';
      state.realtime.voiceDraft = null;
    }
    state.realtime.responseText = '';
    state.realtime.responseFinalized = false;
    state.realtime.awaitingResponse = true;
    state.realtime.lastOutputAudioAt = performance.now();
    setAvatarMode('thinking');
    startRealtimeThinkingSound();
    return;
  }
  if (type === 'response.output_audio.delta' || type === 'response.audio.delta') {
    stopRealtimeThinkingSound();
    state.realtime.lastOutputAudioAt = performance.now();
    state.realtime.outputActive = true;
    setAvatarMode('talking');
    return;
  }
  if (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta') {
    stopRealtimeThinkingSound();
    state.realtime.lastOutputAudioAt = performance.now();
    state.realtime.outputActive = true;
    state.realtime.responseText += event.delta || '';
    setAvatarMode('talking');
    setCaption('SPEAKING', state.realtime.responseText || '正在翻譯…');
    el.stopVoiceButton.disabled = false;
    return;
  }
  if (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done') {
    const transcript = String(event.transcript || state.realtime.responseText || '').trim();
    finalizeRealtimeReply(transcript);
    return;
  }
  if (type === 'response.output_text.delta') {
    stopRealtimeThinkingSound();
    state.realtime.awaitingResponse = false;
    state.realtime.responseText += event.delta || '';
    setCaption('ANSWER', state.realtime.responseText);
    return;
  }
  if (type === 'response.output_text.done') {
    finalizeRealtimeReply(String(event.text || state.realtime.responseText || '').trim());
    return;
  }
  if (type === 'response.output_audio.done' || type === 'response.audio.done') {
    stopRealtimeThinkingSound();
    window.setTimeout(() => {
      state.realtime.outputActive = false;
      setSpeechLevels(0);
      setMouthShape(0);
      if (state.realtime.connected) setAvatarMode('listening');
    }, 260);
    return;
  }
  if (type === 'response.done') {
    stopRealtimeThinkingSound();
    state.realtime.awaitingResponse = false;
    const text = extractRealtimeResponseText(event.response) || state.realtime.responseText;
    if (!state.realtime.responseFinalized && text.trim()) finalizeRealtimeReply(text.trim());
    state.realtime.typingNode?.remove();
    state.realtime.typingNode = null;
    if (state.busy) setBusy(false);
    return;
  }
  if (type === 'response.cancelled') {
    stopRealtimeThinkingSound();
    state.realtime.awaitingResponse = false;
    state.realtime.outputActive = false;
    state.realtime.typingNode?.remove();
    state.realtime.typingNode = null;
    if (state.busy) setBusy(false);
    if (state.realtime.connected) setAvatarMode('listening');
    return;
  }
  if (type === 'error') {
    stopRealtimeThinkingSound();
    state.realtime.awaitingResponse = false;
    const detail = event.error?.message || event.message || '未知錯誤';
    if (state.realtime.connecting) rejectRealtimeSessionReady(new Error(detail));
    state.realtime.typingNode?.remove();
    state.realtime.typingNode = null;
    if (state.busy) setBusy(false);
    setCaption('ERROR', detail);
    showToast(`Realtime 錯誤：${detail}`);
  }
}

function updateRealtimeUserTranscript(item) {
  if (!item || item.id === state.realtime.lastUserItemId) return;
  const content = Array.isArray(item.content) ? item.content : [];
  const audioPart = content.find((part) => part?.type === 'input_audio' && part.transcript);
  const transcript = String(audioPart?.transcript || '').trim();
  if (!state.realtime.voiceDraft) return;
  const paragraph = state.realtime.voiceDraft.querySelector('.message-body p');
  if (paragraph && transcript) paragraph.textContent = transcript;
  if (transcript) setSourceCaption(transcript);
  state.realtime.lastUserItemId = item.id || '';
  state.realtime.voiceDraft = null;
  if (transcript) state.history.push({ role: 'user', content: transcript });
}

function finalizeRealtimeReply(text) {
  if (state.realtime.responseFinalized || !text) return;
  state.realtime.responseFinalized = true;
  state.realtime.responseText = text;
  state.realtime.typingNode?.remove();
  state.realtime.typingNode = null;
  state.history.push({ role: 'assistant', content: text });
  state.lastReply = text;
  el.repeatButton.disabled = false;
  addMessage('assistant', text, `譯文 · ${titleCase(state.settings?.realtime_voice || 'cedar')}`);
  setCaption('SPEAKING', text);
  if (state.busy) setBusy(false);
}

function extractRealtimeResponseText(response) {
  const output = Array.isArray(response?.output) ? response.output : [];
  const parts = [];
  output.forEach((item) => {
    (Array.isArray(item?.content) ? item.content : []).forEach((content) => {
      if (typeof content?.transcript === 'string') parts.push(content.transcript);
      else if (typeof content?.text === 'string') parts.push(content.text);
    });
  });
  return parts.join('\n').trim();
}

async function startRealtimeAudioAnalysis(stream) {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (state.realtime.analyserFrame) cancelAnimationFrame(state.realtime.analyserFrame);
  if (state.realtime.audioContext) await state.realtime.audioContext.close().catch(() => {});

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  context.createMediaStreamSource(stream).connect(analyser);
  await context.resume().catch(() => {});
  state.realtime.audioContext = context;
  state.realtime.analyser = analyser;

  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  state.realtime.env = { loud: 0, shape: 0 };
  let gazeTick = 0;
  const frame = () => {
    if (!state.realtime.analyser || (!state.realtime.connected && !state.realtime.connecting)) return;
    const { loud, shape } = analyseSpeechFrame(analyser, timeData, freqData, state.realtime.env);
    setSpeechLevels(loud);

    if (loud > SPEECH.TALK_ON) {
      state.realtime.lastOutputAudioAt = performance.now();
      stopRealtimeThinkingSound();
      state.realtime.outputActive = true;
      setAvatarMode('talking');
      setMouthShape(shape * 3);
      gazeTick += 1;
      if (gazeTick % 10 === 0) setGaze((Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 0.7);
    } else if (state.realtime.outputActive) {
      setMouthShape(0);
      // Realtime can pause mid-response while it waits for the next audio
      // segment. Treat that silence as a conversational gap, then stop the
      // cue instantly when the next audible syllable arrives.
      if (
        state.realtime.awaitingResponse
        && performance.now() - state.realtime.lastOutputAudioAt > 520
      ) {
        state.realtime.outputActive = false;
        setAvatarMode('thinking');
        startRealtimeThinkingSound();
      }
    }
    state.realtime.analyserFrame = requestAnimationFrame(frame);
  };
  frame();
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    el.micButton.disabled = true;
    el.micButton.title = '這個瀏覽器未提供語音輸入；仍可直接打字。';
    el.inputHint.textContent = '此瀏覽器可打字；未偵測到語音輸入功能';
    return;
  }

  const recognition = new Recognition();
  recognition.lang = speechRecognitionLang();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  state.recognition = recognition;

  let startingText = '';
  recognition.onstart = () => {
    state.listening = true;
    startingText = el.messageInput.value.trim();
    el.micButton.classList.add('is-listening');
    el.micButton.setAttribute('aria-label', '停止語音輸入');
    el.inputHint.textContent = '正在聽你說話…再按一次可停止';
    setAvatarMode('listening');
    setCaption('LISTENING', '正在聽你說話…');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let index = 0; index < event.results.length; index += 1) {
      transcript += event.results[index][0]?.transcript || '';
    }
    el.messageInput.value = [startingText, transcript.trim()].filter(Boolean).join(startingText ? ' ' : '');
  };

  recognition.onerror = (event) => {
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      showToast(`語音輸入無法使用：${recognitionErrorLabel(event.error)}`);
    }
  };

  recognition.onend = () => {
    state.listening = false;
    el.micButton.classList.remove('is-listening');
    el.micButton.setAttribute('aria-label', '開始語音輸入');
    el.inputHint.textContent = '可打字，也可使用麥克風';
    if (!state.busy) setAvatarMode('idle');
    if (el.captionLabel.textContent === 'LISTENING') {
      setCaption('READY', el.messageInput.value.trim() || '沒有聽到內容，可以再試一次或直接打字。');
    }
    el.messageInput.focus();
  };
}

function toggleListening() {
  if (!state.recognition) return;
  if (state.listening) {
    stopListening();
    return;
  }
  stopSpeaking();
  try {
    state.recognition.start();
  } catch (error) {
    console.warn(error);
  }
}

function stopListening() {
  try {
    state.recognition?.stop();
  } catch (error) {
    console.warn(error);
  }
}

function recognitionErrorLabel(code) {
  const labels = {
    'not-allowed': '請允許瀏覽器使用麥克風',
    'service-not-allowed': '系統未允許語音辨識服務',
    'audio-capture': '找不到可用的麥克風',
    'network': '語音辨識服務連線失敗',
    'no-speech': '沒有偵測到語音'
  };
  return labels[code] || code || '未知錯誤';
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), 3400);
}

function shorten(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function titleCase(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  // Static build: there is no local server, so the /api/* routes are answered
  // in the browser. Everything downstream still sees a real Response.
  const target = String(url);
  if (window.TalkTwinStaticAPI && (target.startsWith('/api/') || target === '/health')) {
    return window.TalkTwinStaticAPI.handle(target, options);
  }
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('連線逾時');
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('localStorage unavailable', error);
  }
}
