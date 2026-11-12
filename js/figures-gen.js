/* figures-gen.js — live figures for the idea section, the generation thread and the speed chapter. */
(function () {
  'use strict';
  var HZ = window.HZ, h = HZ.h, tok = HZ.tok;

  /* ============ Survey: left-to-right vs. any-order generation ============ */
  HZ.register('ar-vs-mdm', function (body) {
    var W = ['Text', 'does', 'not', 'have', 'to', 'be', 'written', 'from', 'left', 'to', 'right', '.'];
    var ORDER = [6, 0, 11, 3, 8, 10, 1, 5, 9, 2, 4, 7];
    var n = W.length, p = 0, timer = 0, busy = false;
    var ar = h('div', { class: 'toks' }), md = h('div', { class: 'toks' });
    var arInfo = h('small'), mdInfo = h('small');
    var cost = h('p', { class: 'frame-note', 'aria-live': 'polite' });
    var range = h('input', { type: 'range', min: 0, max: n, value: 0, 'aria-label': 'Forward passes' });
    var play = h('button', { type: 'button', class: 'btn small solid', text: 'Play' });
    var passOut = h('span', { class: 'step-name' });

    function paint() {
      HZ.clear(ar); HZ.clear(md);
      var shown = ORDER.slice(0, Math.min(n, 3 * p));
      W.forEach(function (w, i) {
        var a = i < p ? tok(w, 'click') : tok('…', 'skip');
        if (i < p) a.addEventListener('click', function () { editAR(i); });
        ar.appendChild(a);
        var has = shown.indexOf(i) >= 0;
        var m = has ? tok(w, 'click') : tok('[MASK]', 'mask');
        if (has) m.addEventListener('click', function () { editMD(i, m); });
        md.appendChild(m);
      });
      arInfo.textContent = Math.min(p, n) + ' of ' + n + ' tokens, one per pass';
      mdInfo.textContent = shown.length + ' of ' + n + ' tokens, done in 4 passes';
      HZ.clear(passOut); passOut.appendChild(h('b', { text: 'Forward pass ' + p }));
      cost.textContent = p >= n ? 'Now click any word in either row to edit it.' : 'The diffusion row fills positions in any order, several at a time.';
    }
    function editAR(i) {
      if (busy) return; busy = true; stop();
      var kids = [].slice.call(ar.children, i);
      kids.forEach(function (k, j) { setTimeout(function () { k.className = 'tok regen'; }, j * 80); });
      cost.textContent = 'Left to right: changing word ' + (i + 1) + ' means regenerating all ' + (n - i) + ' tokens from there on.';
      setTimeout(function () { busy = false; kids.forEach(function (k) { k.className = 'tok click'; }); }, kids.length * 80 + 1400);
    }
    function editMD(i, el) {
      if (busy) return; busy = true; stop();
      var word = el.textContent; el.className = 'tok mask'; el.textContent = '[MASK]';
      cost.textContent = 'Masked diffusion: remask one position, infill it in place. Everything else stays fixed.';
      setTimeout(function () { el.className = 'tok ok'; el.textContent = word; }, 700);
      setTimeout(function () { el.className = 'tok click'; busy = false; }, 1900);
    }
    function stop() { clearInterval(timer); timer = 0; play.textContent = 'Play'; }
    function start() {
      if (p >= n) p = 0;
      play.textContent = 'Pause';
      timer = setInterval(function () { p++; range.value = p; paint(); if (p >= n) stop(); }, 420);
    }
    play.addEventListener('click', function () { timer ? stop() : start(); });
    range.addEventListener('input', function () { stop(); p = +range.value; paint(); });

    body.appendChild(h('div', { class: 'ar-row' }, h('h4', null, 'Autoregressive', arInfo), ar));
    body.appendChild(h('div', { class: 'ar-row' }, h('h4', null, 'Masked diffusion', mdInfo), md));
    body.appendChild(cost);
    body.appendChild(h('div', { class: 'ctl' }, play, range, passOut));
    paint();
    HZ.onVisible(body, function () { if (HZ.rm) { p = n; range.value = n; paint(); } else setTimeout(start, 400); }, { threshold: 0.5 });
  });

  /* ============ MDLM reasoning: reasoning-as-infilling, early exit, post-hoc ============ */
  HZ.register('infill', function (body) {
    var R = ['3', '×', '12', '=', '36', 'apples', '.', '36', '−', '9', '=', '27', 'left', '.'];
    var ORDER = [1, 3, 8, 10, 0, 2, 6, 13, 4, 7, 9, 5, 12, 11];
    var POST = [11, 9, 7, 8, 10, 4, 0, 2, 1, 3, 5, 6, 12, 13];
    var SCHED = [0, 2, 4, 6, 7, 8, 10, 11, 12, 13, 14];
    var P = [0.22, 0.31, 0.45, 0.62, 0.78, 0.90, 0.95, 0.97, 0.98, 0.99, 0.99];
    var CANDS = ['27', '36', '45', '3'];
    var STEPS = 10, mode = 'forward', gamma = 0.3;
    function dist(k) { var p = P[k], r = 1 - p; return [p, r * 0.5, r * 0.3, r * 0.2]; }
    function ent(k) { return -dist(k).reduce(function (a, q) { return a + (q > 0 ? q * Math.log(q) : 0); }, 0); }
    var HS = P.map(function (_, k) { return ent(k); });
    function exitStep() { for (var k = 0; k <= STEPS; k++) if (HS[k] < gamma) return k; return STEPS; }

    var reason = h('div', { class: 'toks' }), ans = h('div', { class: 'toks' }), cands = h('div', { class: 'cands' });
    var right = h('div'), chartBox = h('div'), postBox = h('div', { hidden: true });
    var ro = h('div', { class: 'readout' });
    var slider = h('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: gamma, 'aria-label': 'Exit threshold on answer entropy' });
    var gOut = h('span', { class: 'step-name' });

    var chart = HZ.lineChart(chartBox, {
      series: [{ name: 'Answer entropy', color: 'var(--c1)', data: HS.map(function (v, k) { return [k, v]; }) }],
      yDomain: [0, 1.4], xTicks: [0, 2, 4, 6, 8, 10], xLabel: 'Denoising step', xName: 'Step',
      yFmt: function (v) { return v.toFixed(2); }, tipFmt: function (v) { return v.toFixed(3) + ' nats'; },
      height: 240, pinned: true, label: 'Entropy of the answer block over denoising steps',
      hline: { y: gamma, label: 'exit threshold' }
    });

    var st = HZ.stepper({
      names: Array.apply(null, Array(STEPS + 1)).map(function (_, k) { return k === 0 ? 'All positions masked' : 'Denoising step ' + k + ' of ' + STEPS; }),
      interval: 800, onStep: paint,
      stopAt: function (i) { return mode === 'forward' && i >= exitStep(); }
    });

    function paint(k) {
      var e = exitStep(), fwd = mode === 'forward';
      var shown = (fwd ? ORDER : POST).slice(0, SCHED[k]);
      var exited = fwd && k >= e;
      HZ.clear(reason);
      R.forEach(function (w, i) {
        var has = shown.indexOf(i) >= 0;
        reason.appendChild(has ? tok(w) : tok(exited ? 'skipped' : '[MASK]', exited ? 'skip' : 'mask'));
      });
      HZ.clear(ans);
      ans.appendChild(fwd ? (exited ? tok('27', 'ok') : tok('[MASK]', 'mask')) : tok('27', 'given'));
      if (!fwd) ans.appendChild(h('span', { class: 'ctl-label', style: { 'align-self': 'center', 'font-family': 'var(--body)' }, text: 'filled in before reasoning starts' }));
      HZ.clear(cands);
      if (fwd) dist(k).forEach(function (p, i) {
        cands.appendChild(h('div', { class: 'cand' + (i === 0 ? ' top' : '') }, h('span', { text: CANDS[i] }),
          h('div', { class: 't' }, h('i', { style: { width: (p * 100) + '%' } })), h('span', { text: Math.round(p * 100) + '%' })));
      });
      chart.setCursor(k);
      HZ.clear(ro);
      if (fwd) {
        ro.appendChild(h('div', null, h('b', { text: HS[k].toFixed(2) }), 'answer entropy now, in nats'));
        ro.appendChild(h('div', null, h('b', { text: 'step ' + e }), 'where the model exits'));
        ro.appendChild(h('div', null, h('b', { text: Math.round((STEPS - e) / STEPS * 100) + '%' }), 'of the steps skipped'));
      }
    }
    function setGamma() {
      gamma = +slider.value;
      HZ.clear(gOut); gOut.appendChild(h('b', { text: gamma.toFixed(2) + ' nats' }));
      var e = exitStep();
      chart.update({ hline: { y: gamma, label: 'exit threshold' }, vmark: { x: e, label: 'exit', color: 'var(--ok)' } });
      paint(st.i);
    }
    slider.addEventListener('input', function () { st.stop(); setGamma(); });

    var seg = HZ.seg([{ label: 'Reason, then answer', value: 'forward' }, { label: 'Answer given, infill the reasoning', value: 'post' }], function (v) {
      mode = v; st.stop();
      chartBox.hidden = v !== 'forward'; thr.hidden = v !== 'forward'; postBox.hidden = v !== 'post';
      st.go(0); if (!HZ.rm) st.start();
    }, 'Mode');
    var thr = h('div', { class: 'ctl', style: { 'margin-top': '14px' } }, h('span', { class: 'ctl-label', text: 'Exit when answer entropy drops below' }), slider, gOut);

    postBox.appendChild(h('div', { class: 'cardlet' },
      h('h4', { text: 'Sampling the reasoning that leads to a known answer' }),
      h('p', { text: 'Pre-filling the answer block turns the same model into a sampler of reasoning traces conditioned on the answer. No human-written traces are needed, only question and answer pairs.' }),
      h('p', { text: 'Fine-tuning LLaDA-8B Base on its own posterior traces raises GSM8K accuracy by 14.9 points.' })));
    right.appendChild(chartBox); right.appendChild(postBox);

    body.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '18px' } }, seg.el));
    body.appendChild(h('div', { class: 'infill' },
      h('div', { class: 'tpl' },
        h('div', { class: 'slot' }, h('span', { text: 'Question' }), h('div', { class: 'q', text: 'Tom has 3 boxes of 12 apples and gives away 9. How many are left?' })),
        h('div', { class: 'slot' }, h('span', { text: 'Reasoning block' }), reason),
        h('div', { class: 'slot' }, h('span', { text: 'Answer block' }), ans, cands)),
      right));
    body.appendChild(thr);
    body.appendChild(h('div', { style: { 'margin-top': '14px' } }, st.el));
    body.appendChild(ro);
    setGamma(); st.go(0); st.autoplay(body);
  });

  /* ============ DRR: live detect, remask, repair ============ */
  HZ.register('drr-live', function (body) {
    var RAW = [
      'Fire', 'brigades', 'reported', ['approximately', 0.34],
      { old: ['1,800'], neu: ['2,140'], s: 0.93 },
      'lithium-ion', 'battery', 'fire', 'incidents', 'in', ['2025.', 0.27],
      'E-bike', 'fires', 'account', 'for',
      { old: ['around', 'a', 'quarter'], neu: ['over', 'a', 'third'], s: 0.88 },
      'of', 'incidents,', 'with',
      { old: ['commercial', 'storage', 'facilities', 'and', 'warehouses', 'affected.'], neu: ['nearly', 'half', 'occurring', 'in', 'private', 'homes.'], s: 0.81 },
      { old: ['Three'], neu: ['Eight'], s: 0.62 },
      'deaths', 'have', 'been', ['linked', 0.22], 'to', 'the', 'fires.'
    ];
    var ITEMS = RAW.map(function (r, i) {
      if (typeof r === 'string') return { t: r, s: 0.04 + ((i * 37) % 11) / 100 };
      if (Array.isArray(r)) return { t: r[0], s: r[1] };
      return r;
    });
    var TOTAL = ITEMS.reduce(function (a, it) { return a + (it.old ? it.old.length : 1); }, 0);
    var SPANS = ITEMS.filter(function (it) { return it.old; }).length;
    var FACTS = [['Incidents', '1,800', '2,140'], ['E-bike share', 'about 1/4', 'over 1/3'], ['Mostly in', 'warehouses', 'homes'], ['Deaths', '3', '8']];
    var stage = 0, tau = 0.5, mode = 'local';

    var kv = h('div', { class: 'kv' });
    var olds = [], news = [];
    kv.appendChild(h('span', { class: 'k' })); kv.appendChild(h('span', { class: 'k', text: 'earlier' })); kv.appendChild(h('span', { class: 'k', text: 'later' }));
    FACTS.forEach(function (f) {
      var o = h('span', { class: 'v old', text: f[1] }), n = h('span', { class: 'v neu', text: f[2] });
      olds.push(o); news.push(n);
      kv.appendChild(h('span', { class: 'k', text: f[0] })); kv.appendChild(o); kv.appendChild(n);
    });
    var toks = h('div', { class: 'toks' }), sumLabel = h('span');
    var ro = h('div', { class: 'readout' });
    var slider = h('input', { type: 'range', min: 0.2, max: 0.95, step: 0.01, value: tau, 'aria-label': 'Remask threshold on repair risk' });
    var tOut = h('span', { class: 'step-name' });

    function cell(text, cls, s, hi) {
      var c = h('span', { class: 'tk' }, tok(text, cls));
      if (stage >= 2 && mode === 'local' && s !== undefined) c.appendChild(h('i', { class: 'risk' + (hi ? ' hi' : ''), style: { '--s': s }, title: 'repair risk ' + s.toFixed(2) }));
      return c;
    }
    function paint() {
      var full = mode === 'full';
      olds.forEach(function (o) { o.classList.toggle('struck', stage >= 1); });
      news.forEach(function (n) { n.classList.toggle('in', stage >= 1); });
      HZ.clear(toks);
      var masked = 0, fixed = 0, kept = 0;
      ITEMS.forEach(function (it) {
        var flag = full ? stage >= 2 : (stage >= 2 && it.s >= tau);
        if (!it.old) {
          if (flag) masked++; else kept++;
          var cls = 'plain';
          if (full) cls = stage === 2 ? 'plain' : stage === 3 ? 'mask' : stage === 4 ? 'regen' : 'plain';
          else if (flag) cls = stage === 2 ? 'stale' : stage === 3 ? 'mask' : 'same';
          toks.appendChild(cell(full && stage === 3 ? '[MASK]' : (!full && flag && stage === 3 ? '[MASK]' : it.t), cls, it.s, flag));
          return;
        }
        if (flag) { masked += it.old.length; fixed++; } else kept += it.old.length;
        if (!flag) { it.old.forEach(function (t) { toks.appendChild(cell(t, stage >= 4 ? 'missed' : (stage >= 1 && !full ? 'plain' : 'plain'), it.s, false)); }); return; }
        if (stage === 2) it.old.forEach(function (t) { toks.appendChild(cell(t, full ? 'plain' : 'stale', it.s, true)); });
        else if (stage === 3) it.old.forEach(function () { toks.appendChild(cell('[MASK]', 'mask', it.s, true)); });
        else {
          if (!full) it.old.forEach(function (t) { toks.appendChild(cell(t, 'gone')); });
          it.neu.forEach(function (t) { toks.appendChild(cell(t, full ? 'regen' : 'ok')); });
        }
      });
      sumLabel.textContent = stage === 0 ? 'Summary, written from the earlier context' : stage === 1 ? 'Same summary, now out of date' :
        full ? 'Full regeneration: every token is rewritten' : 'Summary under localized repair';
      HZ.clear(ro);
      if (stage >= 2) {
        ro.appendChild(h('div', null, h('b', { text: masked + ' of ' + TOTAL }), full ? 'tokens rewritten' : 'tokens remasked'));
        ro.appendChild(h('div', null, h('b', { text: Math.round(kept / TOTAL * 100) + '%' }), 'of the draft kept word for word'));
        ro.appendChild(h('div', null, h('b', { text: fixed + ' of ' + SPANS }), 'stale facts ' + (stage >= 4 ? 'repaired' : 'targeted')));
      }
    }
    var st = HZ.stepper({
      names: ['Draft summary', 'New evidence arrives', 'Detect: score every token', 'Remask the risky spans', 'Repair by infilling'],
      interval: 1700, onStep: function (i) { stage = i; paint(); }
    });
    function setTau() {
      tau = +slider.value; HZ.clear(tOut); tOut.appendChild(h('b', { text: tau.toFixed(2) }));
      toks.parentNode.classList.add('no-anim'); paint();
      setTimeout(function () { toks.parentNode.classList.remove('no-anim'); }, 50);
    }
    slider.addEventListener('input', function () { st.stop(); if (stage < 2) st.go(2); setTau(); });
    var seg = HZ.seg([{ label: 'Localized repair', value: 'local' }, { label: 'Full regeneration', value: 'full' }], function (v) {
      mode = v; st.stop(); slider.disabled = v === 'full'; if (stage < 2) st.go(4); else paint();
    }, 'Update strategy');

    body.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '18px' } }, seg.el, h('span', { class: 'grow' }),
      h('span', { class: 'ctl-label', text: 'Remask when risk is above' }), slider, tOut));
    body.appendChild(h('div', { class: 'drr' },
      h('div', { class: 'cardlet' }, h('h4', { text: 'What the sources say' }), kv,
        h('p', { style: { 'margin-top': '14px', 'font-size': '14px' }, text: 'Slide the threshold down and the detector starts touching words that were fine. Slide it up and it misses the death toll.' })),
      h('div', { class: 'sum' }, sumLabel, toks)));
    body.appendChild(h('div', { class: 'legend' },
      h('span', null, h('i', { style: { '--k': 'var(--stale)' } }), 'flagged as unsupported'),
      h('span', null, h('i', { class: 'dash', style: { '--k': 'var(--mask)' } }), 'remasked'),
      h('span', null, h('i', { style: { '--k': 'var(--ok)' } }), 'repaired from the new context'),
      h('span', null, h('i', { style: { '--k': 'var(--lilac)' } }), 'regenerated')));
    body.appendChild(h('div', { style: { 'margin-top': '16px' } }, st.el));
    body.appendChild(ro);
    HZ.clear(tOut); tOut.appendChild(h('b', { text: tau.toFixed(2) }));
    st.go(0); st.autoplay(body);
  });

  /* ============ DRR: results ============ */
  HZ.register('drr-results', function (body) {
    var C = { drr: 'var(--c1)', dcr: 'var(--c2)', full: 'var(--c3)', base: 'var(--ink-3)' };
    var SETS = {
      dialogsum: {
        xDomain: [0, 4.3], yDomain: [0.80, 0.90], xTicks: [0, 1, 2, 3, 4], yTicks: [0.80, 0.82, 0.84, 0.86, 0.88, 0.90],
        hline: { y: 0.851, label: 'stale draft, 0.851' }, path: null,
        points: [
          { x: 0.89, y: 0.879, name: 'DRR', color: C.drr },
          { x: 2.78, y: 0.865, name: 'DCR', color: C.dcr, note: 'autoregressive critique and refine' },
          { x: 3.72, y: 0.826, name: 'Full regeneration', color: C.full, dx: -12 }
        ],
        read: 'DialogSum, where revisions are small and local: repair beats rewriting on faithfulness, in about a quarter of the time (0.89 s against 3.72 s). Rewriting everything actually lands below the stale draft.'
      },
      streamsum: {
        xDomain: [0, 10.6], yDomain: [0.50, 0.90], xTicks: [0, 2, 4, 6, 8, 10], yTicks: [0.5, 0.6, 0.7, 0.8, 0.9],
        hline: { y: 0.543, label: 'stale draft, 0.543' }, path: [[0.31, 0.635], [7.69, 0.690], [9.28, 0.784]], pathColor: C.drr,
        points: [
          { x: 0.31, y: 0.635, name: 'DRR, one step', color: C.drr },
          { x: 7.69, y: 0.690, name: 'DRR, iterative steering', color: C.drr, dx: -12 },
          { x: 9.28, y: 0.784, name: 'DRR, distilled + multi-sampling', color: C.drr, dx: -12 },
          { x: 9.46, y: 0.717, name: 'DCR', color: C.dcr, dx: -12, dy: 18 },
          { x: 7.73, y: 0.860, name: 'Full regeneration', color: C.full, dx: -12 }
        ],
        read: 'StreamSum, where whole events get revised: full regeneration is the right call when most of the summary must change (0.860). DRR still lifts the stale draft from 0.543 to 0.784, beats autoregressive local repair (0.717), and its one-step mode answers in 0.31 s.'
      }
    };
    HZ.tabs(body, [
      { label: 'Faithfulness against time', build: function (pane) {
        var read = h('p', { class: 'frame-note', style: { 'min-height': '0' } });
        var box = h('div');
        var cfg = function (k) {
          var s = SETS[k];
          return { points: s.points, xDomain: s.xDomain, yDomain: s.yDomain, xTicks: s.xTicks, yTicks: s.yTicks, hline: s.hline, path: s.path, pathColor: s.pathColor };
        };
        var first = cfg('dialogsum');
        first.xLabel = 'Repair time, seconds (lower is better)'; first.yLabel = 'AlignScore (higher is better)';
        first.legend = [{ name: 'DRR (ours)', color: C.drr }, { name: 'DCR, autoregressive refine', color: C.dcr }, { name: 'Full regeneration', color: C.full }];
        first.label = 'AlignScore against repair time for each update strategy';
        var seg = HZ.seg([{ label: 'DialogSum', value: 'dialogsum' }, { label: 'StreamSum', value: 'streamsum' }], function (v) {
          sc.update(cfg(v)); read.textContent = SETS[v].read;
        }, 'Dataset');
        pane.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '14px' } }, seg.el));
        pane.appendChild(box); pane.appendChild(read);
        var sc = HZ.scatter(box, first);
        read.textContent = SETS.dialogsum.read;
      } },
      { label: 'Where to edit, and what edits', build: function (pane) {
        var M = {
          as: { domain: [0.84, 0.89], axis: 'AlignScore, higher is better', fmt: function (v) { return v.toFixed(4); }, v: [0.8513, 0.8548, 0.8619, 0.8732, 0.8790] },
          ed: { domain: [0, 0.2], axis: 'Edit distance, lower is better', fmt: function (v) { return v.toFixed(4); }, v: [0, 0.1726, 0.1582, 0.1177, 0.0909] }
        };
        var NAMES = [['Stale draft', 'no repair', C.base], ['Autoregressive repair', 'random positions', C.dcr], ['Autoregressive repair', '[MASK]-DISC positions', C.dcr],
          ['Diffusion repair', 'random positions', C.drr], ['Diffusion repair (DRR)', '[MASK]-DISC positions', C.drr]];
        var rows = function (k) { return NAMES.map(function (n, i) { return { name: n[0], sub: n[1], color: n[2], value: M[k].v[i] }; }); };
        var box = h('div');
        var seg = HZ.seg([{ label: 'AlignScore', value: 'as' }, { label: 'Edit distance', value: 'ed' }], function (v) {
          dp.update({ rows: rows(v), domain: M[v].domain, axis: M[v].axis, fmt: M[v].fmt });
        }, 'Metric');
        pane.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '18px' } }, seg.el));
        pane.appendChild(box);
        var dp = HZ.dots(box, { rows: rows('as'), domain: M.as.domain, axis: M.as.axis, fmt: M.as.fmt, label: 'Ablation on DialogSum' });
        pane.appendChild(h('p', { class: 'frame-note', style: { 'min-height': '0' }, text: 'DialogSum. Both choices matter and they add up: picking positions with [MASK]-DISC instead of at random, and repairing with diffusion instead of an autoregressive model. At identical masks, diffusion repair is also faster: 0.89 s against 2.45 s.' }));
      } },
      { label: 'All numbers', build: function (pane) {
        pane.appendChild(HZ.table(
          ['Update strategy', 'DialogSum AlignScore', 'DialogSum time', 'StreamSum AlignScore', 'StreamSum time'],
          [
            ['Stale draft (early-context summary)', '0.851', 'n/a', '0.543', 'n/a'],
            ['DRR (ours)', '0.879', '0.89 s', '0.784', '9.28 s'],
            ['DRR, one step', 'n/a', 'n/a', '0.635', '0.31 s'],
            ['DRR, iterative steering', 'n/a', 'n/a', '0.690', '7.69 s'],
            ['DCR, autoregressive critique and refine', '0.865', '2.78 s', '0.717', '9.46 s'],
            ['Full regeneration', '0.826', '3.72 s', '0.860', '7.73 s']
          ],
          { num: [1, 2, 3, 4], ours: [1, 2, 3], best: [[1, 1], [1, 2], [5, 3], [2, 4]],
            caption: 'AlignScore is measured against the updated context. On StreamSum the DRR row is the distilled, multi-sampling variant. Green marks the best value in each column.' }));
      } }
    ]);
  });

  /* ============ StreamSum ============ */
  HZ.register('streamsum', function (body) {
    var EX = [
      { type: 'Numeric update', early: ['AI ROI satisfaction ', ['28%'], '; formal AI policy ', ['38%'], '.'], later: ['AI ROI satisfaction ', ['41%'], '; formal AI policy ', ['52%'], '.'] },
      { type: 'Attribution', early: ['Archive breach blamed on ', ['a lone cybercriminal'], '.'], later: ['Tied to ', ['foreign intelligence'], '; ', ['about 2,400 documents exfiltrated'], '.'] },
      { type: 'Outcome flip', early: ['Two backpackers ', ['missing and feared caught in floodwaters'], '.'], later: ['They were ', ['found alive'], '; the creek peaked lower than forecast.'] }
    ];
    var grid = h('div', { class: 'cols c3' });
    function paint(when) {
      HZ.clear(grid);
      EX.forEach(function (e) {
        var p = h('p');
        e[when].forEach(function (part) { p.appendChild(Array.isArray(part) ? h('mark', { text: part[0] }) : document.createTextNode(part)); });
        grid.appendChild(h('div', { class: 'cardlet flip ' + when }, h('h4', { text: e.type }), p));
      });
    }
    var seg = HZ.seg([{ label: 'Early report', value: 'early' }, { label: 'Later update', value: 'later' }], paint, 'Point in the timeline');
    body.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '16px' } }, seg.el,
      h('span', { class: 'ctl-label', text: 'Six revision types: outcome flip, numeric update, attribution, status, timeline, location.' })));
    body.appendChild(grid);
    body.appendChild(h('ol', { class: 'pipe', style: { 'margin-top': '18px' } },
      h('li', null, h('b', { text: 'Real news seed' }), 'An article anchors the event.'),
      h('li', null, h('b', { text: 'Update timeline' }), 'An early report is plausible; a later update revises a fact.'),
      h('li', null, h('b', { text: 'Final-state summary' }), 'The reference uses the full timeline.'),
      h('li', null, h('b', { text: 'Support filtering' }), 'Keep only clear revisions where support shifts.')));
    paint('early');
  });

  /* ============ [MASK]-DISC training ============ */
  HZ.register('disc', function (body) {
    var S = ['The', 'judge', 'revoked', 'the', 'temporary', 'injunction.'];
    var ctx = h('div', { class: 'toks' }), sum = h('div', { class: 'toks' }), note = h('p', { class: 'frame-note' });
    var NOTES = [
      'Start from a context and a summary that agree.',
      'Mask the same fact in both the source and the summary.',
      'A masked diffusion model refills the summary. Its guess is fluent, and wrong.',
      'Compare against the faithful reference: every visible token gets a label, and the detector learns a repair risk s = 1 − p(faithful) for each one.'
    ];
    var st = HZ.stepper({
      names: ['Faithful pair', 'Mask source and summary', 'Diffusion refill', 'Token-level labels'], interval: 1800,
      onStep: function (i) {
        HZ.clear(ctx); HZ.clear(sum);
        S.forEach(function (w, k) {
          var hit = k === 2;
          ctx.appendChild(hit && i >= 1 ? tok('[MASK]', 'mask') : tok(w, 'plain'));
          var cell = h('span', { class: 'tk' });
          if (!hit) cell.appendChild(tok(w, 'plain'));
          else cell.appendChild(i === 0 ? tok(w, 'plain') : i === 1 ? tok('[MASK]', 'mask') : tok('issued', i === 2 ? 'pend' : 'stale'));
          if (i === 3) cell.appendChild(h('i', { class: 'risk' + (hit ? ' hi' : ''), style: { '--s': hit ? 0.92 : 0.06 + (k % 3) * 0.03 } }));
          sum.appendChild(cell);
        });
        note.textContent = NOTES[i];
      }
    });
    body.appendChild(h('div', { class: 'cols c2' },
      h('div', { class: 'cardlet' }, h('h4', { text: 'Context' }), ctx),
      h('div', { class: 'cardlet' }, h('h4', { text: 'Summary' }), sum)));
    body.appendChild(note); body.appendChild(st.el);
    st.go(0); st.autoplay(body);
  });

  /* ============ BENGAL Living Report ============ */
  HZ.register('report', function (body) {
    var T = [['T0', 'Initial report', 'Mar 05'], ['T1', 'First update', 'Mar 06'], ['T2', 'New risk reporting', 'Mar 10'], ['T3', 'Continued disruption', 'Mar 19'], ['T4', 'Conditional passage', 'Mar 29']];
    var REV = [{}, { 1: [2, 3, 11] }, { 2: [1, 2, 5, 14, 15], 4: [0, 1, 9] }, { 2: [4, 12] }, { 0: [3, 4, 16], 3: [1, 2, 3, 10, 11] }];
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var PARAS = Array.apply(null, Array(6)).map(function () { return Array.apply(null, Array(20 + ((rnd() * 8) | 0))).map(function () { return 26 + ((rnd() * 60) | 0); }); });
    var doc = h('div', { class: 'doc' }), ro = h('div', { class: 'readout' }), cur = 0, timer = 0;
    var tl = h('ol', { class: 'tl' });
    var btns = T.map(function (t, i) {
      var b = h('button', { type: 'button', 'aria-pressed': 'false', onclick: function () { stop(); go(i); } }, h('b', { text: t[0] }), h('span', { text: t[1] }), h('small', { text: t[2] }));
      tl.appendChild(h('li', null, b)); return b;
    });
    function go(k) {
      cur = k;
      btns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === k ? 'true' : 'false'); });
      HZ.clear(doc);
      var touched = 0;
      PARAS.forEach(function (p, pi) {
        var rev = REV[k][pi] || [], el = h('div', { class: 'para' + (rev.length ? ' touched' : '') });
        if (rev.length) touched++;
        p.forEach(function (w, bi) {
          if (rev.indexOf(bi) >= 0) {
            el.appendChild(h('i', { class: 'old', style: { width: w + 'px' } }));
            el.appendChild(h('i', { class: 'neu', style: { width: (w + 10) + 'px' } }));
          } else el.appendChild(h('i', { style: { width: w + 'px' } }));
        });
        doc.appendChild(el);
      });
      HZ.clear(ro);
      ro.appendChild(h('div', null, h('b', { text: 'v' + k }), 'report version'));
      ro.appendChild(h('div', null, h('b', { text: touched + ' of 6' }), 'passages revised in this update'));
      ro.appendChild(h('div', null, h('b', { text: (6 - touched) + '' }), 'passages left exactly as they were'));
    }
    function stop() { clearInterval(timer); timer = 0; play.textContent = 'Play the timeline'; }
    var play = h('button', { type: 'button', class: 'btn small solid', text: 'Play the timeline', onclick: function () {
      if (timer) { stop(); return; }
      go(0); play.textContent = 'Pause';
      timer = setInterval(function () { if (cur >= T.length - 1) { stop(); return; } go(cur + 1); }, 1500);
    } });
    body.appendChild(h('div', { class: 'report' }, h('div', null, tl, h('div', { style: { 'margin-top': '12px' } }, play)), doc));
    body.appendChild(h('div', { class: 'legend' },
      h('span', null, h('i', { style: { '--k': 'var(--c1)' } }), 'new wording'),
      h('span', null, h('i', { class: 'dash', style: { '--k': 'var(--stale)' } }), 'replaced wording'),
      h('span', null, h('i', { style: { '--k': 'var(--line-2)' } }), 'supported text, untouched')));
    body.appendChild(ro);
    go(0);
    HZ.onVisible(body, function () { if (!HZ.rm) setTimeout(function () { play.click(); }, 500); else go(4); }, { threshold: 0.5 });
  });

  /* ============ Speed: copy-and-verify system diagram with a token walk-through ============ */
  HZ.register('speed-flow', function (body) {
    var s = HZ.s;
    var svg = s('svg', { class: 'flow', viewBox: '0 0 990 262', role: 'img',
      'aria-label': 'New transcript text and the previous summary feed a draft step: copy when a continuation is available, otherwise a 16K MTP drafter. The full-vocabulary target model verifies every proposal and commits the updated summary.' });
    var B = {};
    function box(id, x, y, w, hh, t1, t2) {
      var r = s('rect', { class: 'bx', x: x, y: y, width: w, height: hh, rx: 12 });
      svg.appendChild(r); B[id] = r;
      svg.appendChild(s('text', { class: 't1', x: x + 14, y: y + 26, text: t1 }));
      svg.appendChild(s('text', { x: x + 14, y: y + 45, text: t2 }));
    }
    var WIRES = [
      ['M200 173 C235 173 235 51 270 51', 2.2, 0], ['M200 173 H270', 1.6, 0.5], ['M200 51 C235 51 235 160 270 160', 2.2, 1.1],
      ['M510 51 C545 51 545 104 580 104', 1.8, 0.3], ['M510 173 C545 173 545 128 580 128', 1.8, 0.9], ['M770 116 H832', 1.2, 0.2],
      ['M907 147 V236 H105 V204', 5, 0]
    ];
    WIRES.forEach(function (w) { svg.appendChild(s('path', { class: 'wire', d: w[0] })); });
    svg.appendChild(s('text', { class: 'lab', x: 505, y: 228, 'text-anchor': 'middle', text: 'becomes the previous summary at the next stage' }));
    box('tr', 10, 20, 190, 62, 'New transcript text', 'revealed in four stages');
    box('pv', 10, 142, 190, 62, 'Previous summary', 'the model\'s last output');
    box('cp', 270, 20, 240, 62, 'Copy', 'when one continuation exists');
    box('mt', 270, 142, 240, 62, '16K MTP drafter', 'otherwise, eight tokens a step');
    box('tg', 580, 85, 190, 62, 'Target model verifies', 'full vocabulary, one pass');
    box('up', 832, 85, 150, 62, 'Updated summary', 'committed tokens');
    if (!HZ.rm) WIRES.forEach(function (w) {
      svg.appendChild(s('circle', { r: 4, fill: 'var(--lilac)', stroke: 'var(--panel)', 'stroke-width': 2 },
        s('animateMotion', { dur: w[1] + 's', begin: w[2] + 's', repeatCount: 'indefinite', path: w[0] })));
    });
    function light(ids) { Object.keys(B).forEach(function (k) { B[k].setAttribute('class', 'bx' + (ids.indexOf(k) >= 0 ? ' key' : '')); }); }

    var SUF = ['the', 'council', 'approved'], OLD = ['$', '5', 'million', 'for', 'the', 'bridge', 'repair', '.'], ALT = ['the', 'revised', 'schedule', 'and', 'closed', 'the', 'hearing', '.'];
    var mode = 'accept', rows = h('div', { style: { 'min-height': '96px' } }), note = h('p', { class: 'frame-note' });
    var pick = h('select', { class: 'pick', 'aria-label': 'Example' },
      h('option', { value: 'accept', text: 'The text is unchanged' }), h('option', { value: 'reject', text: 'The amount changes' }), h('option', { value: 'fallback', text: 'The continuation is ambiguous' }));
    function row(list, cls) { return h('div', { class: 'toks', style: { 'margin-bottom': '10px' } }, list.map(function (t, i) { return tok(t, typeof cls === 'function' ? cls(i) : cls); })); }
    var st = HZ.stepper({
      names: ['Commit a prefix', 'Look in the previous summary', 'Propose a block', 'Verify and commit'], interval: 1700,
      onStep: function (f) {
        HZ.clear(rows);
        var pre = function (i) { return i < 3 ? 'yes' : ''; };
        if (f === 0) { rows.appendChild(row(SUF, 'yes')); light(['up']); note.textContent = 'The last three committed tokens of the summary being written.'; }
        if (f === 1) {
          rows.appendChild(row(SUF.concat(OLD), pre));
          if (mode === 'fallback') rows.appendChild(row(SUF.concat(ALT), pre));
          light(['pv', 'cp']);
          note.textContent = mode === 'fallback' ? 'Two different continuations follow this suffix in the previous summary, so the copy path does not choose.'
            : 'In the previous summary these three tokens are followed by exactly one continuation.';
        }
        if (f === 2) {
          rows.appendChild(row(mode === 'fallback' ? ALT : OLD, 'pend'));
          light([mode === 'fallback' ? 'mt' : 'cp']);
          note.textContent = mode === 'fallback' ? 'The drafter proposes the next eight tokens from a 16,384-token shortlist built for this request.' : 'Propose the eight old tokens. They are drafts; nothing is committed yet.';
        }
        if (f === 3) {
          light(['tg', 'up']);
          if (mode === 'reject') {
            rows.appendChild(row(OLD, function (i) { return i === 0 ? 'yes' : i === 1 ? 'stale' : 'drop'; }));
            rows.appendChild(row(['7'], 'fix'));
            note.textContent = 'The target accepts the dollar sign, rejects "5", commits "7" and discards the unverified rest. Copied text that no longer fits never gets through.';
          } else {
            rows.appendChild(row(mode === 'fallback' ? ALT : OLD, 'yes'));
            note.textContent = 'One target pass checks the whole block. All eight tokens are accepted.';
          }
        }
      }
    });
    pick.addEventListener('change', function () { mode = pick.value; st.stop(); st.go(0); if (!HZ.rm) st.start(); });
    body.appendChild(h('div', { class: 'hscroll' }, svg));
    body.appendChild(h('div', { class: 'ctl', style: { margin: '18px 0 14px' } }, h('span', { class: 'ctl-label', text: 'Walk one block through it:' }), pick));
    body.appendChild(rows); body.appendChild(note); body.appendChild(st.el);
    body.appendChild(h('div', { class: 'legend' },
      h('span', null, h('i', { class: 'dash', style: { '--k': 'var(--gray)' } }), 'drafted'),
      h('span', null, h('i', { style: { '--k': 'var(--ok)' } }), 'verified and committed'),
      h('span', null, h('i', { style: { '--k': 'var(--stale)' } }), 'rejected'),
      h('span', null, h('i', { style: { '--k': 'var(--mask)' } }), 'the target\'s correction')));
    st.go(0); st.autoplay(body);
  });

  /* ============ Speed: p50 benchmark ============ */
  HZ.register('speed-bench', function (body) {
    var D = { update: [18.15, 13.30, 10.44], decode: [17.65, 9.44, 5.80] };
    var READ = {
      update: 'Paired speedup of the 16K drafter on complete updates: 1.99× against autoregressive decoding, 1.35× against full-vocabulary drafting.',
      decode: 'Paired decoding speedup of the 16K drafter: 3.16× against autoregressive decoding.'
    };
    var AX = { update: 'Complete update time, p50 (s)', decode: 'Decoding time, p50 (s)' };
    var rows = function (k) { return [
      { name: 'Fine-tuned target, autoregressive', value: D[k][0], color: '#596274', tip: 'seconds, p50' },
      { name: 'Full-vocabulary MTP8', value: D[k][1], color: '#596274', tip: 'seconds, p50' },
      { name: '16K MTP8', sub: 'context-specific shortlist of 16,384 tokens', value: D[k][2], color: 'var(--lilac)', tip: 'seconds, p50' }
    ]; };
    var box = h('div'), read = h('p', { class: 'frame-note', style: { 'min-height': '0' } }), ax = h('p', { class: 'ctl-label', style: { margin: '0 0 18px' } });
    var seg = HZ.seg([{ label: 'End-to-end update', value: 'update' }, { label: 'Decoding only', value: 'decode' }], function (v) { bars.update(rows(v)); read.textContent = READ[v]; ax.textContent = AX[v]; }, 'Latency metric');
    body.appendChild(h('div', { class: 'ctl', style: { 'margin-bottom': '16px' } }, seg.el));
    body.appendChild(ax); body.appendChild(box); body.appendChild(read);
    ax.textContent = AX.update; read.textContent = READ.update;
    var bars = HZ.bars(box, { rows: rows('update'), max: 20, fmt: function (v) { return v.toFixed(2) + ' s'; }, label: 'Median update time for three decoding systems' });
  });
  /* ============ DRR motivation: a summary going stale, then repaired ============ */
  HZ.register('stale-timeline', function (body) {
    var FEED = [['8:10 AM', 'Smoke affects the city; an air quality alert is issued.'], ['10:35 AM', 'The alert expands citywide.'],
      ['12:20 PM', 'The alert remains in effect through Friday.'], ['2:05 PM', 'The alert is lifted.']];
    var STAMP = ['written 8:10 AM', '2 h 25 min old', '4 h 10 min old', '5 h 55 min old, stale', 'flagged', 'remasked', 'repaired 2:05 PM'];
    var FOOT = ['The summary is right.', 'Still mostly right. Nobody has touched it.', 'Four hours old, and it reads exactly as confident as before.',
      'Now it is wrong.', 'Detect: the detector flags the words the new evidence no longer supports.',
      'Remask: only those positions are reopened.', 'Repair: the diffusion model infills them. Everything else is untouched.'];
    var feed = h('ol', { class: 'feed' }), items = FEED.map(function (f) { return feed.appendChild(h('li', null, h('time', { text: f[0] }), h('p', { text: f[1] }))); });
    var stamp = h('span', { class: 'stamp' }), span = h('span', { class: 's' }), foot = h('p', { class: 'board-foot' });
    var text = h('p', { class: 'board-text' }, h('span', { text: 'Smoke affects the city; ' }), span);
    var st = HZ.stepper({
      names: ['8:10 AM', '10:35 AM', '12:20 PM', '2:05 PM', 'Detect', 'Remask', 'Repair'], interval: 1500,
      onStep: function (i) {
        var k = Math.min(i, 3);
        items.forEach(function (li, j) { li.classList.toggle('on', j <= k); li.classList.toggle('now', j === k); });
        stamp.textContent = STAMP[i];
        stamp.className = 'stamp' + (i >= 3 && i < 6 ? ' old' : i === 6 ? ' fresh' : '');
        span.className = 's' + (i === 4 ? ' flag' : i === 5 ? ' mask' : i === 6 ? ' new' : '');
        span.textContent = i === 6 ? 'the alert is lifted.' : 'an air quality alert is issued.';
        foot.textContent = FOOT[i];
      }
    });
    body.appendChild(h('div', { class: 'stale-grid' }, feed,
      h('div', { class: 'board' }, h('div', { class: 'board-top' }, h('span', { text: 'Summary shown to readers' }), stamp), text, foot)));
    body.appendChild(h('div', { style: { 'margin-top': '18px' } }, st.el));
    st.go(0); st.autoplay(body);
  });
})();
