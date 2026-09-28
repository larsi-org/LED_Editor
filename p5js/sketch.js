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

// Landing view when neither ?layout= nor ?builder= is given at all - reproduces exactly what
// the last checked-in default (hex10.json, Schneeflocke) used to show, now that it's just Hex
// (Custom) at these params rather than a cached file.
const DEFAULT_BUILDER_ID = '__hex__';
const DEFAULT_BUILDER_PARAMS = { count: '10', zigzag: true };

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

// Undefined (not present in the URL at all) lets a builder's own build(params) fall back to
// its toolbar default via ?? - only an explicit zigzag=0/1 (or true/false) should override it.
function parseBuilderParams(urlParams) {
	const zigzagRaw = urlParams.get('zigzag');
	return {
		count: urlParams.get('count'),
		countX: urlParams.get('countX'),
		countY: urlParams.get('countY'),
		zigzag: zigzagRaw === null ? undefined : (zigzagRaw === '1' || zigzagRaw === 'true')
	};
}

// colors - read from led-editor.css's :root palette (see led.js's cssVar() comment for why
// this is safe at plain top-level script scope), not hardcoded, so there's one place to
// change any of them
const BACKGROUND      = cssVar('--bg-canvas');
const FILL_BACKGROUND = cssVar('--bg-canvas-fill');
const STROKE_DIV      = cssVar('--accent');
const STROKE_WIRE     = cssVar('--wire');

const DIM  = 800;
const DIM2 = DIM / 2;

const LEDS_DX = DIM2;
const LEDS_DY = DIM2; // buttons/label used to live in a reserved band above this; now on-page HTML

// thumbnails sit below the main grid (not beside it - that made the canvas
// twice as wide as it needed to be, always overflowing the page)
const THUMB_GAP = 20;
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
// point-cloud-renderer-architecture note). No pinch-zoom: p5's default touch-to-mouse
// simulation already gives single-finger drag-to-pan and tap-to-toggle for free as long as no
// touchStarted/touchMoved/touchEnded are defined, but pinch needs real multi-touch handling,
// which this doesn't add (yet) - wheel zoom (desktop) and double-click/tap reset are the only
// way to zoom in for now.
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

// Same dx/dy/f/sf drawLEDs() actually draws the main view with, for hit-testing at the
// current pan/zoom - mouseReleased() needs this to stay in sync with what's on screen. sf
// (size) deliberately doesn't pick up viewZoom, matching drawLEDs()'s own sf -
// the hit target stays the same fixed size a zoomed-apart LED is actually drawn at, not a
// zoomed-up one, so click precision improves right along with the added visual spacing.
function mainViewProjection() {
	const f = Math.round(0.9 * (LEDS_DX - 1));
	return { dx: LEDS_DX + viewPanX, dy: LEDS_DY + viewPanY, f: f * viewZoom, sf: f };
}

