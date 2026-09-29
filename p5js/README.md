# p5js

A [p5.js](https://p5js.org/) app for laying out LED animation frames by hand:
click LEDs on/off, step through frames, and generate Arduino code (frames as a
`PROGMEM` string array) to paste into firmware. Originally a port of a Processing sketch, but
the Processing version was removed once this one had full feature parity -
this is now the only editor in the repo.

Only the LED grid itself is drawn on `<canvas>` (`led.js`'s `Led` class) -
the toolbar (layout picker, frame nav, clipboard, generate, ...) is
real HTML in `index.html`, each button wired straight to `executeKey()` in
`sketch.js`. That used to all be canvas-drawn too (a literal port of
Processing's button-widget classes, which don't exist in the browser's DOM),
but there's no reason to hand-roll buttons when p5.js runs happily alongside
real ones - real `<button>`s get native hover/focus/keyboard handling for
free, and don't need per-frame hit-testing against the mouse position.

Must be served over HTTP, not opened directly as a `file://` URL (browsers
block `fetch()` of local files). `index.html` loads the built
`dist/led-editor.min.js` (see "Building" below), not `sketch.js`/`led.js`
directly, so run `npm run build` after editing either before testing in the
browser. From the repo root:

```bash
python3 -m http.server
```

then open `http://localhost:8000/p5js/`.

## Building

```sh
cd p5js
npm install
npm run build
```

Concatenates `led.js`, `builders/common.js`, each `builders/*.js` (in
the order `package.json`'s `build` script lists them - `common.js` has to
come before the others, since each one calls `registerBuilder()` at its own
top level, immediately on load), and `sketch.js` last, then minifies the
result with [terser](https://github.com/terser/terser) into
`dist/led-editor.min.js`. No UMD wrapper (unlike
[d3-easygraph](https://github.com/larsi-org/d3-easygraph)) - this
deliberately stays plain global-scope code, since p5.js's global mode finds
`setup()`/`draw()`/`keyPressed()`/etc. as `window` properties, not through a
module export. larsi.org's `make/led-editor/` copies `dist/led-editor.min.js`
into its own `lib/larsi.org/` and loads that - rebuild and copy over after
any source change. `led-editor.css` isn't part of this build (nothing to
concatenate, it's already one file) - just copy it to `lib/larsi.org/`
directly after editing it.

## Adding a new builder

Each live "(Custom)" builder in the Layout dropdown is one file in
`builders/`, registering an object shaped like:

```js
registerBuilder({
	id: '__example__',        // dropdown <option> value
	label: 'Example (Custom)', // dropdown <option> text
	createControls() {
		// Build this builder's own <span class="tb-divider">/<div class="tb-group">
		// pair (inputs, checkboxes, its own Build button - see builders/common.js's
		// tbDivider/tbGroup/tbLabel/tbNumberInput/tbCheckbox/tbButton helpers), wire
		// the Build button's click and each input's Enter-key handler to this.build(),
		// and return { divider, group }.
	},
	build() {
		// Read this builder's own inputs from the DOM, compute { leds, lines?,
		// symmetry? }, and call applyLayoutData(name, data) - same shape loadLayout()
		// builds from a fetched layouts/*.json file.
	}
});
```

Add the new file to `package.json`'s `build` script (anywhere after
`builders/common.js`) and that's it - `builders/common.js`'s own
`populateBuilderOptions()` (called from `sketch.js`'s `populateLayoutSelect()`)
picks up every registered builder automatically, in `BUILDERS` order (i.e.
the order the build script lists them), inserting each one's controls into
the toolbar right before the `#builders-anchor` marker already in
`index.html`. Neither `index.html` nor `make/led-editor/index.php` on the
site ever need editing for a new builder - only for a new *real-hardware*
layout file, which still needs a row in the Projects table and its own
`?layout=` link (see below).

## Layout

- `index.html` - the toolbar and page chrome, plus its own inline `<style>`
  for this bare page's `body`/`a` styling (just two rules, and only this
  one page ever needs them, so no separate file for it - see `led-editor.css`)
- `led-editor.css` - every color and UI rule for the toolbar/canvas/output
  panel, in one `:root` palette shared by both this repo's `index.html` and
  larsi.org's `make/led-editor/index.php` (copied to `lib/larsi.org/` -
  see "Building" below). `led.js`/`sketch.js` read their own canvas colors
  from this same file's custom properties instead of hardcoding a literal -
  one place to change any color, not three
- `sketch.js` / `led.js` - the app shell (canvas, rendering, pan/zoom,
  animation state, keyboard/mouse handling) and the LED grid's canvas drawing
- `builders/common.js` - the shared `{id, label, createControls(), build()}`
  registry every live builder below registers into, small DOM-building
  helpers, and the geometry/symmetry math more than one builder shares
  (`computeSymmetry`, `computeRadialSymmetry`, `collinearLines`)
- `builders/circle.js` / `hex.js` / `matrix.js` / `cube.js` / `triangle.js` -
  one file per live "(Custom)" builder in the Layout dropdown, each owning
  its own geometry *and* its own toolbar controls (see "Adding a new
  builder" below)
- `play-pause-loop.js` - byte-for-byte copy of larsi.org's `lib/larsi.org/play-pause-loop.js`
  (the Play/Pause helper graphics/flower and Function3D use too); `index.html` loads it
  before the editor, and the **Play** button plus **fps** field drive it (playback steps
  through the frames in order at 1-30 fps; any click in the editor or toolbar action stops it)
- `dist/led-editor.min.js` - built from all of those (see "Building" below);
  `index.html` loads this, not the source files directly
- `layouts/<name>.json` - one file per checked-in hand-edited layout the
  **Layout** dropdown can't build live, fetched at runtime; see "Layout
  file format" below. Empty as of 2026-09-28 (see `layouts/README.md`) -
  every file that used to live here turned out to be redundant with a live
  builder

The landing layout defaults to Hex (Custom) at `count=8, zigzag=false`
(the same defaults as the Hex toolbar), but the URL can override it two ways. Both
are handled entirely client-side (`sketch.js` reads
`location.search` itself), so either works the same whether the page is
served by `python3 -m http.server` here or by `index.php` on larsi.org:

- `?layout=<name>.json` - a real checked-in file, e.g.
  `?layout=led_7x7.json`. Still the only way to land on a hand-edited
  layout with no live builder able to reproduce it, or one that's drifted
  from what its builder would currently produce - real files stay
  authoritative, so this wins if both params are somehow present.
- `?builder=<name>&count=<n>[&zigzag=<0|1>]` (or `&countX=`/`&countY=`
  instead of `count` for **Matrix**, which has two dimensions) - builds
  that layout live at load time from these params instead of fetching a
  file, the same thing clicking that builder's own **Build** button does.
  `<name>` is `circle`/`hex`/`matrix`/`cube`/`triangle`. Lets a project
  page link to a specific size with no `layouts/*.json` needed for it at
  all - e.g. `?builder=hex&count=13&zigzag=0`. A missing param (or a whole
  missing `&zigzag=`) falls back to that builder's own toolbar default; an
  unrecognized `?builder=` value falls back to the plain default file
  load, same as an invalid `?layout=` already does.

Every larsi.org page for a real piece of hardware links in with its own
layout this way instead of leaving the visitor to pick it from the
dropdown:

| Page | link |
| --- | --- |
| [make/Schneeflocke](https://larsi.org/make/Schneeflocke/) | `?builder=hex&count=10&zigzag=1` |
| [make/LedCube3](https://larsi.org/make/LedCube3/) | `?builder=cube&count=3` |
| [make/led_6x5](https://larsi.org/make/led_6x5/) | `?builder=matrix&countX=6&countY=5&zigzag=0` |
| [make/CoffeeTable](https://larsi.org/make/CoffeeTable/) | `?builder=matrix&countX=7&countY=7&zigzag=1` |
| [electronics/ATtinyX5/hex3](https://larsi.org/electronics/ATtinyX5/hex3/) | `?builder=hex&count=3&zigzag=0` |
| [electronics/ATtinyX5/led5](https://larsi.org/electronics/ATtinyX5/led5/) | `?builder=strip&count=5` |
| [electronics/ATtinyX5/led20](https://larsi.org/electronics/ATtinyX5/led20/) | `?builder=strip&count=20` |
| [electronics/ATmegaX8/led5](https://larsi.org/electronics/ATmegaX8/led5/) | `?builder=strip&count=5` |
| [electronics/ATmegaX8/led8](https://larsi.org/electronics/ATmegaX8/led8/) | `?builder=strip&count=8` |
| [electronics/ATmegaX8/Peggy2LE](https://larsi.org/electronics/ATmegaX8/Peggy2LE/) | `?builder=matrix&countX=25&countY=25&zigzag=0` |

As of 2026-09-28, all ten of these switched from `?layout=` to `?builder=`
- verified first (comparing every LED position, wire, and symmetry orbit,
not just LED count) that 8 of the 9 distinct checked-in files were an
*exact* match for their builder's live output. `cube3.json` was the one
that wasn't: its LEDs used a hand-picked `r=0.15`, while Cube (Custom)
uses `r=0.1` like its sibling builders (see "Cube (Custom)" below).
Rather than keep that one file around for a cosmetic radius difference,
the live builder became the single source there too - every
`layouts/*.json` file was deleted as a result (see `layouts/README.md`),
not just unlinked, and the landing view with no URL params at all now
defaults to Hex (Custom) at `count=8, zigzag=false` (the builder's own
toolbar defaults; it once reproduced the old `hex10.json` exactly) instead
of fetching a file. `?layout=` and `LAYOUTS` (in `sketch.js`) both stay fully wired up
and ready for whenever a genuinely hand-edited layout - one no builder can
reproduce - needs one again; there just isn't one right now.

(ATtinyX5/led5 and ATmegaX8/led5 intentionally build the same 5&times;1
shape - both are a plain 5-LED row, just on different chips. make/'s own
gallery tile for the editor links with no params at all, since it's the
tool's generic entry point, not tied to one project.)

No generator scripts anymore, and no checked-in layout files either -
**Circle (Custom)**, **Hex (Custom)**, **Matrix (Custom)**, **Strip
(Custom)**, **Cube (Custom)**, and **Triangle (Custom)** in the Layout
dropdown build any size live (see below). Every project page below that links to a Matrix
(Custom) build (project pages named `led_*`, from when these were still
checked-in files with that naming convention) -
[LED 6x5 Shield](https://larsi.org/make/led_6x5)
(`?builder=matrix&countX=6&countY=5&zigzag=0`), [LED Coffee
Table](https://larsi.org/make/CoffeeTable)
(`?builder=matrix&countX=7&countY=7&zigzag=1` - matching the project's
actual wiring order), and one older electronics board (a square matrix) -
[Peggy 2LE](https://larsi.org/electronics/ATmegaX8/Peggy2LE/)
(`countX=25, countY=25, zigzag=0`) - see the table above for each one's
full link. Three older electronics boards (single strips) link to **Strip
(Custom)** instead, now that it exists - `countX=N&countY=1` was the same
shape, just without its own N-only control or `count=` URL param:
[ATtinyX5/led5](https://larsi.org/electronics/ATtinyX5/led5/) and
[ATmegaX8/led5](https://larsi.org/electronics/ATmegaX8/led5/) (`count=5`),
[ATmegaX8/led8](https://larsi.org/electronics/ATmegaX8/led8/) (`count=8`),
and [ATtinyX5/led20](https://larsi.org/electronics/ATtinyX5/led20/)
(`count=20`). Two Hex (Custom) settings are real hardware too:
`count=10, zigzag=1` ([Schneeflocke](https://larsi.org/make/Schneeflocke) -
a continuously wired strip) and `count=3, zigzag=0`
([ATtinyX5/hex3](https://larsi.org/electronics/ATtinyX5/hex3/) - a static
Charlieplexed board, not a wired strip, so its numbering doesn't need to
snake row to row).

## Circle (Custom)

Builds N rings (plus a center LED) live, in memory, growing outward - ring
`c` gets `6c` LEDs, evenly spaced. N from 2 to 16. No zigzag option: unlike
a row-by-row shape, going around each ring in one direction is already a
sensible order to solder in.

Draws each ring as its own closed loop, not connected to the center or to
any other ring - unlike Hex/Matrix/Triangle's straight rows, consecutive
points around a ring are never collinear, so there's no run of edges to
merge into fewer, longer lines the way `collinearLines()` does for those.

## Hex (Custom)

Builds a hexagon live: `2N-1` rows, widest in the middle, narrowing N-1
LEDs at a time toward each point. N from 2 to 16. **Zigzag** mirrors every
other row so LED numbering snakes back and forth (row 0 left-to-right, row
1 right-to-left, ...) instead of always running left-to-right, matching
how an LED strip is usually wired - continuing straight into the next row
rather than a long return wire back to the start of each one. Off by
default - Schneeflocke (`count=10, zigzag=1`, a wired strip) needs it on
(its project link passes it explicitly), ATtinyX5/hex3 (`count=3,
zigzag=0`, a static board, not a strip) doesn't.

Draws wire lines along the lattice's 3 natural directions (rows, plus both
60°/120° diagonals - a triangular grid's pitch is exactly what makes those
two angles clean lines rather than some other, less obvious one), each
merged into the single longest line its full run supports rather than one
line per tiny adjacent-pair segment - same idea as Matrix (Custom)'s row/
column lines, generalized to an arbitrary angle by `collinearLines()`.
Matches real coordinates rather than build order, so it's correct under
Zigzag automatically, same principle Symmetry (below) already follows.

## Matrix (Custom)

Builds a rectangular grid live. Width and height each 1-32; **Zigzag**
works the same way as Hex's, but off by default - most real-hardware
project pages link in with it off, CoffeeTable
(`?builder=matrix&countX=7&countY=7&zigzag=1`, LED Coffee Table) being the
one exception that needs it checked.

Both axes share one pitch (the larger dimension sets it), so LEDs are
evenly spaced even when width and height differ, rather than stretched to
fill a square. Wire lines are drawn across every row and down every column.

## Strip (Custom)

Builds a single straight line of N LEDs - literally `buildMatrix(N, 1,
false)` under the hood (a 1-row Matrix is already exactly this: evenly
spaced, one line straight across, zigzag a no-op with only one row), just
exposed as its own builder with a single N control (1-32, default 8) instead of
Matrix's W/H pair, and its own `?builder=strip&count=..` URL param instead
of spelling out `countX=N&countY=1`.

## Cube (Custom)

Builds an N×N×N cube live: N levels stacked top to bottom, each level an
N×N face drawn with a cabinet-projection skew - N from 2 to 8. The
original design reverse-engineered this formula from a hand-picked N=3
layout (`0.2`/`0.8` skew/spacing, since deleted along with every other
checked-in `layouts/*.json` file - see the "Adding a new builder"/Layout
sections above) rather than reusing those fixed numbers: it solves for
whatever spacing keeps a constant *gap fraction* between levels instead
(each level's own depth spread is always exactly half its vertical step),
so levels never visually overlap at any N, unlike the fixed-ratio numbers
that hand-picked N=3 layout used, which would have started overlapping
past N≈5 if reused unchanged at larger N. Plugging N=3 into this formula
reproduces that original layout's LED positions exactly (still true, just
no longer checkable against a live file) - only its LED radius differs
(`r=0.1` here, matching every other builder, vs that layout's own
`r=0.15`). No Zigzag option (a cube's real wiring order is a whole
separate problem - see "Symmetry, for the six builders" below for why
this one skips symmetry too).

Within a level, a farther-away row (see `buildCube`'s own comment on which
end is "front") can visually overlap a nearer one, especially at higher N
- `drawLEDs()` draws every layout's LEDs back-to-front (last array index
first) specifically so the nearer one always wins that overlap instead of
the farther one painting over it. See also "Pan & zoom" below, which helps
more the bigger N gets.

## Triangle (Custom)

Builds an equilateral triangle live, flat side down and point up: row 0
(the base, N LEDs) is built first, left to right, then each row up has one
fewer LED, ending with the single apex LED - N(N+1)/2 LEDs total (a
triangular number). N from 2 to 24. **Zigzag** works the same way as
Hex/Matrix's - off by default.

Same triangular-lattice pitch as Hex (`dy = sqrt(0.75) * dx`), but centered
on the shape's actual *centroid*, not its bounding box - an equilateral
triangle's centroid sits 1/3 of the way up from its base, not halfway,
since the base has two vertices pulling the average toward it and the apex
only one. This matters beyond just looking right: centering there instead
of at the bounding-box middle is what makes the symmetry below come out
exact (verified numerically - centering on the bounding box only
reproduces the same point set under 120° rotation by accident, at one
single N, not in general).

## Symmetry, for the six builders

None of the six save anything to a file on their own - use **Export
Layout** to grab one yourself. Circle/Hex/Matrix/Strip/Triangle all
compute `symmetry` (see "Layout file format" below) from the shape's actual
geometry, not its row/column/ring index, so it's already correct under
Hex/Matrix/Triangle's Zigzag without needing to special-case it - the same
principle `create_hex_circle.py` used to follow (matching real
coordinates, not array position) before it was replaced by this. Cube
doesn't: a physical cube's real symmetry group acts on its 3D level/row/
column axes, but the cabinet projection treats those three axes
asymmetrically (level is a pure y-shift, column a pure x-shift, row a
diagonal x+y shift), so a real cube rotation doesn't correspond to any
simple 2D transform of the projected (x, y) - same reason the original
hand-picked N=3 cube layout this builder's formula was reverse-engineered
from (see "Cube (Custom)" above) never had a `symmetry` key either.

- **Circle/Hex**: both are rings of points around a center, which always
  has the full 12-element dihedral group available (6 rotations, each
  paired with a mirror) - a generic point's orbit uses all 12; a point
  that already sits on a mirror line (or is the center itself) has a
  smaller one.
- **Matrix**: horizontal flip, vertical flip, and 180° rotation always
  apply to any rectangle; a square additionally gets both diagonal flips
  and both 90° rotations, since only then does swapping the two axes map
  the grid back onto itself ("n×n has the most symmetry, n×m loses half,
  1×n keeps only first↔last, second↔second-to-last, ...").
- **Strip**: the same computation as Matrix's, since Strip *is* Matrix
  with height fixed at 1 - "1×n keeps only first↔last, second↔
  second-to-last" above.
- **Triangle**: the full 6-element dihedral group D3 - 3 rotations (0°/
  120°/240° about the centroid) each optionally paired with a mirror
  across the vertical axis through the apex. A size-N triangular grid is
  exactly the barycentric-coordinate points `(i, j, k)` with
  `i + j + k = N - 1`, `i/j/k >= 0`, and a 120° rotation permutes those
  three coordinates cyclically - which is exactly what preserves that
  constraint, so the symmetry holds at every N, not just special cases.

## Layout file format

```json
{
  "leds": [{ "x": -1, "y": -1 }, ...],
  "r": 0.1,
  "symmetry": [9, 8, 7, ...],
  "lines": [[0, 2], [3, 5], ...]
}
```

- `leds` - one entry per LED, in display-number order (LED 1 is `leds[0]`,
  etc.). `x`/`y` are position, normalized to roughly `[-1, 1]` (canvas center
  is `(0, 0)`, edge is `±1`).
- `r` - the LED dot size, same `[-1, 1]` scale as `x`/`y`. One value for the
  whole layout, not per LED - no builder, and no layout file before they
  were all deleted (see "Layout" above), has ever varied it per LED, so it
  lives once here instead of once per `leds` entry.
- `symmetry` - optional. `symmetry[i]` is "the next LED in LED `i`'s
  mirror-symmetry group": a left-click toggles LED `i`, then walks
  `j = symmetry[j]` until it loops back to `i`, setting each one to `i`'s new
  state - a cycle, not just a pair (hex/circle layouts have up to 12-way
  symmetry near the center, a rectangular grid up to 8-way - see "Symmetry,
  for the six builders" above). Omitted entirely when no LED has a partner
  (Cube (Custom) only, among the six live builders).
- `lines` - optional. Each entry is a `[i0, i1]` pair of 0-based LED indices
  to draw a connecting wire between. Cube (Custom) needs it because the
  cube isn't a flat convex shape, so the physical wiring can't be inferred
  just from LED positions the way it can for a flat grid/hex/circle; a
  rectangular grid's rows/columns get one each too (see "Matrix (Custom)"
  above, which Strip (Custom) inherits directly).

## Pan & zoom

The main LED view (not the thumbnails, which always show the whole layout)
supports mouse-wheel zoom-to-cursor and click-drag pan, matching the gesture
feel of `lib/larsi.org/point-cloud-renderer-2d.js`'s zoom (used elsewhere on
the site by the fractal/point-cloud pages) though not built on that class
directly - see the comment above `viewZoom`/`viewPanX`/`viewPanY` in
`sketch.js` for why. Double-click/tap resets back to the default framing.
Mostly useful for a dense **Cube (Custom)** or **Hex (Custom)** build (N=8
cube is 512 LEDs, N=13 hex is 469) where LEDs overlap too much at the
default zoom to click the one you mean. Zoom only spreads LEDs apart from
each other - it deliberately does **not** also enlarge the circles
themselves (`Led.draw()`/`isOver()` take separate position and size
scale factors, and `drawLEDs()` only zooms the position one). A uniform
zoom would leave LEDs exactly as hard to tell apart as before, just
bigger; more space *between* them is the actual fix. Content is clipped to
the main view's own square border so zooming in doesn't spill past it into
the thumbnail strip below. No pinch-zoom yet (see the same comment for
what that would take) - a single-finger drag still pans on a touchscreen,
since that comes for free from p5's default touch-to-mouse simulation.

A distinct click (not a drag) still toggles whatever LED is under the
cursor, at whatever the current pan/zoom happens to be - `mouseReleased()`
tells the two apart by how far the mouse actually moved between press and
release, not which button, so this works with both the left-click-toggle
and right-click-toggle-ignoring-symmetry behaviors below.

## Controls

Left-click an LED to toggle it (and its symmetric partner, if any); uncheck
the toolbar's **Symmetry** checkbox (on by default), or right-click, to
toggle just that one LED. Random respects the checkbox too; right-click
always ignores symmetry regardless of it.

Click a thumbnail to jump straight to that frame - same result as stepping
to it with `,`/`.`. The current frame's thumbnail is outlined so it's
always clear which one the main view is showing.

- `,` / `.` - previous / next frame
- `[` / `]` - duplicate the current frame before / after itself (the copy becomes current; the clipboard is untouched)
- `c` / `v` - copy / paste the current frame
- `i` - invert the current frame
- Ctrl/Cmd+Z / Ctrl+Y (or Ctrl/Cmd+Shift+Z) - undo / redo, also the two icon buttons at the end of the drawing-tools row; whole-animation snapshots before each edit (LED toggle, paste, invert, random, clear, duplicate, delete), last 50, dropped when a new layout is built
- `r` - flip a random LED (and its symmetric partner, if any)

**Clear**, **Delete**, **Generate** and **Export Layout** are toolbar buttons only, with no
keyboard shortcut: the first two are destructive (there is no undo yet), and Space/Backspace
are habitual scroll/back keys.

The two output actions:

- **Generate** - open a text box with Arduino code for the whole animation: one
  `PROGMEM` string per frame (one `0`/`1` per LED), a `PROGMEM` table of
  pointers to them (`frames[]`), `NUM_LEDS`/`NUM_FRAMES`, and an `ledOn(frame, led)`
  helper - plus a "Copy to clipboard" button. With **Compact** checked, each
  frame is instead a `uint8_t` array, 8 LEDs per byte: LED 1 is the lowest bit
  of the first byte, LED 8 the highest, LED 9 the lowest bit of the second
  byte, and so on, with the last byte zero-padded
- **Export Layout** - open the same text box with the current layout's own `layouts/*.json`
  contents instead - the only way to keep a layout built with **Circle**,
  **Hex**, or **Matrix (Custom)**, since those are never written to a file
  on their own
