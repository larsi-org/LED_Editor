// Saving/loading animations and layouts as plain files, plus Export Layout's coordinate list.
// Pure functions only - no DOM, no p5 - so they can be tested under plain node (see the
// README's "Saving and loading" section); sketch.js does the reading/downloading/UI around them.
//
// Three things can be loaded (parseLoadedFile()):
//  - an animation file (Save's output): { format, version, builder+params | layout, fps, frames }
//  - a layout file: the { leds: [{x, y}], r, symmetry?, lines? } shape `?layout=` already uses
//  - a coordinates list: `label,x,y` lines, i.e. Export Layout's own output round-tripped, or
//    positions from a PCB tool (labels are ignored - LEDs number in row order)
// The last two give a blank one-frame animation on that layout. A shape no builder can make
// (an ornament, an Easter piece) gets in that way; Save then embeds its layout in the
// animation file so the file is self-contained.

const ANIMATION_FORMAT = 'led-editor-animation';
const ANIMATION_VERSION = 1;
const MAX_LOADED_LEDS = 2000;

const round3 = (v) => Math.round(v * 1000) / 1000;

// A frame as a string of 0/1, LED 1 first - the same encoding Generate emits.
const frameToString = (frame) => frame.map((on) => (on ? '1' : '0')).join('');

// build: { id, params } when a builder made the layout (id is the bare name, e.g. 'hex'),
// otherwise layout: the layout object to embed. Returns the file's text, one frame per line.
function serializeAnimation({ states, fps, build, layout }) {
	const lines = [
		'{',
		` "format": "${ANIMATION_FORMAT}",`,
		` "version": ${ANIMATION_VERSION},`
	];
	if (build) {
		lines.push(` "builder": ${JSON.stringify(build.id)},`, ` "params": ${JSON.stringify(build.params)},`);
	} else {
		lines.push(` "layout": ${JSON.stringify(layout)},`);
	}
	lines.push(` "fps": ${fps},`, ' "frames": [');
	lines.push(states.map((f) => `  "${frameToString(f)}"`).join(',\n'));
	lines.push(' ]', '}', '');
	return lines.join('\n');
}

// e.g. hex-10-zigzag-8frames.json, matrix-6x5-3frames.json, led-animation-5frames.json
function animationFilename(build, frameCount) {
	let stem = 'led-animation';
	if (build) {
		const p = build.params;
		const size = p.countX !== undefined ? `${p.countX}x${p.countY}` : String(p.count);
		stem = [build.id, size, p.zigzag ? 'zigzag' : null].filter(Boolean).join('-');
	}
	return `${stem}-${frameCount}frames.json`;
}

// Export Layout's text: one `label,x,y` line per LED, x right / y down as displayed, the
// canvas center at (0, 0) and its edges at +-1.
function layoutToCsv(leds) {
	return ['label,x,y', ...leds.map((led) => `${led.label},${round3(led.posX)},${round3(led.posY)}`)].join('\n');
}

// { leds: [{x, y}], r, symmetry?, lines? } straight from a parsed layout object (or an
// animation file's embedded one), with every field checked; throws Error(message) if not.
function validateLayout(obj) {
	if (!obj || !Array.isArray(obj.leds) || obj.leds.length === 0) throw new Error('the layout has no "leds" list');
	if (obj.leds.length > MAX_LOADED_LEDS) throw new Error(`more than ${MAX_LOADED_LEDS} LEDs`);
	const n = obj.leds.length;
	const leds = obj.leds.map((l, i) => {
		if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) throw new Error(`LED ${i + 1} has no numeric x/y`);
		return { x: l.x, y: l.y };
	});
	const r = obj.r === undefined ? 0.1 : obj.r;
	if (!Number.isFinite(r) || r <= 0 || r > 1) throw new Error('"r" must be a number above 0 and up to 1');
	const layout = { leds, r };
	if (obj.symmetry !== undefined) {
		const ok = Array.isArray(obj.symmetry) && obj.symmetry.length === n &&
			obj.symmetry.every((v) => Number.isInteger(v) && v >= 0 && v < n);
		if (!ok) throw new Error('"symmetry" must list one LED index per LED');
		layout.symmetry = obj.symmetry;
	}
	if (obj.lines !== undefined) {
		const ok = Array.isArray(obj.lines) && obj.lines.every((p) =>
			Array.isArray(p) && p.length === 2 && p.every((v) => Number.isInteger(v) && v >= 0 && v < n));
		if (!ok) throw new Error('"lines" must be pairs of LED indices');
		layout.lines = obj.lines;
	}
	return layout;
}

