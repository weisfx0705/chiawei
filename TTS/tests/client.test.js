const test = require('node:test');
const assert = require('node:assert/strict');
const client = require('../gemini-client.js');

function single(model = 'gemini-3.8-flash-tts') {
  return { model, turns: [{ text: '  你好。<short pause>\n今天好嗎？  ', style: 'warm and friendly' }],
    speakers: [{ speaker: '主持人', voice: 'Kore' }] };
}

test('both 3.8 models use Google Interactions with verbatim text and separate style', () => {
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']) {
    const payload = single(model);
    const request = client.buildRequest('tts', payload);
    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(request.method, 'POST');
    assert.equal(request.body.model, model);
    const turn = request.body.input[0].content[0];
    assert.equal(turn.text, payload.turns[0].text);
    assert.deepEqual(turn.annotations, [{ type: 'speech_metadata', style: 'warm and friendly' }]);
    assert.deepEqual(request.body.generation_config.speech_config, [{ voice: 'Kore' }]);
    assert.equal(request.body.response_format.mime_type, 'audio/wav');
    assert.equal(request.body.store, false);
  }
});

test('natural default has no forced style; PCM output is explicitly requested', () => {
  const payload = single(); payload.turns[0].style = ''; payload.format = 'pcm';
  const request = client.buildRequest('tts', payload);
  assert.equal(request.body.input[0].content[0].annotations, undefined);
  assert.equal(request.body.response_format.mime_type, 'audio/l16');
});

test('every dialogue turn names its configured speaker and its own style', () => {
  const payload = single();
  payload.speakers.push({ speaker: '來賓', voice: 'Puck' });
  payload.turns = [{ speaker: '主持人', text: '你來了。', style: 'excited' },
    { speaker: '來賓', text: '<sigh> 對啊。', style: 'tired' }];
  const request = client.buildRequest('tts', payload);
  assert.equal(request.body.generation_config.speech_config.mode, 'conversational');
  assert.deepEqual(request.body.generation_config.speech_config.speakers, payload.speakers);
  request.body.input[0].content.forEach((turn, index) => {
    assert.equal(turn.text, payload.turns[index].text);
    assert.equal(turn.annotations[0].speaker, payload.turns[index].speaker);
    assert.equal(turn.annotations[0].style, payload.turns[index].style);
  });
});

test('invalid or unsupported requests fail before any network request', () => {
  const cases = [];
  let payload = single(); payload.model = 'invalid'; cases.push(payload);
  payload = single(); payload.turns[0].text = ' '; cases.push(payload);
  payload = single(); payload.speakers.push({ ...payload.speakers[0] }); cases.push(payload);
  payload = single(); payload.turns[0].speaker = 'missing'; cases.push(payload);
  payload = single(); payload.turns[0].text = '字'.repeat(12001); cases.push(payload);
  for (const value of cases) assert.throws(() => client.buildRequest('tts', value));
});

test('custom voice works for single 3.8 and is rejected for unsupported modes', () => {
  const payload = single(); payload.speakers[0].voice = 'voice_example';
  assert.equal(client.buildRequest('tts', payload).method, 'POST');
  payload.speakers.push({ speaker: '來賓', voice: 'Puck' });
  assert.throws(() => client.buildRequest('tts', payload));
  payload.speakers.pop(); payload.model = 'gemini-3.1-flash-tts-preview';
  assert.throws(() => client.buildRequest('tts', payload));
});

test('the 3.1 compatibility option keeps the original GenerateContent format', () => {
  const request = client.buildRequest('tts', single('gemini-3.1-flash-tts-preview'));
  assert.ok(request.url.endsWith('models/gemini-3.1-flash-tts-preview:generateContent'));
  assert.deepEqual(request.body.generationConfig.responseModalities, ['AUDIO']);
});

test('REST audio is read from the last model output and legacy parts are supported', () => {
  const audio = { data: 'AAAA', mime_type: 'audio/l16' };
  assert.deepEqual(client.normalizeResponse('tts', { output_audio: audio }).audio, audio);
  const rest = { steps: [{ content: [{ type: 'text', text: 'ignored' },
    { type: 'audio', data: 'BBBB', mime_type: 'audio/l16' }, { type: 'audio', ...audio }] }] };
  assert.deepEqual(client.normalizeResponse('tts', rest).audio, audio);
  const legacy = { candidates: [{ content: { parts: [{ text: 'ignored' }, { inlineData: { data: 'AAAA', mimeType: 'audio/L16;rate=24000' } }] } }] };
  assert.equal(client.normalizeResponse('tts', legacy).audio.data, 'AAAA');
});

test('voice library uses Google directly and strips unrelated response fields', () => {
  const request = client.buildRequest('voices', { language_code: 'zh-TW', page_token: 'next-page' });
  const url = new URL(request.url);
  assert.equal(url.hostname, 'generativelanguage.googleapis.com');
  assert.equal(request.method, 'GET');
  assert.equal(url.searchParams.get('language_code'), 'zh-TW');
  assert.equal(url.searchParams.get('page_token'), 'next-page');
  const voice = client.normalizeResponse('voices', { voices: [{ id: 'Kore', type: 'prebuilt', key: 'synthetic-test-only', sample_audio: { data: 'AAAA' } }] }).voices[0];
  assert.deepEqual(voice, { id: 'Kore', type: 'prebuilt' });
});

test('script assistant uses the text model and excludes thought content', () => {
  const request = client.buildRequest('chat', { instruction: '整理台詞', contents: [{ role: 'user', parts: [{ text: '你好。' }] }], temperature: 0.2 });
  assert.ok(request.url.endsWith('models/gemini-3.8-flash:generateContent'));
  assert.equal(request.body.generationConfig.temperature, 0.2);
  const response = client.normalizeResponse('chat', { candidates: [{ content: { parts: [{ thought: true, text: 'ignored' }, { text: '你好。' }, { text: '再見。' }] } }] });
  assert.equal(response.text, '你好。再見。');
});

test('errors use fixed messages and bounded retry instructions', () => {
  const error = client.httpError(403, '10');
  assert.equal(error.httpStatus, 403);
  assert.equal(error.retryAfter, 10);
  assert.equal(client.httpError(429, '9999').retryAfter, 120);
  assert.equal(client.httpError(500, 'not-a-number').retryAfter, 0);
});
