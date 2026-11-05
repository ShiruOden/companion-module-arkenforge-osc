# companion-module-arkenforge-osc

A Bitfocus Companion module for [Arkenforge](https://www.arkenforge.com). Fork of
[companion-module-generic-osc](https://github.com/bitfocus/companion-module-generic-osc) (MIT).

- Configurable: IP address (and an optional audio list)
- Fixed: port 11819 (UDP), OSC paths `/HKEYAPP` (hotkeys) and `/CLINK` (content links)
- **Send hotkey**: all 410 Arkenforge hotkeys, chosen by category and name (custom strings allowed)
- **Play SFX / Ambience / Music / Playlist**: searchable lists built from your asset folders
- Also: `Send string`, `Send content link`, `Reload audio list`
- Presets for the most useful hotkeys and three ready-made pages (`pages/`)
- Hotkey profile for Arkenforge: `arkenforge/companion.rwhk` (list of all strings: [HOTKEYS.md](HOTKEYS.md))
- Script to extract SFX/Ambience/Music/Playlist paths of other packs and your own files: `tools/extract_audio_paths.py`

## Installation

### 1. Set up the hotkey profile in Arkenforge

1. Move `arkenforge/companion.rwhk` to `C:\Arkenforge\ArkenforgeData\MyAssets\Misc`.
2. Start Arkenforge.
3. Open the hotkey settings in Arkenforge.
4. Select the profile **companion**.

The profile contains the usual keyboard hotkeys plus an `App: <string>` binding for every hotkey, which is what the module triggers.

### 2. Set up the module in Companion

1. Add a connection **Arkenforge** and enter the IP address (`127.0.0.1` if Arkenforge runs on the same computer).
2. Use the actions in your buttons, drag buttons from *Presets*, or import the pages (below).

### 3. Optional: import the button pages

The folder `pages/` contains three ready-made pages (8 x 4 grid, navigation buttons in the first column):

| File | Page | Content |
| --- | --- | --- |
| `1-audio.companionconfig` | Audio | Music control, clear/stop for SFX and ambience, empty slots for playlists, ambience and SFX |
| `2-prepare.companionconfig` | Prepare | Blocking, lock/unlock, layers, line editing, grouping, lighting |
| `3-play.companionconfig` | Play | Player view and overlay, filters, fog of war, touch input, time of day, ping |

In Companion, open *Import / Export*, select a page file and import it into a page slot. When asked which connection to use, choose your Arkenforge connection. The pages were exported with Companion 5.0.7.

The slots *Playlist n*, *Ambience n* and *SFX n* on the Audio page use the action **Send content link** with an empty path. Paste the path of the asset there, or replace the action with **Play SFX / Ambience / Music / Playlist** and pick the asset from the list.

### 4. Play SFX, ambience, music and playlists by name

The audio files of the **Arkencore** pack (included with Arkenforge) are built into the module. The actions below work right after installing it.
The actions **Play SFX**, **Play Ambience**, **Play Music** and **Play Playlist** send the content path of an asset to Arkenforge (OSC path `/CLINK`). For other packs or your own files you can add your own list:

1. Run the extraction script (Python 3.8+, no extra packages):
   `python tools/extract_audio_paths.py "C:\Arkenforge\ArkenforgeData" --out output`
2. Copy `audio_paths.json` from the output folder to a fixed place, e.g. `C:\Arkenforge\ArkenforgeData\MyAssets\Misc\audio_paths.json`.
3. Enter this path in the connection settings of the module under **Additional audio list**. Entries are added to the built-in list (duplicates are ignored).

In the action, choose a **Category** first; a second dropdown then lists the assets of that category (type to search). The field **Custom path** overrides the selection and accepts variables. After running the script again, use the action **Reload audio list** (or re-save the connection settings).

The script reads SFX (`Audio/SFX`), music and jingles (`Audio/Songs`), ambience presets (`AmbiencePresets`) and playlists (`Playlists`) from all packs and from `MyAssets`. Only `.rwmeta` files are used (change with `--ext`).

If a type is missing in the list, run `python tools/extract_audio_paths.py --folders` to see which folders contain assets.

## Notes

- OSC is one-way here: Companion sends, Arkenforge does not report back, so there are no feedbacks.
- Hotkeys that need a key to be held (e.g. *Hold for movement*) cannot be triggered by a single OSC message.

## Development

```
yarn install
node tests.js
yarn build      # development build
yarn package    # package for Companion
```

The built-in Arkencore list is `data/arkencore-audio.json`. To refresh it: `python tools/extract_audio_paths.py "C:\Arkenforge\ArkenforgeData" --include Packs/Arkencore/ --out output`, then copy `output/audio_paths.json` to `data/arkencore-audio.json`.

`hotkeys.js` is the list of all hotkeys. Every string must also exist in the profile `arkenforge/companion.rwhk`; `node tests.js` checks this. Items with a `button` entry get a preset in Companion.
