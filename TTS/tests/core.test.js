const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../tts-core.js');
const audio = bytes => ({ data: Buffer.from(bytes).toString('base64'), mime_type: 'audio/wav' });
const samples = values => {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setInt16(i * 2, value, true));
  return bytes;
};

test('3.8 WAV is not wrapped a second time; raw PCM gets exactly one header', async () => {
  const pcm = samples([100, -100, 32000, 0]);
  const wav = new Uint8Array(await core.pcmToWav(pcm).arrayBuffer());
  const decoded = core.decodeAudio(audio(wav));
  assert.deepEqual(decoded.pcm, pcm);
  assert.equal(decoded.blob.size, wav.length);
  const raw = core.decodeAudio({ data: Buffer.from(pcm).toString('base64'), mime_type: 'audio/L16;codec=pcm;rate=24000' });
  assert.equal(raw.blob.size, pcm.length + 44);
});

test('WAV parser skips metadata chunks rather than assuming a 44-byte header', async () => {
  const pcm = samples([11, 22, 33]);
  const original = new Uint8Array(await core.pcmToWav(pcm).arrayBuffer());
  const extended = new Uint8Array(original.length + 12);
  extended.set(original.slice(0, 36));
  extended.set(Buffer.from('JUNK'), 36);
  new DataView(extended.buffer).setUint32(40, 4, true);
  extended.set(original.slice(36), 48);
  new DataView(extended.buffer).setUint32(4, extended.length - 8, true);
  assert.deepEqual(core.decodeAudio(audio(extended)).pcm, pcm);
  assert.throws(() => core.decodeAudio(audio(extended.slice(0, -1))), /不完整/);
});

test('unsupported or corrupt audio fails instead of producing misleading WAV', () => {
  assert.throws(() => core.decodeAudio({ data: 'AAAA', mime_type: 'audio/mp3' }), /不支援/);
  assert.throws(() => core.decodeAudio({ data: 'AA==', mime_type: 'audio/l16' }), /不完整/);
  assert.throws(() => core.decodeAudio({ data: 'AAAAAA==', mime_type: 'audio/l16;rate=16000' }), /不完整/);
});

test('long transcript chunking preserves all characters and vocal tags', () => {
  const text = ('  你好。\n今天好嗎？ 😀 <short pause> 我很好！\n').repeat(150);
  const chunks = core.splitTranscript(text, 100);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.equal((chunk.match(/</g) || []).length, (chunk.match(/>/g) || []).length);
});

test('milliseconds and frames have different meanings and invalid timecodes fail', () => {
  assert.equal(core.tcToMs('00:00:01.50'), 1500);
  assert.equal(core.tcToMs('00:00:01:12', 24), 1500);
  assert.equal(core.tcToMs('00:00:01:12', 25), 1480);
  assert.throws(() => core.tcToMs('00:60:01,000'));
  assert.throws(() => core.tcToMs('00:00:01:25', 25));
});

test('preserve mode keeps subtitle start times and silence through final end time', async () => {
  const result = core.assembleTimeline([{ startMs: 1, endMs: 2, pcmData: samples([123, 456]) }], { endMs: 3 });
  const decoded = core.decodeAudio(audio(new Uint8Array(await result.blob.arrayBuffer())));
  const view = new DataView(decoded.pcm.buffer);
  assert.equal(decoded.pcm.length, 72 * 2);
  assert.equal(view.getInt16(24 * 2, true), 123);
  assert.equal(view.getInt16(25 * 2, true), 456);
  assert.equal(view.getInt16(26 * 2, true), 0);
});

test('overlap is mixed and limited; sequential mode reports shifts', async () => {
  const segments = [{ startMs: 0, endMs: 0.04, pcmData: samples([30000, 100]) },
                    { startMs: 0, endMs: 0.04, pcmData: samples([30000, 100]) }];
  const mixed = core.assembleTimeline(segments);
  assert.equal(mixed.limited, true);
  assert.equal(mixed.shifted, 0);
  const decoded = core.decodeAudio(audio(new Uint8Array(await mixed.blob.arrayBuffer())));
  assert.equal(new DataView(decoded.pcm.buffer).getInt16(0, true), 32767);
  const sequential = core.assembleTimeline(segments, { mode: 'sequential' });
  assert.equal(sequential.shifted, 1);
  assert.equal(sequential.overruns, 2);
});

test('huge timecodes cannot allocate unbounded timeline memory', () => {
  assert.throws(() => core.assembleTimeline([{ startMs: 3600000, pcmData: samples([1]) }]), /30 分鐘/);
});
