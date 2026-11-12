/* Listening effort page: scene diagram (target and masker levels), one trial as a visual analogy, trial-type timeline. No audio. */
(() => {
  const $ = (id) => document.getElementById(id);
  const WORDS = [
    ['Names', ['Allen', 'Doris', 'Kathy', 'Lucy', 'Nina', 'Peter', 'Rachel', 'Steven', 'Thomas', 'William']],
    ['Verbs', ['bought', 'gives', 'got', 'has', 'kept', 'ordered', 'prefers', 'sees', 'sold', 'wants']],
    ['Numerals', ['two', 'three', 'four', 'seven', 'eight', 'nine', 'twelve', 'fifteen', 'nineteen', 'sixty']],
    ['Adjectives', ['cheap', 'dark', 'green', 'heavy', 'large', 'old', 'pretty', 'red', 'small', 'white']],
    ['Objects', ['chairs', 'desks', 'flowers', 'houses', 'rings', 'sofas', 'spoons', 'tables', 'toys', 'windows']],
  ];
  const SCALE = { 1: 'No Effort', 3: 'Hardly Any', 5: 'Little', 7: 'Moderate', 9: 'Considerable', 11: 'Much', 13: 'Extreme', 14: 'Only Noise' };
  const TMR_LABEL = { p5: '+5 dB', z0: '0 dB', m5: '−5 dB' }, DB = { p5: 5, z0: 0, m5: -5 };
  const ratio = (db) => Math.pow(10, db / 20);                 /* level ratio of the target against each masker */

  /* 1. the scene: sound spreading from each talker, the target's level against the maskers */
  function initScene() {
    const bars = { t: $('le-bar-t'), l: $('le-bar-l'), r: $('le-bar-r') }, NS = 'http://www.w3.org/2000/svg';
    const AT = { l: [112, 112, '--masker'], t: [210, 86, '--target'], r: [308, 112, '--masker'] }, rings = { l: [], t: [], r: [] };
    Object.keys(AT).forEach((k) => { for (let i = 0; i < 3; i++) {
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', AT[k][0]); c.setAttribute('cy', AT[k][1]); c.setAttribute('r', 34); c.setAttribute('class', 'le-ring');
      c.style.stroke = `var(${AT[k][2]})`; c.style.animationDelay = (-i * 0.9) + 's'; c.style.setProperty('--s', 1 + i * 0.25); $('le-rings').appendChild(c); rings[k].push(c); } });
    const setScene = (tmr) => {
      const base = 60, alone = tmr === 'alone', ht = alone ? base : base * ratio(+tmr), hm = alone ? 0 : base;
      bars.t.setAttribute('height', ht); bars.t.setAttribute('y', 120 - ht);
      [bars.l, bars.r].forEach((b) => { b.setAttribute('height', hm); b.setAttribute('y', 120 - hm); });
      $('le-masker-l').style.opacity = $('le-masker-r').style.opacity = alone ? 0.25 : 1;
      rings.t.forEach((c) => c.style.setProperty('--lv', alone ? 0.55 : Math.min(1, 0.55 * ratio(+tmr))));
      [...rings.l, ...rings.r].forEach((c) => c.style.setProperty('--lv', alone ? 0 : 0.55));
    };
    const say = {
      alone: 'The target talker alone, straight ahead, with no competing talkers.',
      5: '+5 dB: the target is louder than each masker.',
      0: '0 dB: all three talkers are set to the same level. Location and voice are what the listener has to go on.',
      '-5': '−5 dB: the target is quieter than the talkers on either side.',
    };
    document.querySelectorAll('#le-scene [data-tmr]').forEach((btn) => btn.addEventListener('click', () => {
      const tmr = btn.dataset.tmr;
      document.querySelectorAll('#le-scene [data-tmr]').forEach((b) => b.setAttribute('aria-pressed', b === btn));
      setScene(tmr); $('le-scene-readout').textContent = say[tmr];
    }));
    setScene('0');
  }

  /* 2. one trial, for the eyes: three sentences flashed word by word on top of each other; report the middle one, rate the effort */
  function initTrial() {
    const matrix = $('le-matrix'), scale = $('le-scale'), log = $('le-log').querySelector('tbody'), box = $('le-rsvp');
    const [ml, tg, mr, fix] = ['.ml', '.t', '.mr', '.fix'].map((q) => box.querySelector(q));
    let picks = [], rating = null, current = null, truth = null, locked = false, seq = 0; const done = {};
    WORDS.forEach(([hd]) => { const d = document.createElement('div'); d.className = 'hd'; d.textContent = hd; matrix.appendChild(d); });
    for (let r = 0; r < 10; r++) WORDS.forEach(([, list], c) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = list[r]; b.dataset.col = c; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { if (locked) return; picks[c] = list[r]; refresh(); }); matrix.appendChild(b);
    });
    for (let n = 1; n <= 14; n++) {
      if (n === 14) { const gap = document.createElement('div'); gap.className = 'gap'; scale.appendChild(gap); }
      const b = document.createElement('button'); b.type = 'button'; b.dataset.n = n; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span>${n}</span><span>${SCALE[n] || ''}</span>`; b.setAttribute('aria-label', `${n} ${SCALE[n] || ''}`);
      b.addEventListener('click', () => { if (locked) return; rating = n; refresh(); }); scale.appendChild(b);
    }
    function refresh() {
      matrix.querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', picks[b.dataset.col] === b.textContent); b.classList.remove('hit', 'miss'); });
      scale.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.n === rating));
      $('le-submit').disabled = !(picks.filter(Boolean).length === 5 && rating);
    }
    const sentence = (avoid) => WORDS.map(([, list], c) => { let w; do { w = list[Math.floor(Math.random() * 10)]; } while (avoid.some((o) => o[c] === w)); return w; });
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const show = (a, t, b, f) => { ml.textContent = a; tg.textContent = t; mr.textContent = b; fix.textContent = f; };
    const idle = () => { show('', '', '', '+'); $('le-trial-step').textContent = 'Step 1 of 3: choose a difficulty and watch'; };
    document.querySelectorAll('#le-trial [data-trial]').forEach((btn) => btn.addEventListener('click', async () => {
      const mine = ++seq; current = btn.dataset.trial; picks = []; rating = null; locked = false; refresh();
      $('le-response').hidden = true; $('le-trial-readout').hidden = true; $('le-again').hidden = true;
      const t = sentence([]), a = sentence([t]), b = sentence([t, a]); truth = t;
      tg.style.opacity = 0.5 * ratio(DB[current]);                 /* maskers sit at 0.5 */
      $('le-trial-step').textContent = 'Watch the middle word...'; show('', '', '', '+'); box.scrollIntoView({ block: 'center' });
      await wait(900);
      for (let i = 0; i < 5; i++) { if (mine !== seq) return; show(a[i], t[i], b[i], ''); await wait(520); if (mine !== seq) return; show('', '', '', ''); await wait(90); }
      if (mine !== seq) return;
      $('le-response').hidden = false; $('le-trial-step').textContent = 'Step 2 of 3: report the five words, then rate the effort';
    }));
    window.addEventListener('hashchange', () => { seq++; if ($('le-response').hidden) idle(); });
    $('le-submit').addEventListener('click', () => {
      let n = 0; locked = true;
      matrix.querySelectorAll('button').forEach((b) => { const right = truth[b.dataset.col] === b.textContent, picked = b.getAttribute('aria-pressed') === 'true';
        if (right) { b.classList.add('hit'); n += picked; } else if (picked) b.classList.add('miss'); });
      done[current] = { n, rating };
      log.innerHTML = ['p5', 'z0', 'm5'].filter((k) => done[k]).map((k) =>
        `<tr><td style="padding:0.3rem 0.7rem 0.3rem 0">${TMR_LABEL[k]}</td><td class="num" style="padding:0.3rem 0.7rem">${done[k].n} of 5</td><td class="num" style="padding:0.3rem 0.7rem">${done[k].rating}${SCALE[done[k].rating] ? ' (' + SCALE[done[k].rating] + ')' : ''}</td></tr>`).join('');
      $('le-log-wrap').hidden = false; $('le-submit').disabled = true;
      const count = Object.keys(done).length, out = $('le-trial-readout'); out.hidden = false;
      out.textContent = `The middle sentence was: "${truth.join(' ')}." ` + (count < 3
        ? 'Try another difficulty and compare the two columns.'
        : 'A word score keeps only the middle column. The right-hand column is what this project is trying to measure without having to ask.');
      $('le-trial-step').textContent = count < 3 ? 'Step 3 of 3: try another difficulty' : 'All three done'; $('le-again').hidden = count >= 3;
    });
    $('le-again').addEventListener('click', () => document.querySelector('#le-trial .controls').scrollIntoView({ block: 'center' }));
    idle();
  }

  /* 3. trial-type timeline */
  function initTimeline() {
    const T0 = -4.3, T1 = 15, X = (t) => 10 + (t - T0) / (T1 - T0) * 700;
    const FIX = ['+', 'var(--sunk)', 'currentColor'], JIT = ['0-3 s', 'url(#le-hatch)', 'currentColor'], ITI = ['rest 2-4 s', 'url(#le-hatch)', 'currentColor'];
    const TYPES = {
      respond: { blocks: [[T0, 0, ...FIX], [0, 3, 'Sentence', 'var(--target)', 'var(--bg)'], [3, 4.5, ...JIT], [4.5, 10.1, 'Word matrix', 'var(--act)', 'var(--act-ink)'], [10.1, 11.8, 'Effort', 'var(--act)', 'var(--act-ink)', 0.8], [11.8, 14.8, ...ITI]],
        cap: 'Listen and respond, 60 per listener. A sentence, then the word matrix and the effort rating. This is where the word scores and the ratings come from.' },
      listen: { blocks: [[T0, 0, ...FIX], [0, 3, 'Sentence', 'var(--target)', 'var(--bg)'], [3, 4.5, ...JIT], [4.5, 11.8, ...FIX], [11.8, 14.8, ...ITI]],
        cap: 'Listen only, 60 per listener. The same listening, then nothing to click: the cross stays on for as long as a response would have taken. Here the body signals reflect listening with no response mixed in.' },
      motor: { blocks: [[T0, 0, ...FIX], [0, 3, 'Silence', 'var(--masker)', 'var(--bg)'], [3, 4.5, ...JIT], [4.5, 11.8, 'Guided clicks', 'var(--act)', 'var(--act-ink)'], [11.8, 14.8, ...ITI]],
        cap: 'Motor clicks, 20 per listener. No sound, then guided clicks through the matrix and the scale. This isolates what responding alone does, so it can be told apart from listening.' },
    };
    $('le-tl-ticks').innerHTML = [0, 5, 10, 15].map((t) => `<line x1="${X(t)}" y1="102" x2="${X(t)}" y2="114" stroke="currentColor" stroke-width="1.2"/><text x="${X(t)}" y="132" text-anchor="${t === 15 ? 'end' : 'middle'}" style="fill:var(--muted)">${t} s</text>`).join('');
    const draw = (key) => {
      $('le-tl-blocks').innerHTML = TYPES[key].blocks.map(([a, b, label, fill, ink, op]) =>
        `<rect x="${X(a) + 1}" y="24" width="${X(b) - X(a) - 2}" height="56" rx="3" fill="${fill}" opacity="${op || 1}"${fill.startsWith('url') ? ' stroke="var(--mid)" stroke-width="1.5"' : ''}/>` +
        `<text x="${(X(a) + X(b)) / 2}" y="57" text-anchor="middle" font-size="${label.length > 8 && b - a < 2 ? 11 : 14}" style="fill:${ink}${fill.startsWith('url') ? ';paint-order:stroke;stroke:var(--sunk);stroke-width:5px;stroke-linejoin:round' : ''}">${label}</text>`).join('');
      $('le-tl-caption').textContent = TYPES[key].cap + ' Block lengths for the self-paced steps are drawn at a typical duration.';
      document.querySelectorAll('#le-timeline [data-tt]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tt === key));
    };
    document.querySelectorAll('#le-timeline [data-tt]').forEach((b) => b.addEventListener('click', () => draw(b.dataset.tt)));
    draw('respond');
  }

  document.addEventListener('click', (e) => {         /* reference links scroll within the page; the hash stays the route */
    const a = e.target.closest('[data-ref]'); if (!a) return;
    e.preventDefault(); const el = document.getElementById(a.dataset.ref); if (el) el.scrollIntoView({ block: 'center' });
  });
  Site.onShow('listening-effort', () => { initScene(); initTrial(); initTimeline(); });
})();
