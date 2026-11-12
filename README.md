# Hao Zou — research site (version 4)

A static, dependency-free site: plain HTML, CSS and JavaScript. No build step.

## Look at it on your Mac

```bash
cd research-path
python3 -m http.server 8000
# open http://localhost:8000
```

Double-clicking `index.html` also works. Fonts (Newsreader, Inter, IBM Plex Mono) load from Google Fonts, so be online the first time.

## Publish with GitHub Pages

1. Create a repository, for example `research`, under `haozou-official`.
2. Copy everything in this folder to the repository root and push to `main`.
3. Repository Settings → Pages → "Deploy from a branch", branch `main`, folder `/ (root)`.
4. The site appears at `https://haozou-official.github.io/research/`.

## What is new in version 4

- **The opening.** A night flight over Manhattan to Low Library; the doors open onto the page. It is drawn live in WebGL (`js/intro.js`, no libraries). The lit windows are the same text blocks as the page background: rose is stale, amber is masked, mint is repaired.
  - It runs about five seconds and plays once per browser tab. Any click, key or scroll skips it.
  - It does not play on phones, with "reduce motion" switched on, or when the link points at a chapter (for example `.../#drr`).
  - To see it again: "Replay the opening" in the footer, or add `?intro=1` to the address. `?intro=0` suppresses it.
  - To switch it off for everyone: `intro: false` in `js/data.js`.
- **The map is a 3D scene** (`js/map3d.js`). Move the pointer over it for parallax; click a stop and the camera flies there before the page scrolls to the chapter.
- **Flying between stops.** Back / Next and the arrow keys now cross the map in a short full-screen flight and land in the next chapter. Switch it off with `flight: false` in `js/data.js`.
- **"One loop at three scales"** is three nested rings; the chosen one turns to face you. Click a ring or use the buttons.

## Presenting it

- The left and right arrow keys walk the ten chapters in order; the bar at the bottom does the same.
- Click any paper figure to enlarge it. Press Escape to close.
- The OSWorld 2.0 video plays by itself (muted) while it is on screen.

## Where things live

| File | What is in it |
|---|---|
| `index.html` | All the writing and the page structure. Each chapter is a `<section class="chapter" id="...">`. |
| `js/data.js` | `CONFIG` (switches for the opening and the flights, hidden chapters), plus the research map (stops, links, year marks). |
| `js/intro.js` | The opening flight to Low Library (WebGL shaders and camera path). |
| `js/map3d.js` | The 3D research map and the flight between stops. |
| `js/main.js` | Hero headline, scroll motion, rail and tour, lightbox, video. |
| `js/figures-gen.js` | Live figures for the generation thread and the Capital One chapter. |
| `js/figures-agents.js` | Live figures: OSWorld 2.0 horizon, stale rollouts, the three-scale loop. |
| `js/figures-next.js` | Sketches for the PhD directions. |
| `js/core.js` | Shared helpers: charts, tooltips, steppers, tables. |
| `css/style.css` | All styling. The palette is the block of variables at the top. |
| `assets/figures/` | Figures taken from the papers. |
| `assets/video/` | The OSWorld 2.0 overview video (re-encoded to H.264 so every browser plays it) and its poster frame. |

## Common edits

- **Colors.** Change the variables at the top of `css/style.css` (`--bg`, `--panel`, `--ink`, `--sky` and so on); everything follows.
- **Hide a chapter.** In `js/data.js` set, for example, `hidden: ['speed']`. The chapter, its stop on the map and its place in the tour disappear.
- **Portrait.** Replace `assets/hao_zou.jpg` (square).
- **Swap a paper figure.** Replace the file in `assets/figures/` and keep the name.
- **Headline animation.** `KEEP`, `DRAFT` and `FIXED` at the top of `hero()` in `js/main.js`.

## How figures are labelled

- **Numbers as reported**: values from a paper, talk or measured run.
- **Illustration / Schematic**: shows a mechanism; token scores, probabilities and layouts are made up for clarity.
- **Simulation**: a toy model running in the browser, not an experiment.

The three PhD-direction panels are plans and say so on the page.
