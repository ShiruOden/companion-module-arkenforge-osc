const { hotkeyGroups } = require('./hotkey-groups.js');
const { ARKENFORGE_PORT, ARKENFORGE_PATH, ARKENFORGE_CLINK_PATH } = require('./osc-send.js');

/** Action that sends a hotkey: category dropdown + one hotkey dropdown per category + custom string. */
function hotkeyAction(self) {
	const groups = hotkeyGroups();
	const options = [
		{
			type: 'dropdown',
			id: 'category',
			label: 'Category',
			choices: groups.map((g) => ({ id: g.id, label: `${g.title} (${g.items.length})` })),
			default: groups[0].id,
			minChoicesForSearch: 0,
		},
	];
	for (const g of groups) {
		options.push({
			type: 'dropdown',
			id: `item_${g.id}`,
			label: 'Hotkey',
			choices: g.items.map((i) => ({ id: i.value, label: i.arkenforge })),
			default: g.items[0].value,
			minChoicesForSearch: 0,
			isVisibleExpression: `$(options:category) == '${g.id}'`,
			// fallback for older Companion versions without isVisibleExpression
			isVisible: (opts, data) => opts.category === data.id,
			isVisibleData: { id: g.id },
		});
	}
	options.push({
		type: 'textinput',
		id: 'custom',
		label: 'Custom string (overrides the selection above)',
		default: '',
		useVariables: true,
		tooltip: 'For hotkeys that are not in the list, e.g. one you added to the profile yourself',
	});
	return {
		name: 'Send hotkey',
		description: `Sends a hotkey to Arkenforge (${ARKENFORGE_PATH}). Choose a category, then the hotkey.`,
		options,
		callback: async (event) => {
			const custom = (await self.parseVariablesInString(String(event.options.custom ?? ''))).trim();
			const text = custom || String(event.options[`item_${event.options.category}`] ?? '').trim();
			if (!text) {
				self.log('warn', 'Send hotkey: nothing selected');
				return;
			}
			await self.sendOsc(ARKENFORGE_PATH, text);
		},
	};
}

/** Action that plays an asset of one type: category dropdown + one item dropdown per category + custom path. */
function audioAction(self, type, categories) {
	const options = [];
	const hasList = categories.length > 0;

	if (hasList) {
		options.push({
			type: 'dropdown',
			id: 'category',
			label: 'Category',
			choices: categories.map((c) => ({ id: c.id, label: `${c.label} (${c.items.length})` })),
			default: categories[0].id,
			minChoicesForSearch: 0,
		});
		for (const c of categories) {
			options.push({
				type: 'dropdown',
				id: `item_${c.id}`,
				label: type,
				choices: c.items,
				default: c.items[0].id,
				minChoicesForSearch: 0,
				isVisibleExpression: `$(options:category) == '${c.id}'`,
				// fallback for older Companion versions without isVisibleExpression
				isVisible: (opts, data) => opts.category === data.id,
				isVisibleData: { id: c.id },
			});
		}
	}

	options.push({
		type: 'textinput',
		id: 'custom',
		label: hasList ? 'Custom path (overrides the selection above)' : 'Path',
		default: '',
		useVariables: true,
		tooltip: 'Path relative to ArkenforgeData, e.g. Packs/Arkencore/Audio/SFX/Fantasy/Magic/Earth spell.rwmeta',
	});

	return {
		name: `Play ${type}`,
		description: hasList
			? `Sends the content link of the selected ${type} asset (${ARKENFORGE_CLINK_PATH})`
			: `No ${type} entries in the audio list. Enter a path manually or set the audio list in the connection settings.`,
		options,
		callback: async (event) => {
			const custom = (await self.parseVariablesInString(String(event.options.custom ?? ''))).trim();
			const path = custom || String(event.options[`item_${event.options.category}`] ?? '');
			if (!path) {
				self.log('warn', `${type}: no path selected`);
				return;
			}
			await self.sendOsc(ARKENFORGE_CLINK_PATH, path);
		},
	};
}

function getActions(self, audioList) {
	return {
		send_string: {
			name: 'Send string',
			description: `Sends a string to Arkenforge (${ARKENFORGE_PATH})`,
			options: [{ type: 'textinput', label: 'Text', id: 'string', default: '', useVariables: true }],
			callback: async (event) => {
				const text = await self.parseVariablesInString(String(event.options.string ?? ''));
				await self.sendOsc(ARKENFORGE_PATH, text);
			},
		},
		send_hotkey: hotkeyAction(self),
		send_clink: {
			name: 'Send content link',
			description: `Sends a content path to Arkenforge (${ARKENFORGE_CLINK_PATH})`,
			options: [
				{
					type: 'textinput',
					label: 'Path',
					id: 'path',
					default: '',
					useVariables: true,
					tooltip: 'e.g. Packs/Arkencore/Audio/SFX/Fantasy/Magic/Earth spell.rwmeta',
				},
			],
			callback: async (event) => {
				const path = (await self.parseVariablesInString(String(event.options.path ?? ''))).trim();
				if (!path) {
					self.log('warn', 'Send content link: empty path');
					return;
				}
				await self.sendOsc(ARKENFORGE_CLINK_PATH, path);
			},
		},
		play_sfx: audioAction(self, 'SFX', audioList.SFX),
		play_ambience: audioAction(self, 'Ambience', audioList.Ambience),
		play_music: audioAction(self, 'Music', audioList.Music),
		play_playlist: audioAction(self, 'Playlist', audioList.Playlist),
		reload_audio_list: {
			name: 'Reload audio list',
			description: 'Re-reads audio_paths.json (e.g. after running the extraction script again)',
			options: [],
			callback: async () => {
				await self.loadAudio();
			},
		},
	};
}

module.exports = { getActions };
