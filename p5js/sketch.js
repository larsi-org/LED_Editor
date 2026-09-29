// Must be served over HTTP, not opened as file:// (browsers block fetch()
// of local files). See README.md.

const DATA_BASE = 'layouts/';

// Real-hardware layouts that need a checked-in file instead of a live builder - empty for
// now. Every file that used to live here (cube3/hex3/hex10/led_6x5/led_7x7/led_5x1/led_8x1/
// led_20x1/led_25x25) turned out to be either an exact match for its builder's live output,
// or (cube3 specifically) close enough that Lars chose the builder as the more useful single
// source going forward rather than keeping a slightly-different cached file around - so as of
// 2026-09-28 every real-hardware project page links in via ?builder= instead (see
// larsi-org/html's own repo for those pages, and this repo's README for the comparison this
// session ran). The files were deleted rather than left as unused duplicates - this array,
// DATA_BASE, and loadLayout() below all stay fully wired up and ready for whenever a genuinely
// hand-edited layout (one no builder can reproduce) needs one again: add an entry here and
// drop the file in layouts/.
const LAYOUTS = [];

// Landing view when neither ?layout= nor ?builder= is given at all - Hex (Custom) at the
// same N the toolbar defaults to (8), zigzag off like every builder's default.
const DEFAULT_BUILDER_ID = '__hex__';
const DEFAULT_BUILDER_PARAMS = { count: '8', zigzag: false };

let directory = '';

// Two ways a project page can land directly on a specific layout instead of making the
// visitor pick it from the dropdown themselves - both read straight off the URL client-side,
// no server involvement needed:
//
// ?layout=<name>.json - a real checked-in layouts/*.json file (e.g. ?layout=led_7x7.json).
// The only way to land on a hand-edited layout with no live builder able to reproduce it, or
// one that's drifted from what its builder would currently produce - real files stay
// authoritative, so this wins if both params are somehow present. LAYOUTS is empty right now
// (see above), but the mechanism itself stays fully wired up for whenever one is needed again.
//
// ?builder=<name>&count=<n>[&zigzag=<0|1>] (or &countX=/&countY= for Matrix's two dimensions)
// - builds live at load time instead, straight from these params, the same as clicking that
// builder's own Build button would but with no checked-in file needed at all. <name> is one
// of BUILDERS' own ids with its __ wrapping stripped (circle, hex, matrix, cube, triangle -
// see setup() below for where the wrapping goes back on). Missing/invalid params fall back to
// that builder's own toolbar defaults (see each builders/*.js's own build(params) for how).
const urlParams = new URLSearchParams(window.location.search);
const layoutParam = urlParams.get('layout');
const builderParam = urlParams.get('builder');

// colors - read from led-editor.css's :root palette (see led.js's cssVar() comment for why
// this is safe at plain top-level script scope), not hardcoded, so there's one place to
// change any of them
const BACKGROUND      = cssVar('--bg-canvas');
const PAGE_BACKGROUND = cssVar('--bg-page');    // canvas ground - same as the panel around the toolbar
const PANEL_BACKGROUND = cssVar('--bg-toolbar'); // thumbnail strip - same as the toolbar
const PANEL_BORDER    = cssVar('--border-toolbar');
const STROKE_DIV      = cssVar('--accent');
const STROKE_WIRE     = cssVar('--wire');
const THUMB_ACTIVE    = cssVar('--border-button-hover'); // same blue the toolbar buttons highlight with on hover

const DIM  = 800;
const DIM2 = DIM / 2;

const LEDS_DX = DIM2;
const LEDS_DY = DIM2; // buttons/label used to live in a reserved band above this; now on-page HTML

// thumbnails sit below the main grid (not beside it - that made the canvas
// twice as wide as it needed to be, always overflowing the page)
const THUMB_GAP = 8; // same gap as toolbar-to-editor (#toolbar's margin-bottom)
const THUMB_TOP = DIM + THUMB_GAP;
const THUMB_SIZE = 100; // one thumbnail's on-canvas footprint, width == height

// LEDs
let leds = [];

// Lines - Cube/Hex/Matrix/Triangle all generate these; Circle doesn't
let ledLines = [];

// Every LED in a layout always shares one radius (normalized to the same [-1, 1] scale as
// posX/posY) - no builder, and no checked-in layout before they were all deleted, has ever
// varied it per LED - so this lives once here instead of once per Led instance (see led.js's
// own comment on why its constructor dropped the field entirely).
let radius = 0.1;

// symmetry[i] is the next LED in i's symmetry cycle (i itself if none)
let symmetry = [];

// Animation states: one boolean[] per frame
let states = [];

// current frame index
let current = 0;

// clipboard
let clipboard = [];

