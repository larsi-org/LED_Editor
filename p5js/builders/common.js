// Shared registry + dropdown/controls wiring + DOM helpers + symmetry math for the live
// "(Custom)" builders (Circle, Hex, Matrix, Cube - one file each in this directory). Loaded
// before all of them (see package.json's build script) since each builder's own top-level
// registerBuilder(...) call needs BUILDERS/registerBuilder to already exist.
//
// Interface every builder registers: { id, label, createControls(), build() }.
//  - id/label: the dropdown <option>'s value/text, same as LAYOUTS' entries.
//  - createControls(): called once, at page load (by populateBuilderOptions() below). Builds
//    this builder's own toolbar <span class="tb-divider">/<div class="tb-group"> pair (inputs,
//    checkboxes, its Build button) and wires up that button's click + each input's Enter-key
//    handler itself, calling this.build() (works via plain method-call `this` binding, since
//    this file always calls builder.createControls()/builder.build(), never a bare reference to
//    either). Returns { divider, group } so populateBuilderOptions()/selectBuilder() below can
//    show/hide and position them.
//  - build(): reads this builder's own inputs from the DOM and calls applyLayoutData()
//    (defined in sketch.js) with the result - same as loadLayout() does for a fetched
//    layouts/*.json file, just built in memory instead.
//
// This used to all live directly in sketch.js; split out once a 4th builder (Cube) made that
// file's mix of "generic app shell" and "one specific shape's math + its own toolbar wiring"
// harder to find things in, and - the actual point - so adding a 5th builder later never
// needs touching sketch.js, index.html, or index.php again: drop in one new file here (plus
// one line in package.json's build script and one <script> tag) and it's done.
const BUILDERS = [];

function registerBuilder(builder) {
	BUILDERS.push(builder);
}

// Adds each registered builder's <option> to the shared #layout <select> (sketch.js's own
// populateLayoutSelect() adds LAYOUTS' file-based options separately, into the same element)
// and builds its toolbar controls via createControls() - specifically here, not written into
// index.html/index.php, so adding a new builder never means touching either page's markup.
// Each one's <span class="tb-divider">/<div class="tb-group"> pair is inserted right before
// `anchor` (#builders-anchor - a fixed, empty marker element already in the toolbar, ahead of
// the always-present Symmetry group), in BUILDERS order - i.e. the order their <script> tags
// load in, which package.json's build script controls. Stashes { divider, group } on the
// builder object itself (builder._divider/_group) so selectBuilder() below can show/hide them.
function populateBuilderOptions(select, anchor) {
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
}

// Shows builder's own controls and builds it - shared by populateLayoutSelect()'s dropdown
// change handler (manual selection, no params - build() falls back to reading this builder's
// own toolbar inputs) and sketch.js's setup() ?builder= URL handling (params supplied, see
// parseBuilderParams() below).
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

// Shapes a ?builder= URL's own params into the { count, countX, countY, zigzag } shape every
// builder's build(params) expects (see this file's own top comment on that interface) - called
// once, from sketch.js's setup(). Undefined (not present in the URL at all) lets build(params)
// fall back to its toolbar default via ?? - only an explicit zigzag=0/1 (or true/false) should
// override it.
function parseBuilderParams(urlParams) {
	const zigzagRaw = urlParams.get('zigzag');
	return {
		count: urlParams.get('count'),
		countX: urlParams.get('countX'),
		countY: urlParams.get('countY'),
		zigzag: zigzagRaw === null ? undefined : (zigzagRaw === '1' || zigzagRaw === 'true')
	};
}

function tbDivider(id) {
	const el = document.createElement('span');
	el.className = 'tb-divider';
	el.id = id;
	return el;
}

function tbGroup(id) {
	const el = document.createElement('div');
	el.className = 'tb-group';
	el.id = id;
	return el;
}

function tbLabel(forId, text) {
	const el = document.createElement('label');
	el.htmlFor = forId;
	el.textContent = text;
	return el;
}

function tbNumberInput(id, { min, max, value }) {
	const el = document.createElement('input');
	el.type = 'number';
	el.id = id;
	el.min = min;
	el.max = max;
	el.value = value;
	return el;
}

