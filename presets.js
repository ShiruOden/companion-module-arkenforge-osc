const { combineRgb } = require('@companion-module/base');
const raw = require('./hotkeys.js');

// Presets are created for every hotkey that has a `button` definition in hotkeys.js
function buildPresets() {
	const presets = {};
	for (const group of raw) {
		for (const item of group.items) {
			if (!item.button) continue;
			const [r, g, b] = item.button.color;
			presets[`hotkey_${item.value}`] = {
				type: 'button',
				category: item.button.category,
				name: item.button.label,
				style: {
					text: item.button.label,
					size: 'auto',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(r, g, b),
				},
				steps: [
					{
						down: [{ actionId: 'send_string', options: { string: item.value } }],
						up: [],
					},
				],
				feedbacks: [],
			};
		}
	}
	return presets;
}

module.exports = { buildPresets };