// One rendered p5.Graphics image per frame, blitted with image() instead of redrawing every
// LED from scratch (up to hundreds of ellipse() calls) for each of up to 64 thumbnails,
// every single p5 frame - almost none of that ever changes, since every operation that edits
// a frame's LEDs only ever touches states[current] (see invalidateCurrentThumb() and its call
// sites). null = needs (re)rendering; renderThumb() fills it in lazily, only once a frame's
// thumbnail is actually about to be drawn, not eagerly the moment it's invalidated.
let thumbCache = [];

// Interactive pan/zoom for the main LED view only (thumbnails always stay unzoomed - see
// drawLEDs()'s default params). Same gesture math as lib/larsi.org/point-cloud-renderer-2d.js
// (wheel zoom-to-cursor, drag-to-pan, double-click/tap reset) but reimplemented here rather
// than constructing that class directly: it owns its own <canvas>/2D context and repaints by
// blitting a full ImageData buffer, whereas this sketch already redraws every p5 frame and
// draws circles/lines/text, not pixels - only the gesture *math* carries over, the same
// reasoning Mandelbrot's own hand-rolled zoom used (see CLAUDE.md's
// point-cloud-renderer-architecture note). Touch: handled entirely by plain touch listeners on
// the canvas (tap toggles, one finger pans, two fingers pinch-zoom, double-tap on empty space
// resets) - see wireTouchGestures().
let viewZoom = 1, viewPanX = 0, viewPanY = 0;
const clampViewZoom = (z) => Math.max(0.5, Math.min(40, z));

// Keeps the point under (mx, my) fixed on screen while zoom changes - zoom-to-cursor, same
// formula as PointCloudRenderer2D's zoomAt(), with LEDS_DX/LEDS_DY (the main view's fixed
// center) standing in for its W/2/H/2.
function zoomViewAt(mx, my, newZoom) {
	newZoom = clampViewZoom(newZoom);
	const factor = newZoom / viewZoom;
	viewPanX = mx - LEDS_DX - (mx - LEDS_DX - viewPanX) * factor;
	viewPanY = my - LEDS_DY - (my - LEDS_DY - viewPanY) * factor;
	viewZoom = newZoom;
}

function resetView() {
	viewZoom = 1;
	viewPanX = 0;
	viewPanY = 0;
}

function inMainView(x, y) {
	return x >= 0 && x < DIM && y >= 0 && y < DIM;
}

// Frame index of the thumbnail grid cell at (x, y), or -1 if it's outside the grid entirely
// or over a cell past the last real frame (the grid is always a full 8 columns wide, but the
// last row can be partially empty - see draw()'s own thumbnail loop).
function thumbIndexAt(x, y) {
	if (x < 0 || x >= DIM || y < THUMB_TOP) return -1;
	const ti = Math.floor(x / THUMB_SIZE) + 8 * Math.floor((y - THUMB_TOP) / THUMB_SIZE);
	return ti < states.length ? ti : -1;
}

// Same dx/dy/f/size drawLEDs() actually draws the main view with, for hit-testing at the
// current pan/zoom - mouseReleased() needs this to stay in sync with what's on screen. size
// deliberately doesn't pick up viewZoom, matching drawLEDs()'s own size -
// the hit target stays the same fixed size a zoomed-apart LED is actually drawn at, not a
// zoomed-up one, so click precision improves right along with the added visual spacing.
function mainViewProjection() {
	const f = Math.round(0.9 * (LEDS_DX - 1));
	return { dx: LEDS_DX + viewPanX, dy: LEDS_DY + viewPanY, f: f * viewZoom, size: Math.round(f * radius) };
}

function setup() {
	const canvas = createCanvas(DIM, THUMB_TOP + THUMB_SIZE); // starts at 1 thumbnail row; grows with the frame count
	canvas.parent('sketch-holder');
	wireTouchGestures(canvas.elt);
	canvas.elt.oncontextmenu = () => false; // right-click toggles a single LED, don't show the browser menu
	textAlign(CENTER, CENTER);

	populateLayoutSelect();
	wireToolbar();

	// ?layout= wins if present and valid (a real checked-in file - LAYOUTS is empty right now,
	// see its own comment, but the mechanism stays ready). Otherwise ?builder=, if it names a
	// real builder. Otherwise the default landing view (see DEFAULT_BUILDER_ID/_PARAMS above) -
	// this also covers a misspelled ?builder= value, the same way an invalid ?layout= already
	// falls through its own regex check below.
	if (layoutParam && /^[\w-]+\.json$/.test(layoutParam)) {
		loadLayout(layoutParam.replace(/\.json$/, ''));
		return;
	}

	const builder = builderParam && BUILDERS.find((b) => b.id === `__${builderParam}__`);
	if (builder) {
		selectBuilder(builder, parseBuilderParams(urlParams));
	} else {
		selectBuilder(BUILDERS.find((b) => b.id === DEFAULT_BUILDER_ID), DEFAULT_BUILDER_PARAMS);
	}
}

