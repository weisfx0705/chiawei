/* Deterministic PCM checks independent of browser playback permissions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window:{}, Float32Array, Map, Math };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../audio-engine.js'), 'utf8'), context);
const first = context.window.KtvSound.renderStems(12000);
const again = context.window.KtvSound.renderStems(12000);
const rms = a => Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
for (const [key,array] of Object.entries(first.stems)) {
  assert.equal(array.length, Math.ceil(first.duration*first.sampleRate));
  assert.ok(array.every(Number.isFinite), key+' contains non-finite samples');
  assert.ok(rms(array)>.03, key+' must be audible at its source');
  assert.ok(array.every(v=>Math.abs(v)<=.8), key+' needs composition headroom');
  for (let i=0;i<array.length;i+=173) assert.equal(array[i],again.stems[key][i]);
}
const difference = (a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
assert.ok(difference(first.stems.m1,first.stems.m2)>.05,'Two singers must have different voices');
assert.ok(difference(first.stems.l,first.stems.r)>.04,'Stereo backing must not collapse to dual mono');
assert.ok(first.duration>8&&first.duration<10,'The short original loop stays suitable for rapid comparisons');
console.log('PASS Finite, deterministic, audible PCM with headroom; distinct singers and stereo music.');