// `label,x,y` (or bare `x,y`) lines, comma/semicolon/tab separated, optional header row.
// Positions already inside [-1, 1] are used as they are (what Export Layout wrote); anything
// wider - a PCB tool's millimetres, say - is centered on its bounding box and scaled to fit.
// The dot size shrinks from the default 0.1 if LEDs sit closer than that allows.
function layoutFromCsv(text) {
	const pts = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const f = line.split(/[,;\t]/).map((s) => s.trim());
		const [x, y] = f.length >= 3 ? [parseFloat(f[1]), parseFloat(f[2])] : [parseFloat(f[0]), parseFloat(f[1])];
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			if (pts.length === 0) continue; // header row
			throw new Error(`can't read x,y from "${line}"`);
		}
		pts.push({ x, y });
	}
	if (pts.length === 0) throw new Error('no coordinates found');
	if (pts.length > MAX_LOADED_LEDS) throw new Error(`more than ${MAX_LOADED_LEDS} LEDs`);

	if (pts.some((p) => Math.abs(p.x) > 1 || Math.abs(p.y) > 1)) {
		const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
		const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
		const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;
		for (const p of pts) { p.x = (p.x - cx) / half; p.y = (p.y - cy) / half; }
	}

	let nearest = Infinity;
	for (let i = 0; i < pts.length; i++) {
		for (let j = i + 1; j < pts.length; j++) nearest = Math.min(nearest, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
	}
	const r = Number.isFinite(nearest) && nearest > 0 ? Math.min(0.1, round3(nearest * 0.4)) || 0.01 : 0.1;
	return { leds: pts, r };
}

// A builder's params from a file, keeping only the fields the builders read.
function cleanBuilderParams(p) {
	const out = {};
	for (const k of ['count', 'countX', 'countY']) {
		if (p && p[k] !== undefined) {
			if (!Number.isInteger(p[k])) throw new Error(`params.${k} must be a whole number`);
			out[k] = p[k];
		}
	}
	if (p && p.zigzag !== undefined) out.zigzag = Boolean(p.zigzag);
	return out;
}

// Whatever the user picked, classified: { kind: 'animation', builder?, params?, layout?, fps?,
// frames: [string] } or { kind: 'layout', layout }. Throws Error(message) for anything else.
function parseLoadedFile(text) {
	const trimmed = text.replace(/^﻿/, '').trim();
	if (!trimmed) throw new Error('the file is empty');
	if (trimmed[0] !== '{') return { kind: 'layout', layout: layoutFromCsv(trimmed) };

	let obj;
	try { obj = JSON.parse(trimmed); } catch (e) { throw new Error('not valid JSON'); }

	if (obj.format === ANIMATION_FORMAT) {
		if (obj.version !== ANIMATION_VERSION) throw new Error(`unsupported animation file version ${obj.version}`);
		if (!Array.isArray(obj.frames) || obj.frames.length === 0) throw new Error('the file has no frames');
		if (obj.frames.some((s) => typeof s !== 'string' || !/^[01]+$/.test(s))) throw new Error('every frame must be a string of 0s and 1s');
		if (new Set(obj.frames.map((s) => s.length)).size !== 1) throw new Error('the frames are not all the same length');
		const out = { kind: 'animation', frames: obj.frames };
		if (Number.isFinite(obj.fps)) out.fps = obj.fps;
		if (typeof obj.builder === 'string') {
			out.builder = obj.builder;
			out.params = cleanBuilderParams(obj.params);
		} else if (obj.layout) {
			out.layout = validateLayout(obj.layout);
			if (out.layout.leds.length !== obj.frames[0].length) throw new Error('the frames do not match the embedded layout\'s LED count');
		} else {
			throw new Error('the file names neither a builder nor a layout');
		}
		return out;
	}
	if (Array.isArray(obj.leds)) return { kind: 'layout', layout: validateLayout(obj) };
	throw new Error('not an LED Editor animation or layout file');
}

// One boolean array per frame string; throws if a frame's length isn't the layout's LED count.
function framesFromStrings(strings, ledCount) {
	return strings.map((s) => {
		if (s.length !== ledCount) throw new Error(`the frames have ${s.length} LEDs but the layout has ${ledCount}`);
		return Array.from(s, (c) => c === '1');
	});
}