async function loadLayout(name) {
	leds = []; // draw() bails out while this is empty, so the canvas just goes blank during the fetch

	const data = await (await fetch(DATA_BASE + name + '.json')).json();
	applyLayoutData(name, data);
}

// shared by loadLayout() (fetched layouts/*.json) and every builder's own build() in
// builders/*.js (built in memory, never saved - same {leds, symmetry?, lines?} shape either
// way)
function applyLayoutData(name, data) {
	directory = name;
	leds = data.leds.map((led, i) => new Led(String(i + 1), led.x, led.y));
	radius = data.r;
	symmetry = data.symmetry || leds.map((_, i) => i); // no symmetry key means no partners
	ledLines = data.lines || [];
	clipboard = leds.map(() => false);
	stopPlayback();
	undoStack = [];
	redoStack = [];
	states = [leds.map(() => false)];
	thumbCache = []; // brand-new leds - every previous frame's cached image is for a completely different shape now
	current = 0;
	resetView(); // a stale zoom/pan from the previous layout wouldn't make sense on a new one
}

// Thumbnails no longer go through here at all (see renderThumb() below) - this is always the
// main, interactive view now.
function drawLEDs(dx, dy, a, currentFrame, viewZoom, viewPanX, viewPanY) {
	a -= 1;
	const f = Math.round(0.9 * a);

	// border - stays fixed, framing the viewport; only the content within it (wires, LEDs)
	// pans/zooms, same "viewport stays put, content moves" feel as a map or image viewer
	stroke(STROKE_DIV);
	fill(BACKGROUND);
	rect(dx - a, dy - a, 2 * a, 2 * a);

	// clip everything drawn below to that same border rect - without this, a zoomed-in main
	// view's content overflows its square and spills into whatever's drawn next in the same
	// canvas (the thumbnail strip below it). p5 1.x has no clip()/noClip() of its own (that's
	// a later p5 2.x addition), so this goes straight through drawingContext, p5's own name for
	// the raw CanvasRenderingContext2D. push()/pop() (not drawingContext.save()/restore()
	// directly) scope it to just this call - push() already calls the context's save()
	// internally, and also keeps p5's own tracked style state (not just the raw context) in
	// sync with whatever pop() restores it to.
	push();
	drawingContext.beginPath();
	drawingContext.rect(dx - a, dy - a, 2 * a, 2 * a);
	drawingContext.clip();

	// position transform: dx/dy shift by the pan, f scales by the zoom - spreading LEDs
	// apart from each other as you zoom in. Composing this with Led.getPosX/Y's own
	// dx + f*posX reduces to exactly the same zoom-to-cursor formula
	// lib/larsi.org/point-cloud-renderer-2d.js's project() uses ((pos - center) * zoom +
	// center + pan) - it simplifies this far because dx/dy already *are* that center
	// (LEDS_DX/LEDS_DY), so the "- center" term cancels. See zoomViewAt() below for the
	// matching zoom-to-cursor math.
	//
	// LED *size* deliberately does NOT scale with zoom (computed from the plain unzoomed f,
	// not cf) - the whole point of zooming in is to make a dense build (Cube (Custom) N=8,
	// Hex N=13) easier to edit by spacing its LEDs apart, not by uniformly magnifying the
	// picture. Scaling the circles too would leave them just as hard to click apart as
	// before, only bigger - it's the *gap* between LEDs that needs to grow, not the LEDs
	// themselves.
	const cdx = dx + viewPanX;
	const cdy = dy + viewPanY;
	const cf = f * viewZoom;
	const size = Math.round(f * radius);

	// wires
	stroke(STROKE_WIRE);
	for (const [i0, i1] of ledLines) {
		line(leds[i0].getPosX(cdx, cf), leds[i0].getPosY(cdy, cf), leds[i1].getPosX(cdx, cf), leds[i1].getPosY(cdy, cf));
	}

	// Reverse draw order (last LED first) so farther-away LEDs paint underneath nearer ones,
	// not on top of them - matters for Cube (Custom): buildCube() pushes each level's LEDs in
	// front-to-back row order, so a later index is always farther from the viewer within that
	// level (see buildCube's depth-skew comment). Flat layouts (Circle/Hex/Matrix, non-cube
	// checked-in files) have no such depth axis, so draw order is a no-op for them either way.
	for (let i = leds.length - 1; i >= 0; i--) {
		leds[i].draw(states[currentFrame][i], cdx, cdy, cf, size, mouseX, mouseY);
	}

	pop(); // otherwise the next drawLEDs() call stays clipped to this one's rect
}

