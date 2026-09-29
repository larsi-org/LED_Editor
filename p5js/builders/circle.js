// port of create_hex_circle.py's create_circle() - N rings (plus a center
// LED) of 6, 12, 18, ... points, growing outward. No zigzag option: unlike a
// row-by-row grid or hex, going around each ring in one direction is already
// a sensible order to solder in - nothing to snake back and forth across.
function buildCircle(n) {
	const circleLeds = [{ x: 0, y: 0 }];
	// one closed loop per ring, not connected to the center or to each other - unlike Hex/
	// Matrix/Triangle's straight rows (collinearLines(), builders/common.js), consecutive
	// points around a ring are never collinear, so there's no run of edges to merge into a
	// single longer line: every edge stays its own [i, i+1] pair.
	const circleLines = [];
	let offset = 1; // circleLeds[0] is the center, each ring starts right after the previous one
	for (let c = 1; c < n; c++) {
		const r = c / (n - 1);
		const fA = 60 / c;
		const ringSize = 6 * c;
		for (let a = 0; a < ringSize; a++) {
			const angle = (fA * a * Math.PI) / 180;
			circleLeds.push({ x: r * Math.cos(angle), y: -r * Math.sin(angle) });
		}
		for (let i = 0; i < ringSize; i++) {
			circleLines.push([offset + i, offset + ((i + 1) % ringSize)]);
		}
		offset += ringSize;
	}
	applyLayoutData(`circle ${n}`, { leds: circleLeds, r: 0.1, lines: circleLines, symmetry: computeRadialSymmetry(circleLeds) });
}

registerBuilder({
	id: '__circle__',
	label: 'Circle (Custom)',

	createControls() {
		const divider = tbDivider('circle-divider');
		const group = tbGroup('circle-controls');
		const nInput = tbNumberInput('circle-n', { min: 2, max: 16, value: 8 });
		const buildBtn = tbButton('circle-build-btn', { icon: 'fa-hammer', text: 'Build' });
		group.append(tbLabel('circle-n', 'N'), nInput, buildBtn);

		buildBtn.addEventListener('click', () => this.build());
		nInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.build(); });

		return { divider, group };
	},

	// params (optional): { count } from a ?builder=circle&count=.. URL - see sketch.js's
	// parseBuilderParams()/selectBuilder(). Falls back to this builder's own N input when a
	// param is missing (manual Build click passes no params at all) or not present in the URL.
	build(params) {
		const n = Math.min(16, Math.max(2, parseInt(params?.count ?? document.getElementById('circle-n').value, 10) || 2));
		document.getElementById('circle-n').value = n;
		buildCircle(n);
	}
});
