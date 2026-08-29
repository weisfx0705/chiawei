'use strict';

/**
 * TalkTwin 即席口譯 — 靜態版 API 層
 *
 * 本機版把設定、提示詞組裝與 OpenAI 呼叫都放在 127.0.0.1 的 Python 伺服器。
 * 靜態版（GitHub Pages）沒有伺服器，所以這個檔案在瀏覽器內重現同一組
 * `/api/*` 路由：設定存 localStorage、角色圖片存 IndexedDB，OpenAI 則由頁面
 * 直接呼叫（api.openai.com 對這些端點皆允許跨來源請求）。
 *
 * app.js 的 fetchWithTimeout 會把 /api/ 開頭的請求轉進 handle()，回傳真正的
 * Response 物件，因此上層的 .json() / .blob() / .ok 判斷完全不用改。
 */
const TalkTwinStaticAPI = (() => {
  const OPENAI_BASE = 'https://api.openai.com/v1';
  const STORE = {
    config: 'talktwin.static.config.v1',
    profile: 'talktwin.static.profile.v1',
    avatar: 'talktwin.static.avatar.v1'
  };
  const IDB_NAME = 'talktwin-static';
  const IDB_STORE = 'images';
  const MAX_LIBRARY_ENTRIES = 24;
  const MAX_AVATAR_NAME_LEN = 40;

  // --- 語言目錄（與 server.py 的 INTERPRETER_LANGUAGES 對應）---------------
  const LANGUAGES = [
    { code: 'zh-TW', label: '中文（台灣）', native: '繁體中文', english: 'Traditional Chinese (Taiwan Mandarin)',
      voice_note: '自然、清楚、穩定的台灣華語口音；用台灣慣用詞與語速，避免中國大陸播報腔、兒化音與過度捲舌。' },
    { code: 'zh-CN', label: '中文（简体 · 普通话）', native: '简体中文', english: 'Simplified Chinese (Mandarin)',
      voice_note: '標準普通話發音，語速平穩自然。' },
    { code: 'en', label: '英文 English', native: 'English', english: 'English',
      voice_note: 'clear, natural, neutral international English; conversational pace, not a news anchor.' },
    { code: 'ja', label: '日文 日本語', native: '日本語', english: 'Japanese',
      voice_note: '自然で丁寧な日本語。場面に合わせた敬語を使う。' },
    { code: 'ko', label: '韓文 한국어', native: '한국어', english: 'Korean',
      voice_note: '자연스러운 표준 한국어, 상황에 맞는 존댓말.' },
    { code: 'vi', label: '越南文 Tiếng Việt', native: 'Tiếng Việt', english: 'Vietnamese',
      voice_note: 'tiếng Việt tự nhiên, giọng chuẩn, tốc độ vừa phải.' },
    { code: 'id', label: '印尼文 Bahasa Indonesia', native: 'Bahasa Indonesia', english: 'Indonesian',
      voice_note: 'Bahasa Indonesia yang natural dan jelas.' },
    { code: 'th', label: '泰文 ไทย', native: 'ภาษาไทย', english: 'Thai',
      voice_note: 'ภาษาไทยที่เป็นธรรมชาติ ชัดเจน สุภาพ' },
    { code: 'ms', label: '馬來文 Bahasa Melayu', native: 'Bahasa Melayu', english: 'Malay',
      voice_note: 'Bahasa Melayu yang natural dan jelas.' },
    { code: 'fil', label: '菲律賓文 Filipino', native: 'Filipino', english: 'Filipino (Tagalog)',
      voice_note: 'natural at malinaw na Filipino.' },
    { code: 'hi', label: '印地文 हिन्दी', native: 'हिन्दी', english: 'Hindi',
      voice_note: 'स्वाभाविक और स्पष्ट हिन्दी।' },
    { code: 'fr', label: '法文 Français', native: 'Français', english: 'French',
      voice_note: 'français naturel et clair, rythme conversationnel.' },
    { code: 'de', label: '德文 Deutsch', native: 'Deutsch', english: 'German',
      voice_note: 'natürliches, klares Hochdeutsch.' },
    { code: 'es', label: '西班牙文 Español', native: 'Español', english: 'Spanish',
      voice_note: 'español natural y claro, ritmo conversacional.' },
    { code: 'pt', label: '葡萄牙文 Português', native: 'Português', english: 'Portuguese',
      voice_note: 'português natural e claro.' },
    { code: 'it', label: '義大利文 Italiano', native: 'Italiano', english: 'Italian',
      voice_note: 'italiano naturale e chiaro.' },
    { code: 'ru', label: '俄文 Русский', native: 'Русский', english: 'Russian',
      voice_note: 'естественный и чёткий русский язык.' },
    { code: 'ar', label: '阿拉伯文 العربية', native: 'العربية', english: 'Arabic',
      voice_note: 'عربية فصحى حديثة، واضحة وطبيعية.' }
  ];
  const LANGUAGE_MAP = new Map(LANGUAGES.map((item) => [item.code, item]));

  const TONES = {
    warm: '語氣要友善、帶有情感，像一位站在講者身邊、真心想幫忙的人。',
    neutral: '語氣中性、專業、精準，不加入個人情緒。',
    formal: '語氣正式、莊重，適合典禮、致詞與貴賓場合。'
  };
  const PACING = { fast: 'high', balanced: 'medium', patient: 'low' };
  const STYLES = {
    strict: '只輸出譯文本身，不做任何補充說明。',
    assist: '以譯文為主；只有在原句含有對方文化中不存在的概念時，才在譯文後補一句最多十個字的極短說明。'
  };

  const REALTIME_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  const REALTIME_VOICE_ALIASES = { onyx: 'cedar', onxy: 'cedar' };
  const TTS_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

  const TAIWAN_MANDARIN_VOICE_RULES = `## 回覆語言
- 預設只使用繁體中文的台灣華語；除非使用者明確要求，否則不要切換語言。
- 不要因使用者的口音、語助詞、姓名或零星外語詞而改變回覆語言。

## 說話口音
- 全程使用自然、清楚、穩定的台灣華語（Taiwan Mandarin）口音，從第一個字到最後一個字保持一致。
- 使用台灣日常說話的語速、重音、停頓、聲調與少量自然語助詞，不要刻意誇張口音。
- 使用台灣慣用詞；避免中國大陸普通話的播報腔、兒化音、過度捲舌及中國大陸慣用詞。
- 語氣溫暖、俐落、有真人對話感，不要像新聞主播或導航機器。`;

  const DEFAULT_INTERPRETER = {
    enabled: true,
    language_a: 'zh-TW',
    language_b: 'en',
    venue: '義守大學 I-Shou University',
    tone: 'warm',
    pacing: 'balanced',
    style: 'strict',
    show_source: true,
    transcribe_model: 'gpt-4o-mini-transcribe',
    notes: ''
  };

  const DEFAULT_OPENAI = {
    api_key: '',
    model: 'gpt-5.4-mini',
    max_output_tokens: 600,
    realtime_model: 'gpt-realtime-2.1',
    realtime_voice: 'cedar',
    tts_model: 'gpt-4o-mini-tts',
    tts_voice: 'cedar'
  };

  const DEFAULT_FACE_RIG = { ready: false, source: '', left_eye: null, right_eye: null, mouth: null };
  const DEFAULT_CONTROLS = {
    fit: 'cover',
    rig_mode: 'sophon',
    scale: 1.0,
    offset_x: 0.0,
    offset_y: 0.0,
    memory_opacity: 0.94,
    orb_colors: { mode: 'auto', a: '', b: '', c: '' },
    face_rig: DEFAULT_FACE_RIG
  };

  class ClientInputError extends Error {}
  class ProviderConfigError extends Error {}

  // --- 小工具 --------------------------------------------------------------
  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
      console.warn('localStorage read failed:', key, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('localStorage write failed:', key, error);
      throw new ClientInputError('瀏覽器儲存空間不足或被封鎖，設定無法保存。');
    }
  }

  function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.round(Math.max(min, Math.min(max, num)) * 10000) / 10000;
  }

  function shortenPreservingEnds(text, maxLength) {
    if (text.length <= maxLength) return text;
    const marker = '\n\n…（中間內容因 context 上限省略）…\n\n';
    const available = Math.max(0, maxLength - marker.length);
    const head = Math.floor(available * 0.7);
    return text.slice(0, head).trimEnd() + marker + text.slice(text.length - (available - head)).trimStart();
  }

  function normalizeRealtimeVoice(value) {
    const key = String(value || '').trim().toLowerCase();
    if (REALTIME_VOICE_ALIASES[key]) return REALTIME_VOICE_ALIASES[key];
    return REALTIME_VOICES.includes(key) ? key : 'cedar';
  }

  function normalizeTTSVoice(value) {
    const key = String(value || '').trim().toLowerCase();
    return TTS_VOICES.includes(key) ? key : 'cedar';
  }

  function languageInfo(code) {
    const key = String(code || '').trim();
    if (LANGUAGE_MAP.has(key)) return LANGUAGE_MAP.get(key);
    const lowered = key.toLowerCase();
    const match = LANGUAGES.find((item) => item.code.toLowerCase() === lowered);
    return match || LANGUAGE_MAP.get('zh-TW');
  }

  // --- 設定與人格 ----------------------------------------------------------
  function loadConfig() {
    const stored = readJSON(STORE.config, {});
    return {
      openai: { ...DEFAULT_OPENAI, ...(stored.openai || {}) },
      interpreter: normalizeInterpreter(stored.interpreter)
    };
  }

  function saveConfig(config) {
    writeJSON(STORE.config, config);
  }

  function loadProfile() {
    const stored = readJSON(STORE.profile, null);
    if (stored && typeof stored.persona === 'string') {
      return { persona: stored.persona, knowledge: String(stored.knowledge || '') };
    }
    // First visit: seed from the current language pair so the app is usable
    // before the visitor touches anything.
    const config = loadConfig();
    return { persona: buildInterpreterPersona(config.interpreter), knowledge: DEFAULT_GLOSSARY };
  }

  const DEFAULT_GLOSSARY = `# 詞彙表／專有名詞對照

每行一組對照，口譯時會整份載入並優先採用。

## 學校與單位
義守大學 = I-Shou University
義大 = ISU
國際及兩岸事務處 = Office of International and Cross-Strait Affairs
主校區 = Main Campus
燕巢校區 = Yanchao Campus

## 常見職稱
校長 = President
院長 = Dean
系主任 = Department Chair
教授 = Professor
交換生 = exchange student`;

  // --- 口譯設定 ------------------------------------------------------------
  function normalizeInterpreter(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const a = languageInfo(source.language_a ?? DEFAULT_INTERPRETER.language_a);
    let b = languageInfo(source.language_b ?? DEFAULT_INTERPRETER.language_b);
    if (a.code === b.code) {
      // A single-language pair would make two-way interpreting impossible.
      b = languageInfo(a.code === 'en' ? 'zh-TW' : 'en');
    }

    const tone = TONES[String(source.tone || '').toLowerCase()] ? String(source.tone).toLowerCase() : DEFAULT_INTERPRETER.tone;
    const pacing = PACING[String(source.pacing || '').toLowerCase()] ? String(source.pacing).toLowerCase() : DEFAULT_INTERPRETER.pacing;
    const style = STYLES[String(source.style || '').toLowerCase()] ? String(source.style).toLowerCase() : DEFAULT_INTERPRETER.style;

    const venue = String(source.venue ?? DEFAULT_INTERPRETER.venue).trim();
    if (venue.length > 200) throw new ClientInputError('服務場域太長，最多 200 個字元。');
    const notes = String(source.notes ?? '').trim();
    if (notes.length > 4000) throw new ClientInputError('補充指示太長，最多 4000 個字元。');

    let transcribeModel = String(source.transcribe_model ?? DEFAULT_INTERPRETER.transcribe_model).trim();
    if (transcribeModel && !/^[A-Za-z0-9._:-]+$/.test(transcribeModel)) {
      throw new ClientInputError('原文辨識模型名稱格式錯誤。');
    }

    return {
      enabled: source.enabled === undefined ? DEFAULT_INTERPRETER.enabled : Boolean(source.enabled),
      language_a: a.code,
      language_b: b.code,
      venue,
      tone,
      pacing,
      style,
      show_source: source.show_source === undefined ? DEFAULT_INTERPRETER.show_source : Boolean(source.show_source),
      transcribe_model: transcribeModel || DEFAULT_INTERPRETER.transcribe_model,
      notes
    };
  }

  function buildInterpreterPersona(interpreter) {
    const s = normalizeInterpreter(interpreter);
    const a = languageInfo(s.language_a);
    const b = languageInfo(s.language_b);
    const venueBlock = s.venue ? `通常你服務的地方是 ${s.venue}。` : '服務場域由講者現場說明。';
    const notesBlock = s.notes ? `\n\n# 講者的補充指示（優先於上面的通則）\n${s.notes}` : '';

    return `你是一位專業即席翻譯官。你的任務是協助講者在演講場景中進行「${a.native}」與「${b.native}」逐句翻譯。${TONES[s.tone]}

${venueBlock}

# 工作方式
- 進行逐句雙向翻譯：講者說 ${a.native} 時，你翻成 ${b.native}；講者切換到 ${b.native} 時，你翻成 ${a.native}。
- 每次僅翻譯一個句子，等講者說完一句後再翻譯。
- ${STYLES[s.style]}
- 只說出譯文，不要加「他說」「翻譯如下」「好的」之類的引導語，也不要複誦原文。
- 不要回答講者的問題、不要給建議、不要摘要、不要評論。你是翻譯官，不是對話對象。
- 保持自然、親切、對話式，避免冗長講解。

# 準確度
- 人名、校名、系所、職稱、數字、日期、金額、單位必須精確傳達。
- 遇到不確定的專有名詞，保留原文說法，不要臆測或自行改寫。
- 講者口誤或重複時，翻出他真正要表達的意思，不要跟著錯、不要跟著重複。
- 若聽到的內容不屬於這兩種語言，一律翻成 ${a.native}。
- 聽不清楚時，只說一句「${a.native}：可以再說一次嗎？」，不要猜測內容。

# 開場
- 連線後，先分別用 ${a.native} 和 ${b.native} 各說一句簡短問候，說明「${a.native} ⇄ ${b.native} 逐句口譯已就緒」，然後安靜等待。
- 之後不要主動發言，只在講者說完一句後翻譯。

# Notes
- 回應必須清晰、自然口語，適合即時語音互動的節奏。
- 始終保持友善、積極、鼓勵講者。${notesBlock}`;
  }

  function buildInterpreterVoiceRules(interpreter) {
    const s = normalizeInterpreter(interpreter);
    const a = languageInfo(s.language_a);
    const b = languageInfo(s.language_b);
    return `## 輸出語言（逐句雙向翻譯）
- 這場對話只使用兩種語言：${a.native}（${a.english}）與 ${b.native}（${b.english}）。
- 講者說 ${a.native} → 你只輸出 ${b.native}。講者說 ${b.native} → 你只輸出 ${a.native}。
- 每一句輸出都必須是單一語言，不要在同一句裡混用兩種語言（原文即為專有名詞時除外）。
- 不要因為背景雜音、口音、語助詞、人名或零星外語詞就切換翻譯方向；以整句的主要語言判斷。

## 說話口音
- 說 ${a.native} 時：${a.voice_note}
- 說 ${b.native} 時：${b.voice_note}
- 兩種語言都要從第一個字到最後一個字保持一致的口音，語氣要像真人對話，不要像新聞主播或導航機器。`;
  }

  function interpreterPublic(interpreter) {
    const s = normalizeInterpreter(interpreter);
    const a = languageInfo(s.language_a);
    const b = languageInfo(s.language_b);
    return {
      ok: true,
      ...s,
      language_a_label: a.label,
      language_b_label: b.label,
      language_a_native: a.native,
      language_b_native: b.native,
      pair_label: `${a.native} ⇄ ${b.native}`,
      languages: LANGUAGES.map((item) => ({ code: item.code, label: item.label, native: item.native })),
      tones: Object.keys(TONES),
      pacings: Object.keys(PACING),
      styles: Object.keys(STYLES),
      persona_preview: buildInterpreterPersona(s)
    };
  }

  // --- 提示詞組裝 ----------------------------------------------------------
  function buildRealtimeInterpreterInstructions(personaText, glossary, interpreter) {
    const s = normalizeInterpreter(interpreter);
    const a = languageInfo(s.language_a);
    const b = languageInfo(s.language_b);
    const glossaryText = glossary.trim() || '（目前沒有詞彙表。）';

    return `# 角色與目標
- 你是一位專業即席口譯員，負責「${a.native}」與「${b.native}」的現場逐句雙向口譯。
- 完整採用下方口譯指令；它決定你的身分、語氣與工作方式。
- 你不是聊天助理。除了譯文與必要的一句確認，不要說任何其他話。

# 口譯指令（最高優先）
${personaText}
# 口譯指令結束

# 語言與口音
${buildInterpreterVoiceRules(s)}

# 詞彙表與專有名詞對照（翻譯時務必採用）
${glossaryText}
# 詞彙表結束

# 口譯規則
- 逐句翻譯：講者說完一句就翻一句，不要等到整段結束，也不要一次翻兩三句。
- 忠實完整：不要省略、不要摘要、不要美化、不要加入原句沒有的內容。譯文長度可以跟原句一樣長。
- 詞彙表裡出現過的人名、單位名、職稱、術語，一律採用表中的對應譯法。
- 不要念出 Markdown 符號、括號註記或格式標記。
- 講者若直接對你說話（例如「換成日文」「再說一次」），照做並用最短的一句回覆，然後回到純翻譯狀態。
- 若一段話中途被打斷，翻譯已經聽到的部分即可，不要憑空補完。`;
  }

  function buildRealtimeInstructions(persona, knowledge, interpreter) {
    const personaExcerpt = shortenPreservingEnds(persona.trim(), 30000);
    const knowledgeExcerpt = shortenPreservingEnds(knowledge.trim(), 48000);
    const personaText = personaExcerpt || '自然、溫暖、直接地使用繁體中文回答。';

    if (interpreter && interpreter.enabled) {
      return buildRealtimeInterpreterInstructions(personaText, knowledgeExcerpt, interpreter);
    }

    return `# 角色與目標
- 完整採用下方人格原文；人格原文決定你的身分、語氣、價值觀、回答方式與任務。
- 不要自行加入「數位分身」或一般助理身分，也不要退回預設 Chat 風格。

# 人格 Prompt（最高優先）
${personaText}
# 人格 Prompt 結束

# 語言與口音
- 若人格 Prompt 明確指定輸出語言或翻譯任務，依人格 Prompt 執行。
${TAIWAN_MANDARIN_VOICE_RULES}

# 背景知識（可信事實來源）
${knowledgeExcerpt || '（目前沒有背景資料。）'}
# 背景知識結束

# 回答規則
- 涉及使用者本人、品牌、產品、履歷或經歷，只能依照背景知識；資料不足時坦白說不知道，不要虛構。
- 先回答重點；每次通常控制在 150 個中文字左右，除非對方要求深入說明。
- 不要念出 Markdown 符號、網址或格式標記。
- 不要因背景雜音、口音、語助詞、姓名或零星外語詞切換成英文。
- 回答前先遵守人格 Prompt；不要用一般助理的制式開場取代人格語氣。`;
  }

  function buildRealtimeSessionConfig(config, profile) {
    const section = config.openai || {};
    const model = String(section.realtime_model || 'gpt-realtime-2.1').trim();
    if (!model) throw new ProviderConfigError('尚未設定 Realtime 模型。');
    const voice = normalizeRealtimeVoice(section.realtime_voice);
    const interpreter = normalizeInterpreter(config.interpreter);
    const active = Boolean(interpreter.enabled);

    const audioInput = {
      turn_detection: {
        type: 'semantic_vad',
        eagerness: active ? PACING[interpreter.pacing] : 'high',
        create_response: true,
        interrupt_response: true
      }
    };
    if (active && interpreter.show_source && interpreter.transcribe_model) {
      audioInput.transcription = { model: interpreter.transcribe_model };
    }

    return {
      type: 'realtime',
      model,
      reasoning: { effort: 'low' },
      output_modalities: ['audio'],
      audio: { input: audioInput, output: { voice } },
      instructions: buildRealtimeInstructions(
        profile.persona || '',
        profile.knowledge || '',
        active ? interpreter : null
      )
    };
  }

  function buildSystemPrompt(persona, knowledge, interpreter) {
    if (interpreter && interpreter.enabled) {
      const s = normalizeInterpreter(interpreter);
      const glossary = shortenPreservingEnds(knowledge.trim(), 20000) || '（目前沒有詞彙表。）';
      return `# 口譯指令（最高優先）
${persona.trim() || buildInterpreterPersona(s)}
# 口譯指令結束

# 語言與方向
${buildInterpreterVoiceRules(s)}

# 口譯規則
- 逐句翻譯，一次只翻一句；忠實完整，不省略、不摘要、不加註。
- 只輸出譯文本身，不要加引導語，也不要複誦原文。
- 不要回答使用者的問題、不要給意見。你是翻譯官，不是對話對象。
- 詞彙表裡出現的人名、單位名、職稱、術語，一律採用表中的對應譯法。

# 詞彙表與專有名詞對照
${glossary}
# 詞彙表結束`;
    }

    // The static build always runs in interpreting mode; this branch only
    // matters if someone flips `interpreter.enabled` by hand in storage.
    return `# 人格原文（最高優先）
${persona.trim() || '你是一個有幫助的助理，用自然的方式回答使用者。'}

# 背景資料
${shortenPreservingEnds(knowledge.trim(), 12000) || '（這次沒有背景資料。）'}
# 背景資料結束`;
  }

  function buildTTSPayload(text, config, voice, rate) {
    const section = config.openai || {};
    const model = String(section.tts_model || 'gpt-4o-mini-tts').trim();
    if (!model) throw new ProviderConfigError('尚未設定 OpenAI TTS 模型。');
    let pace = '自然、從容但不要拖拍';
    if (rate < 0.9) pace = '稍慢、清楚、保留自然停頓';
    else if (rate > 1.1) pace = '稍快、俐落，但每個字仍要清楚';

    const payload = {
      model,
      voice: normalizeTTSVoice(voice || section.tts_voice),
      input: text,
      response_format: 'mp3'
    };
    if (model.startsWith('gpt-4o-mini-tts')) {
      payload.instructions = `用自然清楚的方式朗讀這段文字，語速要${pace}，忠實依照文字本身的語言發音。`;
    }
    return payload;
  }

  // --- OpenAI 直連 ---------------------------------------------------------
  function requireKey(config) {
    const key = String(config.openai?.api_key || '').trim();
    if (!key) throw new ProviderConfigError('請先按右上角「設定」輸入你自己的 OpenAI API Key。');
    return key;
  }

  async function openaiJSON(path, body, apiKey, extraHeaders = {}) {
    const response = await fetch(`${OPENAI_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || `HTTP ${response.status}`;
      throw new ProviderConfigError(`OpenAI 回報錯誤：${detail}`);
    }
    return data;
  }

  function extractOpenAIText(data) {
    if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
    const parts = [];
    if (Array.isArray(data.output)) {
      data.output.forEach((item) => {
        if (!item || item.type !== 'message' || !Array.isArray(item.content)) return;
        item.content.forEach((block) => {
          if (!block) return;
          if (block.type === 'output_text' && typeof block.text === 'string') parts.push(block.text);
          else if (block.type === 'refusal' && typeof block.refusal === 'string') parts.push(block.refusal);
        });
      });
    }
    return parts.map((p) => p.trim()).filter(Boolean).join('\n').trim();
  }

  // --- 角色圖片：中繼資料放 localStorage，影像放 IndexedDB -----------------
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(IDB_STORE)) request.result.createObjectStore(IDB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB 無法開啟'));
    });
  }

  async function idbSet(id, dataUrl) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(dataUrl, id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('圖片寫入失敗')); };
    });
  }

  async function idbGet(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const request = tx.objectStore(IDB_STORE).get(id);
      request.onsuccess = () => { db.close(); resolve(request.result || null); };
      request.onerror = () => { db.close(); reject(request.error || new Error('圖片讀取失敗')); };
    });
  }

  async function idbDelete(id) {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  }

  function defaultAvatarIndex() {
    return { active_id: 'default', entries: [], default_controls: { ...DEFAULT_CONTROLS } };
  }

  function loadAvatarIndex() {
    const stored = readJSON(STORE.avatar, null);
    if (!stored || !Array.isArray(stored.entries)) return defaultAvatarIndex();
    return {
      active_id: String(stored.active_id || 'default'),
      entries: stored.entries.filter((e) => e && typeof e.id === 'string'),
      default_controls: { ...DEFAULT_CONTROLS, ...(stored.default_controls || {}) }
    };
  }

  function sanitizeControls(payload) {
    const rigMode = String(payload.rig_mode || 'sophon').toLowerCase();
    const colors = payload.orb_colors && typeof payload.orb_colors === 'object' ? payload.orb_colors : {};
    const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toLowerCase() : '');
    return {
      fit: payload.fit === 'contain' ? 'contain' : 'cover',
      rig_mode: ['sophon', 'aurora', 'ember', 'simple', 'face'].includes(rigMode) ? rigMode : 'sophon',
      scale: clampNumber(payload.scale, 0.7, 3, 1),
      offset_x: clampNumber(payload.offset_x, -40, 40, 0),
      offset_y: clampNumber(payload.offset_y, -40, 40, 0),
      memory_opacity: clampNumber(payload.memory_opacity, 0.15, 1, 0.94),
      orb_colors: {
        mode: colors.mode === 'custom' ? 'custom' : 'auto',
        a: hex(colors.a), b: hex(colors.b), c: hex(colors.c)
      },
      face_rig: DEFAULT_FACE_RIG
    };
  }

  async function avatarPublic(index) {
    const entry = index.entries.find((e) => e.id === index.active_id);
    const library = [
      { id: 'default', name: '預設角色', builtin: true, image_url: 'assets/avatar.jpeg', created_at: 0 },
      ...index.entries.map((e) => ({
        id: e.id, name: e.name, builtin: false, image_url: e.thumb || 'assets/avatar.jpeg', created_at: e.created_at || 0
      }))
    ];

    let base;
    if (!entry) {
      base = {
        is_custom: false,
        image_url: 'assets/avatar.jpeg',
        id: 'default',
        name: '預設角色',
        image_width: 1024,
        image_height: 1024,
        ...index.default_controls
      };
    } else {
      const dataUrl = await idbGet(entry.id).catch(() => null);
      base = {
        is_custom: true,
        id: entry.id,
        name: entry.name,
        image_url: dataUrl || 'assets/avatar.jpeg',
        image_width: entry.width || 0,
        image_height: entry.height || 0,
        ...entry.controls
      };
    }
    base.active_id = index.active_id;
    base.library = library;
    return base;
  }

  // --- 路由 ----------------------------------------------------------------
  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function publicSettings(config) {
    const key = String(config.openai.api_key || '').trim();
    return {
      ok: true,
      provider: 'openai',
      has_api_key: Boolean(key),
      api_key_hint: key ? `••••${key.slice(-4)}` : '',
      api_key_source: key ? 'browser' : 'none',
      model: config.openai.model,
      realtime_model: config.openai.realtime_model,
      realtime_voice: normalizeRealtimeVoice(config.openai.realtime_voice),
      realtime_voices: [...REALTIME_VOICES],
      tts_model: config.openai.tts_model,
      tts_voice: normalizeTTSVoice(config.openai.tts_voice),
      tts_voices: [...TTS_VOICES],
      voice_locale: 'zh-TW',
      voice_style: '台灣華語',
      onyx_compatibility: 'Realtime 不支援 Onyx；已對應為 Cedar。'
    };
  }

  function buildStatus(config) {
    const key = String(config.openai.api_key || '').trim();
    const configured = Boolean(key && config.openai.model);
    return {
      ok: true,
      version: 'static-1.0.0',
      provider: 'openai',
      provider_label: 'OpenAI API',
      model: config.openai.model,
      configured,
      message: configured ? '' : '請按右上角「設定」輸入你自己的 OpenAI API Key。',
      profile_storage: 'browser',
      bind: 'static',
      realtime_model: config.openai.realtime_model,
      realtime_voice: normalizeRealtimeVoice(config.openai.realtime_voice),
      realtime_configured: Boolean(key),
      tts_model: config.openai.tts_model,
      tts_voice: normalizeTTSVoice(config.openai.tts_voice),
      interpreter: interpreterPublic(config.interpreter)
    };
  }

  async function route(path, method, body) {
    const config = loadConfig();

    if (path === '/api/status' && method === 'GET') return json(buildStatus(config));
    if (path === '/health') return json({ ok: true, app: 'talktwin-interpreter-static', version: 'static-1.0.0' });
    if (path === '/api/settings' && method === 'GET') return json(publicSettings(config));
    if (path === '/api/profile' && method === 'GET') return json(loadProfile());
    if (path === '/api/interpreter' && method === 'GET') return json(interpreterPublic(config.interpreter));
    if (path === '/api/avatar' && method === 'GET') return json(await avatarPublic(loadAvatarIndex()));

    if (path === '/api/settings' && method === 'POST') {
      const next = { ...config.openai };
      if (body.clear_api_key === true) next.api_key = '';
      else if (typeof body.api_key === 'string' && body.api_key.trim()) {
        const key = body.api_key.trim();
        if (key.length < 20 || /\s/.test(key)) throw new ClientInputError('API Key 格式看起來不完整，請重新貼上。');
        next.api_key = key;
      }
      const nameField = (field, label) => {
        if (typeof body[field] !== 'string') return;
        const value = body[field].trim();
        if (!value || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new ClientInputError(`${label}名稱格式錯誤。`);
        next[field] = value;
      };
      nameField('model', '文字模型');
      nameField('realtime_model', 'Realtime 模型');
      nameField('tts_model', 'TTS 模型');
      if (body.realtime_voice !== undefined) {
        next.realtime_voice = normalizeRealtimeVoice(body.realtime_voice);
        // One shared voice for Realtime and regular TTS, as in the local build.
        next.tts_voice = normalizeTTSVoice(next.realtime_voice);
      }
      if (body.tts_voice !== undefined) next.tts_voice = normalizeTTSVoice(body.tts_voice);
      saveConfig({ ...config, openai: next });
      return json(publicSettings({ ...config, openai: next }));
    }

    if (path === '/api/profile' && method === 'POST') {
      const persona = String(body.persona || '').trim();
      if (!persona) throw new ClientInputError('提示詞不能是空白。');
      const knowledge = String(body.knowledge || '').trim();
      writeJSON(STORE.profile, { persona, knowledge });
      return json({ ok: true, persona, knowledge });
    }

    if (path === '/api/interpreter' && method === 'POST') {
      const settings = normalizeInterpreter(body);
      saveConfig({ ...config, interpreter: settings });
      const persona = buildInterpreterPersona(settings);
      const profile = loadProfile();
      writeJSON(STORE.profile, { persona, knowledge: profile.knowledge });
      return json({ ...interpreterPublic(settings), persona });
    }

    if (path === '/api/chat' && method === 'POST') {
      const apiKey = requireKey(config);
      const message = String(body.message || '').trim();
      if (!message) throw new ClientInputError('訊息不能是空白。');
      const profile = loadProfile();
      const persona = typeof body.persona === 'string' && body.persona.trim() ? body.persona : profile.persona;
      const knowledge = typeof body.knowledge === 'string' ? body.knowledge : profile.knowledge;
      const interpreter = normalizeInterpreter(config.interpreter);

      const messages = [{ role: 'developer', content: buildSystemPrompt(persona, knowledge, interpreter) }];
      if (Array.isArray(body.history)) {
        body.history.forEach((item) => {
          if (item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string') {
            messages.push({ role: item.role, content: item.content });
          }
        });
      }
      messages.push({ role: 'user', content: message });

      const data = await openaiJSON('/responses', {
        model: config.openai.model,
        input: messages,
        max_output_tokens: clampNumber(config.openai.max_output_tokens, 64, 4000, 600),
        store: false
      }, apiKey);
      const answer = extractOpenAIText(data);
      if (!answer) throw new ProviderConfigError('OpenAI 回應中沒有可朗讀的文字。');
      return json({
        answer,
        provider: 'openai',
        provider_label: 'OpenAI API',
        model: config.openai.model,
        retrieved: knowledge.trim() ? 1 : 0,
        retrieved_titles: [],
        interpreting: Boolean(interpreter.enabled)
      });
    }

    if (path === '/api/tts' && method === 'POST') {
      const apiKey = requireKey(config);
      const text = String(body.text || '').trim();
      if (!text) throw new ClientInputError('TTS 文字不能是空白。');
      const rate = Math.max(0.7, Math.min(1.3, Number(body.rate) || 1));
      const payload = buildTTSPayload(text, config, body.voice, rate);
      const response = await fetch(`${OPENAI_BASE}/audio/speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new ProviderConfigError(`OpenAI 語音產生失敗：${detail?.error?.message || `HTTP ${response.status}`}`);
      }
      return new Response(await response.blob(), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    }

    if (path === '/api/realtime/token' && method === 'POST') {
      const apiKey = requireKey(config);
      const session = buildRealtimeSessionConfig(config, loadProfile());
      const data = await openaiJSON('/realtime/client_secrets', { session }, apiKey);
      const value = typeof data.value === 'string' ? data.value : data.client_secret?.value;
      if (!value) throw new ProviderConfigError('OpenAI 沒有回傳可用的 Realtime client secret。');
      return json({ value, expires_at: data.expires_at, model: session.model, voice: session.audio.output.voice, session });
    }

    // --- 角色庫 ------------------------------------------------------------
    if (path === '/api/avatar' && method === 'POST') {
      const index = loadAvatarIndex();
      const controls = sanitizeControls(body);
      // app.js sends a freshly uploaded picture as `image_data_url`; a plain
      // `image_url` only ever describes an already-stored entry.
      const raw = typeof body.image_data_url === 'string' ? body.image_data_url : '';
      const imageData = raw.startsWith('data:') ? raw : '';

      if (imageData) {
        if (index.entries.length >= MAX_LIBRARY_ENTRIES) {
          throw new ClientInputError(`角色庫已滿（最多 ${MAX_LIBRARY_ENTRIES} 個），請先刪除一個角色。`);
        }
        const id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const size = await imageSize(imageData);
        await idbSet(id, imageData);
        index.entries.unshift({
          id,
          name: String(body.name || '').trim().slice(0, MAX_AVATAR_NAME_LEN) || `角色 ${index.entries.length + 1}`,
          created_at: Date.now(),
          width: size.width,
          height: size.height,
          thumb: imageData,
          controls
        });
        index.active_id = id;
      } else if (index.active_id === 'default') {
        index.default_controls = controls;
      } else {
        const entry = index.entries.find((e) => e.id === index.active_id);
        if (entry) entry.controls = controls;
      }
      persistAvatarIndex(index);
      return json(await avatarPublic(index));
    }

    if (path === '/api/avatar/select' && method === 'POST') {
      const index = loadAvatarIndex();
      const id = String(body.id || 'default');
      if (id !== 'default' && !index.entries.some((e) => e.id === id)) throw new ClientInputError('找不到這個角色。');
      index.active_id = id;
      persistAvatarIndex(index);
      return json(await avatarPublic(index));
    }

    if (path === '/api/avatar/rename' && method === 'POST') {
      const index = loadAvatarIndex();
      const entry = index.entries.find((e) => e.id === String(body.id || ''));
      if (!entry) throw new ClientInputError('找不到這個角色。');
      const name = String(body.name || '').trim().slice(0, MAX_AVATAR_NAME_LEN);
      if (!name) throw new ClientInputError('角色名稱不能是空白。');
      entry.name = name;
      persistAvatarIndex(index);
      return json(await avatarPublic(index));
    }

    if (path === '/api/avatar/delete' && method === 'POST') {
      const index = loadAvatarIndex();
      const id = String(body.id || '');
      const position = index.entries.findIndex((e) => e.id === id);
      if (position < 0) throw new ClientInputError('找不到這個角色。');
      index.entries.splice(position, 1);
      if (index.active_id === id) index.active_id = 'default';
      persistAvatarIndex(index);
      await idbDelete(id);
      return json(await avatarPublic(index));
    }

    if (path === '/api/avatar/rig' && method === 'POST') {
      // Face-rig generation needed server-side image processing. The current
      // orb styles never read it, so the static build reports it as absent.
      throw new ClientInputError('靜態版不提供五官切圖生成；能量體的三種風格不需要它。');
    }

    return json({ error: '找不到這個 API 路徑。' }, 404);
  }

  function persistAvatarIndex(index) {
    try {
      writeJSON(STORE.avatar, index);
    } catch (error) {
      // Thumbnails are the bulky part; drop them rather than lose the library.
      const slim = { ...index, entries: index.entries.map((e) => ({ ...e, thumb: '' })) };
      writeJSON(STORE.avatar, slim);
    }
  }

  function imageSize(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: 0, height: 0 });
      image.src = dataUrl;
    });
  }

  async function handle(url, options = {}) {
    const path = String(url).split('?')[0];
    const method = String(options.method || 'GET').toUpperCase();
    let body = {};
    if (options.body && typeof options.body === 'string') {
      try { body = JSON.parse(options.body) || {}; } catch (error) { body = {}; }
    }
    try {
      return await route(path, method, body);
    } catch (error) {
      const status = error instanceof ClientInputError ? 400 : 503;
      console.warn('static api error:', path, error);
      return json({ error: error.message || '靜態版發生未預期的錯誤。' }, status);
    }
  }

  return {
    handle,
    LANGUAGES,
    buildInterpreterPersona,
    buildInterpreterVoiceRules,
    normalizeInterpreter,
    interpreterPublic,
    buildRealtimeSessionConfig,
    buildSystemPrompt,
    loadConfig,
    loadProfile
  };
})();

window.TalkTwinStaticAPI = TalkTwinStaticAPI;