// (Re)renders frame ti's thumbnail into its own small offscreen buffer, called lazily from
// draw()'s thumbnail loop whenever thumbCache[ti] is missing - not eagerly the moment a frame
// is invalidated, since an invalidated frame that's never actually visible before being
// invalidated again (rapid edits to the current frame, say) would otherwise be rendered for
// nothing. Local coordinates (the buffer is its own tiny canvas, not positioned within the
// main one) - draw() places the result with image() instead. No wires (see the "not worth
// reading at that size" note this replaced) and no stroke/label/hover, matching what
// Led.draw() used to skip in its old icon-mode branch - just plain filled circles, using
// Led's own position/size math directly rather than its draw() method.
function renderThumb(ti) {
	const g = createGraphics(THUMB_SIZE, THUMB_SIZE);
	const c = THUMB_SIZE / 2;
	const a = c - 1;
	const f = Math.round(0.9 * a);

	g.background(PANEL_BACKGROUND);
	g.stroke(STROKE_DIV);
	g.fill(BACKGROUND);
	g.rect(c - a, c - a, 2 * a, 2 * a);

	g.noStroke();
	const size = Math.round(f * radius);
	for (let i = leds.length - 1; i >= 0; i--) {
		g.fill(Led.backgroundColor(states[ti][i]));
		g.ellipse(leds[i].getPosX(c, f), leds[i].getPosY(c, f), size, size);
	}

	thumbCache[ti] = g;
	return g;
}

function invalidateCurrentThumb() {
	thumbCache[current] = null;
}

// executeKey()'s '['/']'/Delete cases need thumbCache kept in the exact same shape as
// states - a frame that didn't change content still needs its cached image relocated to its
// new index, and a newly-inserted frame starts with no cache at all (same as any other
// invalidated frame - rendered lazily next time it's actually visible).
function insertFrame(atIndex, frame) {
	states.splice(atIndex, 0, frame);
	thumbCache.splice(atIndex, 0, null);
}

function deleteFrame(atIndex) {
	states.splice(atIndex, 1);
	thumbCache.splice(atIndex, 1);
}

function draw() {
	background(PAGE_BACKGROUND);

	if (leds.length === 0) return; // layout still loading

	updateToolbarUI();
	updateCanvasHeight();

	// thumbnails, 8 wide, up to 8 rows - cached per frame (see renderThumb()), only actually
	// redrawn when that frame's own content changes, not every p5 frame. The active frame's
	// highlight border is drawn fresh on top every p5 frame instead of baked into the cache -
	// cheap (one rect), and means switching frames never has to invalidate/re-render either
	// thumbnail's cached LED content just to move the highlight.
	const rows = Math.min(8, Math.ceil(states.length / 8));
	fill(PANEL_BACKGROUND);
	noStroke();
	rect(0, THUMB_TOP, DIM, rows * THUMB_SIZE);
	for (let ty = 0; ty < rows; ty++) {
		for (let tx = 0; tx < 8; tx++) {
			const ti = tx + 8 * ty;
			if (ti < states.length) {
				const tlx = tx * THUMB_SIZE;
				const tly = THUMB_TOP + ty * THUMB_SIZE;
				const g = thumbCache[ti] || renderThumb(ti);
				image(g, tlx, tly);
				if (ti === current) {
					noFill();
					stroke(THUMB_ACTIVE);
					strokeWeight(3);
					rect(tlx + 2, tly + 2, THUMB_SIZE - 4, THUMB_SIZE - 4);
					strokeWeight(1); // restore the default - drawLEDs()'s wires/LED outlines below assume it
				}
			}
		}
	}

	// strip's border last, over the cells' own edges - same look as the toolbar's
	noFill();
	stroke(PANEL_BORDER);
	strokeWeight(1);
	rect(0.5, THUMB_TOP + 0.5, DIM - 1, rows * THUMB_SIZE - 1);

	// main LEDs
	drawLEDs(LEDS_DX, LEDS_DY, LEDS_DX, current, viewZoom, viewPanX, viewPanY);
}

function toggleWithSymmetry(i) {
	// set the whole group to LED i's new state, rather than inverting each member
	// independently - the group can be non-uniform (edited earlier with Symmetry off,
	// or via right-click), and inverting each one wouldn't make it uniform again;
	// it would just flip whatever mismatched pattern was already there
	const newState = !states[current][i];
	states[current][i] = newState;
	let j = i;
	while ((j = symmetry[j]) !== i) {
		states[current][j] = newState;
	}
}

// left-click and Random respect the Symmetry checkbox; right-click always
// bypasses it (toggleWithSymmetry directly) as a manual single-LED override
let symmetryEnabled = true;

function toggleLED(i) {
	if (symmetryEnabled) toggleWithSymmetry(i);
	else states[current][i] = !states[current][i];
	invalidateCurrentThumb();
}

