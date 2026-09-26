// Must be served over HTTP, not opened as file:// (browsers block fetch()
// of local files). See README.md.

const DATA_BASE = 'layouts/';

const LAYOUTS = [
	'circle3', 'circle4', 'circle5', 'circle6', 'circle7', 'circle8', 'circle9', 'circle10', 'circle11', 'circle12', 'circle13',
	'cube3',
	'hex3', 'hex4', 'hex5', 'hex6', 'hex7', 'hex8', 'hex9', 'hex10', 'hex11', 'hex12', 'hex13',
	'led_3x3', 'led_4x4', 'led_5', 'led_5x5', 'led_6x5', 'led_8', 'led_8x8', 'led_16', 'led_16x16', 'led_20'
];

let directory = 'hex10';

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

	directory = name;
	leds = data.leds.map((led, i) => new Checkbox(String(i + 1), led.x, led.y, led.r, false));
	symmetry = data.symmetry || leds.map((_, i) => i); // no symmetry key means no partners
	ledLines = data.lines || [];
	clipboard = leds.map(() => false);
	states = [leds.map(() => false)];
	current = 0;
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
	}
}

function generate() {
	const text = states.map((frame) => frame.map((v) => (v ? '1' : '0')).join('')).join('\n');
	document.getElementById('output-text').value = text;
	document.getElementById('output').hidden = false;
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
}

function populateLayoutSelect() {
	const select = document.getElementById('layout');
	for (const name of LAYOUTS) {
		const option = document.createElement('option');
		option.value = name;
		option.textContent = name;
		if (name === directory) option.selected = true;
		select.appendChild(option);
	}
	select.addEventListener('change', () => {
		document.getElementById('output').hidden = true;
		loadLayout(select.value);
	});
}

document.getElementById('copy-btn').addEventListener('click', () => {
	navigator.clipboard.writeText(document.getElementById('output-text').value);
});
document.getElementById('close-output-btn').addEventListener('click', () => {
	document.getElementById('output').hidden = true;
});
