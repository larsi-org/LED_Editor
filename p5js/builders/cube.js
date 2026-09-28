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
				cubeLeds.push({ x: -1 + col * P + row * D, y });
			}
		}
	}

	// same "just the two endpoints" trick as builders/matrix.js's row/column lines - every
	// LED between them is already colinear. One set per axis: left-right within a level's
	// row, front-to-back within a level's column, and top-to-bottom through a row/column's
	// full stack of levels (matches cube3.json's own 9+9+9 grouping, generalized to n*n each).
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
	// to any simple 2D transform of the projected (x, y) the way builders/matrix.js's
	// computeMatrixSymmetry's axis flips do for a flat grid - not worth faking.
	applyLayoutData(`cube ${n}`, { leds: cubeLeds, r: 0.1, lines: cubeLines });
}

registerBuilder({
	id: '__cube__',
	label: 'Cube (Custom)',

	createControls() {
		const divider = tbDivider('cube-divider');
		const group = tbGroup('cube-controls');
		const nInput = tbNumberInput('cube-n', { min: 2, max: 10, value: 3 });
		const buildBtn = tbButton('cube-build-btn', { icon: 'fa-hammer', text: 'Build' });
		group.append(tbLabel('cube-n', 'N'), nInput, buildBtn);

		buildBtn.addEventListener('click', () => this.build());
		nInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.build(); });

		return { divider, group };
	},

	// params (optional): { count } from a ?builder=cube&count=.. URL - see sketch.js's
	// parseBuilderParams()/selectBuilder(). Falls back to this builder's own N input when a
	// param is missing (manual Build click passes no params at all) or not present in the URL.
	build(params) {
		const n = Math.min(10, Math.max(2, parseInt(params?.count ?? document.getElementById('cube-n').value, 10) || 2));
		document.getElementById('cube-n').value = n;
		buildCube(n);
	}
});
