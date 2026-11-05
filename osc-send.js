const osc = require('osc');
const dgram = require('dgram');

// Fixed values for Arkenforge
const ARKENFORGE_PORT = 11819;
const ARKENFORGE_PATH = '/HKEYAPP'; // hotkeys
const ARKENFORGE_CLINK_PATH = '/CLINK'; // content links (SFX, ambience, music)

/**
 * Builds the OSC packet: the given path (default /HKEYAPP) with exactly one string argument.
 * @param {string} text
 * @param {string} [path]
 * @returns {Buffer}
 */
function buildPacket(text, path = ARKENFORGE_PATH) {
	const bytes = osc.writePacket(
		{
			address: path,
			args: [{ type: 's', value: String(text) }],
		},
		{ metadata: true },
	);
	return Buffer.from(bytes);
}

/**
 * Sends the string via UDP to host:port (default: 11819).
 * @param {string} host
 * @param {string} text
 * @param {number} [port]
 * @param {string} [path]
 * @returns {Promise<void>}
 */
function sendString(host, text, port = ARKENFORGE_PORT, path = ARKENFORGE_PATH) {
	return new Promise((resolve, reject) => {
		const packet = buildPacket(text, path);
		const socket = dgram.createSocket('udp4');
		socket.once('error', (err) => {
			try {
				socket.close();
			} catch (_) {
				// ignore
			}
			reject(err);
		});
		socket.send(packet, 0, packet.length, port, host, (err) => {
			socket.close();
			if (err) reject(err);
			else resolve();
		});
	});
}

module.exports = { ARKENFORGE_PORT, ARKENFORGE_PATH, ARKENFORGE_CLINK_PATH, buildPacket, sendString };
