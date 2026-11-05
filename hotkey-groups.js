const raw = require('./hotkeys.js');
const { makeId } = require('./audio-list.js');

/** Hotkey categories with stable ids, e.g. { id: 'Fog_of_war', title: 'Fog of war', items: [...] } */
function hotkeyGroups() {
	const taken = new Set();
	return raw.map((g) => ({ id: makeId(g.category, taken), title: g.category, items: g.items }));
}

module.exports = { hotkeyGroups };
