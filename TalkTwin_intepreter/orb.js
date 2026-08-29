'use strict';

/*
 * TalkTwin Essence Orb — a WebGL "living orb" avatar.
 *
 * Every uploaded image becomes a breathing, speaking sci-fi orb:
 *   - the image's dominant colors become the orb's palette,
 *   - the image itself floats inside the sphere as a refracted memory,
 *   - speech opens an audio-reactive waveform aperture,
 *   - idle / listening / thinking / talking each have their own motion language.
 *
 * Self-contained: no dependencies, exposes window.createTalkOrb(canvas).
 */

(function () {
  const ORB_STYLES = {
    sophon: { noiseScale: 2.1, flow: 0.34, band: 0.0, fresnel: 2.3, sparkle: 1.0 },
    aurora: { noiseScale: 1.35, flow: 0.62, band: 1.0, fresnel: 2.9, sparkle: 0.55 },
    ember: { noiseScale: 1.7, flow: 0.2, band: 0.25, fresnel: 1.9, sparkle: 1.35 }
  };

  const MODES = ['idle', 'listening', 'thinking', 'talking'];

  const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uFlowTime;
uniform vec4 uModeW;        // idle, listening, thinking, talking
uniform vec2 uAudio;        // loudness, vowel openness
uniform vec2 uGaze;
uniform float uShimmer;     // sweep progress 0..1
uniform float uShimmerI;    // sweep intensity
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uBase;
uniform float uNoiseScale;
uniform float uBand;
uniform float uMemory;
uniform float uFresnel;
uniform float uSparkle;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uTexFit;       // cover-fit scale for the memory texture
uniform vec3 uTexFrame;     // zoom, horizontal offset, vertical offset
uniform float uMotion;      // 1 normal, lower for reduced motion

const float TAU = 6.28318530718;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.55;
  }
  return v;
}

