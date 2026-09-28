// Must be served over HTTP, not opened as file:// (browsers block fetch()
// of local files). See README.md.

const DATA_BASE = 'layouts/';

// led_* files are all real hardware, kept checked in instead of rebuilt live each time
const LAYOUTS = [
	{ value: 'cube3',     label: 'Cube3 (LED Cube3)' },

	{ value: 'hex3',      label: 'Hex3 (ATtinyX5 hex3)' },
	{ value: 'hex10',     label: 'Hex10 (Schneeflocke)' },

	{ value: 'led_6x5',   label: '6×5 (LED 6×5)' },
	{ value: 'led_7x7',   label: '7×7 (LED Coffee Table)' },
	{ value: 'led_5x1',   label: '5×1 (LED5)' },
	{ value: 'led_8x1',   label: '8×1 (LED8)' },
	{ value: 'led_20x1',  label: '20×1 (ATtinyX5 led20)' },
	{ value: 'led_25x25', label: '25×25 (Peggy 2LE)' }
];

// pseudo-layouts, not real layouts/*.json files - built live instead, see
// each build*FromInputs() function. Keyed by dropdown <option> value; each
// entry names the toolbar group to show while it's selected and the
// function that (re)builds it from that group's current inputs.
const CUSTOM_BUILDERS = {
	'__circle__': { label: 'Circle (Custom)', controls: 'circle-controls', divider: 'circle-divider', build: buildCircleFromInputs },
	'__hex__': { label: 'Hex (Custom)', controls: 'hex-controls', divider: 'hex-divider', build: buildHexFromInputs },
	'__matrix__': { label: 'Matrix (Custom)', controls: 'matrix-controls', divider: 'matrix-divider', build: buildMatrixFromInputs },
	'__cube__': { label: 'Cube (Custom)', controls: 'cube-controls', divider: 'cube-divider', build: buildCubeFromInputs }
};

let directory = 'hex10';

// ?layout=<name>.json overrides the default landing layout - e.g.
// ?layout=led_7x7.json opens straight on that layout instead of making the
// visitor pick it from the dropdown themselves. Read straight off the URL
// client-side, no server involvement needed.
const layoutParam = new URLSearchParams(window.location.search).get('layout');
if (layoutParam && /^[\w-]+\.json$/.test(layoutParam)) {
	directory = layoutParam.replace(/\.json$/, '');
}

// colors
const BACKGROUND      = '#111111';
const FILL_BACKGROUND = '#333333';
const STROKE_DIV      = '#336699';
const STROKE_WIRE     = '#666666';

const DIM  = 800;
const DIM2 = DIM / 2;

const LEDS_DX = DIM2;
const LEDS_DY = DIM2; // buttons/label used to live in a reserved band above this; now on-page HTML

// thumbnails sit below the main grid (not beside it - that made the canvas
// twice as wide as it needed to be, always overflowing the page)
const THUMB_GAP = 20;
const THUMB_TOP = DIM + THUMB_GAP;

// LEDs
let leds = [];

// Lines (only cube3 has any)
let ledLines = [];

// symmetry[i] is the next LED in i's symmetry cycle (i itself if none)
let symmetry = [];

// Animation states: one boolean[] per frame
let states = [];

// current frame index
let current = 0;

// clipboard
let clipboard = [];

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

// Same dx/dy/f/sf the main (non-icon) drawLEDs() call actually draws with, for hit-testing
// at the current pan/zoom - mouseReleased() needs this to stay in sync with what's on
// screen. sf (size) deliberately doesn't pick up viewZoom, matching drawLEDs()'s own sf -
// the hit target stays the same fixed size a zoomed-apart LED is actually drawn at, not a
// zoomed-up one, so click precision improves right along with the added visual spacing.
function mainViewProjection() {
	const f = Math.round(0.9 * (LEDS_DX - 1));
	return { dx: LEDS_DX + viewPanX, dy: LEDS_DY + viewPanY, f: f * viewZoom, sf: f };
}

