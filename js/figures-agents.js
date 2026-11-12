/* figures-agents.js — live figures for the agents thread. */
(function () {
  'use strict';
  var HZ = window.HZ, h = HZ.h;

  /* ============ OSWorld 2.0: what a ten-times-longer task looks like ============ */
  HZ.register('osworld', function (body) {
    var N1 = 30, N2 = 318;
    var FAILS = [[71, 'lost track of a constraint'], [148, 'missed information that arrived mid-task'], [203, 'guessed instead of asking the user'], [267, 'skipped verification']];
    var c1 = h('div', { class: 'cells' }), c2 = h('div', { class: 'cells' }), fails = h('div', { class: 'fails' });
    var n1 = h('span'), n2 = h('span'), a = [], b = [], i, raf = 0;
    for (i = 0; i < N1; i++) a.push(c1.appendChild(h('i')));
    for (i = 0; i < N2; i++) b.push(c2.appendChild(h('i')));
    var chips = FAILS.map(function (f) { return fails.appendChild(h('span', { text: f[1] })); });
    function set(k) {
      a.forEach(function (el, j) { el.className = j < k ? 'on' : ''; });
      b.forEach(function (el, j) { el.className = j < k ? 'on' : ''; });
      FAILS.forEach(function (f, j) { var hit = k > f[0]; if (hit) b[f[0]].className = 'fail'; chips[j].classList.toggle('on', hit); });
      n1.textContent = Math.min(k, N1) + ' of about ' + N1 + ' tool calls' + (k >= N1 ? ', done' : '');
      n2.textContent = Math.min(k, N2) + ' of ' + N2 + ' tool calls on average';
    }
    function run() {
      cancelAnimationFrame(raf);
      var t0 = performance.now(), last = -1;
      (function step(now) {
        var k = Math.min(N2, Math.floor((now - t0) / 6500 * N2));
        if (k !== last) { last = k; set(k); }
        if (k < N2) raf = requestAnimationFrame(step);
      })(t0);
    }
    body.appendChild(h('div', { class: 'horizon' },
      h('div', { class: 'hz-row' }, h('h4', null, 'A task in OSWorld 1.0', n1), c1),
      h('div', { class: 'hz-row' }, h('h4', null, 'A task in OSWorld 2.0', n2), c2, fails)));
    body.appendChild(h('div', { class: 'ctl', style: { 'margin-top': '10px' } },
      h('button', { type: 'button', class: 'btn small', text: 'Run it again', onclick: function () { HZ.rm ? set(N2) : run(); } }),
      h('span', { class: 'ctl-label', text: 'One square is one tool call; 318 is the reported average for Claude Opus 4.7 at maximum thinking. Red marks the four failure patterns the paper reports, at illustrative positions.' })));
    set(0);
    HZ.onVisible(body, function () { HZ.rm ? set(N2) : run(); }, { threshold: 0.4 });
  });

  /* ============ Staleness: synchronous, grouped asynchronous, single-rollout asynchronous ============ */
  HZ.register('staleness', function (body) {
    var W = 8, G = 4, B = 4, T = 80, SPAN = 15, SPEED = 1.35, sigma = 0.75, mode = 'group';
    var MODES = [['sync', 'Synchronous'], ['group', 'Asynchronous, grouped'], ['sao', 'Asynchronous, single rollout']];
    function dur(w, n) {
      var x = Math.sin((w + 1) * 12.9898 + (n + 1) * 78.233) * 43758.5453; x -= Math.floor(x);
      var y = Math.sin((w + 1) * 39.346 + (n + 1) * 11.135) * 24634.6345; y -= Math.floor(y);
      return HZ.clamp(Math.exp(sigma * Math.sqrt(-2 * Math.log(x + 1e-6)) * Math.cos(6.2832 * y)), 0.25, 6);
    }
    /* Every trajectory gets: a (start), b (finish), r (time it is used for an update), lag (policy updates between start and use). */
    function simulate(m) {
      var segs = [], upd = [], i, k, d;
      if (m === 'sync') {
        var t = 0;
        for (k = 0; t < T; k++) {
          var ds = [], mx = 0;
          for (i = 0; i < W; i++) { d = dur(i, k); ds.push(d); mx = Math.max(mx, d); }
          for (i = 0; i < W; i++) segs.push({ w: i, a: t, b: t + ds[i], r: t + mx, lag: 0 });
          upd.push(t + mx); t += mx + 0.3;
        }
        return { segs: segs, upd: upd };
      }
      /* A pool of always-busy workers: rollout n goes to whichever worker frees up first. Both asynchronous
         schedulers see exactly the same trajectories; they differ only in when a finished one may be used. */
      var all = [], free = [];
      for (i = 0; i < W; i++) free.push(0);
      for (var n = 0; ; n++) {
        var w = free.indexOf(Math.min.apply(null, free)), a = free[w];
        if (a >= T) break;
        d = dur(n % W, Math.floor(n / W)); all.push({ w: w, n: n, a: a, b: a + d }); free[w] = a + d + 0.04;
      }
      var batches = [];
      if (m === 'sao') {
        var byEnd = all.slice().sort(function (p, q) { return p.b - q.b; });
        for (i = 0; i + B <= byEnd.length; i += B) batches.push({ t: byEnd[i + B - 1].b, items: byEnd.slice(i, i + B) });
      } else {
        for (i = 0; i + G <= all.length; i += G) {
          var it = all.slice(i, i + G);
          batches.push({ t: Math.max.apply(null, it.map(function (r) { return r.b; })), items: it });
        }
        batches.sort(function (p, q) { return p.t - q.t; });
      }
      upd = batches.map(function (bt) { return bt.t; });
      function version(time) { var n = 0; while (n < upd.length && upd[n] <= time) n++; return n; }
      batches.forEach(function (bt, j) { bt.items.forEach(function (r) { r.r = bt.t; r.lag = j - version(r.a); segs.push(r); }); });
      all.forEach(function (r) { if (r.r === undefined) { r.r = Infinity; r.lag = 0; segs.push(r); } });
      return { segs: segs, upd: upd };
    }
    function stats(sim, now, m) {
      var n = 0, lag = 0, wait = 0, idle = 0;
      sim.segs.forEach(function (g) {
        if (g.r <= now) { n++; lag += g.lag; wait += g.r - g.b; }
        if (m === 'sync' && g.b < now) idle += Math.min(g.r + 0.3, now) - g.b;
      });
      return { idle: now > 0 ? idle / (now * W) : 0, lag: n ? lag / n : 0, wait: n ? wait / n : 0 };
    }
    var sims = {}, t = 0, raf = 0, on = false, last = 0;
    function rebuild() { MODES.forEach(function (m) { sims[m[0]] = simulate(m[0]); }); t = 0; }
    var cv = h('canvas', { role: 'img', 'aria-label': 'Rollout schedule for eight workers' });
    var cmp = h('div', { class: 'cmp' }), cells = {};
    MODES.forEach(function (m) {
      var idle = h('b'), wait = h('b'), lag = h('b');
      var el = h('div', null, h('h5', { text: m[1] }),
        h('p', null, 'GPU time idle', idle), h('p', null, 'wait before use, in rollout lengths', wait), h('p', null, 'policy lag when used', lag));
      cells[m[0]] = { el: el, idle: idle, wait: wait, lag: lag }; cmp.appendChild(el);
    });
    var RAMP = ['#434b5c', '#7d4a57', '#c05a6d', '#ff6b81'];
    function draw() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, hh = cv.clientHeight;
      if (!w) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, hh);
      var sim = sims[mode], t0 = Math.max(0, t - SPAN * 0.96), px = w / SPAN, lane = (hh - 16) / W;
      sim.segs.forEach(function (g) {
        if (Math.min(g.r, t) < t0 || g.a > t) return;
        var y = 8 + g.w * lane + 3, hgt = lane - 6;
        var x = (Math.max(g.a, t0) - t0) * px, x2 = (Math.min(g.b, t) - t0) * px;
        if (x2 - x > 0.5) {
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x + 1, y, x2 - x - 2, hgt, 4); else ctx.rect(x + 1, y, x2 - x - 2, hgt);
          ctx.fillStyle = g.r <= t ? RAMP[g.lag <= 1 ? 0 : g.lag <= 3 ? 1 : g.lag <= 5 ? 2 : 3] : '#45d6a4'; ctx.fill();
        }
        if (g.b < t && g.r > g.b + 0.02) {
          var wx = (Math.max(g.b, t0) - t0) * px, wx2 = (Math.min(g.r, t) - t0) * px;
          if (wx2 - wx > 1) { ctx.beginPath(); ctx.rect(wx + 1.5, y + 0.5, wx2 - wx - 3, hgt - 1); ctx.strokeStyle = '#6f798b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
        }
      });
      ctx.strokeStyle = 'rgba(241,243,247,.8)'; ctx.lineWidth = 1.25;
      sim.upd.forEach(function (u) { if (u < t0 || u > t) return; var x = (u - t0) * px; ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x, hh - 3); ctx.stroke(); });
      MODES.forEach(function (m) {
        var st = stats(sims[m[0]], t, m[0]), c = cells[m[0]];
        c.idle.textContent = Math.round(st.idle * 100) + '%';
        c.wait.textContent = st.wait.toFixed(2);
        c.lag.textContent = st.lag.toFixed(2) + ' updates';
        c.el.classList.toggle('on', m[0] === mode);
      });
    }
    function loop(now) {
      raf = 0;
      t += Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
      if (t > T - 4) t = 0;
      draw();
      if (on) raf = requestAnimationFrame(loop);
    }
    var seg = HZ.seg(MODES.map(function (m) { return { label: m[1], value: m[0] }; }), function (v) { mode = v; if (HZ.rm) draw(); }, 'Scheduler');
    var slider = h('input', { type: 'range', min: 0.2, max: 1.2, step: 0.05, value: sigma, 'aria-label': 'How much rollout lengths vary' });
    slider.addEventListener('input', function () { sigma = +slider.value; rebuild(); if (HZ.rm) { t = 40; draw(); } });
    body.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '16px' } }, seg.el, h('span', { class: 'grow' }),
      h('span', { class: 'ctl-label', text: 'Rollout lengths: even' }), slider, h('span', { class: 'ctl-label', text: 'very uneven' })));
    body.appendChild(h('div', { class: 'sim' }, cv));
    body.appendChild(h('div', { class: 'legend' },
      h('span', null, h('i', { style: { '--k': '#45d6a4' } }), 'rollout in flight'),
      h('span', null, h('i', { class: 'dash', style: { '--k': '#6f798b' } }), 'finished, waiting to be used'),
      h('span', null, h('i', { style: { '--k': RAMP[0] } }), 'used while fresh (at most 1 update behind)'),
      h('span', null, h('i', { style: { '--k': RAMP[1] } }), h('i', { style: { '--k': RAMP[2] } }), h('i', { style: { '--k': RAMP[3] } }), 'used when stale: 2 to 3, 4 to 5, 6 or more updates behind'),
      h('span', null, h('i', { class: 'ln', style: { '--k': '#f1f3f7' } }), 'policy update')));
    body.appendChild(cmp);
    rebuild(); seg.pick(1);
    HZ.onVisible(body, function (v) {
      on = v && !HZ.rm;
      if (HZ.rm) { t = 40; draw(); return; }
      if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }, { once: false, threshold: 0.15 });
    HZ._staleness = { simulate: simulate, stats: stats };   /* exposed for a quick sanity check */
  });
  var s = HZ.s;

  /* ============ Synthesis: one loop, three scales ============ */
  HZ.register('loop', function (body) {
    var SCALES = [
      { name: 'Tokens', r: 78,
        d: 'A summary written earlier, or a block of eight speculative tokens.',
        v: 'A token-level detector scores each word against the new evidence. A target model checks each drafted block.',
        f: 'Remask and infill only the flagged spans. Commit the verified prefix and one correction.',
        w: 'Detect, Remask, Repair; faster streaming summaries.' },
      { name: 'Reasoning', r: 124,
        d: 'A reasoning trace being infilled, with a blank reserved for the answer.',
        v: 'The entropy of the answer block, read at every step. Partial traces can be scored against a known answer.',
        f: 'Stop early once the answer settles. Sample better traces from the posterior and fine-tune on them.',
        w: 'Rethinking reasoning with masked diffusion language models.' },
      { name: 'Actions', r: 170,
        d: 'A rollout: hundreds of tool calls by an agent inside its real harness.',
        v: 'An environment with a task verifier. Long-horizon benchmarks show which checks agents skip.',
        f: 'Reinforcement learning on the verified outcome, with rollouts collected at scale.',
        w: 'OSWorld 2.0; OpenForgeRL; stale rollouts in agentic RL.' }
    ];
    /* three rings, nested like a gyroscope; the chosen one turns to face the reader */
    var clamp = HZ.clamp;
    var ARCS = [['Draft', -148, -32, '#8ec5ee'], ['Verify', -28, 88, '#f2b84b'], ['Repair', 92, 208, '#45d6a4']];
    var RAD = [0.80, 1.26, 1.72], TILT = [[1.08, 0.5], [1.0, -0.9], [1.12, 2.2]], SPIN = [0.21, -0.15, 0.11];
    var cv = h('canvas', { class: 'loop-3d', role: 'img', 'aria-label': 'Three nested rings, each made of draft, verify and repair: tokens, reasoning and actions. The selected ring faces you.' });
    var ctx = cv.getContext('2d'), W = 0, H = 0, face = [1, 0, 0], par = [0, 0], parTo = [0, 0], paths = [[], [], []];
    function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')'; }
    function solid(hex, a) {       /* the colour already mixed into the panel, so overlapping caps do not show */
      var n = parseInt(hex.slice(1), 16), m = function (c, b) { return Math.round(b + (c - b) * a); };
      return 'rgb(' + m(n >> 16, 21) + ',' + m((n >> 8) & 255, 25) + ',' + m(n & 255, 34) + ')';
    }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      W = Math.max(10, r.width); H = Math.max(10, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function point(i, deg, now, rr) {
      var a = deg * Math.PI / 180, r = rr || RAD[i], x = r * Math.cos(a), y = r * Math.sin(a), z = 0, k = 1 - face[i];
      var tx = TILT[i][0] * k, ty = (TILT[i][1] + now * 0.001 * SPIN[i]) * k + par[0] * 0.35, c, s2, t;
      c = Math.cos(tx); s2 = Math.sin(tx); t = y * c - z * s2; z = y * s2 + z * c; y = t;                  /* tip the ring back */
      c = Math.cos(ty); s2 = Math.sin(ty); t = x * c + z * s2; z = -x * s2 + z * c; x = t;                 /* then swing it round */
      c = Math.cos(par[1] * 0.3); s2 = Math.sin(par[1] * 0.3); t = y * c - z * s2; z = y * s2 + z * c; y = t;
      var d = 7.4, u = Math.min(W, H) * 0.25 * d / (d + z);
      return [W / 2 + x * u, H / 2 + y * u, z];
    }
    function draw(now) {
      if (!W) size();
      ctx.clearRect(0, 0, W, H);
      var i, j, segs = [], unit = Math.min(W, H) / 460;
      for (i = 0; i < 3; i++) { face[i] += ((i === cur ? 1 : 0) - face[i]) * (HZ.rm ? 1 : 0.085); paths[i] = []; }
      par[0] += (parTo[0] - par[0]) * 0.08; par[1] += (parTo[1] - par[1]) * 0.08;
      var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.5);
      g.addColorStop(0, 'rgba(142,197,238,.07)'); g.addColorStop(1, 'rgba(142,197,238,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (i = 0; i < 3; i++) ARCS.forEach(function (a) {
        var N = 34, prev = point(i, a[1], now);
        for (j = 1; j <= N; j++) {
          var p = point(i, a[1] + (a[2] - a[1]) * j / N, now);
          segs.push({ a: prev, b: p, z: (prev[2] + p[2]) / 2, col: a[3], ring: i }); paths[i].push(p); prev = p;
        }
      });
      segs.sort(function (x, y) { return y.z - x.z; });
      ctx.lineCap = 'round';
      segs.forEach(function (sg) {
        var f = face[sg.ring], depth = clamp(0.62 - sg.z * 0.26, 0.2, 1), al = (0.42 + 0.58 * f) * depth;
        ctx.lineCap = 'butt'; ctx.strokeStyle = rgba(sg.col, al * 0.13); ctx.lineWidth = (15 + 9 * f) * unit; ctx.beginPath(); ctx.moveTo(sg.a[0], sg.a[1]); ctx.lineTo(sg.b[0], sg.b[1]); ctx.stroke();
        ctx.lineCap = 'round'; ctx.strokeStyle = solid(sg.col, al); ctx.lineWidth = (4.5 + 5.5 * f) * unit * (0.8 + 0.3 * depth); ctx.beginPath(); ctx.moveTo(sg.a[0], sg.a[1]); ctx.lineTo(sg.b[0], sg.b[1]); ctx.stroke();
      });
      var f0 = face[cur];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + (25 * unit).toFixed(1) + 'px "Newsreader", "Iowan Old Style", Georgia, serif'; ctx.fillStyle = rgba('#f1f3f7', clamp(f0 * 1.2 - 0.2, 0, 1)); ctx.fillText(SCALES[cur].name, W / 2, H / 2);
      ctx.font = '600 ' + (13.5 * unit).toFixed(1) + 'px "Inter", system-ui, sans-serif';
      ARCS.forEach(function (a) {
        var p = point(cur, (a[1] + a[2]) / 2, now, RAD[cur] + (cur === 2 ? -0.27 : 0.26));
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(21,25,34,' + (0.9 * f0).toFixed(3) + ')'; ctx.strokeText(a[0], p[0], p[1]);
        ctx.fillStyle = rgba(a[3], clamp(f0 * 1.3 - 0.3, 0, 1)); ctx.fillText(a[0], p[0], p[1]);
      });
      for (j = 5; j >= 0; j--) {                                         /* the runner and its short tail */
        var q = point(cur, ang - j * 3.2, now), rr = (7.5 - j * 0.9) * unit;
        ctx.fillStyle = rgba('#f1f3f7', j ? 0.5 - j * 0.085 : 1); ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 6.3); ctx.fill();
        if (!j) { ctx.strokeStyle = '#151922'; ctx.lineWidth = 2.5 * unit; ctx.stroke(); }
      }
    }
    function pickAt(e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = -1, bd = 16;
      paths.forEach(function (ps, i) { ps.forEach(function (p) { var d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } }); });
      return best;
    }
    cv.addEventListener('click', function (e) { var i = pickAt(e); if (i >= 0) { auto = false; show(i); } });
    cv.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      if (e.pointerType === 'mouse') parTo = [(e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1];
      cv.style.cursor = pickAt(e) >= 0 ? 'pointer' : '';
    });
    cv.addEventListener('pointerleave', function () { parTo = [0, 0]; });
    window.addEventListener('resize', function () { size(); draw(performance.now()); });
    var title = h('h3'), rows = h('div', { class: 'loop-rows' }), where = h('p', { class: 'loop-where' });
    var cur = 0, auto = true, ang = -148;
    function show(i) {
      cur = i; var sc = SCALES[i];
      title.textContent = sc.name;
      HZ.clear(rows);
      [['draft', 'd', sc.d], ['verify', 'v', sc.v], ['repair', 'r', sc.f]].forEach(function (r) { rows.appendChild(h('div', null, h('b', { class: r[1], text: r[0] }), h('span', { text: r[2] }))); });
      where.textContent = 'In this work: ' + sc.w;
      seg.pick(i);
      if (HZ.rm || !on) draw(performance.now());
    }
    var seg = HZ.seg(SCALES.map(function (sc, i) { return { label: sc.name, value: i }; }), function (v) { auto = false; show(v); }, 'Scale');
    var on = false, raf = 0, last = 0, acc = 0;
    body.appendChild(h('div', { class: 'loop' }, cv, h('div', { class: 'loop-side' }, h('div', { style: { 'margin-bottom': '18px' } }, seg.el), title, rows, where)));
    show(0);
    function loop(now) {
      raf = 0; var dt = Math.min(50, now - last); last = now;
      ang += dt * 0.06; if (ang > 212) ang -= 360;
      acc += dt; if (auto && acc > 4600) { acc = 0; show((cur + 1) % 3); }
      draw(now);
      if (on) raf = requestAnimationFrame(loop);
    }
    HZ.onVisible(body, function (v) {
      on = v && !HZ.rm;
      if (HZ.rm) { size(); draw(0); return; }
      if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }, { once: false, threshold: 0.2 });
  });
})();
