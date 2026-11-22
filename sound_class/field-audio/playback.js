"use strict";

const playButton = document.querySelector("#play");
const playLabel = document.querySelector("#play-label");
const playSymbol = document.querySelector("#play-symbol");
const status = document.querySelector("#audio-status");
const modes = [...document.querySelectorAll("[data-mode]")];
const lp = document.querySelector("#lp");
const boost = document.querySelector("#boost");
const hp = document.querySelector("#hp");
const fallback = document.querySelector("#fallback");
const eqPlot = document.querySelector("#eq-plot");
const duration = 15;
const notes = [
  "先聽鈸和吉他，留意它們有沒有蓋過字尾。",
  "把低頻增益從 0 拉到 +4 dB，聽鼓點有沒有更清楚。",
  "只聽低切後的現場對白。把 Low Cut 拉高，聽人聲何時開始變薄。",
  "清理過的對白，加上獨立的全頻原曲和海浪。"
];
let selected = Number(modes.find(b => b.getAttribute("aria-pressed") === "true").dataset.mode);
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

function mixSettings() {
  return {mode: selected, lowHz: Number(lp.value), highHz: Number(hp.value), boostDb: Number(boost.value)};
}

function makeGraph(ctx, settings) {
  function gain(value) {
    const node = ctx.createGain();
    node.gain.value = value;
    return node;
  }
  const music = gain(1), voice = gain(0.91), sea = gain(1);
  const speaker = gain(1), microphone = gain(1), output = gain(0.72);
  const rawSpeaker = gain(0), lowSpeaker = gain(0);
  const rawMic = gain(0), cleanMic = gain(0), score = gain(0), waves = gain(0);
  const filters = createPlaybackFilters(ctx, settings);

  music.connect(rawSpeaker).connect(speaker);
  music.connect(filters.low[0]);
  filters.shelf.connect(lowSpeaker).connect(speaker);

  // Direct arrival and two reflections from the on-set speaker to the microphone.
  for (const [seconds, amplitude] of [[0.011, 0.53], [0.039, 0.21], [0.071, 0.10]]) {
    const delay = ctx.createDelay(0.1);
    delay.delayTime.value = seconds;
    speaker.connect(delay).connect(gain(amplitude)).connect(microphone);
  }
  voice.connect(microphone);
  microphone.connect(rawMic).connect(output);
  microphone.connect(filters.high[0]);
  filters.high[filters.high.length - 1].connect(cleanMic).connect(output);
  music.connect(score).connect(output);
  sea.connect(waves).connect(output);
  output.connect(ctx.destination);

  const mix = {inputs: [music, voice, sea], rawSpeaker, lowSpeaker, rawMic, cleanMic, score, waves, ...filters};
  applyPlaybackMix(mix, settings, 0);
  return mix;
}

function applyPlaybackMix(mix, settings, smoothing = 0.013) {
  const now = mix.rawMic.context.currentTime;
  function set(param, value) {
    if (smoothing === 0) param.value = value;
    else param.setTargetAtTime(value, now, smoothing);
  }
  const stageOn = settings.mode > 0;
  const postOn = settings.mode >= 2;
  set(mix.rawSpeaker.gain, stageOn ? 0 : 1);
  set(mix.lowSpeaker.gain, stageOn ? 1 : 0);
  // In C and D the entire microphone signal goes through the high-pass.
  set(mix.rawMic.gain, postOn ? 0 : 1);
  set(mix.cleanMic.gain, postOn ? 1 : 0);
  set(mix.score.gain, settings.mode === 3 ? 0.37 : 0);
  set(mix.waves.gain, settings.mode === 3 ? 0.21 : 0);
  set(mix.shelf.gain, settings.boostDb);
  for (const part of mix.low) set(part.frequency, settings.lowHz);
  for (const part of mix.high) set(part.frequency, settings.highHz);
}

function renderEQ() {
  drawPlaybackEQ(eqPlot, mixSettings(), context ? context.sampleRate : 48000);
}

function refreshMixer() {
  const settings = mixSettings();
  const stageOn = selected > 0, postOn = selected >= 2;
  lp.disabled = !stageOn;
  boost.disabled = !stageOn;
  hp.disabled = !postOn;
  for (const slider of [lp, boost, hp]) {
    const suffix = slider === boost ? " dB" : " Hz";
    const prefix = slider === boost && settings.boostDb > 0 ? "+" : "";
    const display = prefix + slider.value + suffix;
    document.querySelector("#" + slider.id + "-out").value = display;
    slider.setAttribute("aria-valuetext", display);
  }
  document.querySelector("#stage-key").classList.toggle("bypassed", !stageOn);
  document.querySelector("#post-key").classList.toggle("bypassed", !postOn);
  document.querySelector("#stage-state").textContent = stageOn ? (settings.boostDb ? "低通＋增益" : "低通") : "全頻";
  document.querySelector("#post-state").textContent = postOn ? "高通" : "原音";
  const stageText = stageOn ? "喇叭低通 " + lp.value + " Hz，低頻增益 " + boost.value + " dB。" : "喇叭播放全頻。";
  const postText = postOn ? "對白高通 " + hp.value + " Hz。" : "對白保留原音。";
  eqPlot.setAttribute("aria-label", "EQ 頻率響應圖。" + stageText + postText);
  if (graph) applyPlaybackMix(graph, settings);
  renderEQ();
}

modes.forEach((button, i) => button.addEventListener("click", () => {
  selected = i;
  modes.forEach((b, j) => b.setAttribute("aria-pressed", String(j === selected)));
  document.querySelector("#mode-note").textContent = notes[selected];
  refreshMixer();
}));
for (const slider of [lp, boost, hp]) slider.addEventListener("input", refreshMixer);
if (window.ResizeObserver) new ResizeObserver(renderEQ).observe(eqPlot);
else window.addEventListener("resize", renderEQ);
refreshMixer();

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
  status.textContent = "15 秒循環播放中。";
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
      graph = makeGraph(context, mixSettings());
      renderEQ();
    }
    await Promise.all([context.resume(), prepareBuffers()]);
    if (request !== revision) return;
    applyPlaybackMix(graph, mixSettings());
    starting = false;
    startSources();
  } catch {
    if (request !== revision) return;
    pauseLab();
    fallback.closest("details").open = true;
    status.textContent = "音軌暫時無法載入。可改用下方播放器，或再試一次。";
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