// Undo/redo: whole-animation snapshots (every frame plus which one is current), taken just
// before each edit - simple and obviously correct, versus per-operation inverses for a dozen
// different edit shapes. Frames are small boolean arrays, so 50 snapshots stays cheap even at
// 64 frames of the densest builder. A new edit drops the redo stack; building a new layout
// (applyLayoutData) drops both, since old snapshots are for a different shape of LEDs.
const UNDO_LIMIT = 50;
let undoStack = [];
let redoStack = [];

const takeSnapshot = () => ({ states: states.map((f) => f.slice()), current });

function pushUndo() {
	undoStack.push(takeSnapshot());
	if (undoStack.length > UNDO_LIMIT) undoStack.shift();
	redoStack = [];
}

function restoreSnapshot(sn) {
	states = sn.states.map((f) => f.slice());
	current = sn.current;
	thumbCache = states.map(() => null); // frames may have moved or changed anywhere
}

function undo() {
	if (undoStack.length === 0) return;
	redoStack.push(takeSnapshot());
	restoreSnapshot(undoStack.pop());
}

function redo() {
	if (redoStack.length === 0) return;
	undoStack.push(takeSnapshot());
	restoreSnapshot(redoStack.pop());
}

// executeKey() answers that change frame content (undoable); navigation, copy, Generate and
// Export don't.
const EDIT_KEYS = new Set([' ', 'i', '[', ']', 'Delete', 'v', 'r']);

function executeKey(key) {
	if (leds.length === 0) return;
	stopPlayback();
	if (EDIT_KEYS.has(key) && !(key === 'Delete' && states.length <= 1)) pushUndo();

	switch (key) {
		case 'undo':
			undo();
			break;
		case 'redo':
			redo();
			break;
		case ' ': // clear current frame (toolbar button only)
			states[current] = states[current].map(() => false);
			invalidateCurrentThumb();
			break;
		case 'i': // invert current frame
			states[current] = states[current].map((v) => !v);
			invalidateCurrentThumb();
			break;
		case ',': // previous frame
			current = current > 0 ? current - 1 : states.length - 1;
			break;
		case '.': // next frame
			current = current < states.length - 1 ? current + 1 : 0;
			break;
		case '[': // duplicate the current frame before itself (own copy - the clipboard is untouched)
			insertFrame(current, states[current].slice());
			break;
		case ']': // duplicate the current frame after itself
			current++;
			insertFrame(current, states[current - 1].slice());
			break;
		case 'Delete': // delete current frame (toolbar button only)
			if (states.length > 1) { // keep at least one frame
				deleteFrame(current);
				if (current > states.length - 1) current = states.length - 1;
			}
			break;
		case 'c': // copy frame to clipboard
			clipboard = states[current].slice();
			break;
		case 'v': // paste clipboard into frame
			states[current] = clipboard.slice();
			invalidateCurrentThumb();
			break;
		case 'r': // random
			toggleLED(Math.floor(Math.random() * leds.length));
			break;
		case 'g': // generate source of animation
			generate();
			break;
		case 'e': // export the current layout as a layouts/*.json file
			exportLayout();
			break;
	}
}

function showOutput(title, descHtml, text) {
	document.getElementById('output-title').textContent = title;
	document.getElementById('output-desc').innerHTML = descHtml;
	document.getElementById('output-text').value = text;
	document.getElementById('output').hidden = false;
}

