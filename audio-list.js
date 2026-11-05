const fs = require('fs/promises');
// The Arkencore list is bundled into the module by the Companion build (webpack inlines JSON requires).
const bundledEntries = () => require('./data/arkencore-audio.json');

const TYPES = ['SFX', 'Ambience', 'Music', 'Playlist'];

/** Makes a stable, safe field id from a category label (letters, digits, underscore). */
function makeId(label, taken) {
	let base = label.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'root';
	let id = base;
	let n = 2;
	while (taken.has(id)) id = `${base}_${n++}`;
	taken.add(id);
	return id;
}

/**
 * Groups the entries of audio_paths.json by type and category.
 * Entry format (written by tools/extract_audio_paths.py): { type, category, name, path }
 * @param {unknown} entries
 * @returns {{SFX: object[], Ambience: object[], Music: object[], Playlist: object[]}}
 *   per type: [{ id, label, items: [{ id: <path>, label: <name> }] }]
 */
function groupEntries(entries) {
	const result = emptyList();
	if (!Array.isArray(entries)) return result;

	const tmp = Object.fromEntries(TYPES.map((t) => [t, new Map()]));
	for (const e of entries) {
		if (!e || typeof e.path !== 'string' || !e.path || typeof e.type !== 'string') continue;
		const wanted = e.type.toLowerCase().replace(/^playlists$/, 'playlist');
		const type = TYPES.find((t) => t.toLowerCase() === wanted);
		if (!type) continue;
		const category = typeof e.category === 'string' && e.category ? e.category : '(root)';
		const name = typeof e.name === 'string' && e.name ? e.name : e.path.split('/').pop();
		if (!tmp[type].has(category)) tmp[type].set(category, []);
		tmp[type].get(category).push({ id: e.path, label: name });
	}

	for (const type of TYPES) {
		const taken = new Set();
		const labels = [...tmp[type].keys()].sort((a, b) => a.localeCompare(b));
		for (const label of labels) {
			const items = tmp[type].get(label).sort((a, b) => a.label.localeCompare(b.label));
			result[type].push({ id: makeId(label, taken), label, items });
		}
	}
	return result;
}

async function readEntries(file) {
	const raw = await fs.readFile(file, 'utf8');
	const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
	if (!Array.isArray(data)) throw new Error('expected a JSON array');
	return data;
}

/** Merges entry lists; the first occurrence of a path wins. */
function mergeEntries(...lists) {
	const seen = new Set();
	const out = [];
	for (const list of lists) {
		for (const e of list) {
			if (!e || typeof e.path !== 'string' || seen.has(e.path)) continue;
			seen.add(e.path);
			out.push(e);
		}
	}
	return out;
}

/**
 * Loads the bundled Arkencore list and, optionally, the user's own audio_paths.json.
 * Throws if the user's file cannot be read (the bundled list is then not returned, the caller decides).
 * @param {string} [userFile]
 */
async function loadAudioList(userFile) {
	const bundled = bundledEntries();
	const user = userFile ? await readEntries(userFile) : [];
	return groupEntries(mergeEntries(bundled, user));
}

/** Only the bundled Arkencore list. */
async function loadBundledList() {
	return groupEntries(bundledEntries());
}

function emptyList() {
	return Object.fromEntries(TYPES.map((t) => [t, []]));
}

function countItems(list) {
	return TYPES.map((t) => `${t}: ${list[t].reduce((n, c) => n + c.items.length, 0)}`).join(', ');
}

module.exports = { TYPES, makeId, groupEntries, mergeEntries, loadAudioList, loadBundledList, emptyList, countItems };
