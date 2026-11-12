/* figures-next.js — sketches for the PhD directions. These are plans, not results. */
(function () {
  'use strict';
  var HZ = window.HZ, h = HZ.h, s = HZ.s;

  /* ============ Direction one: an autoregressive model and a diffusion model in one agent ============ */
  HZ.register('hybrid', function (body) {
    var svg = s('svg', { id: 'hybrid', viewBox: '0 0 600 318', role: 'img',
      'aria-label': 'An autoregressive model reasons token by token; a router hands the tool call to a diffusion model that fills every argument in parallel; a verifier rejects one argument and only that position is repaired.' });
    var ar = s('rect', { class: 'bx', x: 10, y: 10, width: 580, height: 92, rx: 14 });
    var md = s('rect', { class: 'bx', x: 10, y: 196, width: 580, height: 112, rx: 14 });
    var rt = s('rect', { class: 'bx', x: 232, y: 124, width: 136, height: 50, rx: 25 });
    svg.appendChild(s('path', { class: 'wire', d: 'M300 102 V124' })); svg.appendChild(s('path', { class: 'wire', d: 'M300 174 V196' }));
    [ar, md, rt].forEach(function (r) { svg.appendChild(r); });
    svg.appendChild(s('text', { class: 't1', x: 28, y: 38, text: 'Autoregressive model' }));
    svg.appendChild(s('text', { x: 206, y: 38, text: 'reasons in order, one token at a time' }));
    var arT = [];
    for (var i = 0; i < 12; i++) arT.push(svg.appendChild(s('rect', { class: 'arT', x: 28 + i * 46, y: 56, width: 38, height: 22, rx: 6 })));
    svg.appendChild(s('use', { href: '#bot', x: 250, y: 137, width: 24, height: 24, style: { color: 'var(--ink)' } }));
    svg.appendChild(s('text', { class: 't1', x: 282, y: 154, text: 'router' }));
    svg.appendChild(s('text', { class: 't1', x: 28, y: 224, text: 'Diffusion model' }));
    svg.appendChild(s('text', { x: 160, y: 224, text: 'fills the whole tool call in parallel' }));
    var mono = { 'font-family': 'var(--mono)', 'font-size': '14px', fill: 'var(--ink)' };
    svg.appendChild(s('text', { x: 28, y: 271, text: 'search(', style: mono }));
    var slots = [96, 164, 232, 322].map(function (x) { return svg.appendChild(s('rect', { class: 'slot', x: x, y: 252, width: 60, height: 28, rx: 7 })); });
    svg.appendChild(s('text', { x: 298, y: 271, text: ',', style: mono })); svg.appendChild(s('text', { x: 388, y: 271, text: ')', style: mono }));
    var ver = s('rect', { class: 'bx', x: 446, y: 244, width: 126, height: 44, rx: 12 }); svg.appendChild(ver);
    var verT = svg.appendChild(s('text', { class: 't1', x: 509, y: 271, 'text-anchor': 'middle', text: 'verifier' }));
    var cap = h('p', { class: 'hy-cap', 'aria-live': 'polite' }), timers = [];
    var CAPS = [
      'The autoregressive model thinks through the next step, token by token.',
      'The router hands the tool call to the diffusion model, with that reasoning prefilled.',
      'The diffusion model fills every argument at once.',
      'The verifier rejects one argument.',
      'Only that position is reopened and repaired. The agent moves on.'
    ];
    function later(fn, ms) { timers.push(setTimeout(fn, HZ.rm ? 0 : ms)); }
    var st = HZ.stepper({
      names: ['Reason', 'Route', 'Draft in parallel', 'Verify', 'Repair one position'], interval: 1900,
      onStep: function (f) {
        timers.forEach(clearTimeout); timers = [];
        cap.textContent = CAPS[f];
        ar.setAttribute('class', 'bx' + (f === 0 ? ' on' : '')); rt.setAttribute('class', 'bx' + (f === 1 ? ' on' : ''));
        md.setAttribute('class', 'bx' + (f === 2 || f === 4 ? ' on' : '')); ver.setAttribute('class', 'bx' + (f === 3 ? ' on' : ''));
        arT.forEach(function (r, k) {
          r.setAttribute('class', 'arT' + (f > 0 ? ' on' : ''));
          if (f === 0) later(function () { r.setAttribute('class', 'arT on'); }, 110 * k);
        });
        slots.forEach(function (r, k) {
          var cls = 'slot';
          if (f >= 2) cls += ' fill';
          if (f === 3 && k === 2) cls = 'slot bad';
          r.setAttribute('class', cls);
          if (f === 4 && k === 2) { r.setAttribute('class', 'slot'); later(function () { r.setAttribute('class', 'slot fill'); }, 700); }
        });
        verT.textContent = f === 3 ? 'rejects one' : f === 4 ? 'accepts' : 'verifier';
      }
    });
    body.appendChild(svg); body.appendChild(cap); body.appendChild(st.el);
    body.appendChild(h('p', { style: { margin: '14px 0 0', 'font-size': '13.5px', color: 'var(--ink-3)' }, text: 'A sketch of the system I want to build and measure. Not a result.' }));
    st.go(0); st.autoplay(body);
  });

  /* ============ Direction three: rigid against deformable ============ */
  HZ.register('cloth', function (body) {
    var svg = s('svg', { viewBox: '0 0 520 250', role: 'img', style: { width: '100%', height: 'auto' },
      'aria-label': 'A rigid cube, whose state is a pose, next to a piece of cloth, whose state is a whole shape' });
    var ink = 'var(--ink)', lineCol = 'var(--line-2)';
    function gripper(x) {
      svg.appendChild(s('path', { d: 'M' + x + ' 14 V44 M' + (x - 16) + ' 44 H' + (x + 16) + ' M' + (x - 16) + ' 44 V64 M' + (x + 16) + ' 44 V64', fill: 'none', stroke: ink, 'stroke-width': 2, 'stroke-linecap': 'round' }));
    }
    gripper(130); gripper(390);
    svg.appendChild(s('path', { d: 'M90 118 L130 96 L170 118 L130 140 Z', fill: 'var(--panel-2)', stroke: ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    svg.appendChild(s('path', { d: 'M90 118 V164 L130 186 V140 Z', fill: 'var(--panel)', stroke: ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    svg.appendChild(s('path', { d: 'M170 118 V164 L130 186 V140 Z', fill: 'var(--bg-2)', stroke: ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    var lines = [];
    for (var i = 0; i < 7; i++) lines.push(svg.appendChild(s('path', { fill: 'none', stroke: i === 0 ? ink : lineCol, 'stroke-width': i === 0 ? 1.75 : 1.25, 'stroke-linecap': 'round' })));
    svg.appendChild(s('line', { x1: 260, x2: 260, y1: 20, y2: 200, stroke: 'var(--line)', 'stroke-width': 1 }));
    var t1 = { 'font-family': 'var(--sans)', 'font-size': '15px', 'font-weight': 600, fill: ink }, t2 = { 'font-family': 'var(--sans)', 'font-size': '13.5px', fill: 'var(--ink-2)' };
    svg.appendChild(s('text', { x: 130, y: 220, 'text-anchor': 'middle', text: 'Rigid', style: t1 }));
    svg.appendChild(s('text', { x: 130, y: 240, 'text-anchor': 'middle', text: 'the state is a pose', style: t2 }));
    svg.appendChild(s('text', { x: 390, y: 220, 'text-anchor': 'middle', text: 'Deformable', style: t1 }));
    svg.appendChild(s('text', { x: 390, y: 240, 'text-anchor': 'middle', text: 'the state is a whole shape', style: t2 }));
    function paint(time) {
      lines.forEach(function (p, k) {
        var d = '', y0 = 78 + k * 17, amp = 3 + k * 2.2;
        for (var x = 0; x <= 20; x++) {
          var px = 320 + x * 7, pin = Math.exp(-Math.pow((px - 390) / 34, 2));     /* pinched where the gripper holds it */
          var y = y0 - pin * (14 - k * 1.6) + Math.sin(x * 0.55 + time * 1.6 + k * 0.5) * amp * (1 - pin * 0.8) * 0.5;
          d += (x ? 'L' : 'M') + px.toFixed(1) + ' ' + y.toFixed(1);
        }
        p.setAttribute('d', d);
      });
    }
    var on = false, raf = 0;
    function loop(now) { raf = 0; paint(now / 1000); if (on) raf = requestAnimationFrame(loop); }
    body.appendChild(svg);
    body.appendChild(h('p', { style: { margin: '10px 0 0', 'font-size': '14.5px', color: 'var(--ink-2)' }, text: 'A hypothesis to test, not a result: where does a language model\'s physical knowledge run out?' }));
    paint(0);
    HZ.onVisible(body, function (v) { on = v && !HZ.rm; if (on && !raf) raf = requestAnimationFrame(loop); }, { once: false, threshold: 0.1 });
  });
})();
