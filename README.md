# D&D but bad arcade

A lightweight web arcade shell that hosts multiple browser-based games behind a single menu. This repository sets the groundwork for adding, discovering, and launching new experiments quickly.

## Structure
- `index.html`: Arcade landing page and game launcher with filter chips, sort controls, and a debug overlay.
- `styles/`: Styling for the menu experience.
- `scripts/`: Client-side logic and registry of available games.
- `games/`: Each game lives in its own subfolder with its own assets.
- `tools/run-tests.js`: Lightweight validation that keeps the registry healthy.

## Running locally
This project is pure HTML/CSS/JS and works on any static server. For local development:

```bash
npm install # not required, but keeps scripts available
npx http-server .
```

Then open `http://localhost:8080` in your browser.

## Adding a new game
1. Create a folder under `games/<your-game>/` with its own `index.html` (and assets).
2. Add an entry to `scripts/games.js` with a unique `id`, title, status, `launchPath`, optional `tags`, and description.
3. Open the arcade in your browser to confirm the new tile renders and the Launch button opens your game.
4. Sort, search, and filter settings persist between reloads. Use the “Clear filters” button to reset them.

## Debugging and instrumentation
- The Metrics panel (toggle in the header) tracks page readiness, render time, warnings, and errors.
- The event log captures launcher events, missing elements, validation issues, and manual refreshes.
- A live chip bar surfaces search/status filters and warns when warnings or errors are detected.
- Session insights track last interaction, render count, and render performance to ease QA.
- `window.__gameHubMetrics` exposes the metrics object for debugging in the devtools console.

## Tests
Run the lightweight validation to ensure the registry is well-formed and referenced files exist:

```bash
npm test
```

The test script checks that every game entry has the required fields and that the referenced `launchPath` exists on disk.
