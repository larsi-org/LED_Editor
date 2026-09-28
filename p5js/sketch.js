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
	'__matrix__': { label: 'Matrix (Custom)', controls: 'matrix-controls', divider: 'matrix-divider', build: buildMatrixFromInputs }
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
const LEDS_F  = Math.round(0.9 * DIM2);

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

function drawLEDs(dx, dy, a, currentFrame, icon) {
	a -= 1;
	const f = Math.round(0.9 * a);

	// border
	stroke(STROKE_DIV);
	fill(BACKGROUND);
	rect(dx - a, dy - a, 2 * a, 2 * a);

	// wires
	stroke(STROKE_WIRE);
	for (const [i0, i1] of ledLines) {
		line(leds[i0].getPosX(dx, f), leds[i0].getPosY(dy, f), leds[i1].getPosX(dx, f), leds[i1].getPosY(dy, f));
	}

	for (let i = 0; i < leds.length; i++) {
		leds[i].setState(states[currentFrame][i]);
		if (icon) leds[i].draw(dx, dy, f);
		else leds[i].draw(dx, dy, f, mouseX, mouseY);
	}
}

function draw() {
	background(FILL_BACKGROUND);

	if (leds.length === 0) return; // layout still loading

	updateToolbarUI();
	updateCanvasHeight();

	// thumbnails, 8 wide, up to 8 rows
	const rows = Math.min(8, Math.ceil(states.length / 8));
	for (let ty = 0; ty < rows; ty++) {
		for (let tx = 0; tx < 8; tx++) {
			const ti = tx + 8 * ty;
			if (ti < states.length) drawLEDs(50 + tx * 100, THUMB_TOP + 50 + ty * 100, 50, ti, true);
		}
	}

	// main LEDs
	drawLEDs(LEDS_DX, LEDS_DY, LEDS_DX, current, false);
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

function mouseReleased() {
	if (leds.length === 0) return;

	if (mouseButton === LEFT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(LEDS_DX, LEDS_DY, LEDS_F, mouseX, mouseY)) toggleLED(i);
		}
	} else if (mouseButton === RIGHT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(LEDS_DX, LEDS_DY, LEDS_F, mouseX, mouseY)) states[current][i] = !states[current][i];
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
