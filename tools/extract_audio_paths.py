#!/usr/bin/env python3
"""
Extracts the content-link paths of all SFX, Ambience and Music assets from the
Arkenforge data directory, so they can be sent to Arkenforge via OSC
(path /CLINK, one string argument, e.g. "Packs/Arkencore/Audio/SFX/Fantasy/Magic/Earth spell.rwmeta").

Usage examples (Windows):
    python extract_audio_paths.py
    python extract_audio_paths.py "C:\\Arkenforge\\ArkenforgeData" --out output
    python extract_audio_paths.py --types sfx,music --include fantasy --exclude horror

Find out which folders contain .rwmeta files below an "Audio" folder (useful if a type is missing):
    python extract_audio_paths.py --folders

Output (in --out, default ./output):
    audio_paths.csv    type, source, category, name, path   (UTF-8 with BOM, opens correctly in Excel)
    audio_paths.json   same data as JSON
    sfx.txt, ambience.txt, music.txt, playlist.txt   one path per line

Requires only Python 3.8+ (no extra packages).
"""
import argparse
import csv
import json
import os
import sys
from collections import Counter

DEFAULT_ROOT = r"C:\Arkenforge\ArkenforgeData"

# folder name (lower case) -> asset type
TYPE_FOLDERS = {
    "sfx": "SFX",
    "ambience": "Ambience",
    "ambiences": "Ambience",
    "ambiencepresets": "Ambience",  # Packs/<pack>/AmbiencePresets/...
    "playlists": "Playlist",  # Packs/<pack>/Playlists/...
    "music": "Music",
}


def classify(parts):
    """parts = folder names between the data root and the file (without the file name).
    Returns (type, index_of_type_folder) or (None, None)."""
    lower = [p.lower() for p in parts]
    # Prefer the folder directly after an "Audio" folder (Packs/<pack>/Audio/SFX/...)
    for i, p in enumerate(lower[:-1]):
        if p == "audio" and lower[i + 1] in TYPE_FOLDERS:
            return TYPE_FOLDERS[lower[i + 1]], i + 1
        # Audio/Songs/Music/<genre>/..., Audio/Songs/Jingles/..., Audio/Songs/<file>
        if p == "audio" and lower[i + 1] == "songs":
            if len(lower) > i + 2 and lower[i + 2] == "music":
                return "Music", i + 2  # the "Music" folder is not part of the category
            return "Music", i + 1
    # Fallback: first folder anywhere with a known name
    for i, p in enumerate(lower):
        if p in TYPE_FOLDERS:
            return TYPE_FOLDERS[p], i
    return None, None


def source_of(parts):
    """Pack name for Packs/<pack>/..., otherwise the top-level folder (e.g. MyAssets)."""
    if len(parts) >= 2 and parts[0].lower() == "packs":
        return parts[1]
    return parts[0] if parts else ""


def scan(root, ext, wanted_types):
    rows = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for fn in filenames:
            if not fn.lower().endswith(ext):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fn), root)
            parts = rel.split(os.sep)
            folders = parts[:-1]
            atype, idx = classify(folders)
            if atype is None or atype.lower() not in wanted_types:
                continue
            rows.append(
                {
                    "type": atype,
                    "source": source_of(folders),
                    "category": "/".join(folders[idx + 1:]),
                    "name": fn[: -len(ext)],
                    "path": "/".join(parts),  # forward slashes, relative to the data root
                }
            )
    rows.sort(key=lambda r: (r["type"], r["path"].lower()))
    return rows