// Arduino source, kept in flash (PROGMEM) with a PROGMEM table of pointers - on AVR a plain
// `const char* frames[]` would copy every array into scarce RAM, and a table of arrays can't
// itself be PROGMEM-resident without each array being its own PROGMEM array first.
// Default: one string per frame, one '0'/'1' char per LED in the layout's leds order.
// Compact: the same bits packed 8 LEDs per byte, LED 1 = bit 0 (LSB) up to LED 8 = bit 7 (MSB),
// then LEDs 9-16 in the next byte, and so on; the last byte is zero-padded.
function generate() {
	const compact = document.getElementById('compact-toggle').checked;
	const n = states.length;
	const bytesPerFrame = Math.ceil(leds.length / 8);
	const lines = [
		`// ${leds.length} LEDs, ${n} frame${n === 1 ? '' : 's'} - ` + (compact
			? `${bytesPerFrame} byte${bytesPerFrame === 1 ? '' : 's'} per frame, 8 LEDs per byte (LED 1 = bit 0), last byte zero-padded`
			: "one string per frame, one '0'/'1' per LED (layout order)"),
		`const uint16_t NUM_LEDS = ${leds.length};`,
		`const uint16_t NUM_FRAMES = ${n};`,
		'',
	];
	states.forEach((frame, f) => {
		if (!compact) {
			lines.push(`const char frame${f}[] PROGMEM = "${frame.map((v) => (v ? '1' : '0')).join('')}";`);
			return;
		}
		const bytes = [];
		for (let b = 0; b < bytesPerFrame; b++) {
			let v = 0;
			for (let k = 0; k < 8; k++) if (frame[b * 8 + k]) v |= 1 << k;
			bytes.push('0x' + v.toString(16).toUpperCase().padStart(2, '0'));
		}
		lines.push(`const uint8_t frame${f}[] PROGMEM = { ${bytes.join(', ')} };`);
	});
	lines.push('', `const ${compact ? 'uint8_t' : 'char'}* const frames[] PROGMEM = {`);
	lines.push(states.map((_, f) => `  frame${f}`).join(',\n'));
	lines.push(
		'};',
		'',
		'// is LED i lit in frame f?',
		'bool ledOn(uint16_t f, uint16_t i) {',
		compact
			? '  const uint8_t* frame = (const uint8_t*)pgm_read_ptr(&frames[f]);'
			: '  const char* frame = (const char*)pgm_read_ptr(&frames[f]);',
		compact
			? '  return (pgm_read_byte(frame + (i >> 3)) >> (i & 7)) & 1;'
			: "  return pgm_read_byte(frame + i) == '1';",
		'}'
	);
	showOutput(
		'Arduino code',
		'Paste into your sketch. Frames live in flash (<code>PROGMEM</code>); read them with <code>ledOn(frame, led)</code>.',
		lines.join('\n')
	);
}

// round to 3 decimal places (x/y/r never exceed ±1, so this is plenty of
// precision) - mainly matters for a live-built Matrix, whose raw x/y come
// straight out of division with no rounding applied until export time
function clean(v) {
	return Math.round(v * 1000) / 1000;
}

function exportLayout() {
	const data = { leds: leds.map((led) => ({ x: clean(led.posX), y: clean(led.posY) })), r: clean(radius) };
	if (symmetry.some((v, i) => v !== i)) data.symmetry = symmetry;
	if (ledLines.length) data.lines = ledLines;
	showOutput(
		'Layout file',
		'Save as <code>layouts/&lt;name&gt;.json</code> (see the <code>p5js/</code> README) to keep this layout.',
		JSON.stringify(data)
	);
}

// Toolbar buttons are real <button> elements now (see index.html) - keyboard hotkeys
// still work as a shortcut, but only when focus isn't already on an interactive element
// (a toolbar button, the layout <select>, ...), so Enter/Space still natively activate
// whatever's focused instead of also triggering a hotkey underneath it.
function isTypingTarget() {
	const tag = document.activeElement && document.activeElement.tagName;
	return tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA';
}

// Keys executeKey() answers to that are toolbar-button-only: the buttons dispatch through
// executeKey() by their data-key, but destructive or rarely-used actions get no keyboard
// shortcut (no undo yet, and Space/Backspace are habitual scroll/back keys).
const BUTTON_ONLY_KEYS = new Set([' ', 'Delete', 'g', 'e']);

// Ctrl/Cmd+Z undoes, Ctrl+Y or Ctrl/Cmd+Shift+Z redoes - on keydown, while the modifier is
// certainly still held (keyReleased() fires after it may already be up).
function keyPressed(event) {
	// a focused toolbar button (after clicking Undo, say) shouldn't swallow the shortcut - only
	// real text/number fields, where Ctrl+Z belongs to the browser's own field undo
	const tag = document.activeElement && document.activeElement.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !(event.ctrlKey || event.metaKey)) return;
	const k = event.key.toLowerCase();
	if (k === 'z' && !event.shiftKey) executeKey('undo');
	else if (k === 'y' || (k === 'z' && event.shiftKey)) executeKey('redo');
	else return;
	return false;
}

function keyReleased() {
	if (isTypingTarget() || BUTTON_ONLY_KEYS.has(key)) return;
	executeKey(key);
	return false;
}

// Distinguishes a click (toggle whatever LED is under the cursor) from a drag (pan the view)
// - both start with mousePressed and end with mouseReleased, so this tracks how far the mouse
// actually moved in between. A small threshold rather than "any movement at all" so a real
// tap on a touchscreen (which rarely lands at the exact same pixel on press and release)
// doesn't get misread as a pan and lose its toggle.
let dragging = false;
let dragDistance = 0;

function mousePressed() {
	// a press anywhere on the canvas (editor or thumbnails) - not the toolbar's own Play button
	if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) stopPlayback();
	if (mainTouch) return; // touches that begin in the main square are handled by wireTouchGestures()
	if (leds.length === 0 || !inMainView(mouseX, mouseY)) return;
	dragging = true;
	dragDistance = 0;
}

