/* Home page: the mini game inside the phone, its tray and HUD, the damage-bill receipt, and the hero cracks.
   Words for both languages are at the top; the page's <html lang> picks them. */
(function () {
  'use strict';

  const de = document.documentElement.lang === 'de';
  const T = de ? {
    items: { plate: 'Essteller', mug: 'Kaffeebecher', glass: 'Weinglas', gummy: 'Riesen-Gummibär' },
    money: (n) => n.toLocaleString('de-DE') + ' $',
    cents: (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $',
    game: { bullseye: 'Volltreffer', ring: '×{m}', miss: 'Daneben', soft: 'Zu schwach!', kmh: '{n} km/h', decimal: ',',
      label: 'Minispiel. Wisch den Gegenstand an die Wand oder drück die Eingabetaste zum Werfen. Mit 1 bis 4 wählst du, was du wirfst.' },
    bonus: 'Volltreffer ×1,5', incl: 'inkl.', missed: 'daneben', soft: 'zu schwach',
    soundOn: 'Ton an', soundOff: 'Ton aus',
  } : {
    items: { plate: 'Dinner Plate', mug: 'Coffee Mug', glass: 'Wine Glass', gummy: 'Giant Gummy Bear' },
    money: (n) => '$' + n.toLocaleString('en-US'),
    cents: (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    game: { label: 'Mini game. Flick the object at the wall, or press Enter to throw. Keys 1 to 4 pick what to throw.' },
    bonus: 'Bullseye ×1.5', incl: 'incl.', missed: 'missed', soft: 'too soft',
    soundOn: 'Sound on', soundOff: 'Sound off',
  };

  /* the room: the app's Greek-key kitchen */
  function greekKey(g, x0, x1, y, h, color, bg) {
    g.fillStyle = bg; g.fillRect(x0, y, x1 - x0, h);
    g.strokeStyle = color; g.lineWidth = Math.max(1, h * 0.09); g.lineCap = 'square';
    const u = h * 0.78, pad = (h - u) / 2;
    g.beginPath(); g.moveTo(x0, y + pad * 0.5); g.lineTo(x1, y + pad * 0.5); g.moveTo(x0, y + h - pad * 0.5); g.lineTo(x1, y + h - pad * 0.5); g.stroke();
    for (let x = x0 - (x0 % u); x < x1; x += u) {
      const t = y + pad;
      g.beginPath();
      g.moveTo(x + 0.1 * u, t + u); g.lineTo(x + 0.1 * u, t + 0.15 * u); g.lineTo(x + 0.88 * u, t + 0.15 * u);
      g.lineTo(x + 0.88 * u, t + 0.72 * u); g.lineTo(x + 0.36 * u, t + 0.72 * u); g.lineTo(x + 0.36 * u, t + 0.42 * u); g.lineTo(x + 0.62 * u, t + 0.42 * u);
      g.stroke();
    }
  }

  const theme = {
    floorFrac: 0.7,
    heldSize: 0.27,
    heldLift: 92,
    shadow: 'rgba(60,40,20,.2)',
    crack: { dark: 'rgba(70,50,30,.62)', light: 'rgba(255,255,255,.6)', dent: 'rgba(90,70,40,.3)' },
    popup: { stroke: '#0A1A4F', fill: '#FFD633', sub: '#FFFFFF' },
    paintRoom(g, v) {
      const { W, H, base, s, P } = v;
      const wall = g.createLinearGradient(0, 0, 0, base);
      wall.addColorStop(0, '#E6DCC8'); wall.addColorStop(0.5, '#F2EBDD'); wall.addColorStop(1, '#F4EEE2');
      g.fillStyle = wall; g.fillRect(0, 0, W, base);
      const step = 0.16 * s;
      g.fillStyle = 'rgba(150,120,80,.12)';
      for (let y = base - step * 0.5, row = 0; y > -step; y -= step, row++) {
        for (let x = (row % 2 ? step / 2 : 0) + ((W / 2) % step); x < W + step; x += step) {
          g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.fill();
        }
      }
      const [, yTop] = P(0, 2.42, 0), [, yBot] = P(0, 2.24, 0);
      greekKey(g, 0, W, yTop, yBot - yTop, '#1F4E9C', '#F8F5EE');
      // a little landscape picture
      const [px0, py0] = P(-1.08, 2.02, 0), [px1, py1] = P(-0.7, 1.72, 0);
      g.fillStyle = '#B98A4E'; g.fillRect(px0 - 6, py0 - 6, px1 - px0 + 12, py1 - py0 + 12);
      const sky = g.createLinearGradient(0, py0, 0, py1); sky.addColorStop(0, '#9FD3F2'); sky.addColorStop(1, '#F6D8A8');
      g.fillStyle = sky; g.fillRect(px0, py0, px1 - px0, py1 - py0);
      g.fillStyle = '#F2A33A'; g.beginPath(); g.arc(px0 + (px1 - px0) * 0.7, py0 + (py1 - py0) * 0.42, (py1 - py0) * 0.14, 0, 7); g.fill();
      g.fillStyle = '#5E9E5A'; g.beginPath(); g.moveTo(px0, py1); g.quadraticCurveTo(px0 + (px1 - px0) * 0.35, py0 + (py1 - py0) * 0.45, px1, py1 - (py1 - py0) * 0.25); g.lineTo(px1, py1); g.fill();
      // the clock, at 9:41 of course
      const [cx, cy, cs] = P(0.92, 1.98, 0), r = 0.15 * cs;
      g.fillStyle = '#2B2B33'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx, cy, r * 0.84, 0, 7); g.fill();
      g.strokeStyle = '#2B2B33'; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2; g.lineWidth = i % 3 ? 1 : 2;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66); g.lineTo(cx + Math.cos(a) * r * 0.76, cy + Math.sin(a) * r * 0.76); g.stroke();
      }
      const hour = (9 + 41 / 60) / 12 * Math.PI * 2 - Math.PI / 2, minute = 41 / 60 * Math.PI * 2 - Math.PI / 2;
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(hour) * r * 0.45, cy + Math.sin(hour) * r * 0.45); g.stroke();
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(minute) * r * 0.62, cy + Math.sin(minute) * r * 0.62); g.stroke();
      // skirting board and the checkered floor
      const [, sk] = P(0, 0.11, 0);
      g.fillStyle = '#FBF8F2'; g.fillRect(0, sk, W, base - sk);
      g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, sk, W, 1.5);
      g.save(); g.beginPath(); g.rect(0, base, W, H - base); g.clip();
      g.fillStyle = '#E9DEC8'; g.fillRect(0, base, W, H - base);
      const t = 0.36;
      for (let z = 0, i = 0; z < v.CAM_Z - 0.2; z += t, i++) {
        for (let x = -21 * t, j = 0; x < 21 * t; x += t, j++) {
          if ((i + j) % 2) continue;
          const a = P(x, 0, z), b = P(x + t, 0, z), c = P(x + t, 0, z + t), d = P(x, 0, z + t);
          g.fillStyle = '#FAF6EC';
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.fill();
        }
      }
      const ao = g.createLinearGradient(0, base, 0, base + 28); ao.addColorStop(0, 'rgba(60,40,20,.22)'); ao.addColorStop(1, 'rgba(60,40,20,0)');
      g.fillStyle = ao; g.fillRect(0, base, W, 28);
      g.restore();
    },
  };

  const items = ['plate', 'mug', 'glass', 'gummy'].map((id) => ({ id, name: T.items[id] }));
  const bill = document.getElementById('bill'), count = document.getElementById('count'), hint = document.getElementById('hint');
  const lines = document.getElementById('lines'), total = document.getElementById('total');
  let thrown = 0;

  function line(text, amount, cls) {
    const empty = lines.querySelector('.r-empty');
    if (empty) empty.remove();
    const li = document.createElement('li');
    li.className = 'new' + (cls ? ' ' + cls : '');
    const a = document.createElement('span'), b = document.createElement('b');
    a.textContent = text; b.textContent = amount;
    li.append(a, b);
    lines.appendChild(li);
    while (lines.children.length > 7) lines.firstChild.remove();
  }

  const game = Smash.mount(document.getElementById('game'), {
    theme, items, text: T.game, money: T.money,
    onThrow() { thrown++; count.textContent = thrown.toLocaleString(de ? 'de-DE' : 'en-US'); hint.classList.add('gone'); },
    onImpact(e) {
      bill.textContent = T.money(e.total);
      total.textContent = T.cents(e.total);
      const name = e.name.toLocaleUpperCase(de ? 'de-DE' : 'en-US');
      if (e.amount) {
        line(`1× ${name}`, T.cents(e.amount));
        if (e.ring === 1.5) line(T.bonus, T.incl, 'bonus');
      } else line(`1× ${name} (${e.where === 'floor' ? T.soft : T.missed})`, T.cents(0));
    },
    onSelect(id) { tray.querySelectorAll('.slot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); },
  });

  const tray = document.getElementById('tray');
  items.forEach((it, i) => {
    const price = Smash.items[it.id].price;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot'; b.dataset.id = it.id; b.setAttribute('aria-pressed', String(i === 0));
    b.setAttribute('aria-label', `${it.name}, ${T.money(price)}`);
    b.innerHTML = `<img alt="" width="40" height="40" src="${game.icon(it.id, 96)}"><span class="stars" aria-hidden="true">★★★</span>`;
    b.appendChild(document.createTextNode(T.money(price)));
    b.addEventListener('click', () => game.select(it.id));
    tray.appendChild(b);
  });

  const mute = document.getElementById('mute');
  mute.addEventListener('click', () => {
    const m = !game.muted;
    game.setMuted(m);
    mute.setAttribute('aria-pressed', String(m));
    mute.setAttribute('aria-label', m ? T.soundOff : T.soundOn);
  });

  // big cracks across the hero, spreading from behind the phone
  const svg = document.querySelector('.cracks'), phone = document.querySelector('.phone');
  function cracks() {
    const r = svg.getBoundingClientRect(), ph = phone.getBoundingClientRect();
    const cx = ph.left - r.left + ph.width * 0.5, cy = ph.top - r.top + ph.height * 0.36;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let d = '';
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      let a = a0, x = cx + Math.cos(a) * 40, y = cy + Math.sin(a) * 40;
      d += `M${x.toFixed(0)} ${y.toFixed(0)}`;
      for (let w = 0, len = 380 + rnd() * 700; w < len;) {
        const st = 26 + rnd() * 40;
        a = a0 + Math.max(-0.35, Math.min(0.35, a - a0 + (rnd() - 0.5) * 0.7));
        x += Math.cos(a) * st; y += Math.sin(a) * st; w += st;
        d += `L${x.toFixed(0)} ${y.toFixed(0)}`;
      }
    }
    svg.setAttribute('viewBox', `0 0 ${r.width.toFixed(0)} ${r.height.toFixed(0)}`);
    svg.innerHTML = `<path d="${d}" fill="none" stroke="#071447" stroke-opacity=".45" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.6" transform="translate(1.5 2)" stroke-linejoin="round"/>`;
  }
  cracks();
  new ResizeObserver(cracks).observe(document.querySelector('.hero'));
})();
