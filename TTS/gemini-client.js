(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GeminiClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/';
  const MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'];
  const PREBUILT = new Set('Zephyr Puck Charon Kore Fenrir Leda Orus Aoede Callirrhoe Autonoe Enceladus Iapetus Umbriel Algieba Despina Erinome Algenib Rasalgethi Laomedeia Achernar Alnilam Schedar Gacrux Pulcherrima Achird Zubenelgenubi Vindemiatrix Sadachbia Sadaltager Sulafat'.split(' '));
  const ERROR_MESSAGES = {
    400: 'Google 未接受請求，請確認模型、語音 ID 與內容格式。',
    401: 'API key 無效，請確認輸入的 Google API key。',
    403: 'API key 或專案無法使用此功能，請確認金鑰限制、API 權限與計費設定。',
    404: '模型或語音不存在，請確認此 Google 專案可用的模型與語音。',
    429: 'Google 配額或速率已達上限，請稍後再試或檢查配額。',
    500: 'Google 服務發生錯誤，請稍後再試。',
    502: 'Google 回應格式異常，請稍後再試。',
    503: 'Google 服務暫時忙碌，請稍後再試。',
    504: '請求逾時，請縮短內容或稍後再試。'
  };

  function text(value, label, limit = 12000, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > limit || (!allowEmpty && !value.trim())) {
      throw new Error(`${label}不可空白或超過 ${limit.toLocaleString()} 字。`);
    }
    return value;
  }

  function buildTtsRequest(payload) {
    const { model, turns, speakers, format = 'wav' } = payload;
    if (!MODELS.includes(model)) throw new Error('請選擇支援的 TTS 模型。');
    if (!Array.isArray(turns) || !turns.length || turns.length > 200) throw new Error('請提供 1 至 200 段台詞。');
    if (!Array.isArray(speakers) || ![1, 2].includes(speakers.length)) throw new Error('目前支援 1 或 2 位講者。');
    if (!['wav', 'pcm'].includes(format)) throw new Error('音訊格式無效。');
    const names = new Set();
    const voices = speakers.map(speaker => {
      const name = text(speaker?.speaker, '講者名稱', 80);
      const voice = text(speaker?.voice, '語音 ID', 160);
      if (name !== name.trim() || names.has(name)) throw new Error('講者名稱必須不同，且前後不可有空白。');
      if (!/^[A-Za-z0-9_-]+$/.test(voice) || voice.startsWith('voicekey_')) throw new Error('請選擇預設語音或使用已儲存的 voice_ ID。');
      if (speakers.length === 2 && voice.startsWith('voice_')) throw new Error('雙人模式請使用預設語音；自訂 voice_ 語音請以單人逐句生成。');
      if (model.endsWith('preview') && !PREBUILT.has(voice)) throw new Error('3.1 Preview 只支援原有 30 種預設語音。');
      names.add(name);
      return { speaker: name, voice };
    });
    const content = turns.map(turn => {
      const transcript = text(turn?.text, '台詞');
      const style = text(turn?.style ?? '', '語氣', 1000, true).trim();
      const speaker = turn?.speaker ?? (voices.length === 1 ? voices[0].speaker : null);
      if (!names.has(speaker)) throw new Error('每段台詞都必須對應已設定的講者。');
      return { text: transcript, style, speaker };
    });
    if (content.reduce((total, turn) => total + turn.text.length + turn.style.length, 0) > 12000) {
      throw new Error('單次請求超過 12,000 字（含語氣），請分段生成。');
    }
    if (model.startsWith('gemini-3.8-')) {
      const parts = content.map(turn => {
        const metadata = { type: 'speech_metadata' };
        if (voices.length === 2) metadata.speaker = turn.speaker;
        if (turn.style) metadata.style = turn.style;
        const part = { type: 'text', text: turn.text };
        if (Object.keys(metadata).length > 1) part.annotations = [metadata];
        return part;
      });
      return { url: BASE_URL + 'interactions', method: 'POST', body: {
        model,
        input: [{ type: 'user_input', content: parts }],
        response_format: { type: 'audio', mime_type: format === 'pcm' ? 'audio/l16' : 'audio/wav', sample_rate: 24000 },
        generation_config: { speech_config: voices.length === 1 ? [{ voice: voices[0].voice }] : { mode: 'conversational', speakers: voices } },
        store: false
      } };
    }
    // Explicit compatibility option for scripts made for the old preview model.
    const transcript = content.map(turn => (voices.length === 2 ? `${turn.speaker}: ` : '') +
      (turn.style ? `[${turn.style}] ` : '') + turn.text).join('\n');
    const voiceConfig = voice => ({ prebuiltVoiceConfig: { voiceName: voice } });
    const speechConfig = voices.length === 1 ? { voiceConfig: voiceConfig(voices[0].voice) } : {
      multiSpeakerVoiceConfig: { speakerVoiceConfigs: voices.map(voice => ({ speaker: voice.speaker, voiceConfig: voiceConfig(voice.voice) })) }
    };
    return { url: BASE_URL + `models/${model}:generateContent`, method: 'POST', body: {
      contents: [{ parts: [{ text: transcript }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig }
    } };
  }

  function buildRequest(operation, payload) {
    if (operation === 'tts') return buildTtsRequest(payload);
    if (operation === 'voices') {
      const query = new URLSearchParams({ page_size: '100' });
      for (const field of ['language_code', 'search', 'page_token']) {
        if (payload[field]) query.set(field, text(payload[field], '語音搜尋', 500));
      }
      return { url: BASE_URL + 'voices?' + query.toString(), method: 'GET' };
    }
    if (operation === 'chat') {
      if (!Array.isArray(payload.contents) || !payload.contents.length || payload.contents.length > 40) {
        throw new Error('對話紀錄過長，請清除後重試。');
      }
      const contents = payload.contents.map(item => {
        if (!['user', 'model'].includes(item?.role) || !Array.isArray(item.parts) || item.parts.length !== 1) throw new Error('對話格式無效。');
        return { role: item.role, parts: [{ text: text(item.parts[0]?.text, '對話', 20000) }] };
      });
      const temperature = payload.temperature ?? 0.7;
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) throw new Error('創意程度無效。');
      return { url: BASE_URL + 'models/gemini-3.8-flash:generateContent', method: 'POST', body: {
        systemInstruction: { parts: [{ text: text(payload.instruction, '助手指令') }] }, contents,
        generationConfig: { temperature, maxOutputTokens: 8192 }
      } };
    }
    throw new Error('不支援的操作。');
  }

  function normalizeResponse(operation, data) {
    if (!data || typeof data !== 'object') throw new Error('Google 回應格式無效。');
    if (operation === 'tts') {
      let audio = data.output_audio;
      if (!audio) audio = (data.outputs || []).filter(item => item.type === 'audio' && item.data).at(-1);
      if (!audio) {
        const blocks = [...(data.steps || []), ...(data.outputs || [])].flatMap(step => step.content || []);
        audio = blocks.filter(item => item.type === 'audio' && item.data).at(-1);
      }
      if (!audio) {
        const parts = data.candidates?.[0]?.content?.parts || [];
        audio = parts.map(part => part.inlineData || part.inline_data).find(part => part?.data);
      }
      if (!audio?.data) throw new Error('Google 未回傳音訊，請縮短內容後重試。');
      return { audio: { data: audio.data, mime_type: audio.mime_type || audio.mimeType || 'audio/wav' } };
    }
    if (operation === 'chat') {
      const value = (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(part => part.text || '').join('');
      if (!value) throw new Error('Google 未回傳文字，請稍後再試。');
      return { text: value };
    }
    if (operation === 'voices') {
      const fields = ['id', 'display_name', 'language_code', 'gender', 'description', 'type', 'accent', 'pitch'];
      const voices = (data.voices || []).filter(voice => voice.id && !voice.id.startsWith('voicekey_'))
        .map(voice => Object.fromEntries(fields.filter(field => field in voice).map(field => [field, voice[field]])));
      return { voices, next_page_token: data.next_page_token || '' };
    }
    throw new Error('不支援的回應。');
  }

  function httpError(status, retryAfter) {
    // Never expose provider error bodies, request headers or credential values.
    const error = new Error(ERROR_MESSAGES[status] || `Google API 請求失敗（HTTP ${status}）。`);
    error.httpStatus = status;
    error.retryAfter = /^\d+$/.test(retryAfter || '') ? Math.min(Number(retryAfter), 120) : 0;
    return error;
  }

  return { MODELS, buildRequest, normalizeResponse, httpError };
});
