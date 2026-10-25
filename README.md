# Milo & Lina Kids — Cartoon Studio

A free, mobile-friendly web app for planning original children's cartoon
videos for YouTube Shorts. **Phase 1 runs completely free with no API key.**

## What it does (Phase 1)

- **Original stories** — built-in generator (no AI API needed) with themes,
  connected scenes, meaningful dialogue, emotional reactions, and happy endings.
- **Connected 10–15 second scenes** — every scene opens where the previous
  one ended, so the story chains cleanly.
- **Consistent characters** — locked descriptions for Milo (yellow raincoat,
  blue shorts), Lina (pink dress, pigtails), and Bobo (white bunny, orange
  scarf), plus reusable reference images, injected into every prompt.
- **Detailed video prompts** — camera movement, expressions, dialogue, and
  sound instructions per scene, in vertical **9:16** for YouTube Shorts.
- **Scene-by-scene editing** — edit, reorder, add, or delete any scene.
- **Prompt preview + one-click export** — preview each prompt, copy all
  prompts at once, or download a Markdown prompt pack, Shorts info sheet,
  and full project JSON backup.
- **Saves in your browser** — projects reopen after you close the browser
  (see Storage limits below).

## Phase 2 — Video (added, free tier)

- **Video tab** — plays your project as a real animated video in the
  browser: Ken Burns camera motion over character art, scene titles and
  dialogue as subtitles, free device voices per character, cheerful music,
  and **.webm export** via Record. No key, no account, no cost.
- **Honest limits:** this is an animatic (motion over still art), not AI
  motion. Spoken voices play live only — browsers cannot route device
  speech into a recording, so exports carry music + subtitles, not voices.
- **Real AI video (optional, paid):** a MiniMax H3 adapter
  (`js/providers/provider-hailuo.js`) is included. H3 fits these scenes
  (5–15s, up to 9 reference images, native audio, ~$0.08/s at 768p, no free
  tier). It needs your own key in the Video tab and is untested live; if a
  browser call is blocked by CORS, use the exported prompt pack on the
  provider's website instead.

## Run it locally

No build step, no install:

```bash
cd milo-lina-cartoon-ai
python3 -m http.server 8000
```

Then open http://localhost:8000 in your phone or desktop browser.
(Opening `index.html` directly also works.)

## Publish with GitHub Pages (free)

1. Push this repo to GitHub (public repo keeps Pages free).
2. GitHub repo → **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Branch: **main**, folder: **/(root)**. Click **Save**.
5. Wait 1–2 minutes. Your app is live at
   `https://<your-username>.github.io/milo-lina-cartoon-ai/`
   (a `.nojekyll` file is included so Pages serves the files as-is).

## Storage limits (important)

- Data lives in **this browser on this device only** — it does not sync.
- Projects/settings use localStorage; reference images use IndexedDB.
- Clearing site data, uninstalling the browser, or private/incognito mode
  can erase data. **Export project JSON regularly as backup.**
- Reference images are not inside JSON exports (they are large) —
  re-upload them after an import if needed.

## API keys — never in this repo

Keys are typed in the app's Settings page and stored **only in the user's
browser** (localStorage). The app sends nothing anywhere in Phase 1, and no
key may ever be committed here. See [docs/KEYS.md](docs/KEYS.md).
`.gitignore` blocks `.env`, `*-keys.json`, and local config files.

## Provider architecture (Phase 2 ready)

Every provider implements the same interface (`js/providers/provider-base.js`).
Phase 1 ships a free **Demo** provider (simulation only) plus inactive
adapters for Gemini (text), Kling (video), and Runway (video). Adding a real
provider later = one adapter file + registration. No app rewrite, no purchases
in Phase 1.

## File map

```
index.html                  App shell + bottom navigation (mobile-first)
css/style.css               Mobile-first styles, 9:16 preview frames
js/app.js                   UI wiring (browser only)
js/characters.js            Locked character bible
js/story.js                 Built-in original story generator
js/scenes.js                10–15s scene splitter + continuity chain
js/prompts.js               Detailed video prompt builder
js/storage.js               localStorage + IndexedDB persistence
js/export.js                Prompt pack / Shorts info / JSON export
js/providers/               Provider interface + demo + Phase 2 stubs
assets/characters/          Placeholder reference images
docs/                       User guide + key safety
```

## Roadmap

- **Phase 2 (in progress):** free in-browser video (animatic + voices +
  .webm export) is done. The MiniMax H3 adapter is written but needs a key
  and a live test before it counts as working.
- **Later, only on request:** baked AI voices (ElevenLabs or similar),
  multi-scene AI rendering queue, and a free proxy option if browser CORS
  blocks direct provider calls.
