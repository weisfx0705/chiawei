"use strict";

const playButton = document.querySelector("#play");
const playLabel = document.querySelector("#play-label");
const playSymbol = document.querySelector("#play-symbol");
const status = document.querySelector("#audio-status");
const modes = [...document.querySelectorAll("[data-mode]")];
const lp = document.querySelector("#lp");
const hp = document.querySelector("#hp");
const fallback = document.querySelector("#fallback");
const masterGain = 0.72;
const duration = 15;
const notes = [
  "聽現場麥克風。吉他、鈸和鼓都從喇叭漏進來，留意「鼓聲好清楚喔」的字尾。",
  "現場喇叭經過低通，對白原樣錄進麥克風。移動 High Cut，聽吉他從哪裡開始蓋住聲音。",
  "後期只聽處理過的對白軌。提高 Low Cut，再降回來，比較漏進來的鼓和說話者的厚度。",
  "保留清理過的對白，對拍加入一條完整原曲，再鋪上海浪。聽原曲的鈸聲和語尾能否同時辨識。"
];
let selected = 0;
let context;
let graph;
let buffers;
let loadingBuffers;
let sources = [];
let offset = 0;
let startTime = 0;
let frame = 0;
let starting = false;
let revision = 0;

function gain(value) {
  const node = context.createGain();
  node.gain.value = value;
  return node;
}

// Two biquads make a fourth-order Butterworth crossover, 24 dB/octave.
// Web Audio interprets Q in decibels on lowpass and highpass biquads.
function makeFilter(type, frequency) {
  const sections = [0.5411961001, 1.306562965].map(quality => {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = 20 * Math.log10(quality);
    return node;
  });
  sections[0].connect(sections[1]);
  return sections;
}

function makeGraph() {
  const music = gain(1), voice = gain(0.91), sea = gain(1);
  const speaker = gain(1), microphone = gain(1), output = gain(masterGain);
  const rawSpeaker = gain(0), lowSpeaker = gain(0);
  const rawMic = gain(0), cleanMic = gain(0), score = gain(0), waves = gain(0);
  const low = makeFilter("lowpass", Number(lp.value));
  const high = makeFilter("highpass", Number(hp.value));

  music.connect(rawSpeaker).connect(speaker);
  music.connect(low[0]);
  low[1].connect(lowSpeaker).connect(speaker);
  // A direct arrival and two short reflections model music leaking into a mic.
  for (const [seconds, amplitude] of [[0.011, 0.53], [0.039, 0.21], [0.071, 0.10]]) {
    const delay = context.createDelay(0.1);
    delay.delayTime.value = seconds;
    speaker.connect(delay).connect(gain(amplitude)).connect(microphone);
  }
  voice.connect(microphone);
  microphone.connect(rawMic).connect(output);
  microphone.connect(high[0]);
  high[1].connect(cleanMic).connect(output);
  music.connect(score).connect(output);
  sea.connect(waves).connect(output);
  output.connect(context.destination);
  return { inputs: [music, voice, sea], rawSpeaker, lowSpeaker, rawMic, cleanMic, score, waves, low, high };
}

function setValue(param, value) {
  param.setTargetAtTime(value, context.currentTime, 0.013);
}

function updateMix() {
  if (!graph) return;
  setValue(graph.rawSpeaker.gain, selected === 0 ? 1 : 0);
  setValue(graph.lowSpeaker.gain, selected === 0 ? 0 : 1);
  setValue(graph.rawMic.gain, selected < 2 ? 1 : 0);
  setValue(graph.cleanMic.gain, selected >= 2 ? 1 : 0);
  setValue(graph.score.gain, selected === 3 ? 0.37 : 0);
  setValue(graph.waves.gain, selected === 3 ? 0.21 : 0);
  for (const section of graph.low) setValue(section.frequency, Number(lp.value));
  for (const section of graph.high) setValue(section.frequency, Number(hp.value));
}

