const { InstanceBase, Regex, InstanceStatus, runEntrypoint } = require('@companion-module/base');
const { ARKENFORGE_PORT, ARKENFORGE_PATH, sendString } = require('./osc-send.js');
const { buildPresets } = require('./presets.js');
const { getActions } = require('./actions.js');
const { loadAudioList, loadBundledList, emptyList, countItems } = require('./audio-list.js');
const UpgradeScripts = require('./upgrades.js');

class ArkenforgeInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		this.audioList = emptyList();
		this.audioWarning = '';
	}

	async init(config) {
		this.config = config;
		this.setPresetDefinitions(buildPresets());
		await this.loadAudio();
	}

	async destroy() {
		this.log('debug', 'destroy');
	}

	async configUpdated(config) {
		this.config = config;
		await this.loadAudio();
	}

	// (Re)loads the bundled Arkencore list plus the optional user list and rebuilds the actions.
	async loadAudio() {
		const file = String(this.config.audioList ?? '').trim();
		this.audioList = emptyList();
		this.audioWarning = '';
		try {
			this.audioList = await loadAudioList(file);
			this.log('info', `Audio list loaded (${countItems(this.audioList)})`);
		} catch (err) {
			this.audioWarning = `Audio list not readable: ${err.message}`;
			this.log('error', this.audioWarning);
			try {
				this.audioList = await loadBundledList(); // keep the bundled list usable
			} catch (err2) {
				this.log('error', `Bundled audio list not readable: ${err2.message}`);
			}
		}
		this.setActionDefinitions(getActions(this, this.audioList));
		this.checkConfig();
	}

	// UDP is connectionless, so the status only reflects the configuration.
	checkConfig() {
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No IP address entered');
		} else if (this.audioWarning) {
			this.updateStatus(InstanceStatus.UnknownWarning, this.audioWarning);
		} else {
			this.updateStatus(InstanceStatus.Ok);
		}
	}

	async sendOsc(path, text) {
		if (!this.config.host) {
			this.log('warn', 'No IP address configured');
			return;
		}
		try {
			await sendString(this.config.host, text, ARKENFORGE_PORT, path);
			this.log('debug', `Sent: ${path} "${text}" -> ${this.config.host}:${ARKENFORGE_PORT}`);
		} catch (err) {
			this.log('error', `Sending failed: ${err.message}`);
		}
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Arkenforge IP address',
				width: 8,
				default: '127.0.0.1',
				regex: Regex.HOSTNAME,
				required: true,
				tooltip: `If Arkenforge runs on the same computer as Companion, keep 127.0.0.1. Port (${ARKENFORGE_PORT}) is fixed.`,
			},
			{
				type: 'textinput',
				id: 'audioList',
				label: 'Additional audio list (audio_paths.json, optional)',
				width: 12,
				default: '',
				tooltip: `The Arkencore audio files are built in. Use this for other packs or your own files: full path to the audio_paths.json created by tools/extract_audio_paths.py, e.g. C:\\Arkenforge\\ArkenforgeData\\MyAssets\\Misc\\audio_paths.json. Used for the actions Play SFX / Ambience / Music (OSC path /CLINK). Hotkeys use ${ARKENFORGE_PATH}.`,
			},
		];
	}
}

runEntrypoint(ArkenforgeInstance, UpgradeScripts);
