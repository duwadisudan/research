/* Motion layer: chapter layout, step rail, scroll progress, reveals, and the live scenes in the heroes and project cards.
   The scenes show the setup only (the cap layout, the talkers, the stimulus levels, pitch contours). None of them draws a result. */
(() => {
  const root = document.documentElement;
  const C = {}; const col = (n) => C[n] || (C[n] = Site.css(n));
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* ---- chapter layout: heading in a side column, content beside it ---- */
  document.querySelectorAll('.chapter > .wrap').forEach((wrap) => {
    const head = document.createElement('header'), body = document.createElement('div');
    head.className = 'ch-head'; body.className = 'ch-body';
    [...wrap.children].forEach((el) => ((el.matches('.step, h2') && !body.children.length) ? head : body).appendChild(el));
    wrap.classList.add('ch'); wrap.append(head, body);
  });

  /* ---- top bar height, for everything that sticks below it ---- */
  const bar = document.querySelector('.topbar');
  if (bar) { const set = () => root.style.setProperty('--bar-h', bar.offsetHeight + 'px'); set(); if (window.ResizeObserver) new ResizeObserver(set).observe(bar); }

  /* ---- step rail: the jump buttons leave the hero and stick under the top bar, tracking the chapter in view ---- */
  const steps = document.getElementById('cp-steps'); let spy = () => {};
  if (steps) {
    const rail = document.createElement('div'); rail.className = 'rail band';
    steps.closest('.hero').after(rail); steps.className = 'wrap rail-in'; rail.appendChild(steps);
    const btns = [...steps.querySelectorAll('[data-go]')];
    btns.forEach((b) => { const m = b.textContent.match(/^(\d+)\s+(.*)$/); if (m) b.innerHTML = `<i>${m[1]}</i><span>${m[2]}</span>`; });
    const secs = btns.map((b) => document.getElementById(b.dataset.go)); let cur = null;
    spy = () => { if (steps.offsetParent === null) return; let on = null;
      secs.forEach((el, i) => { if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) on = i; });
      if (on === cur) return; cur = on;
      btns.forEach((b, i) => b.setAttribute('aria-current', i === on));
      if (on !== null) steps.scrollTo({ left: btns[on].offsetLeft - steps.clientWidth / 2 + btns[on].offsetWidth / 2, behavior: Site.reduced() ? 'auto' : 'smooth' }); };
  }

  /* ---- reading progress ---- */
  const prog = document.createElement('div'); prog.className = 'progress'; prog.setAttribute('aria-hidden', 'true'); document.body.appendChild(prog);
  let queued = false;
  const onScroll = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false;
    const max = root.scrollHeight - window.innerHeight; prog.style.transform = `scaleX(${max > 40 ? clamp(window.scrollY / max) : 0})`; spy(); }); };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('hashchange', onScroll);

  /* ---- reveal on scroll, and count up the headline numbers once ---- */
  function countUp(el) {
    if (el.id || el.dataset.done) return; const m = el.textContent.trim().match(/^(\d+(?:\.\d+)?)(.*)$/); if (!m) return;
    el.dataset.done = '1'; const end = +m[1], dec = (m[1].split('.')[1] || '').length, t0 = performance.now();
    const step = (now) => { const p = clamp((now - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = (end * e).toFixed(dec) + m[2]; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  if (window.IntersectionObserver && !Site.reduced()) {
    root.classList.add('fx');
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target);
      e.target.querySelectorAll('.big').forEach(countUp);
    }), { rootMargin: '0px 0px -7% 0px' });
    document.querySelectorAll('.ch-head, .ch-body > *, .project').forEach((el) => { el.classList.add('rv'); io.observe(el); });
  }

  /* ---- scene runner: draws only while the canvas is on screen; one still frame under reduced motion ---- */
  function scene(canvas, draw) {
    const ctx = canvas.getContext('2d'), host = canvas.closest('.hero, .project') || canvas, ptr = { x: 0.5, y: 0.5, on: false };
    let raf = null, vis = false; const t0 = performance.now();
    function frame(now) {
      raf = null;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(r.width), h = Math.round(r.height);
      if (w < 2 || h < 2) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const facts = w > 900 ? host.querySelector('.facts') : null;          /* keep the scene clear of the facts panel */
      const hh = facts ? Math.max(120, facts.getBoundingClientRect().top - r.top - 12) : h;
      draw(ctx, w, h, Site.reduced() ? 5.2 : (now - t0) / 1000, ptr, hh);
      if (vis && !Site.reduced()) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    if (window.IntersectionObserver) new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) kick(); }).observe(canvas); else { vis = true; kick(); }
    host.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.x = (e.clientX - r.left) / r.width; ptr.y = (e.clientY - r.top) / r.height; ptr.on = true; });
    host.addEventListener('pointerleave', () => { ptr.on = false; });
    window.addEventListener('resize', () => { if (vis) kick(); });
    window.addEventListener('hashchange', () => setTimeout(kick, 80)); setTimeout(kick, 80);          /* first frame without waiting for the observer */
  }

  /* ---- scene 1: the real cap (56 sources, 144 detectors) with light travelling source to detector.
          With talkers: seen from behind the listener, two talkers at 30 degrees left and right, the pointer picks the attended side. ---- */
  function party(o) {
    const O = window.CP.optodes, CH = window.CP.channels, talk = o.talkers === '1', mini = o.mini === '1';
    const ph = Array.from({ length: mini ? 70 : 150 }, (_, i) => ({ c: (i * 53) % CH.length, p: (i * 0.618) % 1, v: 0.35 + ((i * 0.37) % 0.4) }));
    let side = -1, yaw = Math.PI, last = 0;
    return (ctx, w, h0, t, ptr, h) => {
      const dt = clamp(t - last, 0, 0.05); last = t;
      const wide = w > 900 && !mini, cx = wide ? w * 0.75 : w / 2, th = talk ? 0.55 : 0.3;
      const sc = talk ? Math.min(w * (wide ? 0.44 : 0.94) / 370, h / 300) : Math.min(w, h) / 240, cy = talk ? h * 0.64 : h * 0.54;
      if (talk) { const want = ptr.on ? (ptr.x < cx / w ? -1 : 1) : (Math.floor(t / 5) % 2 ? 1 : -1); side += (want - side) * (dt ? Math.min(1, dt * 5) : 1);
        const goal = Math.PI + 0.24 * Math.sin(t * 0.3) + (ptr.on ? (ptr.x - cx / w) * 0.5 : 0); yaw += (goal - yaw) * (dt ? Math.min(1, dt * 3) : 1); }
      else yaw = 2.2 + t * 0.25;
      const cs = Math.cos(yaw), sn = Math.sin(yaw), ct = Math.cos(th), st = Math.sin(th);
      const P3 = (x, y, z) => { const xr = x * cs + z * sn, zr = -x * sn + z * cs; return [cx - xr * sc, cy - (y * ct - zr * st) * sc, y * st + zr * ct]; };

      if (talk) {                                               /* the two talkers, 30 degrees either side, in front of the listener */
        const top = P3(0, 70, 30);
        [-1, 1].forEach((s) => {
          const [tx, ty] = P3(s * 125, 10, 205), att = clamp(s * side), hue = col(s < 0 ? '--hbr' : '--hbo');
          for (let k = 0; k < 4; k++) { const f = ((t * 0.32 + k / 4) % 1), r = (16 + f * 120) * sc;
            ctx.lineWidth = 1.2; ctx.strokeStyle = col('--masker'); ctx.globalAlpha = (1 - f) * 0.3 * (1 - att); ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.stroke();
            ctx.lineWidth = 2; ctx.strokeStyle = hue; ctx.globalAlpha = (1 - f) * 0.85 * att; ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.stroke(); }
          if (att > 0.02) { const g = ctx.createLinearGradient(top[0], top[1], tx, ty); g.addColorStop(0, 'transparent'); g.addColorStop(1, hue);
            ctx.globalAlpha = 0.5 * att; ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); }
          ctx.globalAlpha = 0.45 + 0.55 * att; ctx.fillStyle = att > 0.5 ? col('--ink') : col('--masker');
          ctx.beginPath(); ctx.arc(tx, ty - 9 * sc, 9 * sc, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.roundRect(tx - 14 * sc, ty + 2 * sc, 28 * sc, 18 * sc, 7 * sc); ctx.fill();
        });
      }

      const P = O.map(([, x, y, z]) => P3(x, y, z)), hc = P3(0, 20, 0);
      const halo = ctx.createRadialGradient(hc[0], hc[1], 10 * sc, hc[0], hc[1], 125 * sc);
      halo.addColorStop(0, 'rgba(255,255,255,0.07)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(hc[0], hc[1], 125 * sc, 0, 7); ctx.fill();

      ctx.lineCap = 'round'; ctx.lineWidth = 0.7; ctx.strokeStyle = col('--masker');
      CH.forEach(([s, d]) => { const a = P[s], b = P[d]; ctx.globalAlpha = (a[2] + b[2]) / 2 > 0 ? 0.26 : 0.06; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });

      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col('--mid');           /* light: source to detector, dipping toward the head */
      ph.forEach((q) => { q.p += dt * q.v; if (q.p > 1) { q.p = 0; q.c = (q.c * 7 + 131) % CH.length; }
        const [s, d] = CH[q.c], a = P[s], b = P[d], f = q.p, bow = Math.sin(Math.PI * f) * 0.07;
        const x = a[0] + (b[0] - a[0]) * f + (hc[0] - (a[0] + b[0]) / 2) * bow, y = a[1] + (b[1] - a[1]) * f + (hc[1] - (a[1] + b[1]) / 2) * bow;
        const front = (a[2] + b[2]) / 2 > 0, k = Math.sin(Math.PI * f);
        ctx.globalAlpha = (front ? 0.22 : 0.05) * k; ctx.beginPath(); ctx.arc(x, y, (mini ? 4.5 : 7), 0, 7); ctx.fill();
        ctx.globalAlpha = (front ? 0.95 : 0.2) * k; ctx.beginPath(); ctx.arc(x, y, (mini ? 1.4 : 2), 0, 7); ctx.fill(); });
      ctx.globalCompositeOperation = 'source-over';

      O.map((_, i) => i).sort((i, j) => P[i][2] - P[j][2]).forEach((i) => { const front = P[i][2] > 0, r = (front ? 3.1 : 2.2) * (mini ? 0.85 : wide ? 1.15 : 1);
        ctx.fillStyle = col(O[i][0] ? '--hbo' : '--hbr'); ctx.globalAlpha = front ? 1 : 0.25; ctx.beginPath(); ctx.arc(P[i][0], P[i][1], r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
    };
  }

  /* ---- scene 2: one target voice among two maskers, stepping through +5, 0 and -5 dB (the study's three levels) ---- */
  function waves(o) {
    const mini = o.mini === '1'; let tmr = 5, last = 0;
    const env = (u, a, b, c) => Math.abs(Math.sin(u * 1.7 + a)) * (0.5 + 0.5 * Math.sin(u * 0.37 + b)) * (0.6 + 0.4 * Math.sin(u * 5.1 + c));
    return (ctx, w, h0, t, ptr, h) => {
      const dt = clamp(t - last, 0, 0.05); last = t;
      const wide = w > 900 && !mini, x0 = wide ? w * 0.57 : 0, mid = h * (wide ? 0.5 : 0.52), A = h * (mini ? 0.3 : 0.26);
      const want = ptr.on && !mini ? [5, 0, -5][Math.min(2, Math.floor(clamp((ptr.x * w - x0) / (w - x0)) * 3))] : [5, 0, -5][Math.floor(t / 3.5) % 3];
      tmr += (want - tmr) * (dt ? Math.min(1, dt * 4) : 1);
      const gT = Math.pow(10, (tmr - 5) / 20), hue = col(want > 0 ? '--hbr' : want < 0 ? '--hbo' : '--mid');
      ctx.lineCap = 'round';
      for (let x = x0 + 4; x < w; x += 7) { const u = x / 46 + t * 1.5;
        const m = A * 0.5623 * (env(u, 0.3, 1.1, 2.0) + env(u * 1.13, 2.2, 0.4, 5.1)) + 2, tg = A * gT * env(u * 0.91, 4.0, 2.6, 0.7) + 1.5;
        ctx.globalAlpha = 0.55; ctx.strokeStyle = col('--masker'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, mid - m); ctx.lineTo(x, mid + m); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = hue; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, mid - tg); ctx.lineTo(x, mid + tg); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.font = `${mini ? 11 : 13}px ${col('--font-body')}`; ctx.textAlign = 'right'; ctx.fillStyle = hue;
      ctx.fillText(`target-to-masker ratio ${want > 0 ? '+5' : want < 0 ? '−5' : '0'} dB`, w - 16, mini ? h - 14 : Math.min(h - 14, mid + A + 34));
    };
  }

  /* ---- scene 3: one sentence, two deliveries, drawn as pitch tracks (line height is pitch, line weight is loudness) ---- */
  function contour(o) {
    const mini = o.mini === '1';
    const SY = [[1.0, 0.3, 0.6], [1.2, 0.8, 1.0], [0.8, 0.2, 0.4], [0.6, 0.0, 0.2], [1.2, 0.5, 0.8], [1.3, -0.6, 0.5], [1.0, 0.4, 0.6], [1.2, 0.6, 0.8], [1.3, 0.9, 1.0], [0.8, 0.3, 0.3], [1.0, 0.2, 0.7], [0.8, -0.2, 0.3], [1.3, -0.8, 0.4]];
    const layout = (pause) => { let x = 0; const out = SY.map(([len, tg, st], i) => { const s = { a: x, b: x + len * 0.86, tg, st, nx: SY[i + 1] ? SY[i + 1][1] : tg - 0.3 }; x += len; if (i === 5) x += pause; return s; }); return { seg: out, len: x }; };
    const A = layout(2.2), B = layout(0.2);
    return (ctx, w, h0, t, ptr, h) => {
      const wide = w > 900 && !mini, x0 = wide ? w * 0.56 : w * 0.07, x1 = w * 0.95, play = (t % 6) / 4.6;
      [[A, h * (mini ? 0.34 : 0.36), 1, 1, '--ir'], [B, h * (mini ? 0.72 : 0.72), 0.1, 0.72, '--hbr']].forEach(([L, y0, range, span, tone], row) => {
        const X = (u) => x0 + u / L.len * (x1 - x0) * span, amp = h * (mini ? 0.17 : 0.16);
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col('--rule'); ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = (row === 0 ? 5 : 4) * (mini ? 0.8 : 1);
        const path = () => { ctx.beginPath(); [L.seg.slice(0, 6), L.seg.slice(6)].forEach((phrase) => {
          const pts = phrase.map((s) => [X((s.a + s.b) / 2), y0 - s.tg * range * amp]);
          pts.unshift([X(phrase[0].a), pts[0][1] + 0.25 * range * amp]); pts.push([X(phrase[phrase.length - 1].b), pts[pts.length - 1][1] + 0.3 * range * amp]);
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
          ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); }); };
        ctx.globalAlpha = 0.45; ctx.strokeStyle = col('--masker'); path(); ctx.stroke();
        const xp = X(Math.min(1, play) * L.len);
        let stroke = col(tone); if (row === 0) { stroke = ctx.createLinearGradient(x0, 0, x1, 0); stroke.addColorStop(0, col('--ir-a')); stroke.addColorStop(1, col('--ir-b')); }
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xp, h); ctx.clip(); ctx.globalAlpha = 1; ctx.strokeStyle = stroke; path(); ctx.stroke(); ctx.restore();
        if (play < 1) { ctx.globalAlpha = 1; ctx.fillStyle = col('--ink'); const half = amp * (row === 0 ? 1 : 0.5); ctx.fillRect(xp - 0.75, y0 - half, 1.5, half * 2); }
        ctx.globalAlpha = 1; ctx.fillStyle = col('--muted'); ctx.font = `${mini ? 11 : 12}px ${col('--font-body')}`; ctx.textAlign = 'left';
        ctx.fillText(row === 0 ? 'delivery A: slow, wide pitch, a pause' : 'delivery B: fast, flat, no pause', x0, y0 + amp + (mini ? 16 : 20));
      });
    };
  }

  const SCENES = { party, waves, contour };
  document.querySelectorAll('canvas[data-scene]').forEach((c) => { const make = SCENES[c.dataset.scene]; if (make) scene(c, make(c.dataset)); });
})();
