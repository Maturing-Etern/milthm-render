# Milthm Web Suite

A browser-based toolset for playing and previewing [Milthm](https://milthm.com/) rhythm game charts. The suite contains two independent players accessible from a shared landing page.

---

## Contents

```
.
├── index.html              # Landing page — select a player to open
├── style.css               # Shared stylesheet (design tokens, layout)
├── MilLune Player/         # Canvas-based chart player with scoring
└── rain player/            # WebGL-based chart player (Rain engine)
```

---

## Players

### MilLune Player

A chart player built on the native MilLune engine (WebAssembly + Canvas 2D).

**Features**

- Loads charts packaged as `.zip` (with `meta.json`) or raw `.json` files
- Supports two ZIP formats: `meta.json` style and `info.json` style (with difficulty selection)
- Storyboard image loading from within the ZIP archive
- Real-time result panel with score, accuracy, grade, and judgment breakdown
- Grading system: R / Purple S / Cyan S / S / A / B / C / F
- Completion status: Rhythm of Rain / All Perfect / Full Combo / Complete / Crash
- Adjustable aspect ratio (presets + custom input)
- Theater mode (F11 or button)
- Auto-play mode

**Chart ZIP requirements**

| File | Description |
|------|-------------|
| `meta.json` | Chart metadata (title, artist, charter, difficulty) |
| `<audio>.ogg` / `.mp3` | Music file referenced in `meta.json` |
| `<chart>.json` | Chart event data referenced in `meta.json` |
| `<image>` (optional) | Cover illustration referenced in `meta.json` |

---

### Rain Player

A chart player built on the Rain engine, which renders via a Unity WebGL build embedded in an `<iframe>`.

**Features**

- Loads `.zip` charts conforming to the Milthm standard format
- Configurable gameplay parameters via a settings panel:
  - Note size, note speed, fall speed
  - Judgment offset, perfect/good windows, judgment line position
  - Master / music / SFX volume, audio offset
  - Visual toggles: particles, hit effects, judgment text, combo counter
  - Lane spacing and lane count
- Adjustable aspect ratio (presets + custom input)
- Theater mode (F11 or button)

**Chart ZIP requirements**

| File | Description |
|------|-------------|
| `meta.json` | Chart metadata |
| `music.ogg` / `music.mp3` | Music file |
| `chart/*.json` | Chart event data |

---

## Usage

### Option 1 — Open directly in a browser

> **Note:** Due to browser security restrictions on local files, opening `index.html` directly with `file://` may fail. Use a local HTTP server instead.

### Option 2 — Local HTTP server (recommended)

A minimal static file server is included:

```bash
node __serve.js
```

Then open `http://localhost:7788` in your browser.

Any standard static server works as well:

```bash
# Python
python -m http.server 7788

# Node (npx)
npx serve .
```

---

## File Formats

### `meta.json` (MilLune / Rain Player)

```json
{
  "name": "Song Title",
  "music_artist": "Artist Name",
  "charter": "Charter Name",
  "difficulty_name": "Master",
  "difficulty": 12,
  "audio_file": "music.ogg",
  "image_file": "cover.png",
  "chart_file": "chart/master.json"
}
```

### `info.json` (MilLune Player — multi-difficulty)

```json
{
  "Title": "Song Title",
  "Levels": [
    {
      "Difficulty": "Master",
      "DifficultyValue": 12.0,
      "Beatmapper": "Charter Name",
      "FileMap": {
        "beatmap": "/chart/master.json",
        "song": [{ "file": "/music.ogg" }],
        "illu": "/cover.png"
      }
    }
  ]
}
```

---

## Grading Reference (MilLune Player)

| Grade | Condition |
|-------|-----------|
| R | All Perfect (large only) and score ≥ 1,010,000 |
| Purple S | All Perfect and 1,000,000 ≤ score ≤ 1,009,999 |
| Cyan S | Full Combo (no Bad / Miss) |
| S | Score ≥ 950,000 |
| A | Score ≥ 900,000 |
| B | Score ≥ 850,000 |
| C | Score ≥ 800,000 |
| F | Score < 800,000 |

---

## Browser Compatibility

Requires a modern browser with support for:

- WebAssembly
- Canvas 2D API
- ES Modules (`import` / `export`)
- File API and `URL.createObjectURL`

Tested on Chrome 120+ and Edge 120+. Firefox and Safari should work but are not regularly tested.

---

## License

This project is for personal and educational use. The Milthm game and its assets are the property of their respective owners.
