# Arkenforge (OSC)

This module controls Arkenforge via OSC: hotkeys, SFX, ambience and music.

## Setup in Arkenforge (one time)

Arkenforge needs to know what to do when it receives the strings. The hotkey profile `companion.rwhk` provides this (in the module's GitHub repository, folder `arkenforge`).

1. Move the file `companion.rwhk` to this folder:
   `C:\Arkenforge\ArkenforgeData\MyAssets\Misc`
2. Start Arkenforge.
3. Open the **hotkey settings** in Arkenforge.
4. Select the profile **companion**.

## Setup in Companion

1. Add a connection **Arkenforge**.
2. Enter the IP address of the computer running Arkenforge. If it runs on the same computer as Companion, keep `127.0.0.1`.

The port (`11819`) is fixed. Hotkeys use the OSC path `/HKEYAPP`, content links use `/CLINK`.

## Actions

- **Send hotkey**: choose a category (e.g. *Fog of war*), then the hotkey (type to search). The field *Custom string* overrides the selection. Sent to `/HKEYAPP`.
- **Send string**: sends the entered text as an OSC string to `/HKEYAPP`. Companion variables can be used.
- **Send content link**: sends a content path (e.g. `Packs/Arkencore/Audio/SFX/Fantasy/Magic/Earth spell.rwmeta`) to `/CLINK`.
- **Play SFX / Play Ambience / Play Music / Play Playlist**: choose a category, then an asset from the list. The optional field *Custom path* overrides the selection. 
- **Reload audio list**: re-reads the audio list file.

## Audio lists

The audio files of the Arkencore pack are built into the module, so the Play actions work right away.

For other packs or your own files, run `tools/extract_audio_paths.py` from the GitHub repository. It creates `audio_paths.json`. Enter the full path of this file in the connection settings under **Additional audio list**. Its entries are added to the built-in list.

The module needs read access to the filesystem to read your additional list. It requests the `filesystem` permission in its manifest. If the connection shows "Access to this API has been restricted", you are running an older version of the module without this permission - install the latest version.

## Presets

Under *Presets* you will find ready-made buttons for the most useful hotkeys. The full list of strings is in `HOTKEYS.md` in the repository.

## Ready-made pages

The GitHub repository contains three importable pages (folder `pages`): Audio, Prepare and Play. Import them via *Import / Export* and choose your Arkenforge connection when asked.