function setup() {
	const canvas = createCanvas(DIM, THUMB_TOP + 100); // starts at 1 thumbnail row; grows with the frame count
	canvas.parent('sketch-holder');
	canvas.elt.oncontextmenu = () => false; // right-click toggles a single LED, don't show the browser menu
	textAlign(CENTER, CENTER);

	populateLayoutSelect();
	wireToolbar();
	loadLayout(directory);
}

async function loadLayout(name) {
	leds = []; // draw() bails out while this is empty, so the canvas just goes blank during the fetch

	const data = await (await fetch(DATA_BASE + name + '.json')).json();
	applyLayoutData(name, data);
}

// shared by loadLayout() (fetched layouts/*.json) and buildMatrixFromInputs()
// (built in memory, never saved - same {leds, symmetry?, lines?} shape either way)
function applyLayoutData(name, data) {
	directory = name;
	leds = data.leds.map((led, i) => new Checkbox(String(i + 1), led.x, led.y, led.r, false));
	symmetry = data.symmetry || leds.map((_, i) => i); // no symmetry key means no partners
	ledLines = data.lines || [];
	clipboard = leds.map(() => false);
	states = [leds.map(() => false)];
	current = 0;
	resetView(); // a stale zoom/pan from the previous layout wouldn't make sense on a new one
}

// Unlike create_matrix.py (which spaces each axis independently across the full
// [-1, 1] range, stretching a non-square grid), this uses one pitch for both axes
// - m = the larger dimension, inc = 2/m - so LEDs are evenly spaced in both x and
// y instead of squashed to fill a square regardless of the grid's aspect ratio.
//
// zigzag mirrors alternate rows (create_matrix.py has this too, just hardcoded
// off) so LED numbering snakes back and forth - row 0 left-to-right, row 1
// right-to-left, row 2 left-to-right, etc. - matching how an LED strip is
// actually wired: continuing straight into the next row instead of a long
// return wire back to the start of each row.
function buildMatrix(dimX, dimY, zigzag) {
	const m = Math.max(dimX, dimY);
	const inc = 2 / m;
	const matrixLeds = [];
	let direction = 1;
	for (let j = 0; j < dimY; j++) {
		const y = (j - (dimY - 1) / 2) * inc;
		for (let i = 0; i < dimX; i++) {
			const x = direction * (i - (dimX - 1) / 2) * inc;
			matrixLeds.push({ x, y, r: 0.1 });
		}
		if (zigzag) direction *= -1;
	}

	// one line per row, left end to right end - a row's two ends are always at
	// array indices j*dimX and j*dimX+dimX-1, regardless of zigzag (that only
	// mirrors x position, not array order), and every LED in between is already
	// colinear with them, so this alone draws straight across the whole row
	const matrixLines = [];
	if (dimX > 1) {
		for (let j = 0; j < dimY; j++) {
			matrixLines.push([j * dimX, j * dimX + dimX - 1]);
		}
	}
	// one line per column, top to bottom. Unlike rows, zigzag mirrors each row
	// independently, so a given physical column can sit at a different array
	// index per row - group by actual rendered x instead of assuming index
	// i, i+dimX, i+2*dimX, ... stays at the same column.
	if (dimY > 1) {
		const byX = new Map();
		matrixLeds.forEach((led, i) => {
			const key = Math.round(led.x * 1e6);
			if (!byX.has(key)) byX.set(key, []);
			byX.get(key).push(i);
		});
		for (const col of byX.values()) {
			if (col.length < 2) continue;
			col.sort((a, b) => matrixLeds[a].y - matrixLeds[b].y);
			matrixLines.push([col[0], col[col.length - 1]]);
		}
	}

	applyLayoutData(`matrix ${dimX}×${dimY}`, {
		leds: matrixLeds,
		lines: matrixLines,
		symmetry: computeMatrixSymmetry(matrixLeds, dimX, dimY)
	});
}