// Returns { wrapper, input } - wrapper is the <label class="tb-checkbox"> to append into a
// tb-group, input is the actual checkbox (read its .checked in build()).
function tbCheckbox(id, labelText, { checked = false, title } = {}) {
	const wrapper = document.createElement('label');
	wrapper.className = 'tb-checkbox';
	if (title) wrapper.title = title;
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.id = id;
	input.checked = checked;
	wrapper.append(input, document.createTextNode(labelText));
	return { wrapper, input };
}

function tbButton(id, { icon, text }) {
	const el = document.createElement('button');
	el.type = 'button';
	el.className = 'tb-btn';
	el.id = id;
	if (icon) {
		const i = document.createElement('i');
		i.className = `fas ${icon}`;
		el.append(i, ' ');
	}
	el.append(text);
	return el;
}

// Shared by every builder's own *Symmetry() function: given a shape's LEDs and a list of
// candidate symmetry transforms ((x, y) -> [x, y]), find each LED's full orbit by closing
// over all of them from its actual rendered position - the LEDs that are all mutual
// mirror/rotation images of each other, wired into one "next in cycle" cycle (see the
// layouts/*.json format in the README). Working from real coordinates rather than
// row/column/ring index means this is automatically correct under zigzag without
// special-casing it, the same way hex/circle's own generator (create_hex_circle.py) always
// matched by real (r, t) rather than array position. tolerance should match how far a
// transform's floating-point result can drift from its true value - plain sign flips are
// exact, but a rotation's sin/cos aren't, hence each caller's own choice of tolerance.
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

// Symmetry group of a hex/circle shape (shared by builders/circle.js and builders/hex.js,
// unlike computeMatrixSymmetry, which only builders/matrix.js needs - see that file for why
// it stayed local instead of moving here too): both are built as rings of 6, 12, 18, ...
// points around a center, which always has full 12-fold dihedral symmetry (D6) - 6 rotations
// (multiples of 60°) plus a mirror, regardless of ring count or zigzag. Rotation involves
// sin/cos, which aren't exact in floating point, so this needs a looser tolerance (0.001,
// matching create_hex_circle.py's own f_equal) instead of computeMatrixSymmetry's 1e-6.
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

// Groups shapeLeds into the longest possible straight lines running in one direction
// (angleDeg, degrees from horizontal) - the same "just the two endpoints, everything
// between is already colinear" idea builders/matrix.js's row/column lines use, generalized
// to an arbitrary angle instead of only 0°/90°. Points are bucketed by their position along
// the axis *perpendicular* to that direction (rounded to a tolerance, since a rotated
// coordinate isn't exact in floating point) - matching by real position rather than array
// index/build order, so this is automatically correct regardless of zigzag, the same
// principle computeSymmetry follows. A bucket of one point isn't a line (nothing to
// connect). Shared by builders/hex.js and builders/triangle.js (both triangular-lattice
// shapes with the same 0°/60°/120° natural line directions) - moved here once a second
// builder actually needed it, not before (see computeMatrixSymmetry's own comment on that
// same judgment call).
function collinearLines(shapeLeds, angleDeg, tolerance = 1e-4) {
	const theta = (angleDeg * Math.PI) / 180;
	const dirX = Math.cos(theta), dirY = Math.sin(theta);
	const perpX = -dirY, perpY = dirX;
	const scale = 1 / tolerance;

	const buckets = new Map();
	shapeLeds.forEach((led, i) => {
		const key = Math.round((led.x * perpX + led.y * perpY) * scale);
		if (!buckets.has(key)) buckets.set(key, []);
		buckets.get(key).push(i);
	});

	const lines = [];
	for (const idxs of buckets.values()) {
		if (idxs.length < 2) continue;
		idxs.sort((a, b) => (shapeLeds[a].x * dirX + shapeLeds[a].y * dirY) - (shapeLeds[b].x * dirX + shapeLeds[b].y * dirY));
		lines.push([idxs[0], idxs[idxs.length - 1]]);
	}
	return lines;
}
