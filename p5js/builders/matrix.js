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
			matrixLeds.push({ x, y });
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
		r: 0.1,
		lines: matrixLines,
		symmetry: computeMatrixSymmetry(matrixLeds, dimX, dimY)
	});
}

// Symmetry group of an n x m grid: horizontal flip, vertical flip, and 180°
// rotation always apply (a rectangle mirrors onto itself either way, and a
// 1-wide/1-tall strip degenerates to just the one meaningful reversal, since
// the other flip becomes a no-op). A square (dimX === dimY) additionally gets
// both diagonal flips and both 90° rotations, since only then does swapping
// the two axes map the grid back onto itself - "n x n has the most symmetry,
// n x m loses half, 1 x n keeps only first<->last, second<->second-to-last".
// These transforms are exact (pure sign flips/swaps), hence the tight 1e-6
// tolerance. Only Matrix needs this shape of symmetry group, unlike
// computeRadialSymmetry (builders/common.js), which both Circle and Hex share -
// no reason to move a single-consumer helper like this one out of its own file.
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

registerBuilder({
	id: '__matrix__',
	label: 'Matrix (Custom)',

	createControls() {
		const divider = tbDivider('matrix-divider');
		const group = tbGroup('matrix-controls');
		const widthInput = tbNumberInput('matrix-width', { min: 1, max: 32, value: 8 });
		const heightInput = tbNumberInput('matrix-height', { min: 1, max: 32, value: 8 });
		const { wrapper: zigzagWrapper } = tbCheckbox('matrix-zigzag', 'Zigzag', {
			title: 'Snake wiring: every other row is mirrored, so the strip continues straight into the next row instead of jumping back to the start'
		});
		const buildBtn = tbButton('matrix-build-btn', { icon: 'fa-hammer', text: 'Build' });
		group.append(
			tbLabel('matrix-width', 'W'), widthInput,
			tbLabel('matrix-height', 'H'), heightInput,
			zigzagWrapper, buildBtn
		);

		buildBtn.addEventListener('click', () => this.build());
		[widthInput, heightInput].forEach((input) => {
			input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.build(); });
		});

		return { divider, group };
	},

	// params (optional): { countX, countY, zigzag } from a ?builder=matrix&countX=..&countY=..
	// URL (Matrix is the one builder with two dimensions, hence X/Y instead of a plain count -
	// see sketch.js's parseBuilderParams()/selectBuilder()). Falls back to this builder's own
	// inputs for whichever param is missing, or for all three on a manual Build click.
	build(params) {
		const clampDim = (v) => Math.min(32, Math.max(1, parseInt(v, 10) || 1));
		const width = clampDim(params?.countX ?? document.getElementById('matrix-width').value);
		const height = clampDim(params?.countY ?? document.getElementById('matrix-height').value);
		const zigzag = params?.zigzag ?? document.getElementById('matrix-zigzag').checked;
		document.getElementById('matrix-width').value = width;
		document.getElementById('matrix-height').value = height;
		document.getElementById('matrix-zigzag').checked = zigzag;
		buildMatrix(width, height, zigzag);
	}
});