// Shared by every *Symmetry() below: given a layout's LEDs and a list of
// candidate symmetry transforms ((x, y) -> [x, y]), find each LED's full
// orbit by closing over all of them from its actual rendered position - the
// LEDs that are all mutual mirror/rotation images of each other, wired into
// one "next in cycle" cycle (see the layouts/*.json format in the README).
// Working from real coordinates rather than row/column/ring index means this
// is automatically correct under zigzag without special-casing it, the same
// way hex/circle's own generator (create_hex_circle.py) always matched by
// real (r, t) rather than array position. tolerance should match how far a
// transform's floating-point result can drift from its true value - plain
// sign flips are exact, but a rotation's sin/cos aren't, hence the two
// different tolerances passed in below.
function computeSymmetry(shapeLeds, transforms, tolerance) {
	const n = shapeLeds.length;
	const scale = 1 / tolerance;
	const keyOf = (x, y) => `${Math.round(x * scale)},${Math.round(y * scale)}`;
	const byPos = new Map();
	shapeLeds.forEach((led, i) => byPos.set(keyOf(led.x, led.y), i));

	const next = shapeLeds.map((_, i) => i); // default: no partner (self)
	const assigned = new Array(n).fill(false);
	for (let i = 0; i < n; i++) {
		if (assigned[i]) continue;

		const members = new Set([i]);
		const stack = [i];
		while (stack.length) {
			const cur = stack.pop();
			const { x, y } = shapeLeds[cur];
			for (const t of transforms) {
				const [tx, ty] = t(x, y);
				const j = byPos.get(keyOf(tx, ty));
				if (j !== undefined && !members.has(j)) {
					members.add(j);
					stack.push(j);
				}
			}
		}

		const orbit = Array.from(members).sort((a, b) => a - b);
		orbit.forEach((idx) => { assigned[idx] = true; });
		orbit.forEach((idx, k) => { next[idx] = orbit[(k + 1) % orbit.length]; });
	}
	return next;
}

// Symmetry group of an n x m grid: horizontal flip, vertical flip, and 180°
// rotation always apply (a rectangle mirrors onto itself either way, and a
// 1-wide/1-tall strip degenerates to just the one meaningful reversal, since
// the other flip becomes a no-op). A square (dimX === dimY) additionally gets
// both diagonal flips and both 90° rotations, since only then does swapping
// the two axes map the grid back onto itself - "n x n has the most symmetry,
// n x m loses half, 1 x n keeps only first<->last, second<->second-to-last".
// These transforms are exact (pure sign flips/swaps), hence the tight 1e-6
// tolerance.
function computeMatrixSymmetry(matrixLeds, dimX, dimY) {
	const transforms = [
		(x, y) => [-x, y],
		(x, y) => [x, -y],
		(x, y) => [-x, -y]
	];
	if (dimX === dimY) {
		transforms.push(
			(x, y) => [-y, x],
			(x, y) => [y, -x],
			(x, y) => [y, x],
			(x, y) => [-y, -x]
		);
	}
	return computeSymmetry(matrixLeds, transforms, 1e-6);
}

// Symmetry group of a hex/circle shape: both are built as rings of 6, 12,
// 18, ... points around a center, which always has full 12-fold dihedral
// symmetry (D6) - 6 rotations (multiples of 60°) plus a mirror, regardless
// of ring count or zigzag. Rotation involves sin/cos, which aren't exact in
// floating point, so this needs a looser tolerance (0.001, matching
// create_hex_circle.py's own f_equal) instead of computeMatrixSymmetry's 1e-6.
function computeRadialSymmetry(shapeLeds) {
	const transforms = [];
	for (let k = 0; k < 6; k++) {
		const theta = (k * 60 * Math.PI) / 180;
		const cosT = Math.cos(theta);
		const sinT = Math.sin(theta);
		if (k > 0) transforms.push((x, y) => [x * cosT - y * sinT, x * sinT + y * cosT]);
		// mirror across the x-axis (y -> -y), then that same rotation
		transforms.push((x, y) => [x * cosT + y * sinT, x * sinT - y * cosT]);
	}
	return computeSymmetry(shapeLeds, transforms, 0.001);
}

