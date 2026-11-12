/* core.js — small helpers shared by every figure. No dependencies. */
(function () {
  'use strict';
  var HZ = window.HZ = window.HZ || {};
  var NS = 'http://www.w3.org/2000/svg';

  HZ.rm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function build(e, attrs, kids) {
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.setAttribute('class', v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { e.style.setProperty(p, v[p]); });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) add(c);
        else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return e;
  }
  HZ.h = function (tag, attrs) { return build(document.createElement(tag), attrs, [].slice.call(arguments, 2)); };
  HZ.s = function (tag, attrs) { return build(document.createElementNS(NS, tag), attrs, [].slice.call(arguments, 2)); };
  HZ.$ = function (sel, root) { return (root || document).querySelector(sel); };
  HZ.$$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  HZ.clear = function (e) { while (e.firstChild) e.removeChild(e.firstChild); return e; };
  HZ.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  HZ.num = function (n) { return new Intl.NumberFormat('en-US').format(n); };

  /* run cb the first time el is on screen (or every time, with once:false) */
  HZ.onVisible = function (el, cb, opts) {
    opts = opts || {};
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (opts.once === false) cb(e.isIntersecting);
        else if (e.isIntersecting) { io.disconnect(); cb(true); }
      });
    }, { threshold: opts.threshold === undefined ? 0.3 : opts.threshold });
    io.observe(el);
  };

  /* ---------- one shared tooltip ---------- */
  var tipEl;
  HZ.tip = {
    show: function (content, x, y) {
      if (!tipEl) { tipEl = HZ.h('div', { class: 'tip', role: 'status' }); document.body.appendChild(tipEl); }
      HZ.clear(tipEl); tipEl.appendChild(content);
      tipEl.classList.add('on');
      var r = tipEl.getBoundingClientRect(), vw = window.innerWidth;
      var left = x + 14, top = y - r.height - 12;
      if (left + r.width > vw - 8) left = x - r.width - 14;
      if (left < 8) left = 8;
      if (top < 8) top = y + 18;
      tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
    },
    hide: function () { if (tipEl) tipEl.classList.remove('on'); }
  };
  HZ.tipRows = function (head, rows) {
    return HZ.h('div', null,
      head ? HZ.h('span', { class: 'th', text: head }) : null,
      rows.map(function (r) {
        return HZ.h('div', { class: 'tr' },
          r.color ? HZ.h('i', { style: { '--k': r.color } }) : null,
          HZ.h('b', { text: r.value }), HZ.h('span', { text: r.name }));
      }));
  };

  /* ---------- figure frame ---------- */
  var KIND = {
    reported: 'Numbers as reported',
    illustration: 'Illustration',
    schematic: 'Schematic',
    simulation: 'Simulation'
  };
  HZ.frame = function (mount) {
    if (mount.hasAttribute('data-bare')) return mount;
    var kind = mount.getAttribute('data-kind') || 'illustration';
    var body = HZ.h('div', { class: 'fig-body' });
    var fig = HZ.h('figure', { class: 'fig-frame' },
      HZ.h('figcaption', { class: 'fig-top' },
        HZ.h('span', { class: 'fig-title', text: mount.getAttribute('data-title') || '' }),
        HZ.h('span', { class: 'fig-kind ' + kind, title: 'What kind of figure this is' }, HZ.h('i'), mount.getAttribute('data-kind-label') || KIND[kind])),
      body);
    var note = mount.getAttribute('data-note');
    if (note) fig.appendChild(HZ.h('p', { class: 'fig-note', text: note }));
    mount.appendChild(fig);
    return body;
  };

  HZ.figures = {};
  HZ.register = function (name, fn) { HZ.figures[name] = fn; };
  HZ.mountAll = function () {
    HZ.$$('[data-fig]').forEach(function (m) {
      var fn = HZ.figures[m.getAttribute('data-fig')];
      if (!fn) return;
      try { fn(HZ.frame(m), m); }
      catch (err) { console.error('figure failed:', m.getAttribute('data-fig'), err); }
    });
  };

  /* ---------- segmented control / tabs ---------- */
  HZ.seg = function (options, onPick, label) {
    var el = HZ.h('div', { class: 'seg', role: 'group', 'aria-label': label || 'Options' });
    var btns = options.map(function (o, i) {
      var b = HZ.h('button', { type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', text: o.label,
        onclick: function () { pick(i, true); } });
      el.appendChild(b); return b;
    });
    function pick(i, fire) {
      btns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      if (fire) onPick(options[i].value, i);
    }
    return { el: el, pick: pick };
  };
  HZ.tabs = function (body, defs) {
    var panes = defs.map(function () { return HZ.h('div', { hidden: true }); });
    var built = [];
    var seg = HZ.seg(defs.map(function (d, i) { return { label: d.label, value: i }; }), show, 'Views');
    seg.el.classList.add('tabs');
    function show(i) {
      panes.forEach(function (p, j) { p.hidden = j !== i; });
      if (!built[i]) { built[i] = true; defs[i].build(panes[i]); }
    }
    body.appendChild(seg.el);
    panes.forEach(function (p) { body.appendChild(p); });
    show(0);
    return { show: function (i) { seg.pick(i); show(i); } };
  };

  /* ---------- stepper: Back / Play / Next over n named steps ---------- */
  HZ.stepper = function (opts) {
    var n = opts.names.length, i = 0, timer = 0;
    var back = HZ.h('button', { type: 'button', class: 'btn small', text: 'Back', onclick: function () { stop(); go(i - 1); } });
    var play = HZ.h('button', { type: 'button', class: 'btn small solid', text: 'Play', onclick: function () { timer ? stop() : start(); } });
    var next = HZ.h('button', { type: 'button', class: 'btn small', text: 'Next', onclick: function () { stop(); go(i + 1); } });
    var name = HZ.h('span', { class: 'step-name', 'aria-live': 'polite' });
    var dots = HZ.h('span', { class: 'dots', 'aria-hidden': 'true' }, opts.names.map(function () { return HZ.h('i'); }));
    var el = HZ.h('div', { class: 'ctl' }, back, play, next, dots, name);
    function go(k) {
      i = HZ.clamp(k, 0, n - 1);
      back.disabled = i === 0; next.disabled = i === n - 1;
      HZ.clear(name); name.appendChild(HZ.h('b', { text: opts.names[i] }));
      [].forEach.call(dots.children, function (d, j) { d.classList.toggle('on', j <= i); });
      opts.onStep(i);
    }
    function stop() { clearInterval(timer); timer = 0; play.textContent = 'Play'; }
    function start() {
      if (i >= n - 1) go(0);
      play.textContent = 'Pause';
      timer = setInterval(function () {
        if (i >= n - 1 || (opts.stopAt && opts.stopAt(i))) { stop(); return; }
        go(i + 1);
      }, opts.interval || 1200);
    }
    return { el: el, go: go, start: start, stop: stop, get i() { return i; },
      autoplay: function (target) { HZ.onVisible(target, function () { if (!HZ.rm) setTimeout(start, 400); else go(n - 1); }, { threshold: 0.45 }); } };
  };

  /* ---------- token helpers ---------- */
  HZ.tok = function (text, cls, attrs) {
    var a = { class: 'tok' + (cls ? ' ' + cls : ''), text: text };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return HZ.h('span', a);
  };

  /* ---------- charts ---------- */
  function nice(lo, hi) { var pad = (hi - lo) * 0.12 || 1e-6; return [lo - pad, hi + pad]; }
  function onResize(el, draw) {
    var w = 0;
    function check() { var nw = el.clientWidth; if (nw && Math.abs(nw - w) > 4) { w = nw; draw(nw); } }
    if ('ResizeObserver' in window) new ResizeObserver(check).observe(el);
    else window.addEventListener('resize', check);
    check();
  }

  /* Line chart with crosshair + all-series tooltip. series: [{name,color,data:[[x,y]..]}] */
  HZ.lineChart = function (mount, o) {
    var wrap = HZ.h('div', { class: 'chart' });
    var legend = HZ.h('div', { class: 'chart-legend' });
    var svg = HZ.s('svg', { role: 'img', tabindex: '0' });
    mount.appendChild(legend); mount.appendChild(wrap); wrap.appendChild(svg);
    var W = 0, cursor = null, first = true, geo = null;

    function draw(w) {
      if (w) W = w;
      if (!W) return;
      var H = o.height || 250, l = 56, r = 18, t = 14, b = o.xLabel ? 46 : 32, pw = W - l - r, ph = H - t - b;
      var xs = o.series[0].data.map(function (d) { return d[0]; });
      var ys = [].concat.apply([], o.series.map(function (s) { return s.data.map(function (d) { return d[1]; }); }));
      if (o.hline) ys.push(o.hline.y);
      var dom = o.yDomain || nice(Math.min.apply(null, ys), Math.max.apply(null, ys));
      var x0 = xs[0], x1 = xs[xs.length - 1];
      var sx = function (x) { return l + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * pw; };
      var sy = function (y) { return t + (dom[1] - y) / (dom[1] - dom[0]) * ph; };
      geo = { sx: sx, sy: sy, xs: xs, t: t, b: H - b, l: l, r: W - r };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('aria-label', o.label || 'Line chart');
      HZ.clear(svg);
      var fmt = o.yFmt || function (v) { return v.toFixed(2); };
      for (var i = 0; i <= 4; i++) {
        var v = dom[0] + (dom[1] - dom[0]) * i / 4, y = sy(v);
        svg.appendChild(HZ.s('line', { class: 'grid', x1: l, x2: W - r, y1: y, y2: y }));
        svg.appendChild(HZ.s('text', { x: l - 8, y: y + 4, 'text-anchor': 'end', text: fmt(v) }));
      }
      var ticks = o.xTicks || (xs.length <= 6 ? xs : [x0, x0 + (x1 - x0) / 4, x0 + (x1 - x0) / 2, x0 + 3 * (x1 - x0) / 4, x1].map(Math.round));
      ticks.forEach(function (x) {
        svg.appendChild(HZ.s('text', { x: sx(x), y: H - b + 18, 'text-anchor': 'middle', text: (o.xFmt || HZ.num)(x) }));
      });
      if (o.xLabel) svg.appendChild(HZ.s('text', { class: 'ax', x: l + pw / 2, y: H - 6, 'text-anchor': 'middle', text: o.xLabel }));
      if (o.hline) {
        var hy = sy(o.hline.y);
        svg.appendChild(HZ.s('line', { class: 'ref', x1: l, x2: W - r, y1: hy, y2: hy }));
        svg.appendChild(HZ.s('text', { class: 'ax', x: W - r, y: hy - 6, 'text-anchor': 'end', text: o.hline.label }));
      }
      if (o.vmark !== undefined && o.vmark !== null) {
        var vx = sx(o.vmark.x);
        svg.appendChild(HZ.s('line', { class: 'ref', x1: vx, x2: vx, y1: t, y2: H - b, 'stroke-dasharray': '0', style: { stroke: o.vmark.color || 'var(--ok)' } }));
        svg.appendChild(HZ.s('text', { class: 'lbl', x: vx + 6, y: t + 12, text: o.vmark.label }));
      }
      o.series.forEach(function (s) {
        var d = s.data.map(function (p, k) { return (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1); }).join(' ');
        var path = HZ.s('path', { class: 'ln', d: d, stroke: s.color });
        svg.appendChild(path);
        if (first && !HZ.rm && o.animate !== false) {
          var len = path.getTotalLength ? path.getTotalLength() : 1000;
          path.style.setProperty('--len', len); path.classList.add('draw');
        }
        if (s.data.length <= 4) s.data.forEach(function (p) {
          svg.appendChild(HZ.s('circle', { class: 'pt', cx: sx(p[0]), cy: sy(p[1]), r: 4.5, fill: s.color }));
        });
      });
      first = false;
      var g = HZ.s('g', { class: 'cur' }); svg.appendChild(g);
      paintCursor();
      svg.appendChild(HZ.s('rect', { x: l, y: t, width: pw, height: ph, fill: 'transparent' }));
    }
    function paintCursor() {
      var g = svg.querySelector('.cur'); if (!g || !geo) return;
      HZ.clear(g);
      if (cursor === null) return;
      var x = geo.sx(geo.xs[cursor]);
      g.appendChild(HZ.s('line', { class: 'cross', x1: x, x2: x, y1: geo.t, y2: geo.b }));
      o.series.forEach(function (s) {
        g.appendChild(HZ.s('circle', { class: 'pt', cx: x, cy: geo.sy(s.data[cursor][1]), r: 5, fill: s.color }));
      });
    }
    function nearest(clientX) {
      var r = svg.getBoundingClientRect(), px = (clientX - r.left) / r.width * W, best = 0, bd = 1e9;
      geo.xs.forEach(function (x, k) { var d = Math.abs(geo.sx(x) - px); if (d < bd) { bd = d; best = k; } });
      return best;
    }
    function tipAt(k, cx, cy) {
      var fmt = o.tipFmt || o.yFmt || function (v) { return v.toFixed(3); };
      HZ.tip.show(HZ.tipRows((o.xName || 'x') + ' ' + (o.xFmt || HZ.num)(geo.xs[k]),
        o.series.map(function (s) { return { color: s.color, value: fmt(s.data[k][1]), name: s.name }; })), cx, cy);
    }
    svg.addEventListener('pointermove', function (e) {
      if (!geo) return;
      cursor = nearest(e.clientX); paintCursor(); tipAt(cursor, e.clientX, e.clientY);
      if (o.onCursor) o.onCursor(cursor);
    });
    svg.addEventListener('pointerleave', function () {
      HZ.tip.hide();
      if (o.pinned === undefined) { cursor = null; paintCursor(); }
    });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation();
      var n = geo.xs.length;
      cursor = HZ.clamp((cursor === null ? 0 : cursor) + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1);
      paintCursor();
      var r = svg.getBoundingClientRect();
      tipAt(cursor, r.left + geo.sx(geo.xs[cursor]) / W * r.width, r.top + 30);
      if (o.onCursor) o.onCursor(cursor);
    });
    svg.addEventListener('blur', HZ.tip.hide);

    function paintLegend() {
      HZ.clear(legend);
      legend.hidden = o.series.length < 2;
      o.series.forEach(function (s) { legend.appendChild(HZ.h('span', null, HZ.h('i', { style: { '--k': s.color } }), s.name)); });
    }
    paintLegend();
    onResize(wrap, draw);
    return {
      update: function (patch) { Object.keys(patch).forEach(function (k) { o[k] = patch[k]; }); paintLegend(); draw(); },
      setCursor: function (k) { cursor = k; paintCursor(); }
    };
  };

  /* Scatter with direct labels and 24px hit targets. points: [{x,y,name,color,dx,dy,note}] */
  HZ.scatter = function (mount, o) {
    var wrap = HZ.h('div', { class: 'chart' });
    var legend = HZ.h('div', { class: 'chart-legend' });
    var svg = HZ.s('svg', { role: 'img' });
    mount.appendChild(legend); mount.appendChild(wrap); wrap.appendChild(svg);
    var W = 0;
    function draw(w) {
      if (w) W = w; if (!W) return;
      var H = o.height || 330, l = 58, r = 24, t = 18, b = 48, pw = W - l - r, ph = H - t - b;
      var xd = o.xDomain, yd = o.yDomain;
      var sx = function (x) { return l + (x - xd[0]) / (xd[1] - xd[0]) * pw; };
      var sy = function (y) { return t + (yd[1] - y) / (yd[1] - yd[0]) * ph; };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('aria-label', o.label || 'Scatter plot');
      HZ.clear(svg);
      o.yTicks.forEach(function (v) {
        svg.appendChild(HZ.s('line', { class: 'grid', x1: l, x2: W - r, y1: sy(v), y2: sy(v) }));
        svg.appendChild(HZ.s('text', { x: l - 8, y: sy(v) + 4, 'text-anchor': 'end', text: v.toFixed(2) }));
      });
      o.xTicks.forEach(function (v) {
        svg.appendChild(HZ.s('text', { x: sx(v), y: H - b + 18, 'text-anchor': 'middle', text: v + ' s' }));
      });
      svg.appendChild(HZ.s('line', { class: 'axis', x1: l, x2: W - r, y1: H - b, y2: H - b }));
      svg.appendChild(HZ.s('text', { class: 'ax', x: l + pw / 2, y: H - 8, 'text-anchor': 'middle', text: o.xLabel }));
      svg.appendChild(HZ.s('text', { class: 'ax', x: 14, y: t + ph / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (t + ph / 2) + ')', text: o.yLabel }));
      if (o.hline) {
        var hy = sy(o.hline.y);
        svg.appendChild(HZ.s('line', { class: 'ref', x1: l, x2: W - r, y1: hy, y2: hy }));
        svg.appendChild(HZ.s('text', { class: 'ax', x: W - r, y: hy + 16, 'text-anchor': 'end', text: o.hline.label }));
      }
      if (o.path) {
        var d = o.path.map(function (p, k) { return (k ? 'L' : 'M') + sx(p[0]) + ' ' + sy(p[1]); }).join(' ');
        svg.appendChild(HZ.s('path', { class: 'ln', d: d, stroke: o.pathColor, 'stroke-opacity': 0.45 }));
      }
      o.points.forEach(function (p, k) {
        var cx = sx(p.x), cy = sy(p.y);
        var c = HZ.s('circle', { class: 'pt', cx: cx, cy: cy, r: HZ.rm ? 7 : 0, fill: p.color });
        svg.appendChild(c);
        if (!HZ.rm) setTimeout(function () { c.style.transition = 'r .5s cubic-bezier(.2,1.6,.4,1)'; c.setAttribute('r', 7); }, 80 + k * 90);
        var tx = cx + (p.dx === undefined ? 12 : p.dx), anchor = (p.dx || 0) < 0 ? 'end' : 'start';
        svg.appendChild(HZ.s('text', { class: 'lbl', x: tx, y: cy + (p.dy === undefined ? 4 : p.dy), 'text-anchor': anchor, text: p.name }));
        var hit = HZ.s('circle', { cx: cx, cy: cy, r: 16, fill: 'transparent', tabindex: '0', 'aria-label': p.name + ': AlignScore ' + p.y + ', ' + p.x + ' seconds' });
        function show(e) {
          var rect = hit.getBoundingClientRect();
          HZ.tip.show(HZ.tipRows(p.name, [
            { color: p.color, value: p.y.toFixed(3), name: 'AlignScore' },
            { color: p.color, value: p.x.toFixed(2) + ' s', name: 'repair time' }
          ].concat(p.note ? [{ value: '', name: p.note }] : [])), e.clientX || rect.left + 16, e.clientY || rect.top);
        }
        hit.addEventListener('pointermove', show); hit.addEventListener('focus', show);
        hit.addEventListener('pointerleave', HZ.tip.hide); hit.addEventListener('blur', HZ.tip.hide);
        svg.appendChild(hit);
      });
    }
    function paintLegend() {
      HZ.clear(legend);
      (o.legend || []).forEach(function (s) { legend.appendChild(HZ.h('span', null, HZ.h('i', { class: 'dot', style: { '--k': s.color } }), s.name)); });
    }
    paintLegend();
    onResize(wrap, draw);
    return { update: function (patch) { Object.keys(patch).forEach(function (k) { o[k] = patch[k]; }); paintLegend(); draw(); } };
  };

  /* Horizontal bars from zero. rows: [{name, sub, value, color}] */
  HZ.bars = function (mount, o) {
    var el = HZ.h('div', { class: 'bars', role: 'img', 'aria-label': o.label || 'Bar chart' });
    mount.appendChild(el);
    function paint(rows, animate) {
      HZ.clear(el);
      rows.forEach(function (r) {
        var fill = HZ.h('div', { class: 'bar-fill', style: { '--k': r.color || 'var(--c1)' } });
        var track = HZ.h('div', { class: 'bar-track' }, fill);
        if (o.ref) track.appendChild(HZ.h('div', { class: 'bar-ref', style: { left: (o.ref.value / o.max * 100) + '%' } }, HZ.h('span', { text: o.ref.label })));
        var row = HZ.h('div', { class: 'bar-row' },
          HZ.h('div', { class: 'nm' }, r.name, r.sub ? HZ.h('small', { text: r.sub }) : null),
          track, HZ.h('div', { class: 'val', text: o.fmt(r.value) }));
        row.addEventListener('pointermove', function (e) {
          HZ.tip.show(HZ.tipRows(r.name, [{ color: r.color || 'var(--c1)', value: o.fmt(r.value), name: r.tip || o.unit || '' }]), e.clientX, e.clientY);
        });
        row.addEventListener('pointerleave', HZ.tip.hide);
        el.appendChild(row);
        var w = (r.value / o.max * 100) + '%';
        if (animate && !HZ.rm) requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = w; }); });
        else fill.style.width = w;
      });
    }
    paint(o.rows, true);
    return { update: function (rows) { paint(rows, true); } };
  };

  /* Dot plot on a truncated axis (for values that live in a narrow band). */
  HZ.dots = function (mount, o) {
    var el = HZ.h('div', { class: 'bars', role: 'img', 'aria-label': o.label || 'Dot plot' });
    var axis = HZ.h('div', { class: 'dot-axis' });
    mount.appendChild(el); mount.appendChild(axis);
    function paint(p) {
      HZ.clear(el); HZ.clear(axis);
      p.rows.forEach(function (r) {
        var dot = HZ.h('div', { class: 'dot-mark', style: { '--k': r.color || 'var(--c1)' } });
        el.appendChild(HZ.h('div', { class: 'bar-row' },
          HZ.h('div', { class: 'nm' }, r.name, r.sub ? HZ.h('small', { text: r.sub }) : null),
          HZ.h('div', { class: 'dot-track' }, dot),
          HZ.h('div', { class: 'val', text: p.fmt(r.value) })));
        var left = ((r.value - p.domain[0]) / (p.domain[1] - p.domain[0]) * 100) + '%';
        if (!HZ.rm) requestAnimationFrame(function () { requestAnimationFrame(function () { dot.style.left = left; }); });
        else dot.style.left = left;
      });
      axis.appendChild(HZ.h('span'));
      axis.appendChild(HZ.h('div', null, HZ.h('span', { text: p.fmt(p.domain[0]) }), HZ.h('span', { text: p.axis }), HZ.h('span', { text: p.fmt(p.domain[1]) })));
      axis.appendChild(HZ.h('span'));
    }
    paint(o);
    return { update: paint };
  };

  /* table from arrays: head [..], rows [[..]], opts {num:[colIdx], ours: rowIdx, best: [[r,c]], caption} */
  HZ.table = function (head, rows, opts) {
    opts = opts || {};
    var isNum = function (c) { return (opts.num || []).indexOf(c) >= 0; };
    var isBest = function (r, c) { return (opts.best || []).some(function (b) { return b[0] === r && b[1] === c; }); };
    return HZ.h('div', { class: 'tbl-wrap' },
      HZ.h('table', { class: 'tbl' },
        opts.caption ? HZ.h('caption', { text: opts.caption }) : null,
        HZ.h('thead', null, HZ.h('tr', null, head.map(function (t, c) { return HZ.h('th', { scope: 'col', class: isNum(c) ? 'num' : null, text: t }); }))),
        HZ.h('tbody', null, rows.map(function (row, r) {
          return HZ.h('tr', { class: (opts.ours || []).indexOf(r) >= 0 ? 'ours' : null }, row.map(function (cell, c) {
            var cls = (isNum(c) ? 'num' : '') + (isBest(r, c) ? ' best' : '');
            return c === 0 ? HZ.h('th', { scope: 'row' }, cell) : HZ.h('td', { class: cls || null }, cell);
          }));
        }))));
  };
})();
