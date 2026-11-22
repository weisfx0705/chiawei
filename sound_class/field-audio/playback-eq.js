"use strict";

const playbackFilterSpec = Object.freeze({bassHz: 80, lowOrder: 4, highOrder: 16});

function makeButterworth(ctx, type, order, frequency) {
  const sections = [];
  for (let k = 0; k < order / 2; k++) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    // Web Audio uses dB for Q on lowpass and highpass biquads.
    const q = 1 / (2 * Math.cos((2 * k + 1) * Math.PI / (2 * order)));
    node.Q.value = 20 * Math.log10(q);
    if (k > 0) sections[k - 1].connect(node);
    sections.push(node);
  }
  return sections;
}

function createPlaybackFilters(ctx, settings) {
  const spec = playbackFilterSpec;
  const low = makeButterworth(ctx, "lowpass", spec.lowOrder, settings.lowHz);
  const high = makeButterworth(ctx, "highpass", spec.highOrder, settings.highHz);
  const shelf = ctx.createBiquadFilter();
  shelf.type = "lowshelf";
  shelf.frequency.value = spec.bassHz;
  shelf.gain.value = settings.boostDb;
  low[low.length - 1].connect(shelf);
  return {low, high, shelf};
}

// Digital magnitude of the same Butterworth cascades and Web Audio low shelf.
// The chart works before the first audio gesture and without downloading a stem.
function playbackResponse(settings, sampleRate) {
  const spec = playbackFilterSpec;
  const warp = hz => Math.tan(Math.PI * hz / sampleRate);
  const lowCorner = warp(settings.lowHz);
  const highCorner = warp(settings.highHz);
  const shelfCorner = warp(spec.bassHz);
  const gain = 10 ** (settings.boostDb / 20);
  return {
    speaker(hz) {
      const f = warp(hz);
      const r4 = (f / shelfCorner) ** 4;
      const shelfDb = 10 * Math.log10(gain * (gain + r4) / (1 + gain * r4));
      return shelfDb - 10 * Math.log10(1 + (f / lowCorner) ** (2 * spec.lowOrder));
    },
    dialogue(hz) {
      return -10 * Math.log10(1 + (highCorner / warp(hz)) ** (2 * spec.highOrder));
    }
  };
}

function drawPlaybackEQ(canvas, settings, sampleRate) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width), height = Math.round(rect.height);
  if (width < 80 || height < 60) return;
  const scale = Math.min(window.devicePixelRatio || 1, 3);
  const pixelWidth = Math.round(width * scale), pixelHeight = Math.round(height * scale);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  g.clearRect(0, 0, width, height);
  const left = 32, right = width - 19, top = 11, bottom = height - 23;
  const lowFreq = 20, highFreq = Math.min(10000, sampleRate * 0.45);
  const logSpan = Math.log(highFreq / lowFreq);
  const x = hz => left + Math.log(hz / lowFreq) / logSpan * (right - left);
  const y = db => bottom - (db + 72) / 84 * (bottom - top);
  g.font = "11px ui-monospace, Menlo, monospace";
  g.textAlign = "right";
  g.textBaseline = "middle";
  for (let db = -72; db <= 12; db += 12) {
    const py = y(db);
    g.strokeStyle = db === 0 ? "#7e9691" : "#304843";
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(left, py); g.lineTo(right, py); g.stroke();
    if (db === 12 || db % 24 === 0) {
      g.fillStyle = "#c0d0c9";
      g.fillText(db > 0 ? "+" + db : String(db), left - 5, py);
    }
  }
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const freq of [20, 40, 80, 150, 250, 500, 1000, 2000, 4000, 10000]) {
    if (freq > highFreq) continue;
    const px = x(freq);
    g.strokeStyle = "#2d4640";
    g.beginPath(); g.moveTo(px, top); g.lineTo(px, bottom); g.stroke();
    if ([20, 80, 150, 500, 2000, 10000].includes(freq)) {
      g.fillStyle = "#c0d0c9";
      g.fillText(freq >= 1000 ? freq / 1000 + "k" : String(freq), px, bottom + 6);
    }
  }

  const response = playbackResponse(settings, sampleRate);
  function trace(fn, color, fill, dashed, markerHz) {
    const line = new Path2D();
    for (let px = left; px <= right; px++) {
      const hz = lowFreq * Math.exp(logSpan * (px - left) / (right - left));
      const py = y(Math.max(-78, fn(hz)));
      if (px === left) line.moveTo(px, py);
      else line.lineTo(px, py);
    }
    const area = new Path2D(line);
    area.lineTo(right, bottom); area.lineTo(left, bottom); area.closePath();
    g.fillStyle = fill;
    g.fill(area);
    g.strokeStyle = color;
    g.lineWidth = 2.6;
    g.setLineDash(dashed ? [6, 3] : []);
    g.stroke(line);
    g.setLineDash([]);
    g.fillStyle = color;
    g.beginPath(); g.arc(x(markerHz), y(fn(markerHz)), 3.6, 0, 2 * Math.PI); g.fill();
  }
  g.save();
  g.beginPath(); g.rect(left - 1, top - 2, right - left + 2, bottom - top + 3); g.clip();
  if (settings.mode > 0) {
    trace(response.speaker, "#83edd2", "rgba(86,200,172,.12)", false, settings.lowHz);
  } else {
    g.strokeStyle = "#e6e9de";
    g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(left, y(0)); g.lineTo(right, y(0)); g.stroke();
  }
  if (settings.mode >= 2) {
    trace(response.dialogue, "#ffb18b", "rgba(240,160,122,.07)", true, settings.highHz);
  }
  g.restore();
}