function buildMatrixFromInputs() {
	const clampDim = (id) => Math.min(32, Math.max(1, parseInt(document.getElementById(id).value, 10) || 1));
	buildMatrix(clampDim('matrix-width'), clampDim('matrix-height'), document.getElementById('matrix-zigzag').checked);
}

// port of create_hex_circle.py's create_circle() - N rings (plus a center
// LED) of 6, 12, 18, ... points, growing outward. No zigzag option: unlike a
// row-by-row grid or hex, going around each ring in one direction is already
// a sensible order to solder in - nothing to snake back and forth across.
function buildCircle(n) {
	const circleLeds = [{ x: 0, y: 0, r: 0.1 }];
	for (let c = 1; c < n; c++) {
		const r = c / (n - 1);
		const fA = 60 / c;
		for (let a = 0; a < 6 * c; a++) {
			const angle = (fA * a * Math.PI) / 180;
			circleLeds.push({ x: r * Math.cos(angle), y: -r * Math.sin(angle), r: 0.1 });
		}
	}
	applyLayoutData(`circle ${n}`, { leds: circleLeds, symmetry: computeRadialSymmetry(circleLeds) });
}

function buildCircleFromInputs() {
	const n = Math.min(20, Math.max(3, parseInt(document.getElementById('circle-n').value, 10) || 3));
	buildCircle(n);
}

// port of create_hex_circle.py's create_hex() - a hexagon built as 2n-1
// rows, widest in the middle. zigzag mirrors alternate rows, same idea and
// same reason as Matrix's: the physical strip continues straight into the
// next row instead of a long return wire back to the start of each one.
function buildHex(n, zigzag) {
	const dx = 1 / (n - 1);
	const dy = Math.sqrt(0.75) * dx;
	const hexLeds = [];
	let direction = 1;

	function addRow(count, y) {
		for (let i = 0; i < count; i++) {
			const x = direction * dx * (i - (count - 1) / 2);
			hexLeds.push({ x, y, r: 0.1 });
		}
	}

	let count = n;
	for (let row = 1; row < n; row++) {
		addRow(count, dy * (row - n));
		count += 1;
		if (zigzag) direction *= -1;
	}
	count = 2 * n - 1;
	addRow(count, 0);
	count -= 1;
	if (zigzag) direction *= -1;
	for (let row = 1; row < n; row++) {
		addRow(count, dy * row);
		count -= 1;
		if (zigzag) direction *= -1;
	}

	applyLayoutData(`hex ${n}`, { leds: hexLeds, symmetry: computeRadialSymmetry(hexLeds) });
}

function buildHexFromInputs() {
	const n = Math.min(20, Math.max(3, parseInt(document.getElementById('hex-n').value, 10) || 3));
	buildHex(n, document.getElementById('hex-zigzag').checked);
}

