// Port of Processing/LED_Editor/LED_Editor.pde
//
// Reuses the existing per-layout data files instead of duplicating them -
// fetched relative to this page, so it must be served (not opened via
// file://) from somewhere that also serves ../Processing/LED_Editor/data/.
// See README.md.

const DATA_BASE = '../Processing/LED_Editor/data/';

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

const MENU_DX = 0;
const MENU_DY = 0;

const DIM  = 800;
const DIM2 = DIM / 2;

const LEDS_DX = DIM2;
const LEDS_DY = 50 + DIM2;
const LEDS_F  = Math.round(0.9 * DIM2);

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
let currentLabel;

// clipboard
let clipboard = [];

// Buttons
let buttons = [];

function setup() {
	const canvas = createCanvas(1600, 850);
	canvas.parent('sketch-holder');
	canvas.elt.oncontextmenu = () => false; // right-click toggles a single LED, don't show the browser menu
	textAlign(CENTER, CENTER);

	currentLabel = new Label('', MENU_DX + 100, MENU_DY + 25, 80, 24);

	buttons = [
		new Button('<<',       MENU_DX +   30, MENU_DY + 25, 40, 24, ','),
		new Button('>>',       MENU_DX +  170, MENU_DY + 25, 40, 24, '.'),

		new Button('Copy',     MENU_DX +  260, MENU_DY + 25, 80, 24, 'c'),
		new Button('Paste',    MENU_DX +  350, MENU_DY + 25, 80, 24, 'v'),

		new Button('Clear',    MENU_DX +  460, MENU_DY + 25, 80, 24, ' '),
		new Button('Invert',   MENU_DX +  550, MENU_DY + 25, 80, 24, 'i'),
		new Button('Random',   MENU_DX +  640, MENU_DY + 25, 80, 24, 'r'),

		new Button('<< Ins',   MENU_DX +  750, MENU_DY + 25, 60, 24, '['),
		new Button('Del',      MENU_DX +  810, MENU_DY + 25, 40, 24, 'Delete'),
		new Button('Ins >>',   MENU_DX +  870, MENU_DY + 25, 60, 24, ']'),

		new Button('Generate', MENU_DX +  980, MENU_DY + 25, 80, 24, 'g')
	];

	populateLayoutSelect();
	loadLayout(directory);
}

async function fetchLines(path) {
	const res = await fetch(path);
	if (!res.ok) return null;
	const text = await res.text();
	return text.split('\n').map((line) => line.replace('\r', '')).filter((line) => line.length > 0);
}

async function loadLayout(name) {
	leds = []; // draw() bails out while this is empty, so the canvas just goes blank during the fetch

	const base = DATA_BASE + name + '/';

	const coordLines = await fetchLines(base + 'coords.txt');
	const newLeds = coordLines.map((line) => {
		const [label, x, y, r] = line.split('\t');
		return new Checkbox(label, parseFloat(x), parseFloat(y), parseFloat(r), false);
	});

	const newSymmetry = newLeds.map((_, i) => i);
	const symmetryLines = await fetchLines(base + 'symmetry.txt');
	if (symmetryLines) {
		symmetryLines.forEach((line, i) => {
			newSymmetry[i] = parseInt(line, 10);
		});
	}

	const lineLines = await fetchLines(base + 'lines.txt');
	const newLines = lineLines ? lineLines.map((line) => line.split('\t').map(Number)) : [];

	directory = name;
	leds = newLeds;
	symmetry = newSymmetry;
	ledLines = newLines;
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

	currentLabel.setLabel(`${current + 1} / ${states.length}`);
	currentLabel.draw();

	for (const b of buttons) b.draw(mouseX, mouseY);

	// thumbnails, 8x8
	for (let ty = 0; ty < 8; ty++) {
		for (let tx = 0; tx < 8; tx++) {
			const ti = tx + 8 * ty;
			if (ti < states.length) drawLEDs(850 + tx * 100, 100 + ty * 100, 50, ti, true);
		}
	}

	// main LEDs
	drawLEDs(LEDS_DX, LEDS_DY, LEDS_DX, current, false);
}

function toggleWithSymmetry(i) {
	states[current][i] = !states[current][i];
	let j = i;
	while ((j = symmetry[j]) !== i) {
		states[current][j] = !states[current][j];
	}
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
			toggleWithSymmetry(Math.floor(Math.random() * leds.length));
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

function keyPressed() {
	return false; // the browser's default action (space/arrow scroll, Delete/Backspace nav) fires on
	              // keydown, so it has to be blocked here - blocking it in keyReleased is too late
}

function keyReleased() {
	executeKey(key);
	return false;
}

function mouseReleased() {
	if (leds.length === 0) return;

	if (mouseButton === LEFT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(LEDS_DX, LEDS_DY, LEDS_F, mouseX, mouseY)) toggleWithSymmetry(i);
		}
		for (const b of buttons) {
			if (b.isOver(mouseX, mouseY)) executeKey(b.hotkey);
		}
	} else if (mouseButton === RIGHT) {
		for (let i = 0; i < leds.length; i++) {
			if (leds[i].isOver(LEDS_DX, LEDS_DY, LEDS_F, mouseX, mouseY)) states[current][i] = !states[current][i];
		}
		for (const b of buttons) {
			if (b.isOver(mouseX, mouseY)) executeKey(b.hotkey);
		}
	}
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
