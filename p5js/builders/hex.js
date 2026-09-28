// Groups shapeLeds into the longest possible straight lines running in one direction
// (angleDeg, degrees from horizontal) - the same "just the two endpoints, everything
// between is already colinear" idea builders/matrix.js's row/column lines use, generalized
// to an arbitrary angle instead of only 0°/90°. Points are bucketed by their position along
// the axis *perpendicular* to that direction (rounded to a tolerance, since a rotated
// coordinate isn't exact in floating point) - matching by real position rather than array
// index/build order, so this is automatically correct regardless of zigzag, the same
// principle computeSymmetry follows. A bucket of one point isn't a line (nothing to
// connect). Only Hex needs this so far - see builders/matrix.js's computeMatrixSymmetry
// comment for why a single-consumer helper like this one stays local instead of moving to
// builders/common.js.
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

	// A hex/triangular lattice has 3 natural line directions, 60° apart - horizontal rows
	// (already implicit in how addRow() builds them) plus the two diagonals. dy's own
	// sqrt(0.75) === sin(60°) is exactly what makes those two diagonals fall on clean 60°/
	// 120° lines rather than some other angle - not a coincidence, the equilateral-triangle
	// pitch is what a hex lattice *is*.
	const hexLines = [0, 60, 120].flatMap((angle) => collinearLines(hexLeds, angle));

	applyLayoutData(`hex ${n}`, { leds: hexLeds, lines: hexLines, symmetry: computeRadialSymmetry(hexLeds) });
}

registerBuilder({
	id: '__hex__',
	label: 'Hex (Custom)',

	createControls() {
		const divider = tbDivider('hex-divider');
		const group = tbGroup('hex-controls');
		const nInput = tbNumberInput('hex-n', { min: 3, max: 20, value: 10 });
		const { wrapper: zigzagWrapper } = tbCheckbox('hex-zigzag', 'Zigzag', {
			checked: true,
			title: 'Snake wiring: every other row is mirrored, so the strip continues straight into the next row instead of jumping back to the start'
		});
		const buildBtn = tbButton('hex-build-btn', { icon: 'fa-hammer', text: 'Build' });
		group.append(tbLabel('hex-n', 'N'), nInput, zigzagWrapper, buildBtn);

		buildBtn.addEventListener('click', () => this.build());
		nInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.build(); });

		return { divider, group };
	},

	build() {
		const n = Math.min(20, Math.max(3, parseInt(document.getElementById('hex-n').value, 10) || 3));
		buildHex(n, document.getElementById('hex-zigzag').checked);
	}
});