// Generalizes the checked-in cube3.json's hand-picked N=3 cabinet projection (see the
// CLAUDE.md/README notes on it) to any N x N x N cube: N levels stacked top to bottom,
// each level an N x N face, each row within a level skewed diagonally by (dx, dy) = (D, D)
// to suggest depth - same idea cube3 used, just not hand-tweaked to round numbers anymore.
//
// cube3 picked colSpacing = levelStep = 0.8 and depthSkew = 0.2 - a 4:1 ratio - which for
// N=3 happens to leave exactly half of each level's vertical step (0.8) as clear gap above
// the next level's rows (depth spread = 0.2*(3-1) = 0.4 = 0.8/2). That's the part worth
// keeping exact, not the raw numbers: fixing the *ratio* at 4:1 would let levels start
// visually overlapping once N-1 >= 5 (N >= 6), since the within-level depth spread grows
// with N while the level step doesn't. Instead this fixes the gap fraction itself - depth
// spread is always exactly half the level step, at any N - by solving colSpacing ===
// levelStep === P and depthSkew === D = P / (2*(N-1)) for whatever P makes the whole shape
// span [-1, 1] on both axes: P = 4 / (2N - 1). Plugging in N=3 reproduces cube3.json's
// 0.8/0.2 exactly, so this is a true generalization, not a different look.
function buildCube(n) {
	const P = 4 / (2 * n - 1);
	const D = n > 1 ? P / (2 * (n - 1)) : 0;
	const idx = (level, row, col) => (level * n + row) * n + col;

	const cubeLeds = [];
	for (let level = 0; level < n; level++) {
		const topY = 1 - level * P;
		for (let row = 0; row < n; row++) {
			const y = topY - row * D;
			for (let col = 0; col < n; col++) {
				cubeLeds.push({ x: -1 + col * P + row * D, y, r: 0.1 });
			}
		}
	}

	// same "just the two endpoints" trick as buildMatrix's row/column lines - every LED
	// between them is already colinear. One set per axis: left-right within a level's row,
	// front-to-back within a level's column, and top-to-bottom through a row/column's full
	// stack of levels (matches cube3.json's own 9+9+9 grouping, generalized to n*n each).
	const cubeLines = [];
	if (n > 1) {
		for (let level = 0; level < n; level++) {
			for (let row = 0; row < n; row++) {
				cubeLines.push([idx(level, row, 0), idx(level, row, n - 1)]);
			}
		}
		for (let level = 0; level < n; level++) {
			for (let col = 0; col < n; col++) {
				cubeLines.push([idx(level, 0, col), idx(level, n - 1, col)]);
			}
		}
		for (let row = 0; row < n; row++) {
			for (let col = 0; col < n; col++) {
				cubeLines.push([idx(0, row, col), idx(n - 1, row, col)]);
			}
		}
	}

	// No symmetry computed - same as the checked-in cube3.json (no "symmetry" key at all).
	// The cube's real symmetry group acts on its 3D level/row/col axes, but this cabinet
	// projection treats those three axes asymmetrically (level is a pure y-shift, column a
	// pure x-shift, row a diagonal x+y shift), so a physical cube rotation doesn't correspond
	// to any simple 2D transform of the projected (x, y) the way computeMatrixSymmetry's
	// axis flips do for a flat grid - not worth faking.
	applyLayoutData(`cube ${n}`, { leds: cubeLeds, lines: cubeLines });
}

function buildCubeFromInputs() {
	const n = Math.min(10, Math.max(2, parseInt(document.getElementById('cube-n').value, 10) || 2));
	buildCube(n);
}

// viewZoom/viewPanX/viewPanY default to identity (1, 0, 0) for thumbnails, which always
// show the whole layout unzoomed - only the main view (see draw()) passes the live values.
function drawLEDs(dx, dy, a, currentFrame, icon, viewZoom = 1, viewPanX = 0, viewPanY = 0) {
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
	// apart from each other as you zoom in. Composing this with Checkbox.getPosX/Y's own
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
		leds[i].setState(states[currentFrame][i]);
		if (icon) leds[i].draw(cdx, cdy, cf, sf);
		else leds[i].draw(cdx, cdy, cf, sf, mouseX, mouseY);
	}

	pop(); // otherwise the next drawLEDs() call stays clipped to this one's rect
}

function draw() {
	background(FILL_BACKGROUND);

	if (leds.length === 0) return; // layout still loading

	updateToolbarUI();
	updateCanvasHeight();

	// thumbnails, 8 wide, up to 8 rows - always unzoomed, independent of the main view
	const rows = Math.min(8, Math.ceil(states.length / 8));
	for (let ty = 0; ty < rows; ty++) {
		for (let tx = 0; tx < 8; tx++) {
			const ti = tx + 8 * ty;
			if (ti < states.length) drawLEDs(50 + tx * 100, THUMB_TOP + 50 + ty * 100, 50, ti, true);
		}
	}

	// main LEDs
	drawLEDs(LEDS_DX, LEDS_DY, LEDS_DX, current, false, viewZoom, viewPanX, viewPanY);
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
}

