/* Throw a Plate at the Wall!!! – the web mini-smash.
   A small pseudo-3D room in a canvas: flick the object at the wall and it breaks into pieces that bounce
   and slide across the floor. World units are metres: X right, Y up, Z toward the viewer.
   The wall is the plane Z = 0 and the floor is Y = 0, as in the game.
   No libraries and nothing loaded from other servers; the sounds are synthesized with Web Audio.

   const game = Smash.mount(element, { theme, items, text, money, label, onThrow, onImpact, onSelect, onLayout }) */
(function () {
  'use strict';

  const G = 9.8;                 // gravity, m/s²
  const CAM_Z = 3.6;             // camera distance from the wall (the game uses the same)
  const CAM_Y = 1.35;            // camera height
  const TEX = 1400;              // texture pixels per metre
  const TARGET = { x: 0, y: 1.45 };
  const RINGS = [{ r: 0.12, m: 1.5 }, { r: 0.28, m: 1 }, { r: 0.44, m: 0.75 }, { r: 0.6, m: 0.5 }];
  const MAX_DEBRIS = 380;        // pieces kept on the floor before the oldest go
  const SHARD_SCALE = 1.25;      // pieces are drawn a little larger than life so they read on a phone
  const FONT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif';
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const R = Math.random;
  const between = (a, b) => a + (b - a) * R();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function seeded(seed) {          // mulberry32, so decals look the same after a resize
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- the objects (sizes in metres, prices from the game's catalog) ---------- */

  const MATTER = {
    porcelain: { pieces: [15, 22], edge: 'rgba(255,255,255,.95)', edgeW: 0.004, bounce: 0.28, spread: 1, dust: '255,255,255' },
    ceramic:   { pieces: [7, 11],  edge: 'rgba(255,255,255,.95)', edgeW: 0.005, bounce: 0.22, spread: 0.85, dust: '244,240,230' },
    glass:     { pieces: [26, 34], edge: 'rgba(255,255,255,.95)', edgeW: 0.0025, bounce: 0.3, spread: 1.25, dust: '225,240,255', glints: 26 },
    jelly:     { bounce: 0.55 },
  };

  const ITEMS = {
    plate: { w: 0.27, h: 0.27,   matter: 'porcelain', price: 8,  flip: true, draw: drawPlate },
    mug:   { w: 0.15, h: 0.112,  matter: 'ceramic',   price: 9,  draw: drawMug },
    glass: { w: 0.09, h: 0.21,   matter: 'glass',     price: 10, draw: drawGlass, splat: 'wine' },
    gummy: { w: 0.125, h: 0.16,  matter: 'jelly',     price: 14, draw: drawGummy },
  };

  function drawPlate(c, w) {
    const r = w / 2;
    c.translate(r, r);
    const g = c.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.05, 0, 0, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#F7F4EC'); g.addColorStop(0.86, '#ECE6DA'); g.addColorStop(1, '#D6CFC0');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 0.985, 0, 7); c.fill();
    c.strokeStyle = 'rgba(80,70,50,.10)'; c.lineWidth = r * 0.06; c.beginPath(); c.arc(0, 0, r * 0.62, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = r * 0.02; c.beginPath(); c.arc(0, 0, r * 0.585, Math.PI * 0.9, Math.PI * 1.6); c.stroke();
    c.strokeStyle = '#1F4E9C'; c.lineWidth = r * 0.075; c.beginPath(); c.arc(0, 0, r * 0.855, 0, 7); c.stroke();
    c.strokeStyle = '#2F6BEA'; c.lineWidth = r * 0.018; c.beginPath(); c.arc(0, 0, r * 0.775, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = r * 0.035; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.93, Math.PI * 1.08, Math.PI * 1.38); c.stroke();
    c.strokeStyle = 'rgba(60,50,40,.28)'; c.lineWidth = r * 0.02; c.beginPath(); c.arc(0, 0, r * 0.985, 0, 7); c.stroke();
  }

  function drawMug(c, w, h) {
    const bw = w * 0.74, top = h * 0.07, bot = h * 0.98;
    c.lineCap = 'round';
    c.strokeStyle = '#E4DED2'; c.lineWidth = h * 0.13;
    c.beginPath(); c.ellipse(bw * 0.97, h * 0.52, w * 0.16, h * 0.24, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.07)'; c.lineWidth = h * 0.04;
    c.beginPath(); c.ellipse(bw * 0.97, h * 0.52, w * 0.13, h * 0.2, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    const g = c.createLinearGradient(0, 0, bw, 0);
    g.addColorStop(0, '#D5CFC2'); g.addColorStop(0.22, '#FBFAF6'); g.addColorStop(0.38, '#FFFFFF'); g.addColorStop(1, '#D9D3C6');
    c.fillStyle = g; roundRect(c, 0, top, bw, bot - top, [bw * 0.03, bw * 0.03, bw * 0.14, bw * 0.14]); c.fill();
    c.fillStyle = '#CFC7B8'; c.beginPath(); c.ellipse(bw / 2, top, bw / 2, h * 0.055, 0, 0, 7); c.fill();
    c.fillStyle = '#4A2B17'; c.beginPath(); c.ellipse(bw / 2, top + h * 0.008, bw * 0.43, h * 0.036, 0, 0, 7); c.fill();
    c.fillStyle = '#C8372D'; c.font = `900 ${h * 0.21}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('MONDAY', bw / 2, h * 0.56, bw * 0.8);
  }

  function drawGlass(c, w, h) {
    const cx = w / 2, bowlH = h * 0.53, rim = w * 0.46;
    const bowl = new Path2D();
    bowl.moveTo(cx - rim, h * 0.01);
    bowl.bezierCurveTo(cx - rim * 1.1, bowlH * 0.55, cx - rim * 0.75, bowlH * 0.96, cx - w * 0.05, bowlH);
    bowl.lineTo(cx + w * 0.05, bowlH);
    bowl.bezierCurveTo(cx + rim * 0.75, bowlH * 0.96, cx + rim * 1.1, bowlH * 0.55, cx + rim, h * 0.01);
    bowl.closePath();
    c.save(); c.clip(bowl);
    const top = bowlH * 0.42;
    const g = c.createLinearGradient(0, top, 0, bowlH);
    g.addColorStop(0, '#A01C33'); g.addColorStop(1, '#5A0614');
    c.fillStyle = g; c.fillRect(0, top, w, bowlH);
    c.fillStyle = 'rgba(255,130,150,.4)'; c.beginPath(); c.ellipse(cx, top, rim * 0.95, h * 0.012, 0, 0, 7); c.fill();
    c.restore();
    c.fillStyle = 'rgba(214,232,255,.24)'; c.fill(bowl);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = w * 0.028; c.stroke(bowl);
    c.fillStyle = 'rgba(226,238,255,.7)'; c.fillRect(cx - w * 0.035, bowlH, w * 0.07, h * 0.42);
    c.beginPath(); c.ellipse(cx, h * 0.955, w * 0.42, h * 0.035, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = w * 0.02; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = w * 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - rim * 0.6, bowlH * 0.12); c.quadraticCurveTo(cx - rim * 0.74, bowlH * 0.5, cx - rim * 0.38, bowlH * 0.82); c.stroke();
  }

  function drawGummy(c, w, h) {
    const cx = w / 2, p = new Path2D();
    const blob = (x, y, rx, ry) => { p.moveTo(x + rx, y); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
    blob(cx, h * 0.25, w * 0.3, h * 0.2);
    blob(cx - w * 0.25, h * 0.1, w * 0.11, h * 0.08);
    blob(cx + w * 0.25, h * 0.1, w * 0.11, h * 0.08);
    blob(cx, h * 0.6, w * 0.36, h * 0.27);
    blob(cx - w * 0.37, h * 0.5, w * 0.12, h * 0.1);
    blob(cx + w * 0.37, h * 0.5, w * 0.12, h * 0.1);
    blob(cx - w * 0.22, h * 0.87, w * 0.16, h * 0.11);
    blob(cx + w * 0.22, h * 0.87, w * 0.16, h * 0.11);
    const g = c.createRadialGradient(cx - w * 0.15, h * 0.3, w * 0.05, cx, h * 0.55, h * 0.6);
    g.addColorStop(0, '#FF8D92'); g.addColorStop(0.45, '#E63946'); g.addColorStop(1, '#9E101D');
    c.globalAlpha = 0.95; c.fillStyle = g; c.fill(p); c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,.38)';
    c.beginPath(); c.ellipse(cx - w * 0.12, h * 0.17, w * 0.08, h * 0.04, -0.5, 0, 7); c.fill();
    c.beginPath(); c.ellipse(cx - w * 0.17, h * 0.52, w * 0.05, h * 0.11, 0.2, 0, 7); c.fill();
  }

  function roundRect(c, x, y, w, h, r) {
    if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); return; }
    const [a, b, d, e] = Array.isArray(r) ? r : [r, r, r, r];
    c.beginPath(); c.moveTo(x + a, y); c.lineTo(x + w - b, y); c.quadraticCurveTo(x + w, y, x + w, y + b);
    c.lineTo(x + w, y + h - d); c.quadraticCurveTo(x + w, y + h, x + w - d, y + h); c.lineTo(x + e, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - e); c.lineTo(x, y + a); c.quadraticCurveTo(x, y, x + a, y); c.closePath();
  }

  const textures = {};
  function texture(id) {
    if (textures[id]) return textures[id];
    const D = ITEMS[id], c = document.createElement('canvas');
    c.width = Math.ceil(D.w * TEX); c.height = Math.ceil(D.h * TEX);
    const g = c.getContext('2d');
    D.draw(g, c.width, c.height);
    return (textures[id] = c);
  }

  /* ---------- breaking: Voronoi cells cut out of the texture ---------- */

  function clipHalf(poly, nx, ny, k) {       // keep the part where nx·x + ny·y ≤ k
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * ny - k, db = b[0] * nx + b[1] * ny - k;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }

  function shatter(id, power) {
    const tex = texture(id), D = ITEMS[id], M = MATTER[D.matter];
    const W = tex.width, H = tex.height, cx = W / 2, cy = H / 2;
    const n = Math.round(between(M.pieces[0], M.pieces[1]) * (0.8 + 0.3 * Math.min(power, 1.3)));
    const seeds = [], maxR = Math.hypot(W, H) / 2;
    for (let i = 0; i < n; i++) {
      if (i < n * 0.6) {
        const a = R() * Math.PI * 2, d = Math.pow(R(), 1.7) * maxR;
        seeds.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
      } else seeds.push([R() * W, R() * H]);
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      let cell = [[0, 0], [W, 0], [W, H], [0, H]];
      const [sx, sy] = seeds[i];
      for (let j = 0; j < n && cell.length; j++) {
        if (j === i) continue;
        const nx = seeds[j][0] - sx, ny = seeds[j][1] - sy;
        cell = clipHalf(cell, nx, ny, ((sx + seeds[j][0]) / 2) * nx + ((sy + seeds[j][1]) / 2) * ny);
      }
      if (cell.length >= 3) { const s = cut(tex, cell, M); if (s) out.push(s); }
    }
    return out;
  }

  function cut(tex, cell, M) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of cell) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    const w = Math.ceil(x1) - x0, h = Math.ceil(y1) - y0;
    if (w < 4 || h < 4) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.beginPath();
    cell.forEach(([x, y], i) => (i ? g.lineTo(x - x0, y - y0) : g.moveTo(x - x0, y - y0)));
    g.closePath();
    g.save(); g.clip(); g.drawImage(tex, -x0, -y0); g.restore();
    const data = g.getImageData(0, 0, w, h).data;
    let n = 0, sx = 0, sy = 0;
    for (let i = 3, p = 0; i < data.length; i += 4, p++) if (data[i] > 40) { n++; sx += p % w; sy += (p / w) | 0; }
    if (n < 40) return null;
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0,0,0,${(R() * 0.13).toFixed(3)})`; g.fillRect(0, 0, w, h);
    g.strokeStyle = M.edge; g.lineWidth = M.edgeW * TEX; g.lineJoin = 'round'; g.stroke();
    return { spr: c, cx: sx / n, cy: sy / n, ox: x0 + sx / n - tex.width / 2, oy: y0 + sy / n - tex.height / 2 };
  }

  /* ---------- sound ---------- */

  const Sound = {
    ac: null, out: null, buf: null, muted: false, lastTick: 0,
    unlock() {
      if (this.muted) return;
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ac = new AC(); } catch (e) { return; }
        const comp = this.ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 5;
        this.out = this.ac.createGain(); this.out.gain.value = 0.8;
        this.out.connect(comp); comp.connect(this.ac.destination);
        const n = this.ac.sampleRate;
        this.buf = this.ac.createBuffer(1, n, n);
        const d = this.buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    ok() { return this.ac && !this.muted && this.ac.state === 'running'; },
    env(t, gain, attack, dur, pan) {
      const ac = this.ac, g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (pan && ac.createStereoPanner) {
        const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
        g.connect(p); p.connect(this.out);
      } else g.connect(this.out);
      return g;
    },
    noise(t, dur, type, freq, q, gain, pan, freq2) {
      const ac = this.ac, src = ac.createBufferSource(), f = ac.createBiquadFilter();
      src.buffer = this.buf;
      f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
      src.connect(f); f.connect(this.env(t, gain, 0.002, dur, pan));
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },
    tone(t, freq, dur, gain, pan, type, freq2) {
      const o = this.ac.createOscillator();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + dur);
      o.connect(this.env(t, gain, 0.001, dur, pan)); o.start(t); o.stop(t + dur + 0.05);
    },
    ting(t, f, dur, gain, pan) {
      this.tone(t, f, dur, gain, pan);
      this.tone(t, f * 2.76, dur * 0.55, gain * 0.35, pan);
    },
    whoosh(power, T) {
      if (!this.ok()) return;
      this.noise(this.ac.currentTime, T + 0.08, 'bandpass', 450, 1.3, 0.06 + 0.08 * Math.min(power, 1.2), 0, 1900);
    },
    smash(matter, power, pan) {
      if (!this.ok()) return;
      const t = this.ac.currentTime + 0.004, p = clamp(power, 0.35, 1.3);
      const tings = (n, lo, hi, d0, d1, g0, g1, spread) => {
        for (let i = 0; i < n; i++) this.ting(t + Math.pow(R(), 2) * spread, between(lo, hi), between(d0, d1), between(g0, g1) * p, pan + between(-0.35, 0.35));
      };
      if (matter === 'porcelain') {
        this.tone(t, 160, 0.09, 0.5 * p, pan, 'sine', 60);
        this.noise(t, 0.17, 'bandpass', 2600, 0.7, 0.65 * p, pan);
        this.noise(t, 0.3, 'highpass', 6000, 0.5, 0.15 * p, pan);
        tings(10 + 6 * p | 0, 2200, 5600, 0.05, 0.17, 0.05, 0.13, 0.22);
      } else if (matter === 'ceramic') {
        this.tone(t, 120, 0.13, 0.65 * p, pan, 'sine', 50);
        this.noise(t, 0.2, 'bandpass', 1300, 0.9, 0.7 * p, pan);
        this.noise(t + 0.01, 0.12, 'bandpass', 3200, 1.2, 0.25 * p, pan);
        tings(6, 1500, 3200, 0.04, 0.12, 0.05, 0.1, 0.16);
      } else if (matter === 'glass') {
        this.tone(t, 240, 0.05, 0.25 * p, pan, 'sine', 120);
        this.noise(t, 0.32, 'highpass', 4800, 0.6, 0.38 * p, pan);
        tings(16 + 8 * p | 0, 3400, 8800, 0.1, 0.34, 0.035, 0.09, 0.3);
        this.ting(t + 0.02, 2950, 0.7, 0.05 * p, pan);
        this.ting(t + 0.05, 4420, 0.55, 0.04 * p, pan);
      } else {
        this.noise(t, 0.13, 'lowpass', 700, 0.8, 0.8 * p, pan);
        this.tone(t, 230, 0.16, 0.32 * p, pan, 'sine', 85);
      }
    },
    boing(v, pan) {
      if (!this.ok()) return;
      const t = this.ac.currentTime, f = 160 + 60 * Math.min(v, 4);
      this.tone(t, f, 0.2, Math.min(0.28, 0.07 * v), pan, 'sine', f * 0.55);
      this.noise(t, 0.06, 'lowpass', 500, 0.7, Math.min(0.3, 0.07 * v), pan);
    },
    clatter(matter, v, pan) {
      if (!this.ok()) return;
      const now = this.ac.currentTime;
      if (now - this.lastTick < 0.028) return;
      this.lastTick = now;
      const lo = matter === 'ceramic' ? 1500 : matter === 'glass' ? 3800 : 2500;
      this.ting(now, between(lo, lo * 1.9), 0.035 + 0.035 * R(), Math.min(0.07, 0.014 * v), pan);
    },
  };

  /* ---------- the game ---------- */

  let styled = false;
  function addStyle() {
    if (styled) return;
    styled = true;
    const s = document.createElement('style');
    s.textContent = `
:where(.smash){position:relative}
.smash{overflow:hidden;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.smash-stage{position:absolute;inset:0}
.smash-stage>canvas,.smash-props{position:absolute;inset:0;width:100%;height:100%}
.smash-stage>canvas{pointer-events:none}
.smash-props{pointer-events:none}
.smash-grab{position:absolute;touch-action:none;cursor:grab;border-radius:50%;z-index:5}
.smash-grab:active{cursor:grabbing}
.smash-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
    document.head.appendChild(s);
  }

  function mount(root, opts) {
    addStyle();
    const theme = opts.theme || {};
    const text = Object.assign({
      bullseye: 'Bullseye', ring: '×{m}', miss: 'Missed the target', soft: 'Too soft!',
      pieces: '{n} pieces', kmh: '{n} km/h', label: 'Mini game. Flick the object at the wall, or press Enter to throw.',
    }, opts.text);
    const money = opts.money || ((n) => '$' + n.toLocaleString('en-US'));
    const fill = (s, k, v) => s.replace('{' + k + '}', v);
    const list = opts.items || Object.keys(ITEMS).map((id) => ({ id, name: id }));

    root.classList.add('smash');
    root.tabIndex = 0;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', opts.label || text.label);
    const stage = el('div', 'smash-stage', root);
    const scene = el('canvas', 'smash-scene', stage);
    const props = el('div', 'smash-props', stage);
    const debris = el('canvas', 'smash-debris', stage);
    const fx = el('canvas', 'smash-fx', stage);
    const grab = el('div', 'smash-grab', root);
    const live = el('div', 'smash-live', root);
    live.setAttribute('aria-live', 'polite');
    const sc = scene.getContext('2d'), dc = debris.getContext('2d'), fc = fx.getContext('2d');

    function el(tag, cls, parent) { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e; }

    // view
    const v = { W: 300, H: 300, f: 300, hz: 0, base: 0, cx: 150, dpr: 1, s: 1, wallTop: 3, roomHalf: 2.1 };
    const P = (x, y, z) => { const s = v.f / Math.max(0.05, CAM_Z - z); return [v.cx + x * s, v.hz - (y - CAM_Y) * s, s]; };
    const onWall = (sx, sy) => { const s = v.f / CAM_Z; return [(sx - v.cx) / s, CAM_Y + (v.hz - sy) / s, 0]; };
    const atDepth = (sx, sy, d) => { const s = v.f / d; return [(sx - v.cx) / s, CAM_Y + (v.hz - sy) / s, CAM_Z - d]; };
    const onFloor = (sx, sy) => { const d = v.f * CAM_Y / Math.max(1, sy - v.hz); return [(sx - v.cx) * d / v.f, 0, CAM_Z - d]; };
    v.P = P; v.onWall = onWall; v.CAM_Z = CAM_Z; v.CAM_Y = CAM_Y; v.target = TARGET; v.rings = RINGS; v.seeded = seeded;

    // state
    let current = list[0].id, held = null, respawnAt = 0, samples = [], down = null, tap = null;
    const flying = [], shards = [], resting = [], parts = [], jellies = [], popups = [], decals = [], hits = [];
    let shake = 0, total = 0, raf = 0, last = 0, visible = true, alive = true;

    function layout() {
      const r = root.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      v.W = r.width; v.H = r.height; v.cx = v.W / 2;
      v.dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [scene, debris, fx]) { c.width = Math.round(v.W * v.dpr); c.height = Math.round(v.H * v.dpr); }
      v.base = v.H * (theme.floorFrac || 0.72);
      const minStage = theme.stage || 2.4;
      let f = v.W * CAM_Z / clamp(minStage * Math.max(1, (v.W / v.H) * 0.9), minStage, 5.4);
      const need = theme.need || 2.45, top = theme.top || 0;   // metres of wall that must show below a header of `top` px
      if ((v.base - top) * CAM_Z / f < need) f = (v.base - top) * CAM_Z / need;
      v.f = f; v.s = f / CAM_Z;
      v.hz = v.base - f * CAM_Y / CAM_Z;
      v.wallTop = CAM_Y + v.hz / v.s;
      v.roomHalf = Math.max(2.1, (v.W / 2) / v.s + 0.25);
      paintScene();
      rebake();
      if (held && !held.drag) placeHeld(held);
      if (opts.onLayout) opts.onLayout(v);
      wake();
    }

    function heldGeom(id) {
      const D = ITEMS[id], max = Math.max(D.w, D.h);
      const px = clamp(Math.min(v.W, v.H) * (theme.heldSize || 0.3), 84, 210) * (D.h > D.w * 1.4 ? 1.15 : 1);
      return { d: v.f * max / px, px, sx: v.W / 2 + (theme.heldX || 0) * v.W, sy: v.H - px * 0.56 - (theme.heldLift || 0) };
    }
    function placeHeld(h) {
      const g = heldGeom(h.id);
      h.x = g.sx; h.y = g.sy; h.px = g.px; h.d = g.d;
      const size = Math.max(72, g.px * 1.1);
      Object.assign(grab.style, { left: g.sx - size / 2 + 'px', top: g.sy - size / 2 + 'px', width: size + 'px', height: size + 'px', display: '' });
    }
    function spawnHeld() {
      held = { id: current, pop: 0, drag: false, t: 0 };
      placeHeld(held);
      wake();
    }

    /* scene: wall, floor, target, decals */
    function paintScene() {
      sc.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      sc.clearRect(0, 0, v.W, v.H);
      if (theme.paintRoom) theme.paintRoom(sc, v);
      if (theme.target !== false) (theme.paintTarget || paintTarget)(sc, v);
      for (const d of decals) paintDecal(sc, d);
      if (theme.paintOver) theme.paintOver(sc, v);
    }

    function paintTarget(g) {
      const t = theme.rings || {};
      const fills = t.fills || ['#1E44B8', '#F7F4EC', '#2F6BEA', '#E23B3B'];
      const [cx, cy, s] = P(TARGET.x, TARGET.y, 0);
      g.save();
      g.globalAlpha = t.alpha == null ? 0.92 : t.alpha;
      for (let i = RINGS.length - 1; i >= 0; i--) {
        g.fillStyle = fills[RINGS.length - 1 - i];
        g.beginPath(); g.arc(cx, cy, RINGS[i].r * s, 0, 7); g.fill();
        g.strokeStyle = t.line || 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1, s * 0.012); g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = t.label || '#FFD633';
      g.font = `900 ${Math.max(10, s * 0.075)}px ${t.font || FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('×1.5', cx, cy);
      g.fillStyle = t.labelSoft || 'rgba(255,255,255,.85)';
      g.font = `800 ${Math.max(8, s * 0.05)}px ${t.font || FONT}`;
      const labels = ['×1', '×0.75', '×0.5'];
      for (let i = 1; i < RINGS.length; i++) {
        const y = cy - (RINGS[i].r + RINGS[i - 1].r) / 2 * s;
        g.fillStyle = i === 2 ? (t.labelDark || 'rgba(10,26,79,.55)') : (t.labelSoft || 'rgba(255,255,255,.85)');
        g.fillText(labels[i - 1], cx, y);
      }
      g.restore();
    }

    function paintDecal(g, d) {
      const [sx, sy, s] = P(d.x, d.y, 0), r = seeded(d.seed), L = d.size * s;
      const C = theme.crack || {};
      g.save();
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (d.type === 'crack') {
        const rg = g.createRadialGradient(sx, sy, 0, sx, sy, L * 0.3);
        rg.addColorStop(0, C.dent || 'rgba(40,30,20,.28)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, L * 0.3, 0, 7); g.fill();
        const n = 5 + (r() * 3 | 0);
        const paths = [];
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
          let a = a0, x = sx + Math.cos(a) * L * 0.06, y = sy + Math.sin(a) * L * 0.06, walked = 0;
          const len = L * (0.3 + r() * 0.5), pts = [[x, y]];
          while (walked < len) {
            const step = L * (0.05 + r() * 0.07);
            a = a0 + clamp(a - a0 + (r() - 0.5) * 0.8, -0.5, 0.5);
            x += Math.cos(a) * step; y += Math.sin(a) * step; walked += step;
            pts.push([x, y]);
            if (r() < 0.12) {
              const b = a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), bl = L * (0.08 + r() * 0.15);
              paths.push([[x, y], [x + Math.cos(b) * bl * 0.5, y + Math.sin(b) * bl * 0.5 + (r() - 0.5) * 3], [x + Math.cos(b) * bl, y + Math.sin(b) * bl]]);
            }
          }
          paths.push(pts);
        }
        const line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
        g.strokeStyle = C.dark || 'rgba(40,28,18,.6)'; g.lineWidth = Math.max(1, L * 0.02);
        paths.forEach(line);
        g.translate(0.7, 0.9);
        g.strokeStyle = C.light || 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(0.6, L * 0.007);
        paths.forEach(line);
      } else if (d.type === 'wine') {
        g.fillStyle = 'rgba(112,10,32,.85)';
        g.beginPath(); g.ellipse(sx, sy, L * 0.12, L * 0.1, r() * 3, 0, 7); g.fill();
        for (let i = 0; i < 18; i++) {
          const a = r() * Math.PI * 2, dd = L * (0.1 + r() * 0.38), rr = L * (0.008 + r() * 0.04);
          g.beginPath(); g.arc(sx + Math.cos(a) * dd, sy + Math.sin(a) * dd * 0.9, rr, 0, 7); g.fill();
        }
        g.strokeStyle = 'rgba(112,10,32,.8)';
        for (let i = 0; i < 9; i++) {
          const a = r() * Math.PI * 2, d0 = L * 0.08, d1 = L * (0.2 + r() * 0.25);
          g.lineWidth = L * (0.008 + r() * 0.02);
          g.beginPath(); g.moveTo(sx + Math.cos(a) * d0, sy + Math.sin(a) * d0); g.lineTo(sx + Math.cos(a) * d1, sy + Math.sin(a) * d1); g.stroke();
        }
        for (let i = 0; i < 4; i++) {
          const x = sx + (r() - 0.5) * L * 0.2, y = sy + L * 0.05, len = L * (0.25 + r() * 0.7), w = L * (0.012 + r() * 0.014);
          g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y + len); g.stroke();
          g.beginPath(); g.arc(x, y + len, w * 0.9, 0, 7); g.fill();
        }
      } else if (d.type === 'jelly') {
        const [, y1] = P(d.x, d.y1, 0);
        g.strokeStyle = 'rgba(230,57,70,.26)'; g.lineWidth = d.w * s;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, y1); g.stroke();
        g.fillStyle = 'rgba(230,57,70,.3)';
        g.beginPath(); g.ellipse(sx, sy, d.w * s * 0.75, d.w * s * 0.55, 0, 0, 7); g.fill();
      }
      g.restore();
    }

    function addDecal(d) {
      d.seed = (Math.random() * 1e9) | 0;
      decals.push(d);
      if (decals.length > 70) { decals.splice(0, 10); paintScene(); } else paintDecal(sc, d);
    }

    /* debris that has come to rest is baked into its own canvas */
    function bake(p) {
      resting.push(p);
      if (resting.length > MAX_DEBRIS) { resting.splice(0, 40); rebake(); } else drawResting(dc, p);
    }
    function rebake() {
      dc.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      dc.clearRect(0, 0, v.W, v.H);
      for (const p of resting) drawResting(dc, p);
    }
    function drawResting(g, p) {
      if (p.jelly) { drawJelly(g, p); return; }
      const [sx, sy, s] = P(p.x, 0, p.z);
      g.fillStyle = theme.shadow || 'rgba(0,0,0,.16)';
      g.beginPath(); g.ellipse(sx + 1, sy + 1.5, p.sw * s * 0.45, p.sh * s * 0.16, 0, 0, 7); g.fill();
      drawShard(g, p);
    }
    function drawShard(g, p) {
      const [sx, sy, s0] = P(p.x, p.y, p.z), s = s0 * SHARD_SCALE;
      const w = p.spr.width / TEX * s, h = p.spr.height / TEX * s;
      if (sy - h > v.H || sy + h < 0) return;
      g.save();
      g.translate(sx, sy);
      g.scale(1, 1 - 0.5 * p.flat);
      g.rotate(p.a);
      g.drawImage(p.spr, -p.cx / TEX * s, -p.cy / TEX * s, w, h);
      g.restore();
    }

    /* throwing */
    function screenOfTarget() { return P(TARGET.x, TARGET.y, 0); }

    function launch(aimX, aimY, power) {
      if (!held || !alive) return;
      const id = held.id, D = ITEMS[id];
      const S = atDepth(held.x, held.y, held.d);
      let I, floor = false;
      if (aimY > v.base - 2) { I = onFloor(aimX, Math.max(aimY, v.base + 4)); I[1] = D.h / 2; I[2] = Math.min(I[2], S[2] - 0.5); floor = true; }
      else {
        I = onWall(aimX, Math.max(aimY, 2));
        I[0] = clamp(I[0], -v.roomHalf + 0.2, v.roomHalf - 0.2);
        I[1] = clamp(I[1], 0.12, v.wallTop + 0.4);
      }
      const T = clamp(0.47 - 0.16 * power, 0.27, 0.44);
      const o = {
        id, D, power, x: S[0], y: S[1], z: S[2],
        vx: (I[0] - S[0]) / T, vy: (I[1] - S[1]) / T + 0.5 * G * T, vz: (I[2] - S[2]) / T,
        a: 0, va: between(-8, 8) * (D.flip ? 0.4 : 1), flip: 0, vflip: D.flip ? between(13, 19) * (R() < 0.5 ? -1 : 1) : 0,
        trail: [], floor,
        kmh: Math.round(Math.hypot(I[0] - S[0], I[1] - S[1], I[2] - S[2]) / T * 3.6 * 1.7),
        pre: D.matter === 'jelly' ? null : shatter(id, power),
      };
      flying.push(o);
      held = null; grab.style.display = 'none';
      respawnAt = performance.now() + 480;
      Sound.whoosh(power, T);
      if (opts.onThrow) opts.onThrow({ id });
      wake();
    }

    function throwAtTarget(power) {
      if (!held) return;
      const [tx, ty, s] = screenOfTarget();
      launch(tx + between(-0.14, 0.14) * s, ty + between(-0.14, 0.14) * s, power);
    }

    function impact(o, where) {
      const D = o.D, M = MATTER[D.matter];
      const [sx, sy] = P(o.x, o.y, o.z);
      let mult = 0;
      if (where === 'wall') {
        const dist = Math.hypot(o.x - TARGET.x, o.y - TARGET.y);
        for (const r of RINGS) if (dist <= r.r) { mult = r.m; break; }
      }
      const pieces = o.pre ? o.pre.length : 1;
      const amount = mult ? Math.round(D.price * (1 + pieces * 0.15) * mult * (0.8 + 0.4 * Math.min(o.power, 1.2))) : 0;
      total += amount;
      const pan = clamp((sx - v.cx) / (v.W / 2), -1, 1) * 0.7;

      if (where === 'wall' && D.matter !== 'jelly') {
        addDecal({ type: 'crack', x: o.x, y: o.y, size: (0.26 + 0.24 * Math.min(o.power, 1.3)) * (D.matter === 'glass' ? 0.6 : 1) });
        if (D.splat === 'wine') addDecal({ type: 'wine', x: o.x, y: o.y, size: 0.5 });
      }
      if (o.pre) burst(o, where);
      else jelly(o, where);
      if (D.matter !== 'jelly') puff(o, M);
      Sound.smash(D.matter, o.power, pan);
      shake = reduceMotion ? 0 : 3 + 7 * Math.min(o.power, 1.2);

      let big, small;
      if (where === 'floor') { big = text.soft; small = ''; }
      else if (!mult) { big = text.miss; small = fill(text.kmh, 'n', o.kmh); }
      else {
        big = '+' + money(amount);
        small = (mult === 1.5 ? text.bullseye + ' ' : '') + fill(text.ring, 'm', String(mult).replace('.', text.decimal || '.')) + ' · ' + fill(text.kmh, 'n', o.kmh);
      }
      popups.push({ x: sx, y: sy, t: 0, big, small, good: amount > 0 });

      if (where === 'wall') for (const h of hits) {
        const rr = h.el.getBoundingClientRect(), rr0 = root.getBoundingClientRect();
        const x = sx + rr0.left, y = sy + rr0.top;
        if (x > rr.left - 12 && x < rr.right + 12 && y > rr.top - 12 && y < rr.bottom + 12) {
          h.cb({ power: o.power, dx: (x - (rr.left + rr.width / 2)) / rr.width, dy: (y - (rr.top + rr.height / 2)) / rr.height });
        }
      }
      const name = (list.find((i) => i.id === o.id) || {}).name || o.id;
      live.textContent = `${name}: ${big}${small ? ', ' + small : ''}`;
      if (opts.onImpact) opts.onImpact({ id: o.id, name, price: D.price, where, ring: mult, amount, total, pieces, kmh: o.kmh });
    }

    function burst(o, where) {
      const M = MATTER[o.D.matter];
      const spread = M.spread * (0.9 + 0.7 * Math.min(o.power, 1.3));
      const sq = o.D.flip ? 0.55 + 0.45 * Math.abs(Math.cos(o.flip)) : 1;
      const ca = Math.cos(o.a), sa = Math.sin(o.a);
      for (const p of o.pre) {
        const lx = p.ox / TEX, ly = (p.oy / TEX) * sq;
        const dx = lx * ca - ly * sa, dy = -(lx * sa + ly * ca);
        const len = Math.hypot(dx, dy) || 1, sp = between(0.3, 1.35) * spread;
        const s = Object.assign(p, {
          x: o.x + dx, y: o.y + dy, z: where === 'wall' ? 0.03 + R() * 0.05 : o.z,
          vx: (dx / len) * sp + o.vx * 0.06 + between(-0.3, 0.3),
          vy: (dy / len) * sp + between(0, 1.3) * spread * 0.6,
          vz: where === 'wall' ? between(0.25, 1.45) * spread : between(-0.8, 0.8) * spread,
          a: o.a, va: between(-16, 16), flat: 0, m: M, rest: 0,
        });
        if (where === 'floor') { s.y = Math.max(0.02, o.y * 0.5 + dy * 0.3); s.vy = between(1, 2.6) * spread * 0.7; s.vx *= 1.3; }
        shards.push(s);
      }
      if (M.glints) for (let i = 0; i < M.glints; i++) {
        parts.push({ glint: true, x: o.x + between(-0.05, 0.05), y: o.y + between(-0.08, 0.08), z: 0.05,
          vx: between(-2, 2) * spread, vy: between(-0.5, 2.2), vz: between(0.3, 2.2), life: between(1.6, 2.6), age: 0, r: between(0.004, 0.009) });
      }
    }

    function puff(o, M) {
      const n = reduceMotion ? 4 : 12;
      for (let i = 0; i < n; i++) {
        parts.push({ dust: M.dust, x: o.x + between(-0.06, 0.06), y: o.y + between(-0.06, 0.06), z: 0.05,
          vx: between(-1, 1), vy: between(-0.3, 1), vz: between(0.2, 0.9), life: between(0.4, 0.8), age: 0, r: between(0.02, 0.05) });
      }
      parts.push({ ring: true, x: o.x, y: o.y, z: 0.02, age: 0, life: 0.32 });
    }

    function jelly(o, where) {
      const j = { jelly: true, id: o.id, x: o.x, y: o.y, z: Math.max(0.04, o.z), vx: 0, vy: 0, vz: 0, a: o.a * 0.3,
        state: where === 'wall' ? 'stick' : 'fall', t: 0, y0: o.y, sq: 0.45, sqv: 0 };
      if (where === 'floor') { j.vy = 2.2; j.vz = 0.4; j.vx = o.vx * 0.1; }
      jellies.push(j);
    }

    /* simulation */
    function step(dt, now) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const o = flying[i];
        o.trail.push([o.x, o.y, o.z, o.a, o.flip]); if (o.trail.length > 4) o.trail.shift();
        o.vy -= G * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
        o.a += o.va * dt; o.flip += o.vflip * dt;
        if (o.z <= 0.03) { o.z = 0.03; flying.splice(i, 1); impact(o, 'wall'); }
        else if (o.y - o.D.h * 0.5 <= 0) { o.y = o.D.h * 0.5; flying.splice(i, 1); impact(o, 'floor'); }
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        const p = shards[i];
        p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.a += p.va * dt;
        if (p.z < 0.01) { p.z = 0.01; p.vz = Math.abs(p.vz) * 0.3; }
        if (p.z > CAM_Z - 0.4) { p.z = CAM_Z - 0.4; p.vz = -Math.abs(p.vz) * 0.3; }
        if (Math.abs(p.x) > v.roomHalf) { p.x = Math.sign(p.x) * v.roomHalf; p.vx *= -0.35; }
        if (p.y <= 0) {
          p.y = 0;
          if (p.vy < -1.1) {
            Sound.clatter(p.m === MATTER.ceramic ? 'ceramic' : p.m === MATTER.glass ? 'glass' : 'porcelain', -p.vy, clamp(p.x / 2, -0.8, 0.8));
            p.vy = -p.vy * p.m.bounce; p.vx *= 0.55; p.vz *= 0.55; p.va *= 0.45;
          } else {
            p.vy = 0;
            const k = Math.max(0, 1 - 3.6 * dt);
            p.vx *= k; p.vz *= k; p.va *= k;
          }
          p.flat = Math.min(1, p.flat + dt * 6);
          if (p.vy === 0 && Math.hypot(p.vx, p.vz) < 0.05) p.rest += dt;
          if (p.rest > 0.2 && p.flat >= 1) { shards.splice(i, 1); bake(p); }
        }
      }
      for (let i = jellies.length - 1; i >= 0; i--) {
        const j = jellies[i];
        j.t += dt;
        j.sqv += ((j.state === 'stick' ? 0.82 : 1) - j.sq) * 160 * dt - j.sqv * 9 * dt;
        j.sq += j.sqv * dt;
        if (j.state === 'stick') {
          if (j.t > 0.18) j.y -= (0.1 + 0.32 * (j.t - 0.18)) * dt;
          if (j.t > 1.1 || j.y < ITEMS.gummy.h * 0.5) {
            addDecal({ type: 'jelly', x: j.x, y: j.y0, y1: j.y, w: ITEMS.gummy.w * 0.6 });
            j.state = 'fall'; j.vz = 0.7; j.vy = 0;
          }
        } else if (j.state === 'fall') {
          j.vy -= G * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.z += j.vz * dt;
          if (j.z > CAM_Z - 0.5) { j.z = CAM_Z - 0.5; j.vz = -Math.abs(j.vz) * 0.4; }
          const h = ITEMS.gummy.h * 0.5;
          if (j.y <= h) {
            j.y = h;
            if (j.vy < -0.8) {
              Sound.boing(-j.vy, clamp(j.x / 2, -0.8, 0.8));
              j.vy = -j.vy * MATTER.jelly.bounce; j.vz *= 0.7; j.vx *= 0.7; j.sq = 0.55; j.sqv = 0;
            } else { j.vy = 0; j.vx *= 0.9; j.vz *= 0.9; if (Math.abs(j.sq - 1) < 0.02 && Math.abs(j.sqv) < 0.05) { j.state = 'rest'; jellies.splice(i, 1); j.flat = 0; bake(j); } }
          }
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age > p.life) { parts.splice(i, 1); continue; }
        if (p.ring) continue;
        if (p.dust) { p.vx *= 0.94; p.vy = p.vy * 0.94 - 0.4 * dt; p.vz *= 0.94; }
        else p.vy -= G * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.glint && p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; }
      }
      for (let i = popups.length - 1; i >= 0; i--) { popups[i].t += dt; if (popups[i].t > 1.5) popups.splice(i, 1); }
      shake = Math.max(0, shake - dt * 40);
      if (!held && now > respawnAt && respawnAt) { respawnAt = 0; spawnHeld(); }
      if (held) { held.t += dt; held.pop = Math.min(1, held.pop + dt * 5); }
    }

    /* drawing */
    function drawJelly(g, j) {
      const tex = texture('gummy'), D = ITEMS.gummy;
      const [sx, sy, s] = P(j.x, j.y, j.z);
      const sq = j.sq == null ? 1 : j.sq;
      if (j.state !== 'stick') {
        const [fx2, fy2, fs] = P(j.x, 0, j.z);
        g.fillStyle = theme.shadow || 'rgba(0,0,0,.16)';
        g.beginPath(); g.ellipse(fx2, fy2, D.w * fs * 0.5, D.w * fs * 0.14, 0, 0, 7); g.fill();
      }
      g.save();
      g.translate(sx, sy + (1 - sq) * D.h * s * 0.5 * (j.state === 'stick' ? 0 : 1));
      g.rotate(j.a);
      g.scale(1 + (1 - sq) * 0.9, sq);
      g.drawImage(tex, -D.w * s / 2, -D.h * s / 2, D.w * s, D.h * s);
      g.restore();
    }

    function drawObject(g, o, x, y, z, a, flip, alpha) {
      const tex = texture(o.id || o.D && o.id), D = ITEMS[o.id];
      const [sx, sy, s] = P(x, y, z);
      g.save();
      g.globalAlpha = alpha;
      g.translate(sx, sy); g.rotate(a);
      if (D.flip) g.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(flip)));
      g.drawImage(tex, -D.w * s / 2, -D.h * s / 2, D.w * s, D.h * s);
      g.restore();
    }

    function draw(now) {
      const g = fc;
      g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      g.clearRect(0, 0, v.W, v.H);
      stage.style.transform = shake > 0.2 ? `translate(${between(-shake, shake).toFixed(1)}px,${between(-shake, shake).toFixed(1)}px)` : '';

      for (const p of parts) {
        const [sx, sy, s] = P(p.x, p.y, p.z), k = p.age / p.life;
        if (p.ring) {
          g.strokeStyle = `rgba(255,255,255,${(0.75 * (1 - k)).toFixed(3)})`; g.lineWidth = 3 * (1 - k) + 0.5;
          g.beginPath(); g.arc(sx, sy, (0.05 + 0.35 * k) * s, 0, 7); g.stroke();
        } else if (p.dust) {
          g.fillStyle = `rgba(${p.dust},${(0.55 * (1 - k)).toFixed(3)})`;
          g.beginPath(); g.arc(sx, sy, p.r * s * (1 + k * 1.5), 0, 7); g.fill();
        } else {
          const fl = 0.55 + 0.45 * Math.sin(now / 40 + p.x * 90);
          g.fillStyle = `rgba(255,255,255,${(fl * Math.min(1, (1 - k) * 2)).toFixed(3)})`;
          const r = Math.max(1, p.r * s);
          g.fillRect(sx - r / 2, sy - r / 2, r, r);
        }
      }
      shards.sort((a, b) => a.z - b.z);
      for (const p of shards) drawShard(g, p);
      for (const j of jellies) drawJelly(g, j);
      for (const o of flying) {
        const [fx2, fy2, fs] = P(o.x, 0, o.z);
        g.fillStyle = theme.shadow || 'rgba(0,0,0,.16)';
        g.globalAlpha = clamp(1 - o.y / 2.6, 0.15, 1);
        g.beginPath(); g.ellipse(fx2, fy2, o.D.w * fs * 0.45, o.D.w * fs * 0.12, 0, 0, 7); g.fill();
        g.globalAlpha = 1;
        o.trail.forEach((t, i) => drawObject(g, o, t[0], t[1], t[2], t[3], t[4], 0.08 + i * 0.05));
        drawObject(g, o, o.x, o.y, o.z, o.a, o.flip, 1);
      }
      if (held) {
        const D = ITEMS[held.id], tex = texture(held.id);
        const bob = reduceMotion || held.drag ? 0 : Math.sin(held.t * 2.4) * 2.5;
        const pop = held.pop < 1 ? 0.55 + 0.45 * (1 - Math.pow(1 - held.pop, 3)) * (1 + 0.12 * Math.sin(held.pop * Math.PI)) : 1;
        const sc2 = (held.px / Math.max(D.w, D.h)) * pop * (held.drag ? 1.06 : 1);
        g.save();
        g.translate(held.x, held.y + bob + (1 - Math.min(1, held.pop * 1.4)) * 60);
        g.rotate(held.drag ? clamp((held.x - held.lx || 0) * 0.004, -0.25, 0.25) : 0);
        g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 18; g.shadowOffsetY = 10;
        g.drawImage(tex, -D.w * sc2 / 2, -D.h * sc2 / 2, D.w * sc2, D.h * sc2);
        g.restore();
        held.lx = held.x;
      }
      const pop = theme.popup || {};
      for (const p of popups) {
        const k = p.t / 1.5;
        const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const rise = 46 * (1 - Math.pow(1 - Math.min(1, k * 1.6), 3));
        const sz = clamp(v.W * 0.075, 22, 46) * (k < 0.1 ? 0.6 + 4 * k : 1);
        g.save();
        g.globalAlpha = clamp(a, 0, 1);
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        const x = clamp(p.x, v.W * 0.2, v.W * 0.8), y = Math.max(sz, p.y - 30 - rise);
        g.font = `${pop.weight || 900} ${p.good ? sz : sz * 0.6}px ${pop.font || FONT}`;
        g.lineWidth = (p.good ? sz : sz * 0.6) * 0.24; g.strokeStyle = pop.stroke || '#0A1A4F'; g.strokeText(p.big, x, y);
        g.fillStyle = p.good ? (pop.fill || '#FFD633') : (pop.soft || '#FFFFFF'); g.fillText(p.big, x, y);
        if (p.small) {
          g.font = `${pop.weight || 900} ${sz * 0.36}px ${pop.font || FONT}`;
          g.lineWidth = sz * 0.1; g.strokeText(p.small, x, y + sz * 0.62);
          g.fillStyle = pop.sub || '#FFFFFF'; g.fillText(p.small, x, y + sz * 0.62);
        }
        g.restore();
      }
    }

    function busy() {
      return flying.length || shards.length || jellies.length || parts.length || popups.length || shake > 0.2 ||
        respawnAt || (held && (held.drag || held.pop < 1 || !reduceMotion));
    }
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const dt = clamp((now - last) / 1000, 0, 0.05);   // a frame's timestamp can be earlier than the wake-up time
      last = Math.max(last, now);
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let i = 0; i < n; i++) step(dt / n, now);
      draw(now);
      if (busy()) raf = requestAnimationFrame(frame);
      else stage.style.transform = '';
    }
    function wake() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    /* input */
    const pos = (e) => { const r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    grab.addEventListener('pointerdown', (e) => {
      if (!held || held.drag) return;
      Sound.unlock();
      e.preventDefault();
      try { grab.setPointerCapture(e.pointerId); } catch (_) { /* old browsers */ }
      const p = pos(e);
      held.drag = true; held.offX = held.x - p.x; held.offY = held.y - p.y;
      down = { x: p.x, y: p.y, t: e.timeStamp };
      samples = [[p.x, p.y, e.timeStamp]];
      if (opts.onGrab) opts.onGrab();
      wake();
    });
    grab.addEventListener('pointermove', (e) => {
      if (!held || !held.drag) return;
      const p = pos(e);
      held.x = clamp(p.x + held.offX, 0, v.W); held.y = clamp(p.y + held.offY, v.H * 0.35, v.H);
      samples.push([p.x, p.y, e.timeStamp]);
      while (samples.length > 2 && e.timeStamp - samples[0][2] > 140) samples.shift();
    });
    grab.addEventListener('pointerup', (e) => {
      if (!held || !held.drag) return;
      Sound.unlock();
      held.drag = false;
      const p = pos(e), now = e.timeStamp;
      const recent = samples.filter((s) => now - s[2] < 100);
      const first = recent[0] || samples[0];
      const dt = Math.max(16, now - first[2]) / 1000;
      const vx = (p.x - first[0]) / dt, vy = (p.y - first[1]) / dt;
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      if (moved < 8 && now - down.t < 400) { placeHeld(held); throwAtTarget(0.8); return; }
      const scale = 640 / clamp(v.H, 420, 1000);
      const sp = Math.hypot(vx, vy) * scale;
      if (vy < -220 / scale) {
        const power = clamp((sp - 250) / 2000, 0.15, 1.4);
        const [tx, ty] = screenOfTarget();
        const dist = Math.hypot(tx - held.x, ty - held.y);
        const k = dist * (0.5 + 0.62 * Math.min(power, 1.2)) / (sp / scale);
        launch(held.x + vx * k, held.y + vy * k, power);
      } else placeHeld(held);
    });
    grab.addEventListener('pointercancel', () => { if (held) { held.drag = false; placeHeld(held); } });

    // a tap or click on the wall throws there
    root.addEventListener('pointerdown', (e) => {
      if (e.target === grab) return;
      tap = { x: e.clientX, y: e.clientY, t: e.timeStamp, ok: e.target === root || e.target.closest('.smash-stage') || e.target.hasAttribute('data-smash-wall') };
    });
    root.addEventListener('pointerup', (e) => {
      if (!tap || !tap.ok || e.target === grab) { tap = null; return; }
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
      const quick = e.timeStamp - tap.t < 450;
      tap = null;
      if (moved > 10 || !quick || !held || held.drag) return;
      Sound.unlock();
      const p = pos(e);
      if (p.y < held.y - held.px * 0.5) launch(p.x, p.y, 0.85);
    });
    root.addEventListener('keydown', (e) => {
      if (e.target !== root) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Sound.unlock(); throwAtTarget(0.85); }
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= list.length) api.select(list[k - 1].id);
    });

    const ro = new ResizeObserver(() => layout());
    ro.observe(root);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; if (visible) wake(); }).observe(root);
    }
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) wake(); });

    layout();
    spawnHeld();

    const api = {
      select(id) {
        if (!ITEMS[id]) return;
        current = id;
        if (held && !held.drag) { held.id = id; held.pop = 0; placeHeld(held); wake(); }
        if (opts.onSelect) opts.onSelect(id);
      },
      sweep() {
        resting.length = 0; shards.length = 0; jellies.length = 0; decals.length = 0; parts.length = 0;
        rebake(); paintScene(); wake();
      },
      setMuted(m) { Sound.muted = !!m; if (m && Sound.ac) Sound.ac.suspend(); else if (!m) Sound.unlock(); },
      get muted() { return Sound.muted; },
      get total() { return total; },
      icon(id, size) {
        const t = texture(id), c = document.createElement('canvas'), k = size / Math.max(t.width, t.height) * 0.86;
        c.width = c.height = size;
        c.getContext('2d').drawImage(t, (size - t.width * k) / 2, (size - t.height * k) / 2, t.width * k, t.height * k);
        return c.toDataURL('image/png');
      },
      onHit(elm, cb) { hits.push({ el: elm, cb }); },
      throwAt(power) { Sound.unlock(); throwAtTarget(power || 0.85); },
      relayout: layout,
      // Steps the simulation without animation frames, for automated checks of a hidden page.
      debugStep(frames) { let t = performance.now(); for (let i = 0; i < frames; i++) { t += 1000 / 60; for (let k = 0; k < 2; k++) step(1 / 120, t); } draw(t); },
      props,
      view: v,
    };
    instances.push(api);
    return api;
  }

  const instances = [];
  window.Smash = { mount, items: ITEMS, instances };
})();