def list_folders(root, ext):
    """Prints all folders below an 'Audio', 'AmbiencePresets' or 'Playlists' folder that contain files with the given extension."""
    counts = Counter()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        n = sum(1 for fn in filenames if fn.lower().endswith(ext))
        if not n:
            continue
        parts = os.path.relpath(dirpath, root).split(os.sep)
        lower = [p.lower() for p in parts]
        anchors = [lower.index(a) for a in ("audio", "ambiencepresets", "playlists") if a in lower]
        if not anchors:
            continue
        i = min(anchors)
        counts["/".join(parts[: i + 3])] += n  # up to two levels below "Audio" / "AmbiencePresets"
    for folder, n in sorted(counts.items()):
        print(f"{n:6}  {folder}")
    if not counts:
        print("No folders with that extension below an 'Audio', 'AmbiencePresets' or 'Playlists' folder.")

    # Folders with "ambien" in the name, any file type (helps to find ambience assets stored elsewhere)
    amb = Counter()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        rel = os.path.relpath(dirpath, root)
        if "ambien" not in rel.lower():
            continue
        for fn in filenames:
            amb[(rel.replace(os.sep, "/"), os.path.splitext(fn)[1].lower() or "(none)")] += 1
    print("\nFolders with 'ambien' in the path (any file type):")
    if amb:
        for (folder, e), n in sorted(amb.items()):
            print(f"{n:6}  {folder}  [{e}]")
    else:
        print("  none found")


def main():
    ap = argparse.ArgumentParser(description="Extract Arkenforge SFX/Ambience/Music paths for OSC /CLINK.")
    ap.add_argument("root", nargs="?", default=DEFAULT_ROOT, help=f"Arkenforge data directory (default: {DEFAULT_ROOT})")
    ap.add_argument("--out", default="output", help="output directory (default: ./output)")
    ap.add_argument("--types", default="sfx,ambience,music,playlist", help="comma separated: sfx,ambience,music,playlist")
    ap.add_argument("--ext", default=".rwmeta", help="file extension to collect (default: .rwmeta)")
    ap.add_argument("--folders", action="store_true", help="only list the folders (below 'Audio', 'AmbiencePresets' or 'Playlists') that contain asset files, then exit")
    ap.add_argument("--include", action="append", default=[], help="only paths containing this text (case-insensitive, repeatable)")
    ap.add_argument("--exclude", action="append", default=[], help="skip paths containing this text (case-insensitive, repeatable)")
    args = ap.parse_args()

    if not os.path.isdir(args.root):
        sys.exit(f"Directory not found: {args.root}\nPass the Arkenforge data directory as the first argument.")

    if args.folders:
        list_folders(args.root, args.ext.lower())
        return

    wanted = {t.strip().lower() for t in args.types.split(",") if t.strip()}
    wanted = {"playlist" if t == "playlists" else t for t in wanted}
    unknown = wanted - {"sfx", "ambience", "music", "playlist"}
    if unknown:
        sys.exit(f"Unknown type(s): {', '.join(sorted(unknown))} (allowed: sfx, ambience, music, playlist)")

    rows = scan(args.root, args.ext.lower(), wanted)
    inc = [s.lower() for s in args.include]
    exc = [s.lower() for s in args.exclude]
    if inc:
        rows = [r for r in rows if any(s in r["path"].lower() for s in inc)]
    if exc:
        rows = [r for r in rows if not any(s in r["path"].lower() for s in exc)]

    if not rows:
        sys.exit("No matching files found. Check the directory and the folder names (Audio/SFX, Audio/Ambience, Audio/Music).")

    os.makedirs(args.out, exist_ok=True)
    fields = ["type", "source", "category", "name", "path"]
    with open(os.path.join(args.out, "audio_paths.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(args.out, "audio_paths.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    for t in ("SFX", "Ambience", "Music", "Playlist"):
        subset = [r["path"] for r in rows if r["type"] == t]
        if subset:
            with open(os.path.join(args.out, f"{t.lower()}.txt"), "w", encoding="utf-8") as f:
                f.write("\n".join(subset) + "\n")

    print(f"{len(rows)} files found in {args.root}")
    for (t, s), n in sorted(Counter((r["type"], r["source"]) for r in rows).items()):
        print(f"  {t:9} {s}: {n}")
    print("\nFirst entries (compare with the format Arkenforge expects):")
    for r in rows[:3]:
        print("  " + r["path"])
    print(f"\nFiles written to: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()