function executeKey(key) {
	if (leds.length === 0) return;

	switch (key) {
		case ' ': // clear current frame
			states[current] = states[current].map(() => false);
			break;
		case 'i': // invert current frame
			states[current] = states[current].map((v) => !v);
			break;
		case ',': // previous frame
			current = current > 0 ? current - 1 : states.length - 1;
			break;
		case '.': // next frame
			current = current < states.length - 1 ? current + 1 : 0;
			break;
		case '[': // insert a frame before the current frame
			states.splice(current, 0, leds.map(() => false));
			break;
		case ']': // insert a frame after the current frame
			current++;
			states.splice(current, 0, leds.map(() => false));
			break;
		case 'Delete':
		case 'Backspace': // delete current frame
			if (states.length > 1) { // keep at least one frame
				states.splice(current, 1);
				if (current > states.length - 1) current = states.length - 1;
			}
			break;
		case 'c': // copy frame to clipboard
			clipboard = states[current].slice();
			break;
		case 'v': // paste clipboard into frame
			states[current] = clipboard.slice();
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
	const data = { leds: leds.map((led) => ({ x: clean(led.posX), y: clean(led.posY), r: clean(led.size) })) };
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
			if (leds[i].isOver(dx, dy, f, sf, mouseX, mouseY)) toggleLED(i);
		}
	} else if (mouseButton === RIGHT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(dx, dy, f, sf, mouseX, mouseY)) states[current][i] = !states[current][i];
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
	resizeCanvas(DIM, THUMB_TOP + rows * 100);
}

function wireToolbar() {
	document.querySelectorAll('#toolbar .tb-btn[data-key]').forEach((btn) => {
		btn.addEventListener('click', () => executeKey(btn.dataset.key));
	});
	document.getElementById('symmetry-toggle').addEventListener('change', (e) => {
		symmetryEnabled = e.target.checked;
	});

	document.getElementById('circle-build-btn').addEventListener('click', buildCircleFromInputs);
	document.getElementById('circle-n').addEventListener('keydown', (e) => {
		if (e.key === 'Enter') buildCircleFromInputs();
	});

	document.getElementById('hex-build-btn').addEventListener('click', buildHexFromInputs);
	document.getElementById('hex-n').addEventListener('keydown', (e) => {
		if (e.key === 'Enter') buildHexFromInputs();
	});

	document.getElementById('matrix-build-btn').addEventListener('click', buildMatrixFromInputs);
	['matrix-width', 'matrix-height'].forEach((id) => {
		document.getElementById(id).addEventListener('keydown', (e) => {
			if (e.key === 'Enter') buildMatrixFromInputs();
		});
	});

	document.getElementById('cube-build-btn').addEventListener('click', buildCubeFromInputs);
	document.getElementById('cube-n').addEventListener('keydown', (e) => {
		if (e.key === 'Enter') buildCubeFromInputs();
	});
}

function populateLayoutSelect() {
	const select = document.getElementById('layout');
	for (const { value, label } of LAYOUTS) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		if (value === directory) option.selected = true;
		select.appendChild(option);
	}

	for (const [value, { label }] of Object.entries(CUSTOM_BUILDERS)) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		select.appendChild(option);
	}

	select.addEventListener('change', () => {
		document.getElementById('output').hidden = true;
		for (const { controls, divider } of Object.values(CUSTOM_BUILDERS)) {
			document.getElementById(controls).hidden = true;
			document.getElementById(divider).hidden = true;
		}
		const custom = CUSTOM_BUILDERS[select.value];
		if (custom) {
			document.getElementById(custom.controls).hidden = false;
			document.getElementById(custom.divider).hidden = false;
			custom.build();
		} else {
			loadLayout(select.value);
		}
	});
}

document.getElementById('copy-btn').addEventListener('click', () => {
	navigator.clipboard.writeText(document.getElementById('output-text').value);
});
document.getElementById('close-output-btn').addEventListener('click', () => {
	document.getElementById('output').hidden = true;
});
