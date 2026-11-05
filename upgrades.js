const { hotkeyGroups } = require('./hotkey-groups.js');

/**
 * v1.1 -> v1.2: "Send hotkey" used a single dropdown (option `hotkey`).
 * It now has a category dropdown plus one hotkey dropdown per category.
 */
function upgradeSendHotkey(_context, props) {
	const groups = hotkeyGroups();
	const updatedActions = [];
	for (const action of props.actions) {
		if (action.actionId !== 'send_hotkey' || !action.options || action.options.hotkey === undefined) continue;
		if (action.options.category !== undefined) continue;
		const value = String(action.options.hotkey ?? '');
		const group = groups.find((g) => g.items.some((i) => i.value === value));
		const options = { ...action.options };
		delete options.hotkey;
		if (group) {
			options.category = group.id;
			options[`item_${group.id}`] = value;
			options.custom = '';
		} else {
			options.category = groups[0].id;
			options.custom = value;
		}
		action.options = options;
		updatedActions.push(action);
	}
	return { updatedConfig: null, updatedSecrets: null, updatedActions, updatedFeedbacks: [] };
}

module.exports = [upgradeSendHotkey];
