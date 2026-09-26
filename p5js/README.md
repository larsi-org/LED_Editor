# p5js

A [p5.js](https://p5js.org/) app for laying out LED animation frames by hand:
click LEDs on/off, step through frames, and export the result as bitmap rows
to paste into Arduino firmware. Originally a port of a Processing sketch, but
the Processing version was removed once this one had full feature parity -
this is now the only editor in the repo.

Only the LED grid itself is drawn on `<canvas>` (`checkbox.js`'s `Checkbox`
class) - the toolbar (layout picker, frame nav, clipboard, generate, ...) is
real HTML in `index.html`, each button wired straight to `executeKey()` in
`sketch.js`. That used to all be canvas-drawn too (a literal port of
Processing's button-widget classes, which don't exist in the browser's DOM),
but there's no reason to hand-roll buttons when p5.js runs happily alongside
real ones - real `<button>`s get native hover/focus/keyboard handling for
free, and don't need per-frame hit-testing against the mouse position.

Must be served over HTTP, not opened directly as a `file://` URL (browsers
block `fetch()` of local files). From the repo root:

```bash
python3 -m http.server
```

then open `http://localhost:8000/p5js/`.

## Layout

- `index.html` / `style.css` - the toolbar and page chrome
- `sketch.js` / `checkbox.js` - the app logic and the LED grid's canvas drawing
- `layouts/<name>.json` - one file per supported LED layout, fetched at
  runtime by the **Layout** dropdown; see "Layout file format" below
- `create_matrix.py` - generates `layouts/led_*.json` for the rectangular
  grid layouts (`led_5`, `led_8`, ..., `led_16x16`, `led_6x5`)
- `create_hex_circle.py` - generates `layouts/hex*.json`/`layouts/circle*.json`
  for the hexagonal (`hex3`-`hex13`) and circular (`circle3`-`circle13`)
  layouts

`cube3` has no generator - it was hand-authored, since it also needs a
`lines` list (see below) that neither script produces.

## Layout file format

```json
{
  "leds": [{ "x": -1, "y": -1, "r": 0.1 }, ...],
  "symmetry": [9, 8, 7, ...],
  "lines": [[0, 2], [3, 5], ...]
}
```

- `leds` - one entry per LED, in display-number order (LED 1 is `leds[0]`,
  etc.). `x`/`y` are position, normalized to roughly `[-1, 1]` (canvas center
  is `(0, 0)`, edge is `±1`); `r` is the LED's dot size on that same scale.
- `symmetry` - optional. `symmetry[i]` is "the next LED in LED `i`'s
  mirror-symmetry group": a left-click toggles LED `i`, then walks
  `j = symmetry[j]` until it loops back to `i`, setting each one to `i`'s new
  state - a cycle, not just a pair (hex/circle layouts have up to 6-way
  rotational symmetry near the center). Omitted entirely when no LED has a
  partner (every `led_*` grid layout, plus `cube3`).
- `lines` - optional, only `cube3` has one. Each entry is a `[i0, i1]` pair
  of 0-based LED indices to draw a connecting wire between. Needed there
  because the cube isn't a flat convex shape, so the physical wiring can't be
  inferred just from LED positions the way it can for a flat grid/hex/circle.

## Controls

Left-click an LED to toggle it (and its symmetric partner, if any); uncheck
the toolbar's **Symmetry** checkbox (on by default), or right-click, to
toggle just that one LED. Random respects the checkbox too; right-click
always ignores symmetry regardless of it.

- `,` / `.` - previous / next frame
- `[` / `]` - insert a blank frame before / after the current one
- Delete - remove the current frame
- `c` / `v` - copy / paste the current frame
- Space - clear the current frame
- `i` - invert the current frame
- `r` - flip a random LED (and its symmetric partner, if any)
- `g` - open a text box with the whole animation (every frame, every LED, as
  `0`/`1`) and a "Copy to clipboard" button
