/* map3d.js — the research map as a small 3D scene, drawn on a 2D canvas with its own camera.
   Stops stand on stems above a floor grid; the three threads run left to right through time.
   The same scene is used twice: in the "path" section (hover, click, pointer parallax) and as a
   short full-screen flight from one stop to the next when the tour moves with Back / Next / arrow keys.
   Turn the flight off with HZ.CONFIG.flight = false in js/data.js. */
(function () {
  'use strict';
  var HZ = window.HZ, clamp = HZ.clamp, h = HZ.h;
  var COL = { seed: '#828b9a', gen: '#8ec5ee', eff: '#b9a4ff', agents: '#ffa873', next: '#45d6a4' };
  var INK = '#f1f3f7', INK2 = '#b6bdc9', INK3 = '#828b9a';
  var SANS = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif', SERIF = '"Newsreader", "Iowan Old Style", Georgia, serif', MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  var OVER = { pos: [0.6, 8.7, 7.5], tgt: [0.6, 0, -0.32] }, FOC = 1.38;

  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')'; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  function Scene(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = 0, H = 0, far = !!opts.flight;
    var nodes = HZ.NODES.filter(function (n) { return !n.ch || !opts.visible || opts.visible[n.ch]; }).map(function (n) {
      var lift = n.lane === 'seed' ? 0.12 : 0.3 + n.size * 0.05;
      return { n: n, p: [(n.x - 640) / 100, lift, (n.y - 300) / 100 * 1.42], col: COL[n.lane], a: 1, to: 1, s: null };
    });
    var byId = {}; nodes.forEach(function (o) { byId[o.n.id] = o; });
    var edges = HZ.EDGES.filter(function (e) { return byId[e[0]] && byId[e[1]]; }).map(function (e, i) {
      var a = byId[e[0]], b = byId[e[1]], mx = (a.p[0] + b.p[0]) / 2, pts = [], N = 26;
      for (var k = 0; k <= N; k++) {
        var t = k / N, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
        pts.push([w0 * a.p[0] + (w1 + w2) * mx + w3 * b.p[0], w0 * a.p[1] + w1 * a.p[1] + w2 * b.p[1] + w3 * b.p[1], (w0 + w1) * a.p[2] + (w2 + w3) * b.p[2]]);
      }
      var lane = b.n.lane === 'next' ? a.n.lane : b.n.lane;
      return { pts: pts, lane: lane, col: COL[lane], a: 1, to: 1, x0: Math.min(a.p[0], b.p[0]), x1: Math.max(a.p[0], b.p[0]), ph: (i * 0.37) % 1, sp: 0.16 + (i % 4) * 0.03 };
    });
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var dust = []; for (var d = 0; d < (far ? 120 : 64); d++) {
      var k = rnd();
      dust.push({ p: [(rnd() - 0.5) * (far ? 26 : 17), 0.5 + rnd() * 3.6, (rnd() - 0.6) * (far ? 16 : 9)], w: 0.10 + rnd() * 0.26, c: k > 0.9 ? '#ff6b81' : k > 0.8 ? '#f2b84b' : k > 0.68 ? '#45d6a4' : INK2, v: 0.02 + rnd() * 0.05 });
    }

    var cam = { pos: OVER.pos.slice(), tgt: OVER.tgt.slice() }, par = [0, 0], parTo = [0, 0];
    var R, U, F, P, reveal = opts.reveal === false ? 1 : 0, revealAt = 0, current = null, hover = null, fly = null, raf = 0, on = false, self = this;

    function basis() {
      P = [cam.pos[0] + par[0] * 0.9, cam.pos[1] + par[1] * 0.5, cam.pos[2]];
      F = norm(sub(cam.tgt, P)); R = norm(cross(F, [0, 1, 0])); U = cross(R, F);
    }
    function view(p) { var v = sub(p, P); return [dot(v, R), dot(v, U), dot(v, F)]; }
    function scr(v) { var k = FOC * W * 0.5 / v[2]; return [W * 0.5 + v[0] * k, H * 0.5 - v[1] * k, v[2]]; }
    function proj(p) { var v = view(p); return v[2] < 0.15 ? null : scr(v); }
    function seg(a, b) {                                  /* a 3D segment clipped against the near plane */
      var va = view(a), vb = view(b), nz = 0.15;
      if (va[2] < nz && vb[2] < nz) return null;
      if (va[2] < nz) va = mix3(va, vb, (nz - va[2]) / (vb[2] - va[2]));
      else if (vb[2] < nz) vb = mix3(vb, va, (nz - vb[2]) / (va[2] - vb[2]));
      return [scr(va), scr(vb)];
    }
    function fog(z) { return clamp(1.25 - z / (far ? 15 : 30), 0, 1); }
    function line(a, b, style, w) { var s = seg(a, b); if (!s) return; ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); ctx.stroke(); }

    this.size = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
      W = Math.max(10, r.width); H = Math.max(10, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    this.over = function () { return { pos: OVER.pos.slice(), tgt: OVER.tgt.slice() }; };
    this.closeup = function (id) {
      var o = byId[id]; if (!o) return this.over();
      return { pos: [o.p[0] - 2.2, 1.5, o.p[2] + 2.7], tgt: [o.p[0] + 1.0, 0.42, o.p[2] - 0.6] };
    };
    this.anchor = function (ch) { for (var i = 0; i < nodes.length; i++) if (nodes[i].n.ch === ch) return nodes[i].n.id; return null; };
    this.pose = function (p) { cam.pos = p.pos.slice(); cam.tgt = p.tgt.slice(); fly = null; };
    this.fly = function (to, ms, done, arc) {
      fly = { a: { pos: cam.pos.slice(), tgt: cam.tgt.slice() }, b: to, t0: performance.now(), ms: ms, done: done, arc: arc || 0 };
      kick();
    };
    this.current = function (ch) { current = ch; kick(); };
    this.filter = function (lane) {
      nodes.forEach(function (o) { o.to = (lane === 'all' || o.n.lane === lane || o.n.lane === 'next' || o.n.lane === 'seed') ? 1 : 0.14; });
      edges.forEach(function (e) { e.to = (lane === 'all' || e.lane === lane) ? 1 : 0.1; });
      kick();
    };
    this.parallax = function (x, y) { parTo = [x, y]; kick(); };
    this.hover = function (id) { if (hover !== id) { hover = id; kick(); } };
    this.hit = function (x, y) {
      var best = null, bd = 1e9;
      nodes.forEach(function (o) {
        if (!o.s || !o.n.ch) return;
        var b = o.box, inside = b && x >= b[0] - 6 && x <= b[2] + 6 && y >= b[1] - 6 && y <= b[3] + 6;
        var dd = Math.hypot(x - o.s[0], y - o.s[1]);
        if ((inside || dd < o.r + 12) && dd < bd) { bd = dd; best = o; }
      });
      return best;
    };
    this.start = function () { on = true; if (!revealAt) revealAt = performance.now(); kick(); };
    this.stop = function () { on = false; };
    this.draw = function (now) { frame(now, true); };
    function kick() { if (!raf && (on || fly)) raf = requestAnimationFrame(function (n) { frame(n); }); }

    function label(o, k, alpha) {
      var n = o.n, sc = clamp(W / 1120, 0.86, 1.2) * k, right = n.lp === 'right', up = n.lp === 'above';
      var fs = (n.big ? 17.5 : 13.5) * sc, vs = 11.5 * sc, x = o.s[0], y;
      ctx.textAlign = right ? 'left' : 'center'; ctx.textBaseline = 'alphabetic';
      if (right) { x += o.r + 10; y = o.s[1] - 1; }
      else if (up) y = o.s[1] - o.r - (n.venue ? vs + 13 : 9) * 1;
      else y = o.s[1] + o.r + fs + 5;
      if (n.anchor === 'end' && !far) { ctx.textAlign = 'right'; x += 18 * sc; }
      ctx.font = (n.big ? '500 ' : '600 ') + fs.toFixed(1) + 'px ' + (n.big ? SERIF : SANS);
      var w1 = ctx.measureText(n.name).width;
      ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(12,14,19,' + (0.85 * alpha).toFixed(3) + ')'; ctx.strokeText(n.name, x, y);
      ctx.fillStyle = rgba(INK, alpha); ctx.fillText(n.name, x, y);
      var w2 = 0;
      if (n.venue) {
        ctx.font = '500 ' + vs.toFixed(1) + 'px ' + MONO; w2 = ctx.measureText(n.venue).width;
        ctx.strokeText(n.venue, x, y + vs + 4); ctx.fillStyle = rgba(INK3, alpha); ctx.fillText(n.venue, x, y + vs + 4);
      }
      var w = Math.max(w1, w2), x0 = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x;
      o.box = [Math.min(x0, o.s[0] - o.r), Math.min(y - fs, o.s[1] - o.r), Math.max(x0 + w, o.s[0] + o.r), Math.max(y + (n.venue ? vs + 6 : 2), o.s[1] + o.r)];
    }

    function frame(now, once) {
      raf = 0;
      if (!W) self.size();
      var moving = false, i, j;
      if (fly) {
        var t = clamp((now - fly.t0) / fly.ms, 0, 1), e = ease(t);
        cam.pos = mix3(fly.a.pos, fly.b.pos, e); cam.tgt = mix3(fly.a.tgt, fly.b.tgt, e);
        cam.pos[1] += Math.sin(Math.PI * e) * fly.arc;
        if (t >= 1) { var cb = fly.done; fly = null; if (cb) cb(); } else moving = true;
      }
      par[0] += (parTo[0] - par[0]) * 0.08; par[1] += (parTo[1] - par[1]) * 0.08;
      if (Math.abs(parTo[0] - par[0]) + Math.abs(parTo[1] - par[1]) > 0.002) moving = true;
      if (reveal < 1 && revealAt) { reveal = HZ.rm ? 1 : clamp((now - revealAt) / 1900, 0, 1); moving = true; }
      var front = -7 + ease(reveal) * 14.5;                 /* the path draws itself from left to right once */
      basis();
      ctx.clearRect(0, 0, W, H);

      /* floor */
      var gx0 = far ? -16 : -7, gx1 = far ? 16 : 7, gz0 = far ? -10 : -4.4, gz1 = far ? 8 : 3.6;
      ctx.lineCap = 'round';
      for (i = Math.ceil(gx0); i <= gx1; i++) line([i, 0, gz0], [i, 0, gz1], 'rgba(130,139,154,' + (far ? 0.12 : 0.05) + ')', 1);
      for (i = Math.ceil(gz0); i <= gz1; i++) line([gx0, 0, i], [gx1, 0, i], 'rgba(130,139,154,' + (far ? 0.12 : 0.05) + ')', 1);
      HZ.YEARS.forEach(function (y) {
        var x = (y[0] - 640) / 100; if (x > front) return;
        ctx.setLineDash([2, 7]); line([x, 0, -3.5], [x, 0, 3.0], 'rgba(182,189,201,.2)', 1); ctx.setLineDash([]);
        var s = proj([x, 0, 3.32]); if (!s) return;
        var a = far ? fog(s[2]) * 0.9 : 1, k = far ? clamp(7 / s[2], 0.5, 2) : 1;
        ctx.font = '500 ' + (12.5 * k * clamp(W / 1120, 0.86, 1.2)).toFixed(1) + 'px ' + MONO; ctx.textAlign = 'center'; ctx.fillStyle = rgba(INK3, a); ctx.fillText(y[1], s[0], s[1]);
      });

      /* drifting text blocks give the space some depth */
      dust.forEach(function (q) {
        var p = [q.p[0] + Math.sin(now * 0.0001 * q.v * 40 + q.p[2]) * 0.3, q.p[1] + Math.sin(now * 0.0002 + q.p[0]) * 0.12, q.p[2]];
        var s = proj(p); if (!s) return;
        var k = FOC * W * 0.5 / s[2], w = q.w * k, hh = Math.max(1.5, 0.045 * k), a = (q.c === INK2 ? 0.07 : 0.2) * fog(s[2] * 0.8);
        if (a <= 0.004) return;
        ctx.fillStyle = rgba(q.c, a); ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(s[0] - w / 2, s[1] - hh / 2, w, hh, hh / 2); else ctx.rect(s[0] - w / 2, s[1] - hh / 2, w, hh);
        ctx.fill();
      });
      if (!HZ.rm && on) moving = true;

      /* edges: a faint trace on the floor, then the lifted line and a travelling pulse */
      edges.forEach(function (ed) {
        ed.a += (ed.to - ed.a) * 0.15; if (Math.abs(ed.to - ed.a) > 0.01) moving = true;
        var pts = ed.pts, shown = clamp((front - ed.x0) / Math.max(0.01, ed.x1 - ed.x0), 0, 1), last = Math.floor(shown * (pts.length - 1));
        if (last < 1) return;
        var pass, k;
        for (pass = 0; pass < 3; pass++) {
          ctx.beginPath(); var pen = false;
          for (k = 0; k < last; k++) {
            var a3 = pass === 0 ? [pts[k][0], 0, pts[k][2]] : pts[k], b3 = pass === 0 ? [pts[k + 1][0], 0, pts[k + 1][2]] : pts[k + 1];
            var s = seg(a3, b3); if (!s) { pen = false; continue; }
            if (!pen) { ctx.moveTo(s[0][0], s[0][1]); pen = true; }
            ctx.lineTo(s[1][0], s[1][1]);
          }
          var mid = proj(pts[Math.min(last, pts.length >> 1)]), f = mid ? (far ? fog(mid[2]) : 1) : 0, kk = mid ? clamp((far ? 6 : 10.6) / mid[2], 0.6, 3) : 1;
          ctx.strokeStyle = rgba(ed.col, (pass === 0 ? 0.13 : pass === 1 ? 0.14 : 0.9) * ed.a * f);
          ctx.lineWidth = (pass === 0 ? 1.4 : pass === 1 ? 8 : 2.3) * kk; ctx.stroke();
        }
        if (!HZ.rm && shown >= 1) {
          var u = ((now * 0.001 * ed.sp + ed.ph) % 1) * (pts.length - 1), i0 = Math.floor(u), pp = mix3(pts[i0], pts[Math.min(i0 + 1, pts.length - 1)], u - i0), sp = proj(pp);
          if (sp) { var pr = clamp((far ? 6 : 10.6) / sp[2], 0.6, 3) * 3.2, fa = (far ? fog(sp[2]) : 1) * ed.a;
            ctx.fillStyle = rgba(ed.col, 0.25 * fa); ctx.beginPath(); ctx.arc(sp[0], sp[1], pr * 2.4, 0, 6.3); ctx.fill();
            ctx.fillStyle = rgba('#ffffff', 0.9 * fa); ctx.beginPath(); ctx.arc(sp[0], sp[1], pr * 0.8, 0, 6.3); ctx.fill(); }
        }
      });

      /* stops, far to near */
      nodes.forEach(function (o) { var v = view(o.p); o.z = v[2]; o.s = v[2] < 0.3 ? null : scr(v); });
      nodes.slice().sort(function (a, b) { return b.z - a.z; }).forEach(function (o) {
        o.a += (o.to - o.a) * 0.15; if (Math.abs(o.to - o.a) > 0.01) moving = true;
        if (!o.s || o.p[0] > front + 0.05) { o.box = null; if (o.p[0] > front + 0.05) o.s = null; return; }
        var n = o.n, k = clamp((far ? 8.6 : 10.6) / o.z, 0.55, far ? 3.6 : 1.5), f = far ? fog(o.z) : 1, a = o.a * f;
        if (a < 0.02) { o.box = null; return; }
        var r = n.size * 0.82 * k * clamp(W / 1120, 0.86, 1.2); o.r = r;
        var isCur = current && n.ch === current, isHov = hover === n.id;
        var g = proj([o.p[0], 0, o.p[2]]);
        if (g) {                                                                   /* stem and its footprint on the floor */
          ctx.strokeStyle = rgba(o.col, 0.4 * a); ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(o.s[0], o.s[1]); ctx.stroke();
          ctx.fillStyle = rgba(o.col, 0.16 * a); ctx.beginPath(); ctx.ellipse(g[0], g[1], r * 1.25, r * 0.5, 0, 0, 6.3); ctx.fill();
        }
        if (isCur || isHov) {
          var pul = isCur && !HZ.rm ? 0.5 + 0.5 * Math.sin(now * 0.004) : 0.6;
          ctx.fillStyle = rgba(o.col, (0.13 + 0.12 * pul) * a); ctx.beginPath(); ctx.arc(o.s[0], o.s[1], r + 9 * k + pul * 5 * k, 0, 6.3); ctx.fill();
          if (isCur) moving = true;
        }
        var gr = ctx.createRadialGradient(o.s[0] - r * 0.35, o.s[1] - r * 0.4, r * 0.1, o.s[0], o.s[1], r);
        gr.addColorStop(0, rgba('#ffffff', 0.95 * a)); gr.addColorStop(0.35, rgba(o.col, a)); gr.addColorStop(1, rgba(o.col, 0.72 * a));
        ctx.fillStyle = rgba(o.col, 0.16 * a); ctx.beginPath(); ctx.arc(o.s[0], o.s[1], r * 1.9, 0, 6.3); ctx.fill();
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(o.s[0], o.s[1], r, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(12,14,19,' + (0.9 * a).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.stroke();
        label(o, far ? clamp(k * 0.7, 0.75, 1.9) * (isCur ? 1.18 : 1) : 1, far && !isCur ? a * 0.72 : a);
      });

      if (!once && (moving || fly) && (on || fly)) raf = requestAnimationFrame(function (n2) { frame(n2); });
    }
  }

  /* ---------- the map in the "path" section ---------- */
  var api = { setCurrent: function () {}, transit: null, canFly: function () { return false; } };
  HZ.map3d = api;
  api.mount = function (visible) {
    var canvas = HZ.$('#map3d'); if (!canvas) return;
    var sc = new Scene(canvas, { visible: visible });
    var list = HZ.$('#map-links');
    function open(ch) { var t = document.getElementById(ch); if (t) t.scrollIntoView({ behavior: HZ.rm ? 'auto' : 'smooth', block: 'start' }); }
    if (list) HZ.NODES.forEach(function (n) {
      if (n.ch && visible[n.ch]) list.appendChild(h('li', null, h('a', { href: '#' + n.ch, text: n.name + (n.venue ? ', ' + n.venue : '') })));
    });
    function at(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; }
    canvas.addEventListener('pointermove', function (e) {
      var p = at(e), o = sc.hit(p[0], p[1]);
      if (e.pointerType === 'mouse') sc.parallax((p[0] / p[2].width - 0.5) * 2, (0.5 - p[1] / p[2].height) * 2);
      canvas.style.cursor = o ? 'pointer' : ''; sc.hover(o ? o.n.id : null);
      if (o) HZ.tip.show(h('div', null, h('span', { class: 'th', text: o.n.name }), h('div', { text: o.n.blurb || '' }),
        h('div', { style: { 'margin-top': '6px', color: 'var(--ink-3)' }, text: 'Click to open the chapter' })), e.clientX, e.clientY);
      else HZ.tip.hide();
    });
    canvas.addEventListener('pointerleave', function () { sc.parallax(0, 0); sc.hover(null); HZ.tip.hide(); });
    var busy = false;
    canvas.addEventListener('click', function (e) {
      var p = at(e), o = sc.hit(p[0], p[1]); if (!o || busy) return;
      HZ.tip.hide();
      if (HZ.rm) { open(o.n.ch); return; }
      busy = true; sc.parallax(0, 0);
      sc.fly(sc.closeup(o.n.id), 720, function () {
        open(o.n.ch);
        setTimeout(function () { sc.pose(sc.over()); busy = false; sc.draw(performance.now()); }, 900);
      }, 0.5);
    });
    HZ.onVisible(canvas, function (v) { if (v) sc.start(); else sc.stop(); }, { once: false, threshold: 0.2 });
    window.addEventListener('resize', function () { sc.size(); sc.draw(performance.now()); });
    HZ.$$('.map-tools .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        HZ.$$('.map-tools .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        sc.filter(b.getAttribute('data-lane'));
      });
    });
    api.setCurrent = function (ch) { sc.current(ch); };
    sc.size(); sc.draw(performance.now());
    api._scene = sc;

    /* ---------- the flight between stops ---------- */
    var box = null, fs = null, cap = null, active = null;
    api.canFly = function () { return !HZ.rm && HZ.CONFIG.flight !== false && window.innerWidth >= 760; };
    api.transit = function (fromCh, toCh, info, jump) {
      if (active) active(true);
      if (!box) {
        cap = h('div', { class: 'transit-cap' });
        box = h('div', { id: 'transit', 'aria-hidden': 'true' }, h('canvas'), cap);
        document.body.appendChild(box);
        fs = new Scene(box.firstChild, { visible: visible, flight: true, reveal: false });
      }
      HZ.clear(cap);
      cap.appendChild(h('b', { text: (info.index + 1) + ' / ' + info.total })); cap.appendChild(h('span', { text: info.title }));
      box.classList.add('on'); fs.size();
      var a = fromCh ? fs.closeup(fs.anchor(fromCh)) : fs.over(), b = fs.closeup(fs.anchor(toCh));
      var dist = Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
      fs.pose(a); fs.current(toCh); fs.start(); fs.draw(performance.now());
      var jumped = false, timers = [];
      function doJump() { if (!jumped) { jumped = true; jump(); } }
      function finish(now) {
        timers.forEach(clearTimeout); active = null; doJump(); fs.stop();
        if (now) { box.classList.add('cut'); box.classList.remove('on'); void box.offsetWidth; box.classList.remove('cut'); }
        else box.classList.remove('on');
      }
      active = finish;
      timers.push(setTimeout(doJump, 170));
      timers.push(setTimeout(function () {
        fs.fly(b, 640 + Math.min(260, dist * 45), function () { timers.push(setTimeout(function () { if (active === finish) finish(false); }, 230)); }, 0.35 + dist * 0.16);
      }, 130));
    };
  };
  HZ.Map3DScene = Scene;
})();
