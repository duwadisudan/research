/* Shared plumbing: hash routing between the four views, theme-aware canvas helpers, one audio context. */
window.Site = (() => {
  const VIEWS = ['home', 'cocktail-party', 'listening-effort', 'internship'];
  const shown = {}, firstShow = {}, themeFns = [];
  let actx = null;

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function route() {
    const want = location.hash.replace('#', '');
    const name = VIEWS.includes(want) ? want : 'home';
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    stopAudio();
    if (!shown[name]) { shown[name] = true; (firstShow[name] || []).forEach((fn) => fn()); }
  }
  function onShow(name, fn) { (firstShow[name] = firstShow[name] || []).push(fn); if (shown[name]) fn(); }

  /* canvas sized to its CSS box at device resolution; returns a 2D context scaled to CSS pixels */
  function fit(canvas, ratio) {
    const w = Math.max(200, Math.round(canvas.parentElement.clientWidth));
    const h = Math.round(w * ratio);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function onTheme(fn) { themeFns.push(fn); }
  const fireTheme = () => themeFns.forEach((fn) => fn());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);
  new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fireTheme, 150); });
  /* canvas text is drawn once: redraw when the web fonts arrive */
  if (document.fonts) { const again = () => window.dispatchEvent(new Event('resize')); if (document.fonts.ready) document.fonts.ready.then(again); if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', again); }

  /* audio: one context, created on the first click; anything playing stops when the view changes */
  const playing = new Set();
  function audio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function track(node) { playing.add(node); node.addEventListener('ended', () => playing.delete(node)); return node; }
  function stopAudio() { playing.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); playing.clear(); }
  async function decode(dataUri) {
    const bin = atob(dataUri.slice(dataUri.indexOf(',') + 1));      /* no fetch: works under a strict CSP and from file:// */
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return await audio().decodeAudioData(bytes.buffer);
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', route);
  if (document.readyState !== 'loading') setTimeout(route, 0);
  return { css, reduced, onShow, fit, onTheme, audio, track, stopAudio, decode };
})();