function mouseDragged() {
	if (!dragging || mainTouch) return;
	viewPanX += mouseX - pmouseX;
	viewPanY += mouseY - pmouseY;
	dragDistance += Math.abs(mouseX - pmouseX) + Math.abs(mouseY - pmouseY);
}

function doubleClicked() {
	if (inMainView(mouseX, mouseY)) resetView();
}

// Only zooms while hovering the main LED square - elsewhere (toolbar, thumbnails, the
// Projects table below), leave the wheel alone so the page still scrolls normally.
function mouseWheel(event) {
	if (!inMainView(mouseX, mouseY)) return;
	zoomViewAt(mouseX, mouseY, viewZoom * Math.exp(-event.delta * 0.001));
	return false;
}

// Touch gestures for the main view, handled here start to finish rather than through p5's
// simulated mouse events: one finger pans (or, if it barely moved, taps an LED), two fingers
// pinch-zoom about their midpoint (and pan with it). Claiming the touch with preventDefault
// keeps the page from scrolling/zooming under it - which also suppresses the browser's
// emulated mouse events, hence handling the tap ourselves. mainTouch makes p5's own
// mousePressed/Dragged/Released ignore everything from the gesture (p5's window-level touch
// listeners run right after these canvas-level ones, for the same event) until every finger
// is up. Touches that begin outside the main square (thumbnails) aren't claimed at all: they
// still scroll, and their emulated mouse events select a frame as before.
let mainTouch = false;
let touchPan = null;    // { x, y, dist } - last position of the one finger, while it's the only one
let touchMoved = 0;     // total travel of this gesture, to tell a tap from a pan
let touchMulti = false; // a second finger joined: this gesture is never a tap
let pinchStart = null;  // { dist, zoom, mx, my } while two fingers are down
let lastEmptyTap = null; // { t, x, y } - a tap on empty space; a second one nearby resets the view

function wireTouchGestures(el) {
	const pos = (t) => {
		const r = el.getBoundingClientRect();
		const k = DIM / r.width; // canvas may be CSS-scaled down (max-width:100%)
		return { x: (t.clientX - r.left) * k, y: (t.clientY - r.top) * k };
	};
	const pinchState = (e) => {
		const a = pos(e.touches[0]), b = pos(e.touches[1]);
		return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
	};

	el.addEventListener('touchstart', (e) => {
		if (leds.length === 0) return;
		if (e.touches.length === 1) {
			const p = pos(e.touches[0]);
			if (!inMainView(p.x, p.y)) return; // thumbnails etc: leave to the browser and p5
			mainTouch = true;
			stopPlayback();
			touchMulti = false;
			touchMoved = 0;
			touchPan = p;
		} else if (!mainTouch) {
			return;
		} else if (e.touches.length === 2) {
			touchMulti = true;
			touchPan = null;
			pinchStart = { ...pinchState(e), zoom: viewZoom };
		}
		if (e.cancelable) e.preventDefault();
	}, { passive: false });

	el.addEventListener('touchmove', (e) => {
		if (!mainTouch) return;
		if (e.cancelable) e.preventDefault();
		if (pinchStart && e.touches.length >= 2) {
			const cur = pinchState(e);
			viewPanX += cur.mx - pinchStart.mx;
			viewPanY += cur.my - pinchStart.my;
			zoomViewAt(cur.mx, cur.my, pinchStart.zoom * cur.dist / pinchStart.dist);
			pinchStart.mx = cur.mx;
			pinchStart.my = cur.my;
		} else if (touchPan && e.touches.length === 1) {
			const p = pos(e.touches[0]);
			viewPanX += p.x - touchPan.x;
			viewPanY += p.y - touchPan.y;
			touchMoved += Math.abs(p.x - touchPan.x) + Math.abs(p.y - touchPan.y);
			touchPan = p;
		}
	}, { passive: false });

	const end = (e) => {
		if (!mainTouch) return;
		if (e.touches.length < 2) pinchStart = null;
		if (e.touches.length > 0) return; // wait for the last finger
		const wasTap = !touchMulti && touchMoved <= 4 && e.type === 'touchend' && touchPan;
		const p = touchPan;
		touchPan = null;
		// p5's own handlers for this same event run right after us and still need to see
		// mainTouch set - clear it once the event has finished dispatching
		setTimeout(() => { mainTouch = false; }, 0);
		if (!wasTap) return;
		if (clickMainAt(p.x, p.y, false)) {
			lastEmptyTap = null;
			return;
		}
		const now = Date.now();
		if (lastEmptyTap && now - lastEmptyTap.t < 300 && Math.hypot(p.x - lastEmptyTap.x, p.y - lastEmptyTap.y) < 30) {
			resetView(); // double-tap on empty space
			lastEmptyTap = null;
		} else {
			lastEmptyTap = { t: now, x: p.x, y: p.y };
		}
	};
	el.addEventListener('touchend', end);
	el.addEventListener('touchcancel', end);
}