void main() {
  float minRes = min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * minRes);
  p /= 0.66;                       // orb radius ~66% of the panel
  float aa = 3.0 / (0.33 * minRes);

  float wIdle = uModeW.x;
  float wListen = uModeW.y;
  float wThink = uModeW.z;
  float wTalk = uModeW.w;
  float loud = uAudio.x;
  float openness = uAudio.y;

  // ---- breathing + audio-driven silhouette -------------------------------
  float breathAmp = (0.020 * wIdle + 0.014 * wListen + 0.011 * wThink + 0.006 * wTalk) * uMotion;
  float breath = 1.0 + breathAmp * sin(uTime * 1.28)
               + 0.006 * uMotion * sin(uTime * 0.53 + 1.7);

  float ang = atan(p.y, p.x);
  vec2 ring = vec2(cos(ang), sin(ang));
  float wobble = fbm(ring * 1.35 + uFlowTime * 0.13) - 0.5;
  float audioRipple = sin(ang * 8.0 + uTime * 11.0) * loud * 0.020
                    + sin(ang * 5.0 - uTime * 7.0) * loud * 0.012;
  float R = breath * (1.0 + wobble * (0.012 + 0.016 * loud * wTalk) * uMotion)
          + audioRipple * wTalk * uMotion;

  float r = length(p);
  float d = r - R;
  float edge = smoothstep(aa, -aa, d);

  // ---- fake sphere normal -------------------------------------------------
  float z2 = max(R * R - r * r, 0.0);
  vec3 n = normalize(vec3(p.x, p.y, sqrt(z2) + 1e-4));
  vec2 sp = p / max(R, 1e-4);      // orb-local -1..1 coordinates

  // ---- flowing surface ----------------------------------------------------
  vec2 q = sp * uNoiseScale;
  vec2 warp = vec2(
    fbm(q + vec2(0.0, uFlowTime * 0.32)),
    fbm(q + vec2(5.2, -uFlowTime * 0.26))
  );
  float f1 = fbm(q + 1.55 * warp + vec2(uFlowTime * 0.18, 0.0));
  float f2 = fbm(q * 1.9 - warp + vec2(0.0, -uFlowTime * 0.12));

  vec3 surf = mix(uBase * 1.45, uColA, smoothstep(0.22, 0.78, f1));
  surf = mix(surf, uColB, smoothstep(0.34, 0.9, f2) * 0.85);

  // aurora bands (style-controlled)
  float bandWave = sin((sp.y * 2.6 + f1 * 2.4 + uFlowTime * 0.35) * 2.2);
  surf = mix(surf, mix(uColB, uColC, 0.5), uBand * 0.4 * smoothstep(0.1, 0.9, bandWave));

  // bright plasma filaments
  surf += uColC * pow(max(f1 * f2, 0.0), 2.2) * 1.4 * uSparkle;

  // curvature shading
  surf *= 0.5 + 0.5 * n.z;

  // ---- the memory: a clear source image protected inside the glass --------
  // Keep the subject readable through animation. Energy remains strongest at
  // the rim, while the middle preserves the uploaded image's actual colors.
  float memoryShape = 1.0 - smoothstep(0.42, 1.01, length(sp - uGaze * 0.045));
  float memMask = memoryShape * uMemory * uHasTex
                * (1.0 - 0.10 * wTalk * loud);
  if (memMask > 0.002) {
    vec2 tuv = sp * mix(0.72, 0.56, n.z);           // gentle glass refraction
    tuv += uGaze * 0.035;
    tuv += (warp - 0.5) * 0.035;                     // subtle living motion
    tuv = tuv * 0.5 * uTexFit / max(uTexFrame.x, 0.01) + 0.5;
    // Positive offsets move the visible subject right/down, matching direct
    // manipulation in the settings preview.
    tuv += vec2(-uTexFrame.y, uTexFrame.z) * 0.006 / max(uTexFrame.x, 0.01);
    vec3 mem = texture2D(uTex, clamp(tuv, 0.0, 1.0)).rgb;
    // Lift shadows before the global film curve, retain the source hue, then
    // add only a light energy tint instead of converting it to dark duotone.
    vec3 memClear = clamp(pow(mem, vec3(0.78)) * 1.12 + 0.025, 0.0, 1.0);
    float memLum = dot(memClear, vec3(0.299, 0.587, 0.114));
    vec3 energyTint = mix(uColA, mix(uColB, uColC, 0.5), memLum);
    vec3 memDisplay = mix(memClear, energyTint, 0.10);
    surf = mix(surf, memDisplay, clamp(memMask * 1.04, 0.0, 1.0));
  }

  // ---- listening: ripples sinking toward the core ------------------------
  float rip = sin(length(sp) * 21.0 + uTime * 6.2);
  surf += uColB * rip * rip * 0.14 * wListen * smoothstep(1.0, 0.5, length(sp)) * uMotion;

  // ---- thinking: an orbit-scan arc around the rim -------------------------
  float a01 = fract(ang / TAU + 0.5);
  float arcPos = fract(uTime * 0.16);
  float darc = abs(a01 - arcPos);
  darc = min(darc, 1.0 - darc);
  float arc = exp(-darc * darc * 220.0);
  float rimBand = smoothstep(0.55, 0.96, length(sp));
  surf += uColC * arc * rimBand * 1.15 * wThink;
  surf += uColA * arc * rimBand * 0.5 * wThink;

  // ---- voice aperture: a waveform mouth -----------------------------------
  float mouthY = -0.34;
  float mx = sp.x / 0.6;
  float edgeFade = smoothstep(1.0, 0.45, abs(mx));
  float wave = sin(mx * 8.5 + uTime * 9.5) * 0.55
             + sin(mx * 14.5 - uTime * 12.5) * 0.45;
  float apert = loud * (0.05 + 0.24 * openness) * edgeFade
              * (0.62 + 0.38 * wave) * uMotion;
  float my = sp.y - mouthY;
  float apertOpen = smoothstep(0.004, 0.03, apert);   // no dark slit when closed
  float inMouth = (1.0 - smoothstep(apert * 0.75, apert + 0.012, abs(my))) * edgeFade * apertOpen;
  float mouthEdge = exp(-abs(abs(my) - apert) * 52.0) * edgeFade;
  float mouthOn = 0.16 * (wIdle + wListen) + 0.4 * wThink + 1.0 * wTalk;

  vec3 mouthCol = mix(surf, uBase * 0.3, inMouth * 0.92 * wTalk);
  mouthCol += uColC * mouthEdge * (0.30 + 1.9 * loud);
  mouthCol += vec3(1.0) * mouthEdge * loud * 0.5;
  surf = mix(surf, mouthCol, mouthOn);

  // ---- glass: fresnel rim + crisp silhouette light + specular -------------
  float fr = pow(clamp(1.0 - n.z, 0.0, 1.0), uFresnel);
  surf += uColC * fr * 0.85;
  surf += uColA * fr * fr * 0.7;
  float rimLine = exp(-abs(d) * 90.0);               // thin mirror edge
  surf += mix(uColC, vec3(1.0), 0.35) * rimLine * 0.55;

  vec3 L = normalize(vec3(-0.42 + uGaze.x * 0.35, 0.58 - uGaze.y * 0.35, 0.7));
  float spec = pow(max(dot(n, L), 0.0), 48.0);
  surf += vec3(1.0, 0.99, 0.96) * spec * 0.5;

  // shimmer sweep (the orb's "blink")
  float sweepAxis = dot(sp, normalize(vec2(0.85, 0.42)));
  float sweep = exp(-pow((sweepAxis - mix(-1.4, 1.4, uShimmer)) * 4.2, 2.0));
  surf += vec3(1.0, 0.98, 0.94) * sweep * 0.30 * uShimmerI * n.z;

  // ---- background: deep space, halo, star dust ----------------------------
  vec3 bg = uBase * 0.35;
  bg += mix(uColA, uColB, 0.5) * fbm(p * 1.7 + uFlowTime * 0.04) * 0.10;
  bg += uColA * exp(-pow(r - R - 0.02, 2.0) * 34.0) * 0.30;              // tight halo
  float aura = exp(-max(r - R, 0.0) * 3.6);
  bg += uColC * aura * (0.10 + 0.42 * loud * wTalk + 0.16 * wListen);    // voice aura
  bg += uColB * exp(-max(r - R, 0.0) * 1.4) * 0.06;

  // star dust
  vec2 st = p * 13.0;
  vec2 sid = floor(st);
  vec2 sgv = fract(st) - 0.5;
  float sh = hash(sid);
  if (sh > 0.978) {
    float tw = 0.5 + 0.5 * sin(uTime * (1.0 + sh * 3.0) + sh * 40.0);
    float star = exp(-dot(sgv, sgv) * 46.0) * tw;
    bg += vec3(0.9, 0.95, 1.0) * star * 0.5;
  }
  bg *= 1.0 - 0.4 * smoothstep(0.85, 1.9, r);                            // vignette

  vec3 col = mix(bg, surf, edge);

  // gentle filmic-ish curve
  col = 1.0 - exp(-col * 1.55);
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

  const PARTICLE_VERT = `
attribute vec3 aP;           // orb-space x, y + depth hint z (-1..1)
attribute float aSize;
attribute float aHue;
uniform vec2 uRes;
uniform float uDpr;
varying float vDepth;
varying float vHue;
void main() {
  float minRes = min(uRes.x, uRes.y);
  vec2 clip = aP.xy * 0.66 * minRes / uRes;
  gl_Position = vec4(clip, 0.0, 1.0);
  vDepth = aP.z;
  vHue = aHue;
  gl_PointSize = aSize * uDpr * (0.7 + 0.3 * aP.z);
}`;

  const PARTICLE_FRAG = `
precision mediump float;
uniform vec3 uColA;
uniform vec3 uColC;
uniform float uAlpha;
varying float vDepth;
varying float vHue;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float m = exp(-dot(c, c) * 14.0);
  float depthFade = 0.35 + 0.65 * (vDepth * 0.5 + 0.5);
  vec3 col = mix(uColA, uColC, vHue);
  gl_FragColor = vec4(col * m * depthFade * uAlpha, 0.0);
}`;

  // ------------------------------------------------------------------------
  // Palette extraction: dominant hues of the source image become the orb.
  // ------------------------------------------------------------------------
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map((v) => v + m);
  }

  function rgbToHex(rgb) {
    const to255 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16).padStart(2, '0');
    return `#${to255(rgb[0])}${to255(rgb[1])}${to255(rgb[2])}`;
  }

  function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }

  function rgbToHsl(rgb) {
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const delta = max - min;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (delta > 0) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    return [((h % 360) + 360) % 360, s, l];
  }

  function clampRange(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatPalette(palette) {
    return {
      ...palette,
      cssA: rgbToHex(palette.colA),
      cssB: rgbToHex(palette.colB),
      cssC: rgbToHex(palette.colC),
      cssBase: rgbToHex(palette.base)
    };
  }

  /**
   * Build a full orb palette from up to three user colors. Missing colors and
   * the deep base are derived from the primary so any single pick still yields
   * a coherent scheme.
   */
  function paletteFromColors(hexA, hexB, hexC) {
    const rgbA = hexToRgb(hexA) || hslToRgb(196, 0.85, 0.6);
    const [hueA, satA, lumA] = rgbToHsl(rgbA);
    const rgbB = hexToRgb(hexB)
      || hslToRgb(hueA + 55, clampRange(satA * 0.95, 0.35, 0.85), clampRange(lumA - 0.04, 0.35, 0.62));
    const rgbC = hexToRgb(hexC)
      || hslToRgb(hueA + 38, clampRange(satA + 0.15, 0.5, 0.95), clampRange(lumA + 0.14, 0.5, 0.76));
    return {
      colA: rgbA,
      colB: rgbB,
      colC: rgbC,
      base: hslToRgb(hueA + 12, 0.5, 0.085),
      vibrant: true
    };
  }

  const FALLBACK_CANDIDATES = ['#55c8f0', '#8f7bf5', '#f08fd0', '#ffd36c', '#6ee7b7', '#f97362'];

  function extractPalette(image) {
    const fallback = {
      colA: hslToRgb(196, 0.85, 0.6),
      colB: hslToRgb(262, 0.7, 0.58),
      colC: hslToRgb(318, 0.85, 0.68),
      base: hslToRgb(230, 0.45, 0.09),
      candidates: FALLBACK_CANDIDATES.slice(),
      vibrant: false
    };
    try {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      const buckets = new Array(18).fill(0).map(() => ({ w: 0, s: 0, l: 0 }));
      let satSum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 120) continue;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const delta = max - min;
        const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        let h = 0;
        if (delta > 0) {
          if (max === r) h = 60 * (((g - b) / delta) % 6);
          else if (max === g) h = 60 * ((b - r) / delta + 2);
          else h = 60 * ((r - g) / delta + 4);
        }
        h = ((h % 360) + 360) % 360;
        satSum += s;
        count += 1;
        // weight: saturated mid-tones define the identity
        const weight = s * (1 - Math.abs(l - 0.52) * 1.4);
        if (weight <= 0.02) continue;
        const bucket = buckets[Math.floor(h / 20) % 18];
        bucket.w += weight;
        bucket.s += s * weight;
        bucket.l += l * weight;
      }

      // per-bucket weighted averages keep the orb faithful to the image's own
      // saturation and lightness (pastel photo → pastel orb, deep red → deep red)
      const ranked = buckets
        .map((bucket, index) => ({
          hue: index * 20 + 10,
          w: bucket.w,
          s: bucket.w > 0 ? bucket.s / bucket.w : 0,
          l: bucket.w > 0 ? bucket.l / bucket.w : 0.5
        }))
        .filter((bucket) => bucket.w > 0.5)
        .sort((a, b) => b.w - a.w);

      const avgSat = count ? satSum / count : 0;
      if (!ranked.length || avgSat < 0.08) return fallback;   // grayscale image

      const candidates = ranked.slice(0, 6).map((bucket) => rgbToHex(
        hslToRgb(bucket.hue, clampRange(bucket.s * 1.2, 0.4, 0.9), clampRange(bucket.l, 0.38, 0.72))
      ));
      while (candidates.length < 4) {
        candidates.push(rgbToHex(hslToRgb(
          ranked[0].hue + 44 * candidates.length,
          clampRange(ranked[0].s * 1.1, 0.45, 0.85),
          clampRange(ranked[0].l, 0.42, 0.68)
        )));
      }

      const primary = ranked[0];
      const hueDistance = (a, b) => {
        const diff = Math.abs(a - b) % 360;
        return Math.min(diff, 360 - diff);
      };
      const secondary = ranked.find((bucket) => hueDistance(bucket.hue, primary.hue) >= 60)
        || { hue: (primary.hue + 48) % 360, s: primary.s * 0.95, l: primary.l };

      return {
        colA: hslToRgb(primary.hue, clampRange(primary.s * 1.25, 0.5, 0.88), clampRange(primary.l, 0.42, 0.68)),
        colB: hslToRgb(secondary.hue, clampRange(secondary.s * 1.15, 0.45, 0.85), clampRange(secondary.l, 0.38, 0.64)),
        colC: hslToRgb(primary.hue + 38, clampRange(primary.s * 1.35, 0.55, 0.95), clampRange(primary.l + 0.14, 0.55, 0.76)),
        base: hslToRgb(primary.hue + 12, 0.5, 0.085),
        candidates,
        vibrant: true
      };
    } catch (error) {
      console.warn('Palette extraction failed; using default orb colors.', error);
      return fallback;
    }
  }

  // ------------------------------------------------------------------------
  // Renderer
  // ------------------------------------------------------------------------
  function createTalkOrb(canvas) {
    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power'
    });
    if (!gl) return null;

    const reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Orb shader compile error: ${info}`);
      }
      return shader;
    }

    function link(vertSrc, fragSrc) {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Orb program link error: ${gl.getProgramInfoLog(program)}`);
      }
      return program;
    }

    let orbProgram;
    let particleProgram;
    try {
      orbProgram = link(VERT, FRAG);
      particleProgram = link(PARTICLE_VERT, PARTICLE_FRAG);
    } catch (error) {
      console.error(error);
      return null;
    }

    // fullscreen triangle
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const orbUniforms = {};
    ['uRes', 'uTime', 'uFlowTime', 'uModeW', 'uAudio', 'uGaze', 'uShimmer', 'uShimmerI',
      'uColA', 'uColB', 'uColC', 'uBase', 'uNoiseScale', 'uBand', 'uMemory', 'uFresnel',
      'uSparkle', 'uTex', 'uHasTex', 'uTexFit', 'uTexFrame', 'uMotion'
    ].forEach((name) => { orbUniforms[name] = gl.getUniformLocation(orbProgram, name); });
    const orbAttrPos = gl.getAttribLocation(orbProgram, 'aPos');

    const particleUniforms = {};
    ['uRes', 'uDpr', 'uColA', 'uColC', 'uAlpha'].forEach((name) => {
      particleUniforms[name] = gl.getUniformLocation(particleProgram, name);
    });
    const particleAttrs = {
      aP: gl.getAttribLocation(particleProgram, 'aP'),
      aSize: gl.getAttribLocation(particleProgram, 'aSize'),
      aHue: gl.getAttribLocation(particleProgram, 'aHue')
    };

    // orbiting spark field
    const PARTICLE_COUNT = 64;
    const particles = [];
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      particles.push({
        radius: 1.06 + Math.random() * 0.5,
        speed: (0.12 + Math.random() * 0.3) * (Math.random() > 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
        squash: 0.22 + Math.random() * 0.4,
        tilt: (Math.random() - 0.5) * 0.9,
        size: 2.2 + Math.random() * 3.4,
        hue: Math.random()
      });
    }
    const particleData = new Float32Array(PARTICLE_COUNT * 5);
    const particleBuffer = gl.createBuffer();

    // memory texture (the uploaded image, downscaled)
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([12, 14, 26, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const orb = {
      palette: extractPalette(null),
      style: { ...ORB_STYLES.sophon },
      hasTex: 0,
      texFit: [1, 1],
      texFrame: [1, 0, 0],
      memoryOpacity: 0.94,
      modeTarget: [1, 0, 0, 0],
      modeW: [1, 0, 0, 0],
      audioTarget: [0, 0.5],
      audio: [0, 0.5],
      gazeTarget: [0, 0],
      gaze: [0, 0],
      shimmerStart: -10,
      flowTime: 0,
      lastTime: 0,
      running: true,
      destroyed: false
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return dpr;
    }

    function frame(nowMs) {
      if (orb.destroyed) return;
      requestAnimationFrame(frame);
      if (document.hidden) return;
      renderFrame(nowMs);
    }

    function renderFrame(nowMs) {
      const now = nowMs * 0.001;
      const dt = Math.min(0.05, Math.max(0.001, now - (orb.lastTime || now)));
      orb.lastTime = now;

      // smooth mode crossfade
      let sum = 0;
      for (let index = 0; index < 4; index += 1) {
        orb.modeW[index] += (orb.modeTarget[index] - orb.modeW[index]) * Math.min(1, dt * 6.5);
        sum += orb.modeW[index];
      }
      for (let index = 0; index < 4; index += 1) orb.modeW[index] /= sum || 1;

      // smooth audio envelope (already smoothed upstream; this rounds mode edges)
      const loudK = orb.audioTarget[0] > orb.audio[0] ? 22 : 9;
      orb.audio[0] += (orb.audioTarget[0] - orb.audio[0]) * Math.min(1, dt * loudK);
      orb.audio[1] += (orb.audioTarget[1] - orb.audio[1]) * Math.min(1, dt * 10);

      orb.gaze[0] += (orb.gazeTarget[0] - orb.gaze[0]) * Math.min(1, dt * 5);
      orb.gaze[1] += (orb.gazeTarget[1] - orb.gaze[1]) * Math.min(1, dt * 5);

      // internal currents accelerate while thinking / talking
      const speedMul = 1 + orb.modeW[2] * 1.6 + orb.modeW[3] * (0.5 + orb.audio[0] * 1.4);
      orb.flowTime += dt * orb.style.flow * speedMul * (reduceMotion ? 0.35 : 1);

      const dpr = resize();
      gl.viewport(0, 0, canvas.width, canvas.height);

      // shimmer envelope: a 0.9s sweep
      const shimmerT = (now - orb.shimmerStart) / 0.9;
      const shimmerProgress = Math.max(0, Math.min(1, shimmerT));
      const shimmerIntensity = shimmerT >= 0 && shimmerT <= 1
        ? Math.sin(shimmerProgress * Math.PI)
        : 0;

      gl.disable(gl.BLEND);
      gl.useProgram(orbProgram);
      gl.uniform2f(orbUniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(orbUniforms.uTime, now);
      gl.uniform1f(orbUniforms.uFlowTime, orb.flowTime);
      gl.uniform4f(orbUniforms.uModeW, orb.modeW[0], orb.modeW[1], orb.modeW[2], orb.modeW[3]);
      gl.uniform2f(orbUniforms.uAudio, orb.audio[0], orb.audio[1]);
      gl.uniform2f(orbUniforms.uGaze, orb.gaze[0], orb.gaze[1]);
      gl.uniform1f(orbUniforms.uShimmer, shimmerProgress);
      gl.uniform1f(orbUniforms.uShimmerI, shimmerIntensity);
      gl.uniform3fv(orbUniforms.uColA, orb.palette.colA);
      gl.uniform3fv(orbUniforms.uColB, orb.palette.colB);
      gl.uniform3fv(orbUniforms.uColC, orb.palette.colC);
      gl.uniform3fv(orbUniforms.uBase, orb.palette.base);
      gl.uniform1f(orbUniforms.uNoiseScale, orb.style.noiseScale);
      gl.uniform1f(orbUniforms.uBand, orb.style.band);
      // Visibility is a user choice and stays consistent across orb styles.
      gl.uniform1f(orbUniforms.uMemory, orb.memoryOpacity);
      gl.uniform1f(orbUniforms.uFresnel, orb.style.fresnel);
      gl.uniform1f(orbUniforms.uSparkle, orb.style.sparkle);
      gl.uniform1f(orbUniforms.uHasTex, orb.hasTex);
      gl.uniform2f(orbUniforms.uTexFit, orb.texFit[0], orb.texFit[1]);
      gl.uniform3f(orbUniforms.uTexFrame, orb.texFrame[0], orb.texFrame[1], orb.texFrame[2]);
      gl.uniform1f(orbUniforms.uMotion, reduceMotion ? 0.4 : 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(orbUniforms.uTex, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(orbAttrPos);
      gl.vertexAttribPointer(orbAttrPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ---- particles ----
      const orbitSpeed = 1 + orb.modeW[2] * 2.6 + orb.modeW[3] * orb.audio[0] * 2.0;
      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const particle = particles[index];
        particle.phase += dt * particle.speed * orbitSpeed * (reduceMotion ? 0.4 : 1);
        const cosT = Math.cos(particle.tilt);
        const sinT = Math.sin(particle.tilt);
        const ox = Math.cos(particle.phase) * particle.radius;
        const oy = Math.sin(particle.phase) * particle.radius * particle.squash;
        particleData[index * 5] = ox * cosT - oy * sinT;
        particleData[index * 5 + 1] = ox * sinT + oy * cosT;
        particleData[index * 5 + 2] = Math.sin(particle.phase);   // depth hint
        particleData[index * 5 + 3] = particle.size * (1 + orb.audio[0] * 0.8);
        particleData[index * 5 + 4] = particle.hue;
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(particleProgram);
      gl.uniform2f(particleUniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(particleUniforms.uDpr, dpr);
      gl.uniform3fv(particleUniforms.uColA, orb.palette.colA);
      gl.uniform3fv(particleUniforms.uColC, orb.palette.colC);
      gl.uniform1f(particleUniforms.uAlpha,
        0.30 + orb.modeW[2] * 0.35 + orb.modeW[3] * orb.audio[0] * 0.5);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(particleAttrs.aP);
      gl.vertexAttribPointer(particleAttrs.aP, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(particleAttrs.aSize);
      gl.vertexAttribPointer(particleAttrs.aSize, 1, gl.FLOAT, false, 20, 12);
      gl.enableVertexAttribArray(particleAttrs.aHue);
      gl.vertexAttribPointer(particleAttrs.aHue, 1, gl.FLOAT, false, 20, 16);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
    }
    requestAnimationFrame(frame);

    return {
      /** 'idle' | 'listening' | 'thinking' | 'talking' */
      setMode(mode) {
        const index = MODES.indexOf(mode);
        orb.modeTarget = [0, 0, 0, 0];
        orb.modeTarget[index >= 0 ? index : 0] = 1;
      },

      /**
       * loud 0..1 (mouth aperture + glow), openness 0..1 (vowel shape).
       * Pass undefined to leave a channel unchanged.
       */
      setAudio(loud, openness) {
        if (loud !== undefined && loud !== null) {
          orb.audioTarget[0] = Math.max(0, Math.min(1, Number(loud) || 0));
        }
        if (openness !== undefined && openness !== null) {
          orb.audioTarget[1] = Math.max(0, Math.min(1, Number(openness) || 0));
        }
      },

      /** normalized -1..1 parallax */
      setGaze(x, y) {
        orb.gazeTarget[0] = Math.max(-1, Math.min(1, Number(x) || 0));
        orb.gazeTarget[1] = Math.max(-1, Math.min(1, Number(y) || 0));
      },

      /** light sweep across the sphere — the orb's blink */
      shimmer() {
        orb.shimmerStart = orb.lastTime || 0;
      },

      /** force-render a single frame (testing / hidden-document environments) */
      renderOnce(atMs) {
        renderFrame(typeof atMs === 'number' ? atMs : performance.now());
      },

      /** 'sophon' | 'aurora' | 'ember' */
      setStyle(name) {
        orb.style = { ...(ORB_STYLES[name] || ORB_STYLES.sophon) };
      },

      /**
       * Feed the uploaded image: extracts the palette and uploads the
       * downscaled image as the orb's inner memory texture.
       * Returns the palette (with CSS color strings) for UI use.
       */
      setSourceImage(image) {
        let palette = extractPalette(null);
        if (image && image.naturalWidth > 0) {
          palette = extractPalette(image);
          try {
            const maxSize = 512;
            const scratch = document.createElement('canvas');
            const aspect = image.naturalWidth / image.naturalHeight;
            const downscale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
            scratch.width = Math.max(1, Math.round(image.naturalWidth * downscale));
            scratch.height = Math.max(1, Math.round(image.naturalHeight * downscale));
            const ctx = scratch.getContext('2d');
            // Keep the full source texture so framing can pan into areas that
            // would otherwise be destroyed by an eager square crop.
            ctx.drawImage(image, 0, 0, scratch.width, scratch.height);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            orb.hasTex = 1;
            orb.texFit = [Math.min(1, 1 / aspect), Math.min(1, aspect)];
          } catch (error) {
            console.warn('Orb memory texture upload failed.', error);
            orb.hasTex = 0;
          }
        } else {
          orb.hasTex = 0;
        }
        orb.palette = palette;
        return formatPalette(palette);
      },

      /**
       * Override the palette with user-picked colors (hex). Any missing color
       * is derived from the primary. Returns the applied palette.
       */
      setPalette(colors = {}) {
        const palette = paletteFromColors(colors.a, colors.b, colors.c);
        orb.palette = palette;
        return formatPalette(palette);
      },

      /** Apply the saved crop used by both the editor preview and main orb. */
      setTextureTransform(scale, offsetX, offsetY) {
        orb.texFrame[0] = Math.max(0.7, Math.min(3, Number(scale) || 1));
        orb.texFrame[1] = Math.max(-40, Math.min(40, Number(offsetX) || 0));
        orb.texFrame[2] = Math.max(-40, Math.min(40, Number(offsetY) || 0));
      },

      /** User-controlled visibility of the uploaded image inside the orb. */
      setMemoryOpacity(value) {
        const number = Number(value);
        orb.memoryOpacity = Number.isFinite(number) ? Math.max(0.15, Math.min(1, number)) : 0.94;
      },

      destroy() {
        orb.destroyed = true;
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    };
  }

  window.createTalkOrb = createTalkOrb;
  window.TALKTWIN_ORB_STYLES = Object.keys(ORB_STYLES);
  // Standalone palette helpers (also used by the non-WebGL fallback UI).
  window.extractOrbPalette = function (image) {
    return formatPalette(extractPalette(image && image.naturalWidth > 0 ? image : null));
  };
  window.orbPaletteFromColors = function (a, b, c) {
    return formatPalette(paletteFromColors(a, b, c));
  };
  // Anchor one image color and derive a coherent three-color scheme from it.
  window.orbPaletteFromAnchor = function (anchorHex) {
    const palette = formatPalette(paletteFromColors(anchorHex));
    return { a: palette.cssA, b: palette.cssB, c: palette.cssC, palette };
  };
})();