function setup() {
	const canvas = createCanvas(DIM, THUMB_TOP + THUMB_SIZE); // starts at 1 thumbnail row; grows with the frame count
	canvas.parent('sketch-holder');
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
	// LED *size* deliberately does NOT scale with zoom (sf stays the plain unzoomed f) -
	// the whole point of zooming in is to make a dense build (Cube (Custom) N=8, Hex N=13)
	// easier to edit by spacing its LEDs apart, not by uniformly magnifying the picture.
	// Scaling the circles too would leave them just as hard to click apart as before, only
	// bigger - it's the *gap* between LEDs that needs to grow, not the LEDs themselves.
	const cdx = dx + viewPanX;
	const cdy = dy + viewPanY;
	const cf = f * viewZoom;
	const sf = f;

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
		leds[i].draw(states[currentFrame][i], cdx, cdy, cf, sf, radius, mouseX, mouseY);
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

	g.background(FILL_BACKGROUND);
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
// new index, and a newly-inserted blank frame starts with no cache at all (same as any other
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
	background(FILL_BACKGROUND);

	if (leds.length === 0) return; // layout still loading

	updateToolbarUI();
	updateCanvasHeight();

	// thumbnails, 8 wide, up to 8 rows - cached per frame (see renderThumb()), only actually
	// redrawn when that frame's own content changes, not every p5 frame
	const rows = Math.min(8, Math.ceil(states.length / 8));
	for (let ty = 0; ty < rows; ty++) {
		for (let tx = 0; tx < 8; tx++) {
			const ti = tx + 8 * ty;
			if (ti < states.length) {
				const g = thumbCache[ti] || renderThumb(ti);
				image(g, tx * THUMB_SIZE, THUMB_TOP + ty * THUMB_SIZE);
			}
		}
	}

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

function executeKey(key) {
	if (leds.length === 0) return;

	switch (key) {
		case ' ': // clear current frame
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
		case '[': // insert a frame before the current frame
			insertFrame(current, leds.map(() => false));
			break;
		case ']': // insert a frame after the current frame
			current++;
			insertFrame(current, leds.map(() => false));
			break;
		case 'Delete':
		case 'Backspace': // delete current frame
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

function generate() {
	const text = states.map((frame) => frame.map((v) => (v ? '1' : '0')).join('')).join('\n');
	showOutput(
		'Generated animation',
		'One line per frame, one <code>0</code>/<code>1</code> per LED (order matches the layout\'s <code>leds</code> list).',
		text
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

function keyPressed() {
	if (isTypingTarget()) return;
	// the browser's default action (space/arrow scroll, Delete/Backspace nav) fires on
	// keydown, so it has to be blocked here - blocking it in keyReleased is too late
	if (key === ' ' || key === 'Delete' || key === 'Backspace') return false;
}

function keyReleased() {
	if (isTypingTarget()) return;
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
	if (leds.length === 0 || !inMainView(mouseX, mouseY)) return;
	dragging = true;
	dragDistance = 0;
}

function mouseDragged() {
	if (!dragging) return;
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

function mouseReleased() {
	if (leds.length === 0) return;

	const wasPan = dragging && dragDistance > 4;
	dragging = false;
	if (wasPan) return; // a real drag pans the view - don't also toggle whatever's under the cursor

	const { dx, dy, f, sf } = mainViewProjection();
	if (mouseButton === LEFT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(dx, dy, f, sf, radius, mouseX, mouseY)) toggleLED(i);
		}
	} else if (mouseButton === RIGHT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(dx, dy, f, sf, radius, mouseX, mouseY)) {
				states[current][i] = !states[current][i];
				invalidateCurrentThumb();
			}
		}
	}
}

function updateToolbarUI() {
	document.getElementById('frame-counter').textContent = `${current + 1} / ${states.length}`;
	document.getElementById('delete-btn').disabled = states.length <= 1;
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

function wireToolbar() {
	document.querySelectorAll('#toolbar .tb-btn[data-key]').forEach((btn) => {
		btn.addEventListener('click', () => executeKey(btn.dataset.key));
	});
	document.getElementById('symmetry-toggle').addEventListener('change', (e) => {
		symmetryEnabled = e.target.checked;
	});
	// each builder in BUILDERS (builders/*.js) wires its own controls' Build button and
	// Enter-key handling itself, inside its own createControls() - see populateLayoutSelect()
}

// Builder controls (builders/*.js) are created here, not written into index.html/index.php,
// specifically so adding a new builder never means touching either page's markup - see
// builders/common.js's own comment on the {id, label, createControls, build} interface this
// relies on. Each one's <span class="tb-divider">/<div class="tb-group"> pair is inserted
// right before #builders-anchor (a fixed, empty marker element already in the toolbar, ahead
// of the always-present Symmetry group), in BUILDERS order - i.e. the order their <script>
// tags load in, which package.json's build script controls.
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

	for (const builder of BUILDERS) {
		const option = document.createElement('option');
		option.value = builder.id;
		option.textContent = builder.label;
		select.appendChild(option);

		const { divider, group } = builder.createControls();
		divider.hidden = true;
		group.hidden = true;
		anchor.before(divider, group);
		builder._divider = divider;
		builder._group = group;
	}

	select.addEventListener('change', () => {
		const builder = BUILDERS.find((b) => b.id === select.value);
		if (builder) selectBuilder(builder); // no params - build() falls back to its own toolbar inputs
		else loadLayout(select.value);
	});
}

// Shows builder's own controls and builds it - shared by the dropdown's change handler above
// (manual selection, no params - build() falls back to reading this builder's own toolbar
// inputs) and setup()'s ?builder= URL handling (params supplied, see parseBuilderParams()).
function selectBuilder(builder, params) {
	document.getElementById('output').hidden = true;
	for (const b of BUILDERS) {
		b._divider.hidden = true;
		b._group.hidden = true;
	}
	document.getElementById('layout').value = builder.id;
	builder._divider.hidden = false;
	builder._group.hidden = false;
	builder.build(params);
}

document.getElementById('copy-btn').addEventListener('click', () => {
	navigator.clipboard.writeText(document.getElementById('output-text').value);
});
document.getElementById('close-output-btn').addEventListener('click', () => {
	document.getElementById('output').hidden = true;
});