function selectMode(index) {
  selected = index;
  modes.forEach((b, i) => b.setAttribute("aria-pressed", String(i === selected)));
  lp.disabled = selected === 0;
  hp.disabled = selected < 2;
  document.querySelector("#mode-note").textContent = notes[selected];
  updateMix();
}
modes.forEach((b, i) => b.addEventListener("click", () => selectMode(i)));
for (const slider of [lp, hp]) {
  slider.addEventListener("input", () => {
    document.querySelector("#" + slider.id + "-out").value = slider.value + " Hz";
    slider.setAttribute("aria-valuetext", slider.value + " 赫茲");
    updateMix();
  });
  slider.setAttribute("aria-valuetext", slider.value + " 赫茲");
}

async function prepareBuffers() {
  if (buffers) return buffers;
  if (!loadingBuffers) {
    loadingBuffers = Promise.all(["band", "dialogue", "surf"].map(async name => {
      const response = await fetch("./field-audio/" + name + ".wav");
      if (!response.ok) throw new Error("Audio asset unavailable");
      return context.decodeAudioData(await response.arrayBuffer());
    })).then(decoded => {
      buffers = decoded;
      return decoded;
    }).finally(() => { loadingBuffers = null; });
  }
  return loadingBuffers;
}

function playPosition() {
  if (!sources.length) return offset;
  return (offset + Math.max(0, context.currentTime - startTime)) % duration;
}
function drawClock() {
  const value = playPosition();
  document.querySelector("#elapsed").textContent = "0:" + String(Math.floor(value)).padStart(2, "0");
  document.querySelector("#playhead").style.left = (value / duration * 100) + "%";
}
function tick() {
  drawClock();
  frame = requestAnimationFrame(tick);
}
function startSources() {
  const when = context.currentTime + 0.035;
  sources = buffers.map((buffer, i) => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopEnd = duration;
    source.connect(graph.inputs[i]);
    source.start(when, offset);
    return source;
  });
  startTime = when;
  playButton.setAttribute("aria-pressed", "true");
  playLabel.textContent = "暫停試聽";
  playSymbol.textContent = "Ⅱ";
  status.textContent = "正在循環播放 15 秒範例。";
  tick();
}
function pauseLab() {
  revision++;
  starting = false;
  offset = playPosition();
  for (const source of sources) {
    source.stop();
    source.disconnect();
  }
  sources = [];
  cancelAnimationFrame(frame);
  drawClock();
  playButton.setAttribute("aria-pressed", "false");
  playLabel.textContent = offset > 0 ? "繼續試聽" : "播放試聽";
  playSymbol.textContent = "▶";
  status.textContent = "";
}
async function togglePlay() {
  if (starting || sources.length) {
    pauseLab();
    return;
  }
  const request = ++revision;
  starting = true;
  playLabel.textContent = "取消載入";
  status.textContent = "正在載入音軌…";
  fallback.pause();
  try {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error("Web Audio unavailable");
      context = new Audio();
      graph = makeGraph();
    }
    await Promise.all([context.resume(), prepareBuffers()]);
    if (request !== revision) return;
    updateMix();
    starting = false;
    startSources();
  } catch {
    if (request !== revision) return;
    pauseLab();
    fallback.closest("details").open = true;
    status.textContent = "互動音軌暫時無法載入。可使用下方的一般播放器，或再按一次試聽。";
  }
}
playButton.addEventListener("click", togglePlay);
document.querySelector("#rewind").addEventListener("click", () => {
  const wasPlaying = sources.length > 0;
  pauseLab();
  offset = 0;
  drawClock();
  playLabel.textContent = "播放試聽";
  if (wasPlaying) startSources();
});
fallback.addEventListener("play", pauseLab);
function stopWhenHidden() {
  if (sources.length || starting) pauseLab();
  fallback.pause();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopWhenHidden();
});
window.addEventListener("pagehide", stopWhenHidden);

document.querySelector("#load-video").addEventListener("click", () => {
  stopWhenHidden();
  const player = document.createElement("iframe");
  player.src = "https://www.youtube-nocookie.com/embed/GklnqhmC3uQ?rel=0";
  player.title = "Deity Microphones：How To Do Music Video Playback";
  player.allow = "encrypted-media; picture-in-picture; fullscreen";
  player.allowFullscreen = true;
  player.referrerPolicy = "strict-origin-when-cross-origin";
  document.querySelector("#video-box").replaceChildren(player);
});
