/* main.js — hero, scroll motion, research map, rail and guided tour, small loaders. */
(function () {
  'use strict';
  var HZ = window.HZ, h = HZ.h, s = HZ.s, $ = HZ.$, $$ = HZ.$$, clamp = HZ.clamp;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- hero headline: draft, detect, remask, repair ---------- */
  function hero() {
    var line = $('#hero-line'); if (!line) return;
    var KEEP = ['When', 'the', 'facts', 'change,'];
    var DRAFT = ['rewrite', 'the', 'whole', 'summary.'];
    var FIXED = ['repair', 'only', 'what', 'went', 'stale.'];
    var pills = $$('.hstep'), run = 0;
    function pill(k) { pills.forEach(function (p) { p.setAttribute('data-on', p.getAttribute('data-k') === k ? '1' : '0'); }); }
    function word(t, cls) { return h('span', { class: 'hw ' + (cls || ''), 'aria-hidden': 'true', text: t }); }
    function final() {
      HZ.clear(line);
      KEEP.forEach(function (t) { line.appendChild(word(t)); });
      FIXED.forEach(function (t) { line.appendChild(word(t, 'settle')); });
      pill('repair');
    }
    async function play() {
      var me = ++run;
      HZ.clear(line);
      var keep = KEEP.map(function (t) { return line.appendChild(word(t, 'm')); });
      var draft = DRAFT.map(function (t) { return line.appendChild(word(t, 'm')); });
      pill('draft');
      await sleep(500);
      var order = [2, 5, 0, 7, 3, 1, 6, 4], all = keep.concat(draft);
      for (var i = 0; i < order.length; i++) {
        if (me !== run) return;
        all[order[i]].classList.remove('m'); all[order[i]].classList.add('pop');
        await sleep(150);
      }
      await sleep(900); if (me !== run) return;
      pill('detect'); draft.forEach(function (w) { w.classList.add('flag'); });
      await sleep(1300); if (me !== run) return;
      pill('remask'); draft.forEach(function (w) { w.remove(); });
      var fixed = FIXED.map(function (t) { return line.appendChild(word(t, 'm amber pop')); });
      await sleep(1100); if (me !== run) return;
      pill('repair');
      for (var j = 0; j < fixed.length; j++) {
        if (me !== run) return;
        fixed[j].className = 'hw new pop'; await sleep(230);
      }
      await sleep(1300); if (me !== run) return;
      fixed.forEach(function (w) { w.className = 'hw settle'; });
    }
    var replay = $('#hero-replay'); if (replay) replay.addEventListener('click', play);
    if (HZ.rm) final(); else { final(); HZ.afterIntro(play); }
  }

  /* ---------- hero background: lines of "text" that get flagged, masked and repaired ---------- */
  function field() {
    var cv = $('#field'), host = $('.hero'); if (!cv || !host) return;
    var ctx = cv.getContext('2d'), blocks = [], W = 0, H = 0, on = true, px = -999, py = -999, raf = 0;
    var COL = { base: 'rgba(182,189,201,.10)', stale: '#ff6b81', mask: '#f2b84b', ok: '#45d6a4' };
    function layout() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = host.clientWidth; H = host.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blocks = [];
      var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var y = 26; y < H - 10; y += 26) {
        var x = 12 + rnd() * 30;
        while (x < W - 30) {
          var w = 18 + rnd() * 62;
          if (rnd() > 0.12) blocks.push({ x: x, y: y, w: Math.min(w, W - x - 10), s: 0, t: 0 });
          x += w + 9;
        }
      }
    }
    function tick(now) {
      raf = 0;
      ctx.clearRect(0, 0, W, H);
      if (!HZ.rm && Math.random() < 0.09 && blocks.length) {
        var b = blocks[(Math.random() * blocks.length) | 0];
        if (b.s === 0) { b.s = 1; b.t = now; }
      }
      for (var i = 0; i < blocks.length; i++) {
        var k = blocks[i], age = now - k.t;
        if (k.s === 0 && Math.abs(k.x + k.w / 2 - px) < 60 && Math.abs(k.y - py) < 34) { k.s = 1; k.t = now; }
        if (k.s === 4 && now >= k.t) { k.s = 3; k.t = now; }
        if (k.s === 1 && age > 650) { k.s = 2; k.t = now; }
        else if (k.s === 2 && age > 650) { k.s = 3; k.t = now; }
        else if (k.s === 3 && age > 1500) { k.s = 0; }
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(k.x, k.y, k.w, 10, 3); else ctx.rect(k.x, k.y, k.w, 10);
        if (k.s === 0 || k.s === 4) { ctx.fillStyle = COL.base; ctx.fill(); }
        else if (k.s === 1) { ctx.fillStyle = COL.stale; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; }
        else if (k.s === 2) { ctx.strokeStyle = COL.mask; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.fillStyle = COL.ok; ctx.globalAlpha = Math.max(0.15, 1 - (now - k.t) / 1500); ctx.fill(); ctx.globalAlpha = 1; }
      }
      if (on && !HZ.rm) raf = requestAnimationFrame(tick);
    }
    host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; });
    host.addEventListener('pointerleave', function () { px = py = -999; });
    window.addEventListener('resize', function () { layout(); if (!raf) tick(performance.now()); });
    HZ.onVisible(host, function (v) { on = v; if (v && !raf) raf = requestAnimationFrame(tick); }, { once: false, threshold: 0.05 });
    layout(); tick(performance.now());
    /* after the opening, the repaired windows of the city land here: a wave of mint blocks from the centre outwards */
    HZ.afterIntro(function () {
      if (!HZ.intro || !HZ.intro.played || HZ.rm) return;
      var now = performance.now();
      blocks.forEach(function (b, i) {
        if (i % 3 === 0) return;
        var d = Math.hypot(b.x + b.w / 2 - W * 0.5, b.y - H * 0.55);
        b.s = 4; b.t = now + 120 + d * 1.1;
      });
    });
  }

  function portrait() {
    var slot = $('#portrait'); if (!slot) return;
    var p = HZ.CONFIG.portrait, tried = 0;
    var img = h('img', { class: 'portrait', alt: 'Portrait of Hao Zou', width: 96, height: 96 });
    img.addEventListener('error', function () {
      tried++;
      if (tried === 1) img.src = p.remote;
      else slot.replaceChildren(h('div', { class: 'portrait-fallback', 'aria-hidden': 'true', text: 'HZ' }));
    });
    img.src = p.local; slot.appendChild(img);
  }

  /* ---------- reveal on scroll, count-ups, lightbox, video, demo ---------- */
  function reveals() {
    var els = $$('[data-reveal]');
    if (HZ.rm || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -7% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }
  function counts() {
    $$('[data-count]').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-count')), dec = +(el.getAttribute('data-dec') || 0);
      var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
      var fmt = function (v) { return pre + v.toFixed(dec) + suf; };
      if (HZ.rm) return;
      el.textContent = fmt(0);
      HZ.onVisible(el, function () {
        var t0 = performance.now(), D = 1300;
        (function step(now) {
          var p = clamp((now - t0) / D, 0, 1), e = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(to * e);
          if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
        })(t0);
      }, { threshold: 0.6 });
    });
  }
  function lightbox() {
    var box = $('#lightbox'); if (!box) return;
    function close() { box.classList.remove('on'); setTimeout(function () { HZ.clear(box); }, 250); }
    $$('.zoom').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = $('img', b); HZ.clear(box); box.appendChild(h('img', { src: i.src, alt: i.alt })); box.classList.add('on');
      });
    });
    box.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('on')) close(); });
  }
  function films() {   /* play a video only while it is on screen */
    $$('.film video').forEach(function (v) {
      v.muted = true;
      if (HZ.rm) return;
      HZ.onVisible(v, function (vis) {
        if (vis) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
      }, { once: false, threshold: 0.45 });
    });
  }
  function demo() {
    var btn = $('#load-demo'), slot = $('#demo-slot'); if (!btn || !slot) return;
    var sketch = null, live = false;
    btn.addEventListener('click', function () {
      if (!live) {
        sketch = slot.firstElementChild; slot.style.padding = '0';
        slot.replaceChildren(h('iframe', { src: 'https://haozou-official.github.io/bengal-cedar-website/demo.html', title: 'Living Report demo', loading: 'lazy' }));
        btn.textContent = 'Back to the sketch';
      } else { slot.style.padding = ''; slot.replaceChildren(sketch); btn.textContent = 'Load the live demo here'; }
      live = !live;
    });
  }

  /* ---------- research map (js/map3d.js draws it) ---------- */
  var mapApi = HZ.map3d || { setCurrent: function () {}, canFly: function () { return false; } };

  /* ---------- rail, tour bar, scroll-linked values ---------- */
  function tour(chapters) {
    var root = document.documentElement, heroEl = $('.hero');
    var rail = $('.rail'), bar = $('.tour'), cur = -2;
    var where = $('.where', bar), prev = $('#tour-prev'), next = $('#tour-next');
    var GLOW = { gen: 'gen', eff: 'eff', agents: 'agents', next: 'next', roots: 'gen' };
    var links = chapters.map(function (c, i) {
      var a = h('a', { href: '#' + c.id, 'data-thread': c.getAttribute('data-thread') }, h('span', { text: (i + 1) + '. ' + c.getAttribute('data-title') }));
      a.setAttribute('aria-label', 'Chapter ' + (i + 1) + ': ' + c.getAttribute('data-title'));
      rail.appendChild(a); return a;
    });
    function setCur(i) {
      cur = i;
      chapters.forEach(function (c, j) { c.classList.toggle('is-current', j === i); });
      links.forEach(function (a, j) { a.classList.toggle('is-here', j === i); });
      prev.disabled = i <= 0; next.disabled = i >= chapters.length - 1;
      HZ.clear(where);
      where.appendChild(s('svg', null, s('use', { href: '#bot' })));
      if (i < 0) where.appendChild(h('span', { text: 'Walk the path' }));
      else { where.appendChild(h('b', { text: (i + 1) + ' / ' + chapters.length })); where.appendChild(h('span', { text: chapters[i].getAttribute('data-title') })); }
      mapApi.setCurrent(i >= 0 ? chapters[i].id : null);
      var thread = i >= 0 ? chapters[i].getAttribute('data-thread') : '';
      document.body.setAttribute('data-glow', GLOW[thread] || '');
      $$('.top nav a[data-thread]').forEach(function (a) { a.classList.toggle('is-here', a.getAttribute('data-thread').split(' ').indexOf(thread) >= 0); });
    }
    var aim = null, aimT = 0;                       /* where a quick run of key presses is heading */
    function go(i) {
      i = clamp(i, 0, chapters.length - 1);
      aim = i; clearTimeout(aimT); aimT = setTimeout(function () { aim = null; }, 1600);
      if (i !== cur && mapApi.canFly() && mapApi.transit) {      /* fly across the map to the next stop, then land in its chapter */
        mapApi.transit(cur >= 0 ? chapters[cur].id : null, chapters[i].id,
          { index: i, total: chapters.length, title: chapters[i].getAttribute('data-title') },
          function () { chapters[i].scrollIntoView({ behavior: 'instant', block: 'start' }); });
      } else chapters[i].scrollIntoView({ behavior: HZ.rm ? 'auto' : 'smooth', block: 'start' });
    }
    function here() { return aim !== null ? aim : cur; }
    prev.addEventListener('click', function () { go(here() - 1); });
    next.addEventListener('click', function () { go(here() + 1); });
    var start = $('#tour-start'); if (start) start.addEventListener('click', function () { go(0); });
    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'VIDEO' || (t && t.closest && t.closest('svg[tabindex]'))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(here() + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(here() < 0 ? 0 : here() - 1); }
    });
    function sync() {
      var vh = window.innerHeight, y = window.scrollY, max = root.scrollHeight - vh;
      root.style.setProperty('--page', max > 0 ? (y / max).toFixed(4) : 0);
      if (heroEl) root.style.setProperty('--hero', clamp(y / (heroEl.offsetHeight * 0.85), 0, 1).toFixed(3));
      var mid = vh * 0.42, found = -1;
      chapters.forEach(function (c, i) { var r = c.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) found = i; });
      if (found !== cur) setCur(found);
      var past = y > vh * 0.7;
      bar.classList.toggle('on', past); rail.classList.toggle('on', past);
      $('.top').classList.toggle('is-stuck', y > 8);
    }
    var ticking = false;
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; sync(); }); } }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  document.addEventListener('DOMContentLoaded', function () {
    (HZ.CONFIG.hidden || []).forEach(function (id) {
      var el = document.getElementById(id); if (el) el.remove();
      $$('[data-needs="' + id + '"]').forEach(function (x) { x.remove(); });
    });
    var chapters = $$('.chapter'), visible = {};
    chapters.forEach(function (c) { visible[c.id] = true; });
    portrait(); hero(); field();
    if (HZ.map3d) HZ.map3d.mount(visible);
    HZ.mountAll();
    reveals(); counts(); lightbox(); films(); demo();
    tour(chapters);
    var again = $('#intro-replay');
    if (again) { if (HZ.intro && !HZ.rm && window.innerWidth >= 760) again.addEventListener('click', HZ.intro.replay); else again.remove(); }
  });
})();
