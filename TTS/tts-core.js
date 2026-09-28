(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TtsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SAMPLE_RATE = 24000;
  const MAX_TIMELINE_MS = 30 * 60 * 1000;

  function base64ToBytes(data) {
    const binary = atob(data);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  }

  function readString(view, offset, size) {
    return String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, size));
  }

  // Parse RIFF chunks; WAV files can contain metadata before or after audio.
  function decodeAudio(audio) {
    if (!audio || typeof audio.data !== 'string') throw new Error('回應中沒有音訊資料');
    const bytes = base64ToBytes(audio.data);
    const mime = (audio.mime_type || audio.mimeType || '').toLowerCase();
    if (bytes.length >= 12 && readString(new DataView(bytes.buffer), 0, 4) === 'RIFF') {
      const view = new DataView(bytes.buffer);
      if (readString(view, 8, 4) !== 'WAVE') throw new Error('無效的 WAV 檔案');
      let format = null;
      let pcm = null;
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const name = readString(view, offset, 4);
        const size = view.getUint32(offset + 4, true);
        const start = offset + 8;
        if (start + size > bytes.length) throw new Error('WAV 音訊資料不完整');
        if (name === 'fmt ' && size >= 16) {
          format = { encoding: view.getUint16(start, true), channels: view.getUint16(start + 2, true),
            sampleRate: view.getUint32(start + 4, true), bitDepth: view.getUint16(start + 14, true) };
        } else if (name === 'data') pcm = bytes.slice(start, start + size);
        offset = start + size + (size % 2);
      }
      if (!format || !pcm || !pcm.length) throw new Error('WAV 缺少音訊資料');
      if (format.encoding !== 1 || format.channels !== 1 || format.bitDepth !== 16 || format.sampleRate !== SAMPLE_RATE) {
        throw new Error('需要 24 kHz、單聲道、16-bit PCM WAV');
      }
      if (pcm.length % 2) throw new Error('PCM 音訊長度無效');
      return { ...format, pcm, blob: new Blob([bytes], { type: 'audio/wav' }) };
    }
    if (!/^audio\/(l16|pcm)(;|$)/.test(mime)) throw new Error('不支援的音訊格式');
    const rate = Number(mime.match(/rate=(\d+)/)?.[1] || audio.sample_rate || SAMPLE_RATE);
    if (rate !== SAMPLE_RATE || !bytes.length || bytes.length % 2) throw new Error('PCM 格式不符或資料不完整');
    return { pcm: bytes, sampleRate: rate, channels: 1, bitDepth: 16, blob: pcmToWav(bytes) };
  }

  function pcmToWav(pcm, sampleRate = SAMPLE_RATE, channels = 1, bitDepth = 16) {
    if (pcm.length % (channels * bitDepth / 8)) throw new Error('PCM 音訊長度無效');
    const buffer = new ArrayBuffer(44 + pcm.length);
    const view = new DataView(buffer);
    const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, 36 + pcm.length, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bitDepth / 8, true);
    view.setUint16(32, channels * bitDepth / 8, true); view.setUint16(34, bitDepth, true);
    write(36, 'data'); view.setUint32(40, pcm.length, true);
    new Uint8Array(buffer).set(pcm, 44);
    return new Blob([buffer], { type: 'audio/wav' });
  }

  function concatPcm(parts) {
    const output = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  // Preserve every character, including punctuation, whitespace and vocal tags.
  function splitTranscript(text, maxChars = 1800) {
    const chars = Array.from(text);
    const chunks = [];
    let start = 0;
    while (start < chars.length) {
      let end = Math.min(start + maxChars, chars.length);
      if (end < chars.length) {
        let boundary = end;
        for (let i = end - 1; i >= start + Math.floor(maxChars / 2); i--) {
          if (/[。！？!?\n]/.test(chars[i]) || (chars[i] === '.' && /\s/.test(chars[i + 1]))) {
            boundary = i + 1; break;
          }
        }
        end = boundary;
        // Do not split inside an inline <vocal tag>.
        const fragment = chars.slice(start, end).join('');
        const open = fragment.lastIndexOf('<');
        if (open > fragment.lastIndexOf('>')) {
          const prefixLength = Array.from(fragment.slice(0, open)).length;
          if (prefixLength) end = start + prefixLength;
          else {
            const close = chars.indexOf('>', end);
            if (close !== -1) end = close + 1;
          }
        }
      }
      chunks.push(chars.slice(start, end).join(''));
      start = end;
    }
    return chunks;
  }

  function tcToMs(tc, fps = 25) {
    const match = tc.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})([,.:])(\d{2,3})$/);
    if (!match) throw new Error('無效的時間碼');
    const [, h, m, s, separator, fraction] = match;
    if (+m >= 60 || +s >= 60) throw new Error('時間碼的分、秒必須小於 60');
    if (separator === ':' && (+fraction >= fps || fraction.length !== 2)) throw new Error('影格時間碼超出所選 FPS');
    const ms = separator === ':' ? Math.round(+fraction * 1000 / fps) : +(fraction.padEnd(3, '0'));
    return (+h * 3600 + +m * 60 + +s) * 1000 + ms;
  }

  function assembleTimeline(segments, { mode = 'preserve', endMs = 0 } = {}) {
    const placed = [];
    let endFrame = 0;
    let shifted = 0;
    let overruns = 0;
    for (const seg of [...segments].sort((a, b) => a.startMs - b.startMs)) {
      const intended = Math.round(seg.startMs * SAMPLE_RATE / 1000);
      const frame = mode === 'sequential' ? Math.max(intended, endFrame) : intended;
      const frames = seg.pcmData.length / 2;
      if (!Number.isInteger(frames) || intended < 0) throw new Error('字幕音訊或時間碼無效');
      if (frame !== intended) shifted++;
      if (seg.endMs != null && frame + frames > Math.round(seg.endMs * SAMPLE_RATE / 1000)) overruns++;
      endFrame = Math.max(endFrame, frame + frames);
      placed.push({ frame, pcm: seg.pcmData });
    }
    endFrame = Math.max(endFrame, Math.round(endMs * SAMPLE_RATE / 1000));
    if (endFrame > MAX_TIMELINE_MS * SAMPLE_RATE / 1000) throw new Error('合併音訊上限為 30 分鐘，請拆成多個 SRT 檔案');
    const mixed = new Int32Array(endFrame);
    for (const { frame, pcm } of placed) {
      const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      for (let i = 0; i < pcm.length / 2; i++) mixed[frame + i] += view.getInt16(i * 2, true);
    }
    let peak = 0;
    for (const value of mixed) peak = Math.max(peak, Math.abs(value));
    const gain = peak > 32767 ? 32767 / peak : 1;
    const output = new Uint8Array(endFrame * 2);
    const view = new DataView(output.buffer);
    for (let i = 0; i < endFrame; i++) view.setInt16(i * 2, Math.round(mixed[i] * gain), true);
    return { blob: pcmToWav(output), shifted, overruns, limited: gain < 1 };
  }

  return { SAMPLE_RATE, MAX_TIMELINE_MS, base64ToBytes, decodeAudio, pcmToWav, concatPcm, splitTranscript, tcToMs, assembleTimeline };
});
