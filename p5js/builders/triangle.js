// Builds an equilateral triangle, flat side down and point up: row 0 (the base, n LEDs) is
// built first, left to right, then each row up has one fewer LED, ending with the single
// apex LED - a triangular number of LEDs total (n + (n-1) + ... + 1 = n(n+1)/2). zigzag
// mirrors alternate rows, same reason as Hex/Matrix's: the physical strip continues straight
// into the next row instead of a long return wire back to the start of each one.
//
// Same equilateral-triangle lattice pitch as Hex (dy = sqrt(0.75) * dx - sqrt(0.75) ===
// sin(60°), the pitch any triangular lattice has to use), but centered on the shape's actual
// *centroid*, not its bounding box - unlike a hexagon (symmetric top-to-bottom) or a
// rectangle, an equilateral triangle's centroid sits 1/3 of the way up from its base, not
// halfway, since the base has two vertices pulling the average toward it and the apex only
// one. Centering there instead of at the bounding-box middle is what makes the 120°-rotation
// symmetry below (and the perpendicular bisector distance from centroid to each of the 3
// sides being equal) come out exact - centering on the bounding box instead was verified
// (numerically, rotating every LED 120° and checking it lands on another real LED) to NOT
// reproduce the same point set, except by accident at one single n.
//
// dx/dy are chosen so the taller axis (apex-to-base) exactly reaches the usual [-1, 1] frame
// other builders use, same "whichever dimension is more extreme sets the common scale, don't
// stretch to fill a square" principle as Matrix - solving apex-distance-from-centroid
// (2/3 of the total height) = 1 gives dx = sqrt(3)/(n-1), which makes the base sit at
// y = 0.5 and the apex at exactly y = -1; the base row's own half-width only reaches
// sqrt(3)/2 ≈ 0.866, narrower than the canvas's usable ±1 - correct, since an equilateral
// triangle really is taller than it is wide relative to its own base.
function buildTriangle(n, zigzag) {
	const dx = Math.sqrt(3) / (n - 1);
	const dy = Math.sqrt(0.75) * dx;
	const triLeds = [];
	let direction = 1;

	for (let row = 0; row < n; row++) {
		const count = n - row;
		const y = 0.5 - row * dy;
		for (let i = 0; i < count; i++) {
			const x = direction * dx * (i - (count - 1) / 2);
			triLeds.push({ x, y });
		}
		if (zigzag) direction *= -1;
	}

	// Same 3 natural line directions as Hex (0°/60°/120° - both are triangular lattices),
	// see builders/common.js's collinearLines comment for why it moved there once Triangle
	// became its second consumer.
	const triLines = [0, 60, 120].flatMap((angle) => collinearLines(triLeds, angle));

	applyLayoutData(`triangle ${n}`, { leds: triLeds, r: 0.1, lines: triLines, symmetry: computeTriangleSymmetry(triLeds) });
}

// Symmetry group of an equilateral triangle: full D3 (dihedral order 6) - 3 rotations
// (0°/120°/240° about the centroid) each optionally composed with a mirror across the
// vertical axis through the apex and the base's midpoint (x -> -x). Verified numerically
// (see buildTriangle's own comment) that centering on the centroid, not the bounding box,
// is what makes every LED's 120°-rotated position land back on another real LED - this
// isn't a coincidence of a specific n, it holds at every n because a size-n triangular grid
// is exactly the set of (i, j, k) with i + j + k = n - 1, i/j/k >= 0, and a 120° rotation
// permutes those three barycentric coordinates cyclically, which preserves that sum.
function computeTriangleSymmetry(shapeLeds) {
	const transforms = [];
	for (let k = 0; k < 3; k++) {
		const theta = (k * 120 * Math.PI) / 180;
		const cosT = Math.cos(theta);
		const sinT = Math.sin(theta);
		if (k > 0) transforms.push((x, y) => [x * cosT - y * sinT, x * sinT + y * cosT]);
		// mirror across the vertical axis (x -> -x), then that same rotation
		transforms.push((x, y) => [-(x * cosT - y * sinT), x * sinT + y * cosT]);
	}
	return computeSymmetry(shapeLeds, transforms, 0.001);
}

registerBuilder({
	id: '__triangle__',
	label: 'Triangle (Custom)',

	createControls() {
		const divider = tbDivider('triangle-divider');
		const group = tbGroup('triangle-controls');
		const nInput = tbNumberInput('triangle-n', { min: 2, max: 20, value: 8 });
		const { wrapper: zigzagWrapper } = tbCheckbox('triangle-zigzag', 'Zigzag', {
			checked: true,
			title: 'Snake wiring: every other row is mirrored, so the strip continues straight into the next row instead of jumping back to the start'
		});
		const buildBtn = tbButton('triangle-build-btn', { icon: 'fa-hammer', text: 'Build' });
		group.append(tbLabel('triangle-n', 'N'), nInput, zigzagWrapper, buildBtn);

		buildBtn.addEventListener('click', () => this.build());
		nInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.build(); });

		return { divider, group };
	},

	// params (optional): { count, zigzag } from a ?builder=triangle&count=..&zigzag=.. URL -
	// see sketch.js's parseBuilderParams()/selectBuilder(). Falls back to this builder's own
	// inputs for whichever of the two is missing (or for both, on a manual Build click).
	build(params) {
		const n = Math.min(20, Math.max(2, parseInt(params?.count ?? document.getElementById('triangle-n').value, 10) || 2));
		const zigzag = params?.zigzag ?? document.getElementById('triangle-zigzag').checked;
		document.getElementById('triangle-n').value = n;
		document.getElementById('triangle-zigzag').checked = zigzag;
		buildTriangle(n, zigzag);
	}
});
