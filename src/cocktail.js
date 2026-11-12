/* Cocktail party page. Every chart draws published numbers from window.CP (src/data/cocktail_data.js);
   the trial game, light simulation, blood-response model, cleaning demo and decoder game are illustrations and say so on the page. */
(() => {
  const CP = window.CP; if (!CP) return;
  const $ = (id) => document.getElementById(id);
  const col = (n) => Site.css(n);
  const narrow = (c) => c.parentElement.clientWidth < 520;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function visible(el, on, off) {
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? on() : off && off())), { threshold: 0.15 }).observe(el);
  }
  /* axes with left and bottom spines only; returns pixel mappers */
  function axes(canvas, ratio, o) {
    const { ctx, w, h } = Site.fit(canvas, ratio);
    const L = o.left ?? 46, R = o.right ?? 10, T = o.top ?? 10, B = o.bottom ?? 40;
    const X = (v) => L + (v - o.x[0]) / (o.x[1] - o.x[0]) * (w - L - R), Y = (v) => h - B - (v - o.y[0]) / (o.y[1] - o.y[0]) * (h - B - T);
    ctx.clearRect(0, 0, w, h);
    if (o.band) { ctx.fillStyle = col('--sunk'); ctx.fillRect(L, Y(o.band[1]), w - L - R, Y(o.band[0]) - Y(o.band[1])); }
    ctx.strokeStyle = col('--ink'); ctx.fillStyle = col('--ink'); ctx.lineWidth = 1.2; ctx.font = `12px ${col('--font-body')}`;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, h - B); ctx.lineTo(w - R, h - B); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    (o.yt || []).forEach((v) => { ctx.beginPath(); ctx.moveTo(L - 5, Y(v)); ctx.lineTo(L, Y(v)); ctx.stroke(); ctx.fillText(v, L - 8, Y(v)); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    (o.xt || []).forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), h - B); ctx.lineTo(X(v), h - B + 5); ctx.stroke(); ctx.fillText(o.xfmt ? o.xfmt(v) : v, X(v), h - B + 8); });
    if (o.xl) ctx.fillText(o.xl, (L + w - R) / 2, h - 15);
    if (o.yl) { ctx.save(); ctx.translate(12, (T + h - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(o.yl, 0, 0); ctx.restore(); }
    return { ctx, X, Y, w, h, L, R, T, B };
  }
  const vline = (p, x, color, y0, y1) => { p.ctx.save(); p.ctx.strokeStyle = color; p.ctx.lineWidth = 1.6; p.ctx.setLineDash([5, 4]); p.ctx.beginPath(); p.ctx.moveTo(p.X(x), p.Y(y1)); p.ctx.lineTo(p.X(x), p.Y(y0)); p.ctx.stroke(); p.ctx.restore(); };
  function line(p, xs, ys, color, width = 2.2) { const c = p.ctx; c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.beginPath(); xs.forEach((x, i) => (i ? c.lineTo(p.X(x), p.Y(ys[i])) : c.moveTo(p.X(x), p.Y(ys[i])))); c.stroke(); }
  function ribbon(p, xs, lo, hi, color) { const c = p.ctx; c.save(); c.globalAlpha = 0.2; c.fillStyle = color; c.beginPath(); xs.forEach((x, i) => (i ? c.lineTo(p.X(x), p.Y(hi[i])) : c.moveTo(p.X(x), p.Y(hi[i])))); for (let i = xs.length - 1; i >= 0; i--) c.lineTo(p.X(xs[i]), p.Y(lo[i])); c.closePath(); c.fill(); c.restore(); }

  /* ---------- ear filters shared by the trial game and the direction demo ---------- */
  const irCache = {};
  function earFilter(az) {                       /* stereo impulse response at the context's sample rate */
    const ctx = Site.audio(), key = az + '@' + ctx.sampleRate; if (irCache[key]) return irCache[key];
    const i = CP.hrir.az.indexOf(az), ratio = ctx.sampleRate / CP.hrir.fs, n = Math.round(200 * ratio);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    [CP.hrir.L[i], CP.hrir.R[i]].forEach((h, ch) => { const d = buf.getChannelData(ch);
      for (let k = 0; k < n; k++) { const x = k / ratio, a = Math.floor(x), f = x - a; d[k] = ((h[a] || 0) * (1 - f) + (h[a + 1] || 0) * f) / ratio; } });
    return (irCache[key] = buf);
  }
  function placed(az, gain) {                    /* a node: whatever is connected to it is heard from direction az */
    const ctx = Site.audio(), cv = ctx.createConvolver(), g = ctx.createGain();
    cv.normalize = false; cv.buffer = earFilter(az); g.gain.value = gain; cv.connect(g).connect(ctx.destination); return cv;
  }
  function noise(dest, t0, dur) {
    const ctx = Site.audio(), b = ctx.createBuffer(1, Math.round(dur * ctx.sampleRate), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, i / 400, (d.length - i) / 400);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(dest); Site.track(s).start(t0);
  }
  function hum(dest, t0, base, semis, noteDur, formant) {     /* a wordless voice: one pitch per note */
    const ctx = Site.audio(), osc = ctx.createOscillator(), env = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g2 = ctx.createGain();
    osc.type = 'sawtooth'; env.gain.value = 0; f1.type = f2.type = 'bandpass'; f1.frequency.value = formant[0]; f2.frequency.value = formant[1]; f1.Q.value = 4; f2.Q.value = 6; g2.gain.value = 0.5;
    osc.connect(env); env.connect(f1).connect(dest); env.connect(f2).connect(g2).connect(dest);
    semis.forEach((s, i) => { const a = t0 + i * noteDur, f = base * Math.pow(2, s / 12);
      osc.frequency.setValueAtTime(f, a); env.gain.setValueAtTime(0, a); env.gain.linearRampToValueAtTime(1, a + 0.04);
      env.gain.setValueAtTime(1, a + noteDur - 0.09); env.gain.linearRampToValueAtTime(0, a + noteDur - 0.02); });
    Site.track(osc).start(t0); osc.stop(t0 + semis.length * noteDur + 0.05);
  }

  /* ---------- step 2: one trial ---------- */
  function initGame() {
    const POOL = [[0, 2, 4, 5, 7, 9], [9, 7, 5, 4, 2, 0], [0, 4, 7, 7, 4, 0], [7, 4, 0, 0, 4, 7], [0, 7, 0, 7, 0, 7], [0, 0, 5, 5, 9, 9], [9, 9, 4, 4, 0, 0]];
    const status = $('cp-game-status'), q = $('cp-game-q'), opts = $('cp-game-opts'), start = $('cp-game-start'), cross = $('cp-cross');
    let answered = 0, correct = 0, timers = [];
    window.addEventListener('hashchange', () => { if (!start.disabled) return; timers.forEach(clearTimeout); timers = []; q.hidden = true; lit(false); moveCross('C'); start.disabled = false;
      status.textContent = 'You will hear a noise burst from one side, then two voices at once. Follow the voice on the side the noise came from.'; });
    const spark = (s) => `<svg viewBox="0 0 120 60" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" points="${s.map((v, i) => `${8 + i * 20.8},${52 - v * 4.6} ${8 + (i + 0.8) * 20.8},${52 - v * 4.6}`).join(' ')}"/></svg>`;
    const moveCross = (where) => cross.setAttribute('transform', `translate(${where === 'L' ? -185 : where === 'R' ? 185 : 0},0)`);
    const lit = (on) => ['cp-scr-l', 'cp-scr-r'].forEach((id) => { $(id).style.opacity = on ? 1 : 0.45; });
    lit(false);
    start.addEventListener('click', () => {
      timers.forEach(clearTimeout); timers = []; Site.stopAudio(); q.hidden = true; start.disabled = true;
      let ctx; try { ctx = Site.audio(); } catch (e) { status.textContent = 'The audio could not start in this browser.'; start.disabled = false; return; }
      const side = Math.random() < 0.5 ? 'L' : 'R', pick = POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      const lowOnLeft = Math.random() < 0.5, t0 = ctx.currentTime + 0.15;
      const left = placed(-30, 0.5), right = placed(30, 0.5), cue = placed(side === 'L' ? -30 : 30, 0.085);
      noise(cue, t0, 2);
      const target = pick[0], masker = pick[1];
      hum(left, t0 + 2, lowOnLeft ? 110 : 185, side === 'L' ? target : masker, 0.5, lowOnLeft ? [600, 1000] : [750, 1500]);
      hum(right, t0 + 2, lowOnLeft ? 185 : 110, side === 'R' ? target : masker, 0.5, lowOnLeft ? [750, 1500] : [600, 1000]);
      moveCross(side); lit(false); status.textContent = `Cue: a noise burst and a crosshair on the ${side === 'L' ? 'left' : 'right'}. That is the side to follow.`;
      timers.push(setTimeout(() => { lit(true); status.textContent = 'Two voices at once. Stay with the one on the cued side.'; }, 2150));
      timers.push(setTimeout(() => {
        lit(false); moveCross('C'); status.textContent = 'Now answer.'; q.hidden = false;
        const order = [[target, 'target'], [masker, 'masker'], [pick[2], 'foil']].sort(() => Math.random() - 0.5);
        opts.innerHTML = order.map(([s, kind], i) => `<button type="button" data-kind="${kind}" aria-label="Pattern ${i + 1}">${spark(s)}</button>`).join('');
        opts.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
          if (opts.dataset.done === '1') return; opts.dataset.done = '1';
          const k = b.dataset.kind; answered++; if (k === 'target') correct++;
          opts.querySelectorAll('button').forEach((x) => { if (x.dataset.kind === 'target') x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
          status.textContent = k === 'target' ? 'Correct. That was the voice on your side.' : k === 'masker'
            ? 'That was the other voice. You followed the wrong side, which is the mistake the three choices are designed to catch.' : 'Neither voice hummed that one.';
          $('cp-game-score').textContent = `Trials answered: ${answered}, correct: ${correct}`;
          start.disabled = false; start.textContent = 'Next trial';
        }));
        opts.dataset.done = '0';
      }, 5300));
    });
  }

  /* ---------- step 3: direction from two ears ---------- */
  function initHrtf() {
    const s = $('cp-hrtf-az'); let played = false;
    function stats(i) {
      const L = CP.hrir.L[i], R = CP.hrir.R[i]; let best = -1e9, lag = 0;
      for (let k = -45; k <= 45; k++) { let c = 0; for (let n = 0; n < 200; n++) { const m = n + k; if (m >= 0 && m < 200) c += L[n] * R[m]; } if (c > best) { best = c; lag = k; } }
      const e = (h) => h.reduce((a, v) => a + v * v, 0);
      return { us: lag / CP.hrir.fs * 1e6, db: 10 * Math.log10(e(L) / e(R)) };
    }
    function draw() {
      const az = +s.value, i = CP.hrir.az.indexOf(az), a = az * Math.PI / 180;
      const x = 150 + 110 * Math.sin(a), y = 160 - 110 * Math.cos(a);
      $('cp-hrtf-src').setAttribute('cx', x); $('cp-hrtf-src').setAttribute('cy', y); $('cp-hrtf-ray').setAttribute('x2', x); $('cp-hrtf-ray').setAttribute('y2', y);
      $('cp-hrtf-azout').textContent = (az > 0 ? '+' : az < 0 ? '−' : '') + Math.abs(az) + '°' + (az < 0 ? ' (left)' : az > 0 ? ' (right)' : ' (straight ahead)');
      const c = $('cp-hrtf-canvas'), ms = Array.from({ length: 140 }, (_, n) => n / CP.hrir.fs * 1000);
      const p = axes(c, narrow(c) ? 0.62 : 0.5, { x: [0, 3.2], y: [-1.6, 1.6], xt: [0, 1, 2, 3], yt: [], xl: 'Time (ms)', left: 14 });
      line(p, ms, CP.hrir.L[i].slice(0, 140), col('--whole')); line(p, ms, CP.hrir.R[i].slice(0, 140), col('--attR'));
      const st = stats(i), first = Math.abs(st.us) < 40 ? 'both ears at nearly the same time' : `the ${st.us > 0 ? 'left' : 'right'} ear ${Math.abs(st.us).toFixed(0)} microseconds sooner`;
      $('cp-hrtf-out').innerHTML = `Reaches ${first}.<br>Level difference between the ears: ${Math.abs(st.db).toFixed(1)} dB${Math.abs(st.db) < 1.5 ? ', about equal' : st.db > 0 ? ', louder on the left' : ', louder on the right'}.`;
    }
    function play() {
      let ctx; try { ctx = Site.audio(); } catch (e) { return; }
      Site.stopAudio(); played = true; const node = placed(+s.value, 0.09), t0 = ctx.currentTime + 0.06;
      [0, 0.42, 0.84].forEach((d) => noise(node, t0 + d, 0.3));
    }
    s.addEventListener('input', draw); s.addEventListener('change', () => { if (played) play(); });
    $('cp-hrtf-play').addEventListener('click', play); Site.onTheme(draw); draw();
  }

  /* ---------- step 4a: light paths ---------- */
  function initPhoton() {
    const c = $('cp-photon-canvas'), slider = $('cp-photon-d'), WMM = 70, DMM = 34, XS = 12, MUA = 0.012, TARGET = 3000000, BRAIN = 14;
    const LAYERS = [[0, 5, 'scalp', 'rgba(222,176,140,0.20)'], [5, 12, 'skull', 'rgba(205,203,190,0.11)'], [12, 14, 'fluid', 'rgba(92,158,255,0.24)'], [14, DMM, 'brain', 'rgba(255,92,114,0.13)']];
    const GW = 140, GH = 68, CELL = 0.5, grid = new Float32Array(GW * GH), off = document.createElement('canvas'); off.width = GW; off.height = GH;
    let d = +slider.value, launched = 0, sumW = 0, sumDeep = 0, hits = 0, raf = null, onScreen = false; const buf = new Float32Array(2 * 1500);
    function reset() { d = +slider.value; grid.fill(0); launched = 0; sumW = 0; sumDeep = 0; hits = 0; $('cp-photon-dout').textContent = d + ' mm'; loop(); }
    function simulate(ms) {
      const tEnd = performance.now() + ms, xd = XS + d; let batches = 0;
      while (performance.now() < tEnd && launched < TARGET && batches++ < 60) for (let k = 0; k < 400; k++) {
        launched++; let x = XS, y = 0.01, th = Math.PI / 2 + (Math.random() - 0.5), len = 0, deep = 0, n = 0; buf[0] = x; buf[1] = y;
        for (; n < 1400;) {
          const l = -Math.log(Math.random() + 1e-12), x1 = x + l * Math.cos(th), y1 = y + l * Math.sin(th); len += l; n++;
          buf[2 * n - 1 + 1] = (x + x1) / 2; buf[2 * n - 1 + 2] = (y + y1) / 2; n++; buf[2 * n] = x1; buf[2 * n + 1] = y1; x = x1; y = y1;
          if (y <= 0) { if (Math.abs(x - xd) < 1.6) { const w = Math.exp(-MUA * len); sumW += w; hits++; if (deep > BRAIN) sumDeep += w;
            for (let i = 0; i <= n; i++) { const gy = Math.floor(buf[2 * i + 1] / CELL); if (gy < 0 || gy >= GH) continue;
              for (const px of [buf[2 * i], XS + xd - buf[2 * i]]) { const gx = Math.floor(px / CELL); if (gx >= 0 && gx < GW) grid[gy * GW + gx] += w; } } } break; }      /* a path and its mirror image are equally likely */
          if (y > deep) deep = y; if (len > 600) break; th = Math.random() * 2 * Math.PI;
        }
      }
    }
    function draw() {
      const { ctx, w, h } = Site.fit(c, narrow(c) ? 0.66 : 0.5), top = 30, s = Math.min(w / WMM, (h - top) / DMM);
      ctx.clearRect(0, 0, w, h); ctx.font = `12px ${col('--font-body')}`; ctx.textBaseline = 'middle';
      LAYERS.forEach(([a, b, name, fill]) => { ctx.fillStyle = fill; ctx.fillRect(0, top + a * s, w, (b - a) * s); });
      let sm = grid, tmp = new Float32Array(grid.length);                      /* three 3x3 box blurs: smooth the photon counts into a density */
      for (let pass = 0; pass < 3; pass++) { for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { let a = 0, m = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = gy + dy, xx = gx + dx; if (yy >= 0 && yy < GH && xx >= 0 && xx < GW) { a += sm[yy * GW + xx]; m++; } }
        tmp[gy * GW + gx] = a / m; } sm = tmp; tmp = new Float32Array(grid.length); }
      let vmax = 0; for (let i = 8 * GW; i < sm.length; i++) if (sm[i] > vmax) vmax = sm[i];
      if (vmax > 0) { const g2 = off.getContext('2d'), img = g2.createImageData(GW, GH);                 /* glow: deep red where little light passes, amber to pale yellow where most does */
        for (let i = 0; i < sm.length; i++) { const a = Math.min(1, Math.pow(sm[i] / vmax, 0.5)); img.data[4 * i] = 255; img.data[4 * i + 1] = 50 + 190 * a; img.data[4 * i + 2] = 70 * a * a * a + 60 * (1 - a); img.data[4 * i + 3] = Math.min(255, a * 300); }
        g2.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(off, 0, top, GW * CELL * s, GH * CELL * s); ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillStyle = col('--ink'); ctx.textAlign = 'right'; LAYERS.forEach(([a, b, name]) => ctx.fillText(name, w - 6, top + (a + b) / 2 * s));
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      [[XS, '--hbo', 'source'], [XS + d, '--hbr', 'detector']].forEach(([x, cn, name]) => { ctx.fillStyle = col(cn); ctx.beginPath(); ctx.arc(x * s, top - 7, 6, 0, 7); ctx.fill(); ctx.fillStyle = col('--ink'); ctx.fillText(name, Math.min(w - 30, Math.max(24, x * s)), 12); });
      const share = sumW ? sumDeep / sumW * 100 : 0;
      const settled = launched >= TARGET, sig = (v) => { const q = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.round(v / q) * q; };
      $('cp-photon-out').innerHTML = hits >= 40 || (settled && sumW)
        ? `Light that makes it to the detector: about 1 part in ${sig(launched / sumW).toLocaleString('en-US')}<br>Share of that light that passed through the brain: ${share < 1 ? 'under 1' : share.toFixed(0)}%${settled ? '' : ' (still counting)'}`
        : settled ? 'Almost no light arrives at this distance.' : 'Sending light in...';
    }
    function loop() { cancelAnimationFrame(raf); if (!onScreen) return; const step = () => { simulate(Site.reduced() ? 40 : 9); draw(); if (launched < TARGET && onScreen) raf = requestAnimationFrame(step); }; step(); }
    slider.addEventListener('input', reset); Site.onTheme(draw);
    visible(c, () => { onScreen = true; loop(); }, () => { onScreen = false; }); $('cp-photon-dout').textContent = d + ' mm'; draw();
  }

  /* ---------- step 4b: the slow blood response ---------- */
  function initHrf() {
    const c = $('cp-hrf-canvas'), FS = 10, SPAN = 30, N = FS * SPAN, u = new Float32Array(N + 300);
    const g = (t, a) => Math.pow(t, a - 1) * Math.exp(-t) / [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800, 87178291200, 1307674368000][a - 1];
    const H = Array.from({ length: 250 }, (_, i) => g(i / FS, 6) - g(i / FS, 16) / 6); let peak = 0;
    for (let i = 0; i < 250; i++) { let s = 0; for (let k = 0; k < 30 && i - k >= 0; k++) s += H[i - k]; peak = Math.max(peak, s); }
    let held = false, burstUntil = 0, last = performance.now(), acc = 0, raf = null, onScreen = false, idleSince = performance.now();
    const conv = (idx, delay) => { let s = 0; for (let k = 0; k < 250; k++) { const j = idx - k - delay; if (j < 0) break; s += u[j] * H[k]; } return s / peak; };
    function draw() {
      const end = u.length, xs = [], on = [], o = [], r = [];
      for (let i = 0; i < N; i++) { const idx = end - N + i; xs.push(-SPAN + i / FS); on.push(u[idx]); o.push(conv(idx, 0)); r.push(-0.35 * conv(idx, FS)); }
      const top = Math.max(1.6, Math.max(...o) * 1.22);
      const p = axes(c, narrow(c) ? 0.6 : 0.36, { x: [-SPAN, 0], y: [-top / 2, top], xt: [-30, -20, -10, 0], xfmt: (v) => (v === 0 ? 'now' : v + ' s'), yt: [], left: 14, bottom: 30 });
      p.ctx.fillStyle = col('--muted'); p.ctx.globalAlpha = 0.35;
      for (let i = 0; i < N; i++) if (on[i]) p.ctx.fillRect(p.X(xs[i]), p.Y(top * 0.97), Math.max(1, p.X(xs[1]) - p.X(xs[0]) + 0.5), p.Y(top * 0.86) - p.Y(top * 0.97));
      p.ctx.globalAlpha = 1; p.ctx.strokeStyle = col('--rule'); p.ctx.lineWidth = 1; p.ctx.beginPath(); p.ctx.moveTo(p.L, p.Y(0)); p.ctx.lineTo(p.w - p.R, p.Y(0)); p.ctx.stroke();
      line(p, xs, o, col('--hbo'), 2.6); line(p, xs, r, col('--hbr'), 2.6);
      const ho = o[N - 1], hr = r[N - 1], k = 0.9 / 816, pc = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%';
      $('cp-hrf-out').innerHTML = `Light reaching the detector, compared with rest:<br>850 nm: ${pc(-(1058 * ho + 691 * hr) * k)}<br>760 nm: ${pc(-(586 * ho + 1548 * hr) * k)}`;
    }
    function tick(now) {
      acc += (now - last) / 1000; last = now; const active = held || now < burstUntil; if (active) idleSince = now;
      let moved = false; while (acc >= 1 / FS) { acc -= 1 / FS; u.copyWithin(0, 1); u[u.length - 1] = active ? 1 : 0; moved = true; }
      if (moved) draw();
      if (onScreen && now - idleSince < 32000) raf = requestAnimationFrame(tick); else raf = null;
    }
    const wake = () => { idleSince = performance.now(); if (!raf && onScreen) { last = performance.now(); acc = 0; raf = requestAnimationFrame(tick); } };
    const b = $('cp-hrf-btn');
    b.addEventListener('pointerdown', (e) => { held = true; b.setPointerCapture(e.pointerId); wake(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => { held = false; }));
    b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); held = true; wake(); } });
    b.addEventListener('keyup', () => { held = false; });
    $('cp-hrf-burst').addEventListener('click', () => { burstUntil = performance.now() + 3000; wake(); });
    visible(c, () => { onScreen = true; wake(); }, () => { onScreen = false; }); Site.onTheme(draw); draw();
  }

  /* ---------- the cap in 3D (used in steps 4 and 8) ---------- */
  function montage(canvasId, getMode) {
    const c = $(canvasId), O = CP.optodes, CH = CP.channels; let yaw = 2.5, drag = null, auto = !Site.reduced(), raf = null, onScreen = false, last = 0;
    const inAG = new Set(); CH.forEach(([s, d, ag]) => { if (ag) { inAG.add(s); inAG.add(d); } });
    function draw() {
      const { ctx, w, h } = Site.fit(c, narrow(c) ? 0.95 : 0.88), mode = getMode(), sc = Math.min(w, h) / 200, cx = w / 2, cy = h / 2 + 8, th = 0.32;
      const P = O.map(([, x, y, z]) => { const xr = x * Math.cos(yaw) + z * Math.sin(yaw), zr = -x * Math.sin(yaw) + z * Math.cos(yaw);
        return [cx - xr * sc, cy - (y * Math.cos(th) - zr * Math.sin(th)) * sc, y * Math.sin(th) + zr * Math.cos(th)]; });
      ctx.clearRect(0, 0, w, h); ctx.lineCap = 'round';
      const grey = col('--masker'), hot = col('--ipl');
      CH.forEach(([s, d, ag]) => { const a = P[s], b = P[d], front = (a[2] + b[2]) / 2 > 0;
        if (mode === 'ipl' && ag) return; ctx.strokeStyle = grey; ctx.globalAlpha = (front ? 0.3 : 0.08) * (mode === 'ipl' ? 0.35 : 1); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
      if (mode === 'ipl') CH.forEach(([s, d, ag]) => { if (!ag) return; const a = P[s], b = P[d]; ctx.strokeStyle = hot; ctx.globalAlpha = (a[2] + b[2]) / 2 > 0 ? 0.95 : 0.3; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
      O.map((o, i) => i).sort((i, j) => P[i][2] - P[j][2]).forEach((i) => { const front = P[i][2] > 0, keep = mode !== 'ipl' || inAG.has(i);
        ctx.globalAlpha = (front ? 1 : 0.28) * (keep ? 1 : 0.25); ctx.fillStyle = col(O[i][0] ? '--hbo' : '--hbr'); ctx.beginPath(); ctx.arc(P[i][0], P[i][1], front ? 3.4 : 2.6, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1; ctx.fillStyle = col('--muted'); ctx.font = `12px ${col('--font-body')}`; ctx.textAlign = 'center';
      const fx = Math.sin(yaw), fz = Math.cos(yaw);                      /* where the face points: fx > 0 is screen left, fz > 0 is toward the viewer */
      ctx.fillText(fz > 0.7 ? 'seen from the front' : fz < -0.7 ? 'seen from behind' : fx > 0 ? 'seen from the left side' : 'seen from the right side', cx, h - 6);
    }
    function tick(now) { if (auto && !drag) yaw += Math.min(50, now - last) * 0.00022; last = now; draw(); raf = onScreen && (auto || drag) ? requestAnimationFrame(tick) : null; }
    const wake = () => { if (!raf && onScreen) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    c.style.touchAction = 'pan-y'; c.style.cursor = 'grab';
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; auto = false; c.setPointerCapture(e.pointerId); wake(); });
    c.addEventListener('pointermove', (e) => { if (drag) yaw = drag.yaw - (e.clientX - drag.x) * 0.012; });
    ['pointerup', 'pointercancel'].forEach((ev) => c.addEventListener(ev, () => { drag = null; draw(); }));
    visible(c, () => { onScreen = true; draw(); wake(); }, () => { onScreen = false; }); Site.onTheme(draw); draw();
    return { draw, show: (y) => { yaw = y; auto = false; draw(); } };
  }

  /* ---------- step 5: cleaning a channel ---------- */
  function initClean() {
    const c = $('cp-clean-canvas'), FS = 10, T = 60, on = { motion: false, filter: false, scalp: false }, ONSETS = [5, 23, 41];
    const bump = (t) => (t <= 0 ? 0 : Math.pow(t / 5.5, 5.5) * Math.exp(5.5 - t)), ts = Array.from({ length: T * FS }, (_, i) => i / FS);
    const brain = ts.map((t) => ONSETS.reduce((s, o) => s + bump(t - o), 0));
    const pulse = ts.map((t) => 0.55 * Math.sin(2 * Math.PI * 1.15 * t) + 1.6 * t / T + 0.7 * Math.sin(2 * Math.PI * t / 85));
    const scalp = ts.map((t) => 0.95 * Math.sin(2 * Math.PI * 0.1 * t + 1) + 0.4 * Math.sin(2 * Math.PI * 0.27 * t));
    const motion = ts.map((t) => (t > 33 && t < 33.6 ? 3.2 : 0) + (t > 50 ? 2.2 : 0));
    const SAY = { 0: 'Raw. The brain response (red) is in there, buried under everything else.', 1: 'One removed. Two to go.', 2: 'Two removed. One left.', 3: 'What is left is the brain response: a slow rise after each trial starts, peaking around six seconds later.' };
    function draw() {
      const y = ts.map((_, i) => brain[i] + (on.motion ? 0 : motion[i]) + (on.filter ? 0 : pulse[i]) + (on.scalp ? 0 : scalp[i]));
      const p = axes(c, narrow(c) ? 0.6 : 0.34, { x: [0, T], y: [-2.6, 7.2], xt: [0, 20, 40, 60], xfmt: (v) => v + ' s', yt: [], left: 14, bottom: 30 });
      ONSETS.forEach((o) => vline(p, o, col('--cue'), -2.6, 7.2));
      line(p, ts, y, col('--ink'), 1.4); line(p, ts, brain, col('--hbo'), 2.4);
      $('cp-clean-out').textContent = SAY[Object.values(on).filter(Boolean).length];
    }
    document.querySelectorAll('#cp-clean [data-clean]').forEach((b) => b.addEventListener('click', () => { on[b.dataset.clean] = !on[b.dataset.clean]; b.setAttribute('aria-pressed', on[b.dataset.clean]); draw(); }));
    Site.onTheme(draw); draw();
  }

  /* ---------- step 6: be the decoder ---------- */
  function initDecoder() {
    const W = CP.owa, n = W.t.length;
    function make(side, gain) {
      const wob = () => { const f = [rnd(0.04, 0.12), rnd(0.12, 0.22), rnd(0.22, 0.32)], ph = f.map(() => rnd(0, 6.3)), a = [rnd(2.5, 5), rnd(2, 4), rnd(1, 3)];
        return W.t.map((t) => f.reduce((s, fr, k) => s + a[k] * Math.sin(2 * Math.PI * fr * t + ph[k]), 0) * Math.min(1, Math.max(0, (t + 2) / 2))); };
      const nl = wob(), nr = wob(), key = side === 'L' ? 'attL' : 'attR';
      return { side, l: W.L[key].m.map((v, i) => v * gain + nl[i]), r: W.R[key].m.map((v, i) => v * gain + nr[i]) };
    }
    function plot(canvas, tr, ratio) {
      const p = axes(canvas, ratio, { x: [-2, 15], y: [-32, 32], xt: [], yt: [], left: 4, right: 4, top: 4, bottom: 4 });
      p.ctx.strokeStyle = col('--rule'); p.ctx.lineWidth = 1; p.ctx.beginPath(); p.ctx.moveTo(p.L, p.Y(0)); p.ctx.lineTo(p.w - p.R, p.Y(0)); p.ctx.stroke();
      vline(p, 0, col('--cue'), -32, 32); line(p, W.t, tr.l, col('--whole'), 2); line(p, W.t, tr.r, col('--attR'), 2);
    }
    let train, tests, i, score;
    const trainBox = $('cp-dec-train'), test = $('cp-dec-test'), cap = $('cp-dec-cap'), out = $('cp-dec-out');
    function deal() {
      train = [make('L', 1.2), make('R', 1.2), make('L', 0.9), make('R', 0.9)];
      tests = ['L', 'R', 'L', 'R', 'L', 'R', 'L', 'R'].sort(() => Math.random() - 0.5).map((s) => make(s, rnd(0.3, 1.3))); i = 0; score = 0;
      trainBox.innerHTML = train.map((t, k) => `<figure><canvas id="cp-dec-t${k}"></canvas><figcaption>Attending ${t.side === 'L' ? 'left' : 'right'}</figcaption></figure>`).join('');
      redraw(); cap.textContent = 'Test trial 1 of 8. Which side was this listener attending to?'; out.textContent = 'Your score will appear here.';
    }
    function redraw() { train.forEach((t, k) => plot($('cp-dec-t' + k), t, 0.62)); if (tests[i]) plot(test, tests[i], narrow(test) ? 0.55 : 0.5); }
    document.querySelectorAll('#cp-dec [data-guess]').forEach((b) => b.addEventListener('click', () => {
      if (i >= 8) { deal(); return; }
      const ok = b.dataset.guess === tests[i].side; score += ok; i++;
      const verdict = `${ok ? 'Right' : 'Wrong'}: that listener was attending ${tests[i - 1].side === 'L' ? 'left' : 'right'}.`;
      if (i < 8) { out.textContent = `${verdict} Score so far: ${score} of ${i}.`; cap.textContent = `Test trial ${i + 1} of 8. Which side was this listener attending to?`; plot(test, tests[i], narrow(test) ? 0.55 : 0.5); }
      else { out.textContent = `${verdict} You scored ${score} of 8 (${Math.round(score / 8 * 100)}%). You learned a rule from four labeled examples and applied it to trials you had not seen. A classifier does the same thing. Press either button to play again.`; cap.textContent = 'Done.'; }
    }));
    Site.onTheme(redraw); deal();
  }

  /* ---------- step 6: what chance looks like on 54 trials ---------- */
  function initChance() {
    const c = $('cp-chance-canvas'), NT = 54, counts = new Array(NT + 1).fill(0); let total = 0, lastScore = null;
    const one = () => { let k = 0; for (let j = 0; j < NT; j++) k += Math.random() < 0.5; counts[k]++; total++; return k; };
    function draw() {
      const top = Math.max(8, ...counts) * 1.1, p = axes(c, narrow(c) ? 0.55 : 0.32, { x: [26, 74], y: [0, top], xt: [30, 40, 50, 60, 70], xfmt: (v) => v + '%', yt: [], xl: 'Accuracy of a random guesser', left: 14 });
      const bw = (p.X(100 / NT) - p.X(0)) * 0.86;
      counts.forEach((n, k) => { const a = k / NT * 100; if (!n || a < 26 || a > 74) return; p.ctx.fillStyle = k === lastScore ? col('--act') : col('--masker'); p.ctx.fillRect(p.X(a) - bw / 2, p.Y(n), bw, p.Y(0) - p.Y(n)); });
      if (total >= 200) { const pct = (q) => { let s = 0; for (let k = 0; k <= NT; k++) { s += counts[k]; if (s >= q * total) return k / NT * 100; } return 100; };
        const lo = pct(0.05), hi = pct(0.95); [lo, hi].forEach((v) => vline(p, v, col('--ink'), 0, top));
        $('cp-chance-out').textContent = `${total.toLocaleString('en-US')} random guessers. 90% of them scored between ${lo.toFixed(1)}% and ${hi.toFixed(1)}%. None of them knew anything.`; }
    }
    $('cp-chance-1').addEventListener('click', () => { lastScore = one(); draw(); if (total < 200) $('cp-chance-out').textContent = `This guesser got ${lastScore} of 54 right: ${(lastScore / NT * 100).toFixed(1)}%. ${lastScore / NT > 0.55 ? 'Better than 50%, by luck alone.' : 'Guess again.'}`; });
    $('cp-chance-1000').addEventListener('click', () => { for (let j = 0; j < 1000; j++) one(); lastScore = null; draw(); });
    Site.onTheme(draw); draw();
  }

  /* ---------- steps 7 and 8: published results ---------- */
  function accChart(canvas, a, b, dim) {             /* two columns of per-listener dots, paired */
    const p = axes(canvas, narrow(canvas) ? 0.9 : 0.62, { x: narrow(canvas) ? [-1, 2] : [-0.6, 1.6], y: [38, 103], yt: [40, 60, 80, 100], yl: 'Accuracy (%)', band: CP.chance, bottom: 46 });
    const c = p.ctx, jit = (i) => ((i * 37) % 11 - 5) * 0.018;
    c.fillStyle = col('--muted'); c.font = `italic 12px ${col('--font-body')}`; c.textAlign = 'right'; c.fillText('chance', p.w - p.R - 6, p.Y(CP.chance[0]) - 16);
    c.strokeStyle = col('--masker'); c.lineWidth = 0.8; c.globalAlpha = 0.5;
    CP.acc.forEach((s, i) => { c.beginPath(); c.moveTo(p.X(jit(i)), p.Y(s[a.key])); c.lineTo(p.X(1 + jit(i + 3)), p.Y(s[b.key])); c.stroke(); });
    [a, b].forEach((colm, k) => {
      c.globalAlpha = dim === k ? 0.25 : 0.85; c.fillStyle = col(colm.color);
      CP.acc.forEach((s, i) => { c.beginPath(); c.arc(p.X(k + jit(i + 3 * k)), p.Y(s[colm.key]), 4.2, 0, 7); c.fill(); });
      c.globalAlpha = dim === k ? 0.6 : 1; const m = CP.means[colm.key];
      c.fillStyle = col('--ink'); c.beginPath(); c.arc(p.X(k + (k ? 0.24 : -0.24)), p.Y(m), 6.5, 0, 7); c.fill();
      c.fillStyle = col(colm.color); c.font = `600 15px ${col('--font-body')}`; c.textAlign = k ? 'left' : 'right'; c.textBaseline = 'middle'; c.fillText(m.toFixed(1) + '%', p.X(k + (k ? 0.32 : -0.32)), p.Y(m));
      c.fillStyle = col('--ink'); c.font = `12px ${col('--font-body')}`; c.textAlign = 'center'; c.textBaseline = 'top';
      colm.label.forEach((ln, j) => c.fillText(ln, p.X(k), p.h - p.B + 8 + j * 15));
    });
    c.globalAlpha = 1;
  }
  function curveChart() {
    const c = $('cp-curve-canvas'), E = CP.example, p = axes(c, narrow(c) ? 0.75 : 0.46, { x: [-2, 15], y: [38, 103], xt: [0, 2, 5, 10, 15], yt: [40, 60, 80, 100], xl: 'Time from cue onset (s)', yl: 'Accuracy (%)', band: CP.chance });
    vline(p, 0, col('--cue'), 38, 103); vline(p, 2, col('--movie'), 38, 103); vline(p, 5, col('--muted'), 38, 103);
    [['whole', '--whole'], ['ipl', '--ipl']].forEach(([k, cn]) => { const m = E[k].m, ci = E[k].ci;
      ribbon(p, E.t, m.map((v, i) => Math.max(38, v - ci[i])), m.map((v, i) => Math.min(103, v + ci[i])), col(cn)); line(p, E.t, m.map((v) => Math.max(38, v)), col(cn), 2.6); });
  }
  function owaChart() {
    const c = $('cp-owa-canvas'), stack = narrow(c), { ctx, w, h } = Site.fit(c, stack ? 1.25 : 0.46), O = CP.owa;
    ctx.clearRect(0, 0, w, h); ctx.font = `12px ${col('--font-body')}`;
    [['L', 'Left IPL'], ['R', 'Right IPL']].forEach(([k, title], idx) => {
      const x0 = stack ? 0 : idx * w / 2, y0 = stack ? idx * h / 2 : 0, pw = stack ? w : w / 2, ph = stack ? h / 2 : h, L = 46, R = 10, T = 26, B = 40;
      const X = (v) => x0 + L + (v + 2) / 17 * (pw - L - R), Y = (v) => y0 + ph - B - (v + 25) / 50 * (ph - B - T), p = { ctx, X, Y };
      ctx.strokeStyle = col('--ink'); ctx.fillStyle = col('--ink'); ctx.lineWidth = 1.2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x0 + L, y0 + T); ctx.lineTo(x0 + L, y0 + ph - B); ctx.lineTo(x0 + pw - R, y0 + ph - B); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; [-20, -10, 0, 10, 20].forEach((v) => { ctx.beginPath(); ctx.moveTo(x0 + L - 5, Y(v)); ctx.lineTo(x0 + L, Y(v)); ctx.stroke(); ctx.fillText(v, x0 + L - 8, Y(v)); });
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; [0, 5, 10, 15].forEach((v) => { ctx.beginPath(); ctx.moveTo(X(v), y0 + ph - B); ctx.lineTo(X(v), y0 + ph - B + 5); ctx.stroke(); ctx.fillText(v, X(v), y0 + ph - B + 8); });
      ctx.fillText('Time from cue onset (s)', x0 + (L + pw - R) / 2, y0 + ph - 15); ctx.font = `600 13px ${col('--font-body')}`; ctx.fillText(title, x0 + (L + pw - R) / 2, y0 + 4); ctx.font = `12px ${col('--font-body')}`;
      if (idx === 0 || stack) { ctx.save(); ctx.translate(x0 + 12, y0 + (T + ph - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText('HbO (µM mm)', 0, 0); ctx.restore(); }
      ctx.strokeStyle = col('--rule'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + L, Y(0)); ctx.lineTo(x0 + pw - R, Y(0)); ctx.stroke();
      vline(p, 0, col('--cue'), -25, 25);
      [['attL', '--whole'], ['attR', '--attR']].forEach(([key, cn]) => { const m = O[k][key].m, se = O[k][key].se;
        ribbon(p, O.t, m.map((v, i) => Math.max(-25, v - se[i])), m.map((v, i) => Math.min(25, v + se[i])), col(cn)); line(p, O.t, m, col(cn), 2.6); });
    });
  }
  function roiBars() {
    const NAME = { 'R-AngGyrus': 'Right IPL (angular gyrus)', 'L-AngGyrus': 'Left IPL (angular gyrus)', 'L-VisMotor': 'Left superior parietal (visuomotor)', 'R-PreMot+SuppMot': 'Right premotor and supplementary motor',
      'R-SupTempGyrus': 'Right superior temporal gyrus', 'R-SupramargGyr': 'Right supramarginal gyrus', 'L-PrimSensory': 'Left primary sensory', 'R-PrimSensory': 'Right primary sensory' };
    const top = CP.roi[0].mean;
    $('cp-roi').innerHTML = CP.roi.map((r) => `<span>${NAME[r.name] || r.name}</span><span><span class="bar${r.name.includes('AngGyrus') ? ' hot' : ''}" style="display:block;width:${(r.mean / top * 100).toFixed(1)}%"></span></span><span class="v num">${r.mean.toFixed(1)}%</span>`).join('');
  }

  function initResults() {
    const A = { key: 'overt', color: '--whole', label: ['Look and listen'] }, B = { key: 'covert', color: '--attR', label: ['Listen only,', 'eyes fixed'] };
    const all = () => { accChart($('cp-acc-canvas'), A, B, null); curveChart(); owaChart(); smallAcc(); };
    let mode = 'all';
    const smallAcc = () => accChart($('cp-small-acc'), { key: 'overt', color: '--whole', label: ['All 567', 'channels'] }, { key: 'ipl', color: '--ipl', label: ['IPL only', '(58 channels)'] }, mode === 'all' ? 1 : 0);
    const text = () => { $('cp-small-cap-text').textContent = mode === 'all'
      ? `All channels: mean peak accuracy ${CP.means.overt}%, ${CP.means.above_overt} of 26 listeners above chance.`
      : `IPL channels only: ${CP.means.ipl}%, ${CP.means.above_ipl} of 26 above chance. Each line joins one listener's two results.`; };
    const small = montage('cp-small-cap', () => mode);
    document.querySelectorAll('#cp-small [data-montage]').forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.montage; document.querySelectorAll('#cp-small [data-montage]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      if (mode === 'ipl') small.show(2.75); else small.draw(); smallAcc(); text();
    }));
    roiBars(); text(); all(); Site.onTheme(all);
  }

  Site.onShow('cocktail-party', () => {
    $('cp-cap-photo').src = CP.capPhoto;
    document.querySelectorAll('#cp-steps [data-go]').forEach((b) => b.addEventListener('click', () => $(b.dataset.go).scrollIntoView({ behavior: Site.reduced() ? 'auto' : 'smooth', block: 'start' })));
    initGame(); initHrtf(); initPhoton(); initHrf(); montage('cp-cap-canvas', () => 'all'); initClean(); initDecoder(); initChance(); initResults();
  });
})();
