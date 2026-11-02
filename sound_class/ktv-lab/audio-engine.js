/* Original, deterministic PCM instruments. No recordings, network or microphone access. */
(() => {
  'use strict';
  const KEYS = ['m1', 'm2', 'l', 'r'];
  const BPM = 108;
  const BEAT = 60 / BPM;
  const DURATION = BEAT * 16;
  const TAU = Math.PI * 2;
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const vowels = [[730, 1150, 2600], [450, 850, 2400], [300, 2200, 3000], [350, 700, 2400]];
  const melody = [60, 64, 67, 64, 60, 62, 64, null, 64, 67, 69, 67, 65, 64, 60, null];
  const chords = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]];
  const tableCache = new Map();

  function vowelTable(fundamental, vowel) {
    const key = fundamental + ':' + vowel;
    if (tableCache.has(key)) return tableCache.get(key);
    const bands = vowels[vowel], table = new Float32Array(2048);
    const harmonics = Math.min(36, Math.floor(7000 / fundamental));
    for (let h = 1; h <= harmonics; h++) {
      const f = h * fundamental;
      let weight = .06 / h;
      bands.forEach((center, i) => {
        const width = [110, 160, 230][i];
        weight += Math.exp(-.5 * ((f - center) / width) ** 2) * [1, .65, .35][i] / Math.sqrt(h);
      });
      for (let i = 0; i < table.length; i++) table[i] += Math.sin(TAU * h * i / table.length) * weight;
    }
    let peak = 0;
    for (const sample of table) peak = Math.max(peak, Math.abs(sample));
    for (let i = 0; i < table.length; i++) table[i] /= Math.max(.001, peak);
    tableCache.set(key, table);
    return table;
  }

  function renderStems(sampleRate = 48000) {
    const count = Math.ceil(DURATION * sampleRate);
    const stems = Object.fromEntries(KEYS.map(key => [key, new Float32Array(count)]));
    let seed = 0x14cafe, lastNoise = 0;
    const noise = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2147483648 - 1;
    };
    const phases = [0, 0];
    const voiceNotes = [0, 1].map(voice => melody.map((note, i) => {
      if (note === null) return null;
      const fundamental = hz(note + (voice ? -5 : 0));
      return { fundamental, a:vowelTable(fundamental, i % 4), b:vowelTable(fundamental, (i + 1) % 4) };
    }));
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate, beatIndex = Math.min(15, Math.floor(t / BEAT));
      const within = t % BEAT, eighth = t % (BEAT / 2), bar = Math.floor(beatIndex / 4);
      const random = noise();
      for (let voice = 0; voice < 2; voice++) {
        const note = voiceNotes[voice][beatIndex];
        if (!note) continue;
        const syllable = Math.max(0, Math.min(1, within / .035, (BEAT * .89 - within) / .075));
        const vibrato = 1 + .004 * Math.sin(TAU * (5.2 + voice * .3) * t);
        phases[voice] = (phases[voice] + note.fundamental * vibrato / sampleRate) % 1;
        const index = Math.floor(phases[voice] * 2048), mouth = Math.min(1, within / (BEAT * .65));
        const voiced = note.a[index] * (1 - mouth) + note.b[index] * mouth;
        const breath = random * .045 * Math.exp(-within * 45);
        stems[voice ? 'm2' : 'm1'][i] = (voiced + breath) * syllable * .65;
      }
      const chord = chords[bar], arp = Math.floor(t / (BEAT / 2));
      const ep = (note, decay) => {
        const phase = TAU * hz(note) * eighth;
        return (Math.sin(phase + 1.4 * Math.exp(-eighth * 9) * Math.sin(2 * phase)) + .15 * Math.sin(3 * phase)) * Math.exp(-eighth * decay) * Math.min(1, eighth / .006);
      };
      const leftKeys = ep(chord[arp % 4] + 12, 6);
      const rightKeys = ep(chord[(arp + 2) % 4] + 24, 8);
      const bassTime = t % (BEAT * 2), bassFreq = hz(chord[0] - 12);
      const bass = (Math.sin(TAU * bassFreq * bassTime) + .18 * Math.sin(TAU * bassFreq * 2 * bassTime)) * Math.exp(-bassTime * 3) * Math.min(1, bassTime / .008);
      const kickTime = t % (BEAT * 2);
      const kick = Math.sin(TAU * (48 * kickTime + 2.8 * (1 - Math.exp(-kickTime * 35)))) * Math.exp(-kickTime * 17);
      const snareTime = (t + BEAT) % (BEAT * 2);
      const snare = (random * .8 + Math.sin(TAU * 185 * snareTime) * .2) * Math.exp(-snareTime * 22);
      const hat = (random - lastNoise) * Math.exp(-eighth * 65) * .065;
      const common = bass * .24 + kick * .18 + snare * .12;
      stems.l[i] = leftKeys * .27 + rightKeys * .035 + common + hat;
      stems.r[i] = rightKeys * .25 + leftKeys * .035 + common - hat * .6;
      lastNoise = random;
    }
    // Only the composition has a fixed peak. Routing gains are never normalized.
    for (const key of ['m1', 'm2']) normalize([stems[key]], .67);
    normalize([stems.l, stems.r], .56);
    return { stems, sampleRate, duration:DURATION, bpm:BPM };
  }

  function normalize(arrays, target) {
    let peak = .001;
    arrays.forEach(array => { for (const sample of array) peak = Math.max(peak, Math.abs(sample)); });
    arrays.forEach(array => { for (let i = 0; i < array.length; i++) array[i] *= target / peak; });
  }

  class SoundEngine {
    constructor() {
      this.context = null;
      this.playing = false;
      this.route = [{}, {}];
      this.volume = .55;
      this.sources = [];
      this.offset = 0;
      this.pending = null;
    }

    async prepare() {
      if (this.gains) return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio unavailable');
      if (!this.context) this.context = new Context();
      // Resume inside the user gesture before doing any synthesis work (Safari).
      await this.context.resume();
      this.song = renderStems(this.context.sampleRate);
      const ctx = this.context;
      this.buffers = KEYS.map(key => {
        const buffer = ctx.createBuffer(1, this.song.stems[key].length, ctx.sampleRate);
        buffer.copyToChannel(this.song.stems[key], 0);
        return buffer;
      });
      this.merger = ctx.createChannelMerger(2);
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      const protector = ctx.createDynamicsCompressor();
      protector.threshold.value = -6;
      protector.knee.value = 3;
      protector.ratio.value = 20;
      protector.attack.value = .003;
      protector.release.value = .15;
      this.merger.connect(this.master).connect(protector);
      // A fixed ceiling protects preview playback; it never boosts quiet routes.
      const ceiling = ctx.createWaveShaper(), curve = new Float32Array(4096);
      for (let i = 0; i < curve.length; i++) {
        const x = i * 2 / (curve.length - 1) - 1;
        curve[i] = Math.max(-.8, Math.min(.8, x));
      }
      ceiling.curve = curve;
      protector.connect(ceiling).connect(ctx.destination);
      const splitter = ctx.createChannelSplitter(2);
      ceiling.connect(splitter);
      this.analysers = [0, 1].map(side => {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        splitter.connect(analyser, side);
        return analyser;
      });
      this.waves = this.analysers.map(a => new Float32Array(a.fftSize));
      const impulse = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .48), ctx.sampleRate);
      const ir = impulse.getChannelData(0);
      let seed = 57;
      for (let i = 0; i < ir.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        ir[i] = (seed / 2147483648 - 1) * Math.exp(-i / ctx.sampleRate * 10) * .16;
      }
      this.gains = [0, 1].map(side => {
        const dry = ctx.createGain(), wet = ctx.createGain(), reverb = ctx.createConvolver();
        reverb.buffer = impulse;
        wet.gain.value = .24;
        dry.connect(this.merger, 0, side);
        wet.connect(reverb).connect(this.merger, 0, side);
        return KEYS.map(() => {
          const d = ctx.createGain(), w = ctx.createGain();
          d.gain.value = 0; w.gain.value = 0;
          d.connect(dry); w.connect(wet);
          return { dry:d, wet:w };
        });
      });
      this.setRoute(this.route);
    }

    async play() {
      if (this.pending) return this.pending;
      this.pending = (async () => {
        await this.prepare();
        await this.context.resume();
        if (this.context.state !== 'running') throw new Error('Audio playback blocked');
        if (this.playing) return;
        this.master.gain.setTargetAtTime(.18 * this.volume, this.context.currentTime, .012);
        const when = this.context.currentTime + .025;
        this.sources = this.buffers.map((buffer, index) => {
          const source = this.context.createBufferSource();
          source.buffer = buffer; source.loop = true;
          this.gains.forEach(side => {
            source.connect(side[index].dry);
            source.connect(side[index].wet);
          });
          source.start(when, this.offset % this.song.duration);
          return source;
        });
        this.startedAt = when;
        this.playing = true;
      })();
      try { await this.pending; } finally { this.pending = null; }
    }

    pause() {
      if (!this.playing) return;
      this.offset = this.position;
      this.sources.forEach(source => { source.stop(); source.disconnect(); });
      this.sources = [];
      this.playing = false;
      this.master.gain.setTargetAtTime(0, this.context.currentTime, .012);
    }

    setRoute(channels) {
      this.route = channels;
      if (!this.gains) return;
      const now = this.context.currentTime;
      this.gains.forEach((side, i) => side.forEach((gain, j) => {
        const v = channels[i] || channels[0] || {}, key = KEYS[j];
        for (const [param, value] of [[gain.dry.gain, v[key] || 0], [gain.wet.gain, v['w' + key] || 0]]) {
          param.cancelScheduledValues(now);
          param.setTargetAtTime(value, now, .018);
        }
      }));
    }

    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, value));
      if (this.master) this.master.gain.setTargetAtTime(this.playing ? .18 * this.volume : 0, this.context.currentTime, .018);
    }

    get position() {
      if (!this.song) return 0;
      return (this.offset + (this.playing ? Math.max(0, this.context.currentTime - this.startedAt) : 0)) % this.song.duration;
    }

    analyse() {
      const levels = { vocal:0, music:0 };
      if (this.playing) {
        this.analysers.forEach((a, i) => a.getFloatTimeDomainData(this.waves[i]));
        const start = Math.floor(this.position * this.song.sampleRate);
        KEYS.forEach(key => {
          const samples = this.song.stems[key];
          let sum = 0;
          for (let i = 0; i < 256; i++) sum += samples[(start + i) % samples.length] ** 2;
          const gain = Math.max(...this.route.map(v => Math.abs(v[key] || 0) + .24 * Math.abs(v['w' + key] || 0)));
          levels[key.startsWith('m') ? 'vocal' : 'music'] += Math.sqrt(sum / 256) * gain * this.volume;
        });
      } else if (this.waves) this.waves.forEach(wave => wave.fill(0));
      return { waves:this.waves || [], levels, position:this.position, duration:DURATION, bpm:BPM };
    }
  }

  window.KtvSound = Object.freeze({ create:() => new SoundEngine(), renderStems });
})();
