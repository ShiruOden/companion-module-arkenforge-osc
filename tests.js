// Simple test without a test framework: sends to a local UDP server and decodes the packet.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const osc = require('osc');
const { sendString, buildPacket, ARKENFORGE_PORT, ARKENFORGE_CLINK_PATH } = require('./osc-send.js');
const { groupEntries, mergeEntries, loadAudioList, loadBundledList } = require('./audio-list.js');
const os = require('os');
const { getActions } = require('./actions.js');
const { hotkeyGroups } = require('./hotkey-groups.js');
const upgrades = require('./upgrades.js');
const { buildPresets } = require('./presets.js');
const groups = require('./hotkeys.js');

async function main() {
	// 1) Packet structure
	const decoded = osc.readPacket(buildPacket('play_music'), { metadata: true });
	assert.strictEqual(decoded.address, '/HKEYAPP');
	assert.strictEqual(decoded.args.length, 1);
	assert.strictEqual(decoded.args[0].type, 's');
	assert.strictEqual(decoded.args[0].value, 'play_music');

	// 2) Send via UDP to a local server on a test port
	const server = dgram.createSocket('udp4');
	const received = new Promise((resolve) => server.once('message', (msg) => resolve(msg)));
	await new Promise((res) => server.bind(0, '127.0.0.1', res));
	const testPort = server.address().port;
	await sendString('127.0.0.1', 'time_morning', testPort);
	const msg = osc.readPacket(await received, { metadata: true });
	server.close();
	assert.strictEqual(msg.address, '/HKEYAPP');
	assert.strictEqual(msg.args[0].value, 'time_morning');

	// 3) Hotkey list: unique values
	const values = groups.flatMap((g) => g.items.map((i) => i.value));
	assert.strictEqual(new Set(values).size, values.length, 'duplicate hotkey values');
	const names = groups.flatMap((g) => g.items.map((i) => i.arkenforge));
	assert.strictEqual(new Set(names).size, names.length, 'duplicate Arkenforge hotkey names');
	assert.strictEqual(values.length, 410, 'expected all 410 Arkenforge hotkeys');

	// 4) Every string and Arkenforge hotkey name must exist in the profile (.NET BinaryFormatter strings are length-prefixed)
	const rwhk = fs.readFileSync(path.join(__dirname, 'arkenforge', 'companion.rwhk'));
	const hasString = (text) => {
		const bytes = Buffer.from(text, 'utf8');
		assert.ok(bytes.length < 128, `string too long: ${text}`);
		return rwhk.includes(Buffer.concat([Buffer.from([bytes.length]), bytes]));
	};
	for (const g of groups) {
		for (const i of g.items) {
			assert.ok(hasString(i.value), `"${i.value}" is missing in companion.rwhk`);
			assert.ok(hasString(i.arkenforge), `hotkey "${i.arkenforge}" is missing in companion.rwhk`);
		}
	}

	// 5) /CLINK packets
	const clink = osc.readPacket(buildPacket('Packs/X/Audio/SFX/A.rwmeta', ARKENFORGE_CLINK_PATH), { metadata: true });
	assert.strictEqual(clink.address, '/CLINK');
	assert.strictEqual(clink.args[0].value, 'Packs/X/Audio/SFX/A.rwmeta');

	// 6) Audio list grouping (fake data)
	const list = groupEntries([
		{ type: 'SFX', category: 'Fantasy/Magic', name: 'Earth spell', path: 'Packs/X/Audio/SFX/Fantasy/Magic/Earth spell.rwmeta' },
		{ type: 'SFX', category: 'Fantasy/Magic', name: 'Air spell', path: 'Packs/X/Audio/SFX/Fantasy/Magic/Air spell.rwmeta' },
		{ type: 'sfx', category: 'Scifi/Doors', name: 'Door', path: 'Packs/X/Audio/SFX/Scifi/Doors/Door.rwmeta' },
		{ type: 'Music', category: '', name: 'Song', path: 'Packs/X/Audio/Songs/Music/Song.rwmeta' },
		{ type: 'Playlists', category: '', name: 'List', path: 'Packs/X/Playlists/List.rwmeta' },
		{ type: 'Other', category: 'x', name: 'y', path: 'z' },
		{ nonsense: true },
	]);
	assert.strictEqual(list.SFX.length, 2);
	assert.strictEqual(list.SFX[0].id, 'Fantasy_Magic');
	assert.deepStrictEqual(list.SFX[0].items.map((i) => i.label), ['Air spell', 'Earth spell']);
	assert.strictEqual(list.Music[0].label, '(root)');
	assert.strictEqual(list.Ambience.length, 0);
	assert.strictEqual(list.Playlist.length, 1);

	// 6b) Bundled Arkencore list + merging with a user list
	const bundled = await loadBundledList();
	const count = (l) => l.SFX.reduce((n, c) => n + c.items.length, 0);
	assert.ok(count(bundled) > 1000 && bundled.Music.length > 0, 'bundled list looks too small');
	const tmpFile = path.join(os.tmpdir(), `audio_paths_test_${process.pid}.json`);
	fs.writeFileSync(tmpFile, JSON.stringify([
		{ type: 'SFX', category: 'Mine', name: 'Own', path: 'MyAssets/Audio/SFX/Mine/Own.rwmeta' },
		{ type: 'SFX', category: 'Mine', name: 'Dup', path: bundled.SFX[0].items[0].id },
	]));
	const merged = await loadAudioList(tmpFile);
	fs.unlinkSync(tmpFile);
	assert.strictEqual(count(merged), count(bundled) + 1, 'duplicates must be ignored, new entries added');
	assert.ok(merged.SFX.some((c) => c.label === 'Mine'));
	assert.strictEqual(mergeEntries([{ path: 'a' }], [{ path: 'a' }, { path: 'b' }]).length, 2);

	// 7) Actions: hotkey dropdown, per-category item fields, callbacks
	const sent = [];
	const fakeSelf = {
		parseVariablesInString: async (t) => t,
		sendOsc: async (path, text) => sent.push([path, text]),
		log: () => {},
	};
	const actions = getActions(fakeSelf, list);
	const hk = actions.send_hotkey.options; // category + one dropdown per category + custom
	const hgroups = hotkeyGroups();
	assert.strictEqual(hk.length, hgroups.length + 2);
	assert.strictEqual(hk[1].isVisibleExpression, `$(options:category) == '${hgroups[0].id}'`);
	assert.ok(hk[1].isVisible({ category: hgroups[0].id }, hk[1].isVisibleData));
	assert.ok(!hk[1].isVisible({ category: hgroups[1].id }, hk[1].isVisibleData));
	assert.strictEqual(hk[hk.length - 1].id, 'custom');
	assert.strictEqual(new Set(hgroups.map((g) => g.id)).size, hgroups.length);
	const sfxOpts = actions.play_sfx.options; // category + 2 item fields + custom
	assert.strictEqual(sfxOpts.length, 4);
	assert.strictEqual(sfxOpts[1].isVisibleExpression, "$(options:category) == 'Fantasy_Magic'");
	assert.ok(sfxOpts[1].isVisible({ category: 'Fantasy_Magic' }, sfxOpts[1].isVisibleData));
	assert.ok(!sfxOpts[1].isVisible({ category: 'Scifi_Doors' }, sfxOpts[1].isVisibleData));
	assert.strictEqual(actions.play_playlist.options.length, 3); // category + 1 item field + custom
	assert.strictEqual(actions.play_ambience.options.length, 1); // only the path field when the list is empty

	await actions.play_sfx.callback({ options: { category: 'Fantasy_Magic', item_Fantasy_Magic: 'p1', custom: '' } });
	await actions.play_sfx.callback({ options: { category: 'Fantasy_Magic', item_Fantasy_Magic: 'p1', custom: ' custom/path ' } });
	await actions.play_ambience.callback({ options: { custom: 'amb/path' } });
	const musicGroup = hgroups.find((g) => g.items.some((i) => i.value === 'stop_music'));
	await actions.send_hotkey.callback({ options: { category: musicGroup.id, [`item_${musicGroup.id}`]: 'stop_music', custom: '' } });
	await actions.send_hotkey.callback({ options: { category: musicGroup.id, [`item_${musicGroup.id}`]: 'stop_music', custom: ' my_hotkey ' } });
	await actions.send_string.callback({ options: { string: 'abc' } });
	assert.deepStrictEqual(sent, [
		['/CLINK', 'p1'],
		['/CLINK', 'custom/path'],
		['/CLINK', 'amb/path'],
		['/HKEYAPP', 'stop_music'],
		['/HKEYAPP', 'my_hotkey'],
		['/HKEYAPP', 'abc'],
	]);

	// 8) Upgrade script: old flat "hotkey" option -> category + item
	const up = upgrades[0](null, {
		actions: [
			{ id: 'a', controlId: 'c', actionId: 'send_hotkey', options: { hotkey: 'stop_music' } },
			{ id: 'b', controlId: 'c', actionId: 'send_hotkey', options: { hotkey: 'my_own_string' } },
			{ id: 'c', controlId: 'c', actionId: 'send_string', options: { string: 'x' } },
		],
	});
	assert.strictEqual(up.updatedActions.length, 2);
	assert.strictEqual(up.updatedActions[0].options.category, musicGroup.id);
	assert.strictEqual(up.updatedActions[0].options[`item_${musicGroup.id}`], 'stop_music');
	assert.strictEqual(up.updatedActions[0].options.hotkey, undefined);
	assert.strictEqual(up.updatedActions[1].options.custom, 'my_own_string');

	// 9) Presets exist for every button definition
	const presetCount = groups.flatMap((g) => g.items).filter((i) => i.button).length;
	assert.strictEqual(Object.keys(buildPresets()).length, presetCount);

	assert.strictEqual(ARKENFORGE_PORT, 11819);
	console.log(`OK (${values.length} hotkeys)`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
