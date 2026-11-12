/* intro.js — the opening: a night flight over Manhattan to Low Library, whose doors open onto the page.
   Hand-written WebGL (one ray-marched scene pass, one post pass), no libraries.
   The lit "windows" are the same text blocks as the hero background: as the camera passes,
   some go stale (rose), get masked (amber) and are repaired (mint).

   It plays once per visit on wide screens, never with reduced motion, and any click, key or scroll skips it.
   Switch it off with HZ.CONFIG.intro = false in js/data.js. Force it with ?intro=1, suppress with ?intro=0. */
(function () {
  'use strict';
  var HZ = window.HZ = window.HZ || {};
  var root = document.documentElement;
  var waiters = [], finished = !root.classList.contains('intro-on');
  HZ.afterIntro = function (fn) { if (finished) fn(); else waiters.push(fn); };
  function release() { finished = true; waiters.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); }

  var DUR = 4.8, FADE = 0.75;          /* seconds of flight, then the cross-fade into the page */

  var VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';

  var SCENE = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uT; uniform vec3 uCam; uniform vec3 uTgt; uniform float uRoll; uniform float uFoc; uniform float uOpen; uniform float uFlash;',
    'const vec2 CELL = vec2(34., 22.);',
    'const vec3 DOOR = vec3(0., 9.6, 0.4);',
    'float hash1(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);',
    '  return mix(mix(hash1(i), hash1(i+vec2(1.,0.)), f.x), mix(hash1(i+vec2(0.,1.)), hash1(i+vec2(1.,1.)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= .5; } return s; }',
    'float sdBox(vec3 p, vec3 b){ vec3 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.); }',

    /* ---- the city: one tower per grid cell, with a setback on the tall ones ---- */
    'float bh(vec2 ci){ vec2 cc = (ci + .5) * CELL;',
    '  if (abs(cc.x) < 68. && cc.y > -86. && cc.y < 76.) return 0.;',
    '  float r = hash1(ci);',
    '  float h = 14. + 60.*r*r;',
    '  if (cc.y >= 76.) h = 7. + 9.*r;',
    '  if (abs(cc.x) < 68. && cc.y < -86. && cc.y > -150.) h = min(h, 30.);',
    '  return h; }',
    'vec3 gRd; float gEdge;',
    'float city(vec3 p){',
    '  vec2 ci = floor(p.xz / CELL); vec2 q = p.xz - (ci + .5) * CELL; float h = bh(ci);',
    '  vec2 tt = (CELL*.5 - q*sign(gRd.xz)) / (abs(gRd.xz) + 1e-5); gEdge = min(tt.x, tt.y) + .03;',
    '  if (h < 1.) return 1e3;',
    '  float lo = h > 40. ? h*.68 : h;',
    '  float d = sdBox(vec3(q.x, p.y - lo*.5, q.y), vec3(11., lo*.5, 8.));',
    '  if (h > 40.) d = min(d, sdBox(vec3(q.x, p.y - h*.5, q.y), vec3(7., h*.5, 5.2)));',
    '  return d; }',

    /* ---- Low Library: steps, podium, colonnade of ten, attic, drum and dome ---- */
    'vec2 low(vec3 p){',
    '  float bound = sdBox(p - vec3(0., 20., 6.), vec3(64., 22., 56.));',
    '  if (bound > 6.) return vec2(bound, 1.);',
    '  float d = max(sdBox(p - vec3(0., 1., 7.), vec3(46., 1., 53.)), dot(p - vec3(0., 0., -46.), vec3(0., .98058, -.19612)));',
    '  d = min(d, max(sdBox(p - vec3(0., 3., -10.), vec3(21., 3., 14.)), dot(p - vec3(0., 2., -24.), vec3(0., .97014, -.24254))));',
    '  d = min(d, sdBox(vec3(abs(p.x) - 22.3, p.y - 3.6, p.z + 11.), vec3(1.3, 3.6, 13.)));',      /* cheek walls */
    '  float body = min(sdBox(p - vec3(0., 13., 22.), vec3(21., 7., 22.)), sdBox(p - vec3(0., 13., 22.), vec3(30., 7., 12.)));',
    '  body = max(body, -sdBox(p - vec3(0., 9.6, 2.5), vec3(1.9, 3.6, 2.7)));',                     /* the doorway */
    '  body = min(body, sdBox(p - vec3(0., 20.3, 22.), vec3(21.7, .45, 22.7)));',                    /* cornice */
    '  body = min(body, sdBox(p - vec3(0., 22.2, 22.), vec3(17., 1.6, 17.)));',                      /* attic */
    '  body = min(body, max(length(p.xz - vec2(0., 22.)) - 14.6, abs(p.y - 26.) - 2.4));',           /* drum */
    '  vec3 qd = (p - vec3(0., 28., 22.)) / vec3(14.1, 9.6, 14.1);',
    '  body = min(body, (length(qd) - 1.) * 9.4);',                                                  /* dome */
    '  d = min(d, body);',
    '  float cx = clamp(floor(p.x / 3.8), -5., 4.); vec2 qc = vec2(p.x - (cx + .5)*3.8, p.z + 3.4);',
    '  float ang = atan(qc.y, qc.x);',
    '  float col = max(length(qc) - (.86 - .035*abs(sin(ang*8.)) - .006*(p.y - 6.)), abs(p.y - 11.3) - 5.2);',
    '  col = min(col, sdBox(vec3(qc.x, p.y - 16.25, qc.y), vec3(1.12, .3, 1.12)));',
    '  col = min(col, sdBox(vec3(qc.x, p.y - 6.25, qc.y), vec3(1.12, .25, 1.12)));',
    '  d = min(d, col);',
    '  d = min(d, sdBox(p - vec3(0., 17.75, -2.1), vec3(19.8, 1.2, 2.7)));',                         /* entablature */
    '  d = min(d, sdBox(p - vec3(0., 19.4, -1.9), vec3(20.3, .45, 3.1)));',
    '  float m = 1.;',
    '  vec2 e1 = vec2(-cos(uOpen*1.5), sin(uOpen*1.5)); vec2 q2 = vec2(abs(p.x) - 1.9, p.z);',      /* two door leaves */
    '  float leaf = sdBox(vec3(dot(q2, e1) - .95, p.y - 9.6, dot(q2, vec2(e1.y, -e1.x))), vec3(.95, 3.6, .09));',
    '  if (leaf < d) { d = leaf; m = 4.; }',
    '  float hall = sdBox(vec3(abs(p.x) - 55., p.y - 9., p.z + 26.), vec3(9., 9., 30.));',          /* flanking halls */
    '  if (hall < d) { d = hall; m = 5.; }',
    '  return vec2(d, m); }',

    'vec2 map(vec3 p){',
    '  vec2 r = vec2(p.y, 3.);',
    '  float c = city(p); if (c < r.x) r = vec2(c, 2.);',
    '  vec2 l = low(p); if (l.x < r.x) r = l;',
    '  return r; }',
    'vec3 normal(vec3 p){ vec2 e = vec2(.012, -.012);',
    '  return normalize(e.xyy*map(p + e.xyy).x + e.yyx*map(p + e.yyx).x + e.yxy*map(p + e.yxy).x + e.xxx*map(p + e.xxx).x); }',

    /* light from the doorway, striped by the ten columns in front of it */
    'float doorLight(vec3 p){',
    '  vec3 v = p - DOOR; float front = -v.z; if (front < .02) return 0.;',
    '  float d2 = dot(v, v); float lobe = front / sqrt(d2); float sh = 1.;',
    '  if (front > 3.8) { float k = 3.8/front; float xc = v.x*k; float yc = DOOR.y + v.y*k;',
    '    float dc = abs(mod(xc + 190., 3.8) - 1.9);',
    '    float c = mix(smoothstep(.5, 1.45, dc), 1., step(19.6, abs(xc)));',
    '    sh = c * smoothstep(17.2, 15.4, yc) * smoothstep(5.2, 6.4, yc + (front - 3.8)*.06); }',
    '  return lobe*lobe*sh / (1. + d2*.011); }',

    /* window rows drawn as blocks of text; state runs neutral, stale, masked, repaired as the camera nears */
    'vec4 bars(vec2 uv, vec2 seed, float pz, float dist){',
    '  vec2 g = vec2(uv.x/2.5, uv.y/2.05); vec2 id = floor(g); vec2 f = fract(g);',
    '  float r = hash1(id + seed*7.31), r2 = hash1(id*1.7 + seed + 3.1);',
    '  float len = .38 + .52*r2; float aa = clamp(dist*.0035, .03, .35);',
    '  float m = smoothstep(.07, .07 + aa, f.x)*smoothstep(len, len - aa, f.x)*smoothstep(.34, .34 + aa, f.y)*smoothstep(.68, .68 - aa, f.y);',
    '  m *= step(.26, r);',
    '  vec3 c = vec3(.50, .60, .86)*(.03 + .17*r2*r2)*(1. + smoothstep(120., 420., dist)*2.2);',
    '  if (r > .72) { float s = (uCam.z + 150. - pz)/40. - r2*.45;',
    '    vec3 rose = vec3(1., .20, .33)*1.5, amber = vec3(1., .58, .10)*1.25, mint = vec3(.08, .78, .47)*1.25;',
    '    if (s > 0.) c = mix(c, rose, smoothstep(0., .12, s));',
    '    if (s > 2.) { c = mix(rose, amber, smoothstep(2., 2.12, s)); float hole = step(.16, f.x - .07)*step(f.x, len - .16)*step(.42, f.y)*step(f.y, .60); c *= 1. - .8*hole*step(dist, 150.); }',
    '    if (s > 2.8) c = mix(amber, mint, smoothstep(2.8, 2.95, s));',
    '    if (s > 4.6) c = mix(mint, mint*.6, smoothstep(4.6, 5.6, s)); }',
    '  return vec4(c*m, m); }',

    'float beams(vec3 ro, vec3 rd, float tHit, float jit){',
    '  vec3 lo = vec3(-34., 0., -82.), hi = vec3(34., 30., -.2);',
    '  vec3 inv = 1./(rd + vec3(1e-5)); vec3 a = (lo - ro)*inv, b = (hi - ro)*inv;',
    '  vec3 mn = min(a, b), mx = max(a, b); float t0 = max(max(mn.x, mn.y), max(mn.z, 0.)), t1 = min(min(mx.x, mx.y), min(mx.z, tHit));',
    '  if (t1 <= t0) return 0.;',
    '  float dt = (t1 - t0)/22., g = 0.;',
    '  for (int i = 0; i < 22; i++){ g += doorLight(ro + rd*(t0 + (float(i) + jit)*dt)); }',
    '  return g*dt; }',
    'vec3 sky(vec3 rd){',
    '  float h = max(rd.y, 0.);',
    '  vec3 c = mix(vec3(.016, .020, .044), vec3(.0025, .0032, .008), pow(h, .5));',
    '  c += vec3(.10, .055, .085)*pow(1. - h, 12.)*.34;',
    '  vec3 md = normalize(vec3(.40, .40, .82)); float m = max(dot(rd, md), 0.);',
    '  c += vec3(.75, .85, 1.)*(smoothstep(.9991, .9994, m)*1.6 + pow(m, 180.)*.35 + pow(m, 14.)*.07);',
    '  vec2 cp = rd.xz/(rd.y + .12); float cl = smoothstep(.48, .86, fbm(cp*1.3 + vec2(uT*.02, 0.)));',
    '  c = mix(c, vec3(.012, .015, .030) + vec3(.22, .27, .40)*pow(m, 6.), cl*.55*smoothstep(0., .16, rd.y));',
    '  vec2 sp = vec2(atan(rd.x, rd.z)*150., rd.y*230.); vec2 si = floor(sp); float st = fract(sin(dot(si, vec2(127.1, 311.7)))*43758.5453);',
    '  float sd = length(fract(sp) - .5);',
    '  c += vec3(.8, .9, 1.)*step(.985, st)*smoothstep(.32, .05, sd)*(1. - cl)*smoothstep(.05, .3, rd.y)*(.25 + .75*fract(st*91.7));',
    '  return c; }',

    'float march(vec3 ro, vec3 rd, float t, float tmax, int n, out float mat, out float glow){',
    '  mat = 0.; glow = 0.; gRd = rd;',
    '  for (int i = 0; i < 110; i++){',
    '    if (i >= n) break;',
    '    vec3 p = ro + rd*t; vec2 r = map(p);',
    '    if (r.x < .0015*t + .004) { mat = r.y; break; }',
    '    t += min(r.x, gEdge);',
    '    if (t > tmax || (p.y > 78. && rd.y > 0.)) break;',
    '  }',
    '  gRd = vec3(0.);',
    '  return t; }',

    'vec3 shade(vec3 p, vec3 rd, float mat, float t, out float refl, out vec3 n, out float em){',
    '  n = normal(p); refl = 0.; em = 0.;',
    '  vec3 md = normalize(vec3(.40, .40, .82));',
    '  float moon = max(dot(n, md), 0.);',
    '  float lamp = (.07 + uOpen*1.25) * doorLight(p) * max(dot(n, normalize(DOOR - p)), 0.) * 26.;',
    '  vec3 lampC = vec3(1., .93, .80);',
    '  vec3 amb = vec3(.012, .016, .030)*(.6 + .4*n.y);',
    '  vec3 c;',
    '  if (mat < 1.5) {',                                                      /* limestone */
    '    vec3 alb = vec3(.60, .58, .54)*(.86 + .22*noise(p.xy*1.7 + p.z));',
    '    float ao = clamp(.35 + .65*map(p + n*1.4).x/1.4, 0., 1.);',
    '    if (n.y > .1 && n.y < .995) alb *= .72 + .28*smoothstep(.0, .22, abs(fract(p.y/.34) - .5));',   /* stair risers */
    '    float flood = max(dot(n, normalize(vec3(.0, -.35, -1.))), 0.)*smoothstep(46., 6., p.y)*smoothstep(-60., -8., p.z);',
    '    c = alb*(amb*1.6 + moon*vec3(.10, .14, .24) + flood*vec3(1., .70, .40)*.30*ao + lamp*lampC)*ao;',
    '    if (p.z > -.06 && p.z < .12 && abs(n.z) > .9 && p.y > 6.) {',              /* tall windows behind the columns */
    '      float wx = abs(mod(p.x + 190., 3.8) - 1.9), inx = step(wx, .78)*step(3.2, abs(p.x))*step(abs(p.x), 18.);',
    '      float wy = smoothstep(7.4, 7.6, p.y)*smoothstep(14.2, 14., p.y);',
    '      float bar = step(.07, abs(fract(p.y/1.65) - .5))*step(.06, wx);',
    '      float w = inx*wy*bar; c += vec3(1., .78, .46)*w*(.75 + uOpen*.6); em = w*.55; }',
    '    if (abs(p.x) < 1.95 && p.y > 5.9 && p.y < 13.3 && p.z > .25 && p.z < 5.4) { c = vec3(1., .95, .86)*(3. + 6.*uOpen); em = 1.; }',
    '  } else if (mat < 2.5) {',                                               /* towers */
    '    c = vec3(.006, .007, .011) + moon*vec3(.012, .016, .030) + amb*.3;',
    '    if (abs(n.y) < .5) {',
    '      vec2 ci = floor(p.xz / CELL); vec2 uv = abs(n.x) > abs(n.z) ? vec2(p.z, p.y) : vec2(p.x, p.y);',
    '      vec4 b = bars(uv, ci + (abs(n.x) > abs(n.z) ? 0. : 11.), p.z, t);',
    '      c += b.rgb; em = clamp(max(b.r, max(b.g, b.b))*.6, 0., 1.);',
    '    }',
    '  } else if (mat < 3.5) {',                                               /* wet ground */
    '    bool plaza = abs(p.x) < 68. && p.z > -86. && p.z < 76.;',
    '    vec2 tl = abs(fract(p.xz/(plaza ? 5. : 60.)) - .5);',
    '    float wet = smoothstep(.25, .7, fbm(p.xz*.09));',
    '    vec3 alb = plaza ? vec3(.085, .082, .080)*(1. - .4*smoothstep(.47, .5, max(tl.x, tl.y))) : vec3(.022, .024, .030);',
    '    c = alb*(amb*2. + moon*vec3(.10, .14, .24)*.6 + lamp*lampC);',
    '    if (!plaza) { vec2 lp = vec2(abs(fract(p.x/34. + .5) - .5)*34., abs(fract(p.z/11.) - .5)*11.); vec2 lq = vec2(abs(fract(p.z/22. + .5) - .5)*22., abs(fract(p.x/8.5) - .5)*8.5);',
    '      float pool = exp(-dot(lp, lp)*.09) + .7*exp(-dot(lq, lq)*.16); c += vec3(1., .74, .46)*pool*.12; em = pool*.16; }',
    '    refl = (plaza ? .50 : .55) + .35*wet;',
    '    n = normalize(n + vec3(noise(p.xz*2.3) - .5, 0., noise(p.xz*2.3 + 9.) - .5)*.035*(.4 + wet));',
    '  } else if (mat < 4.5) {',                                               /* bronze doors */
    '    vec2 pu = vec2(abs(p.x), p.y - 6.); vec2 pf = abs(fract(pu/vec2(.95, 1.8)) - .5);',
    '    c = vec3(.20, .13, .07)*(.5 + .5*smoothstep(.34, .40, max(pf.x, pf.y)))*(amb*5. + .12 + lamp*lampC*.6);',
    '  } else {',                                                              /* campus halls */
    '    c = vec3(.022, .015, .013)*(.6 + moon*1.2) + amb*.5 + vec3(.11, .075, .06)*lamp;',
    '    if (abs(n.y) < .5) { vec2 uv = abs(n.x) > abs(n.z) ? vec2(p.z, p.y) : vec2(p.x, p.y);',
    '      vec2 g = uv/vec2(4.2, 4.4); vec2 f = fract(g); float r = hash1(floor(g) + step(0., p.x)*5.);',
    '      float w = step(.3, f.x)*step(f.x, .7)*step(.28, f.y)*step(f.y, .78)*step(.45, r)*step(1.5, p.y);',
    '      c += vec3(1., .74, .42)*w*(.25 + .5*r); em = w*.3; }',
    '  }',
    '  return c; }',

    'vec3 fogc(vec3 rd){ return mix(vec3(.011, .014, .030), vec3(.003, .004, .009), smoothstep(-.05, .5, rd.y)) + vec3(.022, .012, .020)*pow(1. - abs(rd.y), 8.); }',

    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;',
    '  float cr = cos(uRoll), sr = sin(uRoll); uv = mat2(cr, -sr, sr, cr)*uv;',
    '  vec3 f = normalize(uTgt - uCam), s = normalize(cross(f, vec3(0., 1., 0.))), u = cross(s, f);',
    '  vec3 rd = normalize(f*uFoc + s*uv.x + u*uv.y);',
    '  float jit = hash1(gl_FragCoord.xy + fract(uT)*61.);',
    '  float mat, glow; float t = march(uCam, rd, .2 + jit*.8, 640., 110, mat, glow);',
    '  glow = beams(uCam, rd, mat > .5 ? t : 1e4, jit);',
    '  vec3 col; float em = 0.;',
    '  vec3 skyc = sky(rd);',
    '  if (mat > .5) {',
    '    vec3 p = uCam + rd*t; float refl; vec3 n; ',
    '    col = shade(p, rd, mat, t, refl, n, em);',
    '    if (refl > 0.) {',
    '      vec3 r2 = reflect(rd, n); float m2, g2; float t2 = march(p + n*.05, r2, .3, 260., 44, m2, g2);',
    '      vec3 rc;',
    '      if (m2 > .5) { float rf; vec3 nn; float e2; vec3 p2 = p + n*.05 + r2*t2; rc = shade(p2, r2, m2, t2, rf, nn, e2);',
    '        rc = mix(fogc(r2), rc, exp(-t2*.0030)); em = max(em, e2*.5); }',
    '      else rc = sky(r2);',
    '      rc += vec3(1., .93, .8)*beams(p, r2, m2 > .5 ? t2 : 1e4, jit)*(.06 + uOpen)*.012;',
    '      float fr = refl*(.25 + .75*pow(1. - max(dot(-rd, n), 0.), 3.));',
    '      col = mix(col, rc, clamp(fr, 0., .92));',
    '    }',
    '    float fg = exp(-t*.0030*(.45 + .55*exp(-max(uCam.y, 0.)*.02)));',
    '    col = mix(fogc(rd), col, fg);',
    '  } else col = skyc;',
    '  float g = glow*(.04 + uOpen*1.3)*.05;',
    '  col += vec3(1., .93, .80)*g;',
    '  em = max(em, clamp(g*.7, 0., 1.));',
    '  col = mix(col, vec3(1.25, 1.27, 1.30), uFlash);',
    '  col *= smoothstep(0., .3, uT);',
    '  col = 1. - exp(-col*1.55);',
    '  gl_FragColor = vec4(sqrt(col), em);',
    '}'
  ].join('\n');

  /* post: zoom blur for speed, bloom from the glow mask, vignette, grain */
  var POST = [
    'precision highp float;',
    'uniform sampler2D uTex; uniform vec2 uRes; uniform float uBlur; uniform float uT; uniform float uFlash;',
    'float hash1(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'vec4 tx(vec2 uv){ vec4 c = texture2D(uTex, uv); c.rgb *= c.rgb; return c; }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/uRes; vec2 d = uv - vec2(.5, .47);',
    '  float n = hash1(gl_FragCoord.xy + fract(uT)*17.);',
    '  vec3 col = vec3(0.); float wsum = 0.;',
    '  for (int i = 0; i < 9; i++){ float k = (float(i) + n)/9.; float w = 1. - k*.6;',
    '    col += tx(uv - d*k*uBlur*dot(d, d)*2.2).rgb*w; wsum += w; }',
    '  col /= wsum;',
    '  vec3 bl = vec3(0.); vec2 px = 1./uRes;',
    '  for (int j = 0; j < 14; j++){ float a = (float(j) + n)*2.3999632; float r = sqrt((float(j) + .5)/14.);',
    '    vec2 o = vec2(cos(a), sin(a))*r; vec4 s = tx(uv + o*px*uRes.y*.035); vec4 s2 = tx(uv + o*px*uRes.y*.012);',
    '    bl += s.rgb*s.a + s2.rgb*s2.a*.8; }',
    '  col += bl/14.*.95;',
    '  col *= mix(1., smoothstep(1.05, .25, length(d*vec2(1., 1.15))), .55*(1. - uFlash));',
    '  col += (n - .5)*.018;',
    '  gl_FragColor = vec4(sqrt(max(col, 0.)), 1.);',
    '}'
  ].join('\n');

  /* camera: uniform Catmull-Rom through one key every 0.8 s */
  var KEYS = [
    { p: [14, 132, -700], q: [0, 62, -380] },
    { p: [4, 56, -492],   q: [0, 14, -300] },
    { p: [0, 23, -300],   q: [0, 15, -140] },
    { p: [0, 11.5, -150], q: [0, 15, -20] },
    { p: [0, 3.4, -58],   q: [0, 15.5, 0] },
    { p: [0, 7.6, -23],   q: [0, 10.6, 0] },
    { p: [0, 9.6, 1.2],   q: [0, 9.6, 12] }
  ];
  function cr(a, b, c, d, t) { return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
  function spline(key, u) {
    var n = KEYS.length - 1, i = Math.min(Math.floor(u), n - 1), t = u - i;
    var k0 = KEYS[Math.max(i - 1, 0)][key], k1 = KEYS[i][key], k2 = KEYS[i + 1][key], k3 = KEYS[Math.min(i + 2, n)][key];
    return [0, 1, 2].map(function (j) { return cr(k0[j], k1[j], k2[j], k3[j], t); });
  }
  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* Programs are linked without blocking where the browser allows it, so a slow shader compile
     cannot freeze the page: play() gives up and shows the page if they are not ready in time. */
  function program(gl, fs) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, fs]].forEach(function (x) {
      var sh = gl.createShader(x[0]); gl.shaderSource(sh, x[1]); gl.compileShader(sh); gl.attachShader(p, sh);
    });
    gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    return { p: p, u: null };
  }
  function linked(gl, ext, pr) {
    if (pr.u) return true;
    if (ext && !gl.getProgramParameter(pr.p, ext.COMPLETION_STATUS_KHR)) return false;
    if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr.p) || 'link');
    var u = {}, n = gl.getProgramParameter(pr.p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(pr.p, i).name; u[nm] = gl.getUniformLocation(pr.p, nm); }
    pr.u = u; return true;
  }

  function Renderer(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl');
    var par = gl.getExtension('KHR_parallel_shader_compile');
    var scene = program(gl, SCENE), post = program(gl, POST);
    this.ready = function () { return linked(gl, par, scene) && linked(gl, par, post); };
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(), fbo = gl.createFramebuffer(), W = 0, H = 0;
    this.gl = gl;
    this.size = function (w, h) {
      W = Math.max(2, w | 0); H = Math.max(2, h | 0); canvas.width = W; canvas.height = H;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    };
    this.draw = function (t) {
      var u = Math.min(t, DUR) / 0.8, cam = spline('p', u), tgt = spline('q', u);
      var open = ss(3.05, 4.15, t), flash = ss(4.2, 4.8, t);
      var blur = 0.3 * ss(0.3, 1.0, t) * (1 - ss(2.0, 3.3, t)) + 0.7 * ss(4.05, 4.7, t);
      gl.viewport(0, 0, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.useProgram(scene.p);
      gl.uniform2f(scene.u.uRes, W, H); gl.uniform1f(scene.u.uT, t);
      gl.uniform3f(scene.u.uCam, cam[0], cam[1], cam[2]); gl.uniform3f(scene.u.uTgt, tgt[0], tgt[1], tgt[2]);
      gl.uniform1f(scene.u.uRoll, 0.10 * (1 - ss(0.1, 1.7, t))); gl.uniform1f(scene.u.uFoc, 0.82 + 0.3 * ss(1.6, 3.6, t));
      gl.uniform1f(scene.u.uOpen, open); gl.uniform1f(scene.u.uFlash, flash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(post.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(post.u.uTex, 0);
      gl.uniform2f(post.u.uRes, W, H); gl.uniform1f(post.u.uBlur, blur); gl.uniform1f(post.u.uT, t); gl.uniform1f(post.u.uFlash, flash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    this.kill = function () { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); };
  }

  function play() {
    var box = document.getElementById('intro');
    if (!box) { root.classList.remove('intro-on'); release(); return; }
    var canvas = box.querySelector('canvas'), R = null, done = false, raf = 0, t0 = 0, frames = 0, scale = 0.62, slow = 0, acc = 0, lastNow = 0;
    function cleanup() {
      root.classList.remove('intro-on'); box.classList.remove('out', 'run');
      if (R) { R.kill(); R = null; }
      var fresh = canvas.cloneNode(false); canvas.parentNode.replaceChild(fresh, canvas);     /* a lost context cannot be reused */
    }
    function end(fast) {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, skip, true); });
      try { sessionStorage.setItem('hz-intro', '1'); } catch (e) {}
      HZ.intro.played = true;
      box.style.setProperty('--out', fast ? '.32s' : FADE + 's'); box.classList.add('out');
      root.classList.add('intro-leaving');
      release();
      setTimeout(function () { cleanup(); root.classList.remove('intro-leaving'); }, fast ? 340 : FADE * 1000 + 40);
    }
    function skip(e) {
      if (e && e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
      if (e && e.cancelable && e.type !== 'pointerdown') e.preventDefault();
      if (e && e.type === 'keydown') e.stopPropagation();
      end(true);
    }
    try { R = new Renderer(canvas); } catch (err) { done = true; root.classList.remove('intro-on'); release(); return; }
    function fit() { if (!R) return; var k = Math.min(scale, (scale > 0.7 ? 1680 : 1280) / Math.max(1, box.clientWidth)); R.size(box.clientWidth * k, box.clientHeight * k); }
    fit(); window.addEventListener('resize', fit);
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, skip, { capture: true, passive: false }); });
    var asked = performance.now();
    function frame(now) {
      if (done) return;
      if (!t0) {
        var ok = false; try { ok = R.ready(); } catch (err) { end(true); return; }
        if (!ok) { if (performance.now() - asked > 2600) { end(true); return; } raf = requestAnimationFrame(frame); return; }
        t0 = now; lastNow = now; box.classList.add('run');
      }
      var t = (now - t0) / 1000, dt = now - lastNow; lastNow = now;
      if (frames > 1) {                                   /* adapt the internal resolution to the machine */
        acc = acc ? acc * 0.8 + dt * 0.2 : dt;
        if (frames === 14 && acc < 13 && scale < 0.8) { scale = Math.min(1, 0.86); fit(); acc = 0; }
        if (acc > 46) { slow++; if (slow === 6 && scale > 0.4) { scale = 0.4; fit(); acc = 0; } if (slow > 40) { end(true); return; } }
      }
      R.draw(t); frames++;
      if (t >= DUR) { end(false); return; }
      raf = requestAnimationFrame(frame);
    }
    function start() { raf = requestAnimationFrame(frame); }
    if (document.hidden) document.addEventListener('visibilitychange', function once() { if (!document.hidden) { document.removeEventListener('visibilitychange', once); start(); } });
    else start();
    setTimeout(function () { if (!done && frames < 4 && !document.hidden) end(true); }, 4200);   /* never trap the reader behind a stalled intro */
  }

  HZ.intro = {
    duration: DUR,
    replay: function () {
      if (root.classList.contains('intro-on')) return;
      finished = false; window.scrollTo(0, 0); root.classList.add('intro-on'); play();
    },
    /* render one still at time t (used for checking frames) */
    still: function (t, w, h) {
      var box = document.getElementById('intro'), canvas = box.querySelector('canvas');
      root.classList.add('intro-on'); box.classList.add('run');
      var R = HZ.intro._r || (HZ.intro._r = new Renderer(canvas)); while (!R.ready()) {} R.size(w, h); R.draw(t); R.gl.finish();
    }
  };

  if (root.classList.contains('intro-on') && !/[?&]intro=still/.test(location.search)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play); else play();
  }
})();
