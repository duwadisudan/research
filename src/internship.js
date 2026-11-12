/* Internship page: a hummed-sentence synthesizer (delivery without words) and a two-rater agreement calculator. */
(() => {
  const $ = (id) => document.getElementById(id);

  /* ---- 1. prosody synthesizer ---- */
  /* syllable: label, relative length, pitch target (-1..1 around the base), stress (0..1), vowel formants F1/F2 in Hz */
  const SYL = [
    ["I'm", 1.0, 0.3, 0.6, 750, 1300], ['sor', 1.2, 0.8, 1.0, 550, 900], ['ry', 0.8, 0.2, 0.4, 320, 2200], ['to', 0.6, 0.0, 0.2, 380, 900],
    ['hear', 1.2, 0.5, 0.8, 350, 2100], ['that.', 1.3, -0.6, 0.5, 700, 1600],
    ['That', 1.0, 0.4, 0.6, 700, 1600], ['sounds', 1.2, 0.6, 0.8, 720, 1200], ['real', 1.3, 0.9, 1.0, 340, 2100], ['ly', 0.8, 0.3, 0.3, 320, 2200],
    ['dif', 1.0, 0.2, 0.7, 400, 1900], ['fi', 0.8, -0.2, 0.3, 380, 2000], ['cult.', 1.3, -0.8, 0.4, 600, 1100],
  ];
  const PRESET = { a: { pace: 30, pitch: 80, loud: 65, pause: 75 }, b: { pace: 92, pitch: 8, loud: 8, pause: 5 } };
  const ctl = { pace: 'in-pace', pitch: 'in-pitch', loud: 'in-loud', pause: 'in-pause' };
  let raf = null, playStart = null, plan = null;

  function read() { const p = {}; Object.keys(ctl).forEach((k) => { p[k] = +$(ctl[k]).value; }); return p; }
  function build(p) {
    const unit = 0.34 - 0.2 * p.pace / 100;            /* seconds per unit syllable */
    const range = 7 * p.pitch / 100;                    /* semitones either side of the base pitch */
    const pause = 0.08 + 0.85 * p.pause / 100, base = 185;
    let t = 0.1; const out = [];
    SYL.forEach(([label, len, tgt, stress, f1, f2], i) => {
      const d = unit * len, next = SYL[i + 1] ? SYL[i + 1][2] : tgt - 0.3;
      const hz = (x) => base * Math.pow(2, range * x / 12);
      out.push({ label, t0: t, t1: t + d * 0.88, fa: hz(tgt), fb: hz(tgt + (next - tgt) * 0.35), amp: 0.55 + 0.45 * (p.loud / 100) * (stress * 2 - 1), f1, f2 });
      t += d; if (i === 5) t += pause;
    });
    return { syl: out, dur: t + 0.15, fmin: base * Math.pow(2, -8 / 12), fmax: base * Math.pow(2, 9 / 12) };
  }

  function draw(playhead) {
    const c = $('in-canvas'); if (!c || !plan) return;
    const { ctx, w, h } = Site.fit(c, w0() < 520 ? 0.5 : 0.3);
    const tight = w < 520, padL = 8, padR = 8, top = 14, bot = h - (tight ? 42 : 34), total = Math.max(plan.dur, 3.2);
    const X = (t) => padL + t / total * (w - padL - padR);
    const Y = (f) => bot - (Math.log(f / plan.fmin) / Math.log(plan.fmax / plan.fmin)) * (bot - top);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = Site.css('--rule'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, bot + 6); ctx.lineTo(w - padR, bot + 6); ctx.stroke();
    ctx.font = `${w < 520 ? 10 : 13}px ${Site.css('--font-body')}`; ctx.textAlign = 'center';
    plan.syl.forEach((s, i) => {
      const on = playhead != null && playhead >= s.t0;
      ctx.strokeStyle = on ? Site.css('--act') : Site.css('--ink'); ctx.lineCap = 'round'; ctx.lineWidth = 2 + 7 * s.amp;
      ctx.beginPath(); ctx.moveTo(X(s.t0), Y(s.fa)); ctx.lineTo(X(s.t1), Y(s.fb)); ctx.stroke();
      ctx.fillStyle = Site.css('--muted'); ctx.fillText(s.label, X((s.t0 + s.t1) / 2), h - (tight && i % 2 ? 22 : 9));      /* two rows on a narrow canvas so labels do not collide */
    });
    if (playhead != null) { ctx.strokeStyle = Site.css('--act'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(playhead), top - 6); ctx.lineTo(X(playhead), bot + 6); ctx.stroke(); }
  }
  const w0 = () => $('in-canvas').parentElement.clientWidth;

  function speak() {
    plan = build(read()); Site.stopAudio(); cancelAnimationFrame(raf);
    let ctx; try { ctx = Site.audio(); } catch (e) { draw(null); return; }
    const t0 = ctx.currentTime + 0.06;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const env = ctx.createGain(); env.gain.value = 0;
    const b1 = ctx.createBiquadFilter(), b2 = ctx.createBiquadFilter(); b1.type = b2.type = 'bandpass'; b1.Q.value = 5; b2.Q.value = 8;
    const g2 = ctx.createGain(); g2.gain.value = 0.5; const master = ctx.createGain(); master.gain.value = 0.9;
    osc.connect(env); env.connect(b1).connect(master); env.connect(b2).connect(g2).connect(master); master.connect(ctx.destination);
    plan.syl.forEach((s) => {
      osc.frequency.setValueAtTime(s.fa, t0 + s.t0); osc.frequency.linearRampToValueAtTime(s.fb, t0 + s.t1);
      b1.frequency.setValueAtTime(s.f1, t0 + s.t0); b2.frequency.setValueAtTime(s.f2, t0 + s.t0);
      env.gain.setValueAtTime(0, t0 + s.t0); env.gain.linearRampToValueAtTime(s.amp, t0 + s.t0 + 0.035);
      env.gain.setValueAtTime(s.amp, t0 + s.t1 - 0.05); env.gain.linearRampToValueAtTime(0, t0 + s.t1);
    });
    Site.track(osc).start(t0); osc.stop(t0 + plan.dur);
    playStart = performance.now() + 60;
    const tick = () => { const t = (performance.now() - playStart) / 1000; if (t > plan.dur) { draw(null); return; } draw(Math.max(0, t)); raf = requestAnimationFrame(tick); };
    if (Site.reduced()) draw(null); else tick();
  }

  function initVoice() {
    plan = build(read()); draw(null);
    Object.values(ctl).forEach((id) => $(id).addEventListener('input', () => { plan = build(read()); draw(null); }));
    document.querySelectorAll('#in-voice [data-preset]').forEach((b) => b.addEventListener('click', () => {
      Object.entries(PRESET[b.dataset.preset]).forEach(([k, v]) => { $(ctl[k]).value = v; }); speak();
    }));
    $('in-replay').addEventListener('click', speak);
    Site.onTheme(() => draw(null));
  }

  /* ---- 2. agreement between two raters ---- */
  const A_SCORES = [1, 2, 2, 3, 3, 4, 4, 5];
  const AG = { same: [1, 2, 2, 3, 3, 4, 4, 5], shift: [1, 1, 1, 2, 2, 3, 3, 4], scramble: [4, 2, 5, 1, 3, 2, 4, 3] };
  let B = AG.same.slice();
  function qwk(a, b, k = 5) {          /* quadratic weighted kappa on a 1..k scale */
    const n = a.length, O = [...Array(k)].map(() => Array(k).fill(0)), ha = Array(k).fill(0), hb = Array(k).fill(0);
    a.forEach((x, i) => { O[x - 1][b[i] - 1]++; ha[x - 1]++; hb[b[i] - 1]++; });
    let num = 0, den = 0;
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const wgt = (i - j) ** 2 / (k - 1) ** 2; num += wgt * O[i][j]; den += wgt * ha[i] * hb[j] / n; }
    return den === 0 ? 1 : 1 - num / den;
  }
  function ranks(v) { const s = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = Array(v.length); let i = 0;
    while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let m = i; m <= j; m++) r[s[m][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  function spearman(a, b) { const x = ranks(a), y = ranks(b), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
    let sxy = 0, sxx = 0, syy = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN; }
  function renderAgree() {
    const t = $('in-agree-table');
    t.innerHTML = '<tr><th style="text-align:left;font-weight:500;color:var(--muted)">Clip</th><th style="font-weight:500;color:var(--muted)">A</th><th colspan="5" style="font-weight:500;color:var(--muted)">B (click to set)</th></tr>' +
      A_SCORES.map((a, i) => `<tr><td class="num">${i + 1}</td><td class="num" style="text-align:center;font-weight:600;padding-inline:0.6rem">${a}</td>` +
        [1, 2, 3, 4, 5].map((v) => `<td><button class="btn${B[i] === v ? ' primary' : ' quiet'}" style="padding:0.25rem 0.6rem;border-radius:6px" data-i="${i}" data-v="${v}" aria-pressed="${B[i] === v}" aria-label="Clip ${i + 1}, rater B gives ${v}">${v}</button></td>`).join('') + '</tr>').join('');
    const k = qwk(A_SCORES, B), r = spearman(A_SCORES, B);
    $('in-agree-out').innerHTML = `Weighted kappa: ${k.toFixed(2)}<br>Spearman correlation: ${Number.isNaN(r) ? 'undefined (B gave every clip the same score)' : r.toFixed(2)}`;
  }
  function initAgree() {
    renderAgree();
    $('in-agree-table').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; B[+b.dataset.i] = +b.dataset.v; renderAgree(); });
    document.querySelectorAll('#in-agree [data-ag]').forEach((b) => b.addEventListener('click', () => { B = AG[b.dataset.ag].slice(); renderAgree(); }));
  }

  Site.onShow('internship', () => { initVoice(); initAgree(); });
})();