function mouseReleased() {
	if (leds.length === 0) return;

	if (mainTouch) return; // see mousePressed()

	const startedInMain = dragging; // mousePressed() only sets this for a press inside the main square
	const wasPan = dragging && dragDistance > 4;
	dragging = false;
	if (wasPan) return; // a real drag pans the view - don't also toggle whatever's under the cursor

	const ti = thumbIndexAt(mouseX, mouseY);
	if (ti >= 0) {
		current = ti;
		return;
	}

	// p5 sees mouse events on the whole page, and a zoomed-in view's LEDs can lie outside the
	// square (clipped from view, still hit-testable) - so a click on the toolbar's number
	// spinners, say, could otherwise toggle an invisible LED under it. Both ends of the click
	// have to be inside the main square.
	if (!startedInMain || !inMainView(mouseX, mouseY)) return;

	clickMainAt(mouseX, mouseY, mouseButton === RIGHT);
}

// Toggles whatever LED(s) lie under (x, y) in the main view - left click toggles with symmetry,
// right click just the one LED. Returns whether anything was under the point.
function clickMainAt(x, y, single) {
	const { dx, dy, f, size } = mainViewProjection();
	let hit = false;
	for (let i = 0; i < leds.length; i++) {
		if (!leds[i].isOver(dx, dy, f, size, x, y)) continue;
		if (!hit) pushUndo(); // one undo step per click, even over overlapping LEDs
		hit = true;
		if (single) {
			states[current][i] = !states[current][i];
			invalidateCurrentThumb();
		} else {
			toggleLED(i);
		}
	}
	return hit;
}

function updateToolbarUI() {
	document.getElementById('frame-counter').textContent = `${current + 1} / ${states.length}`;
	document.getElementById('delete-btn').disabled = states.length <= 1;
	document.getElementById('undo-btn').disabled = undoStack.length === 0;
	document.getElementById('redo-btn').disabled = redoStack.length === 0;
}

// grow/shrink the canvas with the actual frame count instead of always reserving
// the full 8 rows of thumbnails (mostly-empty gray space for a small animation)
let lastThumbRows = 1; // matches createCanvas()'s initial height

function updateCanvasHeight() {
	const rows = Math.min(8, Math.ceil(states.length / 8)); // states always has >=1 frame, so rows >= 1
	if (rows === lastThumbRows) return;
	lastThumbRows = rows;
	resizeCanvas(DIM, THUMB_TOP + rows * THUMB_SIZE);
}

// Playback preview: steps `current` through every frame in order, looping, at the fps field's
// rate - createPlayPauseLoop() is the same shared helper graphics/flower and Function3D use
// (play-pause-loop.js, loaded before this file). Any click in the canvas or toolbar action
// stops it, so an edit never lands on a frame that's already flown past.
let playLoop = null;
const stopPlayback = () => { if (playLoop) playLoop.stop(); };

function wireToolbar() {
	const fpsInput = document.getElementById('fps-input');
	playLoop = createPlayPauseLoop(
		document.getElementById('play-btn'),
		() => { current = (current + 1) % states.length; },
		() => Math.min(30, Math.max(1, parseFloat(fpsInput.value) || 4))
	);
	window.addEventListener('pagehide', playLoop.stop);
	document.querySelectorAll('#toolbar .tb-btn[data-key]').forEach((btn) => {
		btn.addEventListener('click', () => executeKey(btn.dataset.key));
	});
	document.getElementById('symmetry-toggle').addEventListener('change', (e) => {
		symmetryEnabled = e.target.checked;
	});
	// each builder in BUILDERS (builders/*.js) wires its own controls' Build button and
	// Enter-key handling itself, inside its own createControls() - see populateLayoutSelect()
}

// LAYOUTS' own file-based options, plus BUILDERS' (builders/common.js's populateBuilderOptions()
// - also where each builder's own toolbar controls get created, so adding a new builder never
// means touching this file, index.html, or index.php) - one shared #layout dropdown either way.
function populateLayoutSelect() {
	const select = document.getElementById('layout');
	const anchor = document.getElementById('builders-anchor');

	for (const { value, label } of LAYOUTS) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		if (value === directory) option.selected = true;
		select.appendChild(option);
	}

	populateBuilderOptions(select, anchor);

	select.addEventListener('change', () => {
		const builder = BUILDERS.find((b) => b.id === select.value);
		if (builder) selectBuilder(builder); // no params - build() falls back to its own toolbar inputs
		else loadLayout(select.value);
	});
}

document.getElementById('copy-btn').addEventListener('click', () => {
	navigator.clipboard.writeText(document.getElementById('output-text').value);
});
document.getElementById('close-output-btn').addEventListener('click', () => {
	document.getElementById('output').hidden = true;
});
