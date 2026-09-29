// A single straight line of N LEDs. Literally a 1-row Matrix under the hood - buildMatrix
// already produces exactly this shape (evenly-spaced points, one straight line across, zigzag
// a no-op with only one row - see buildMatrix's own header comment in matrix.js) - just with
// its own {id, label} identity and a single N control instead of Matrix's W/H pair, since a
// bare strip is common enough on its own (any single-run LED strip project) that a caller
// shouldn't have to remember "set H to 1", and a ?builder=strip&count=.. URL reads better than
// spelling out countX/countY=1.
registerBuilder({
	id: '__strip__',
	label: 'Strip (Custom)',

	createControls() {
		const divider = tbDivider('strip-divider');
		const group = tbGroup('strip-controls');
		const nInput = tbNumberInput('strip-n', { min: 1, max: 32, value: 8 });
		const buildBtn = tbButton('strip-build-btn', { icon: 'fa-hammer', text: 'Build' });
		group.append(tbLabel('strip-n', 'N'), nInput, buildBtn);

		buildBtn.addEventListener('click', () => this.build());
		nInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.build(); });

		return { divider, group };
	},

	// params (optional): { count } from a ?builder=strip&count=.. URL - see sketch.js's
	// parseBuilderParams()/selectBuilder(). Falls back to this builder's own N input when a
	// param is missing.
	build(params) {
		const n = Math.min(32, Math.max(1, parseInt(params?.count ?? document.getElementById('strip-n').value, 10) || 1));
		document.getElementById('strip-n').value = n;
		buildMatrix(n, 1, false);
	}
});
