# Arcane Rift: Doomcaster Notes

Living doc for the Doom-inspired fantasy shooter inside Magy's Collection. Tracks concept, instrumentation, and remaining polish work.

## Concept Pillars
- **Doom, arcane edition:** Fast strafe-heavy gunplay with billboarding demons and crunchy projectiles. Magic instead of bullets, but same pacing.
- **Readable brutality:** Wide FOV raycast renderer, high-contrast sprites, and clear telegraphs on incoming projectiles.
- **Run-based rewards:** Clear rooms to draft relics that change fire-rate, damage, armor, or pickup radius.
- **Web-first:** Pure canvas raycaster, small palette-based sprites, and pointer-lock controls.

## Current Slice (playable)
- First-person raycast renderer with full mouse-look, WASD strafe, sprint, dash, and crosshair firing.
- Enemies: imps (fast), wraiths (darting casters), knights (tanky gunners). They track, shoot, and drop pickups on death.
- Loot: health shards, ammo boxes, and relic tokens seeded per wave; relics mutate stats on pickup.
- Telemetry: FPS, frame count, kills, shots fired, hits taken/heals logged to `window.__gameHubMetrics` and runtime log with toast surfacing.

## Next Steps
1. **Renderer polish**
   - Add texture sampling per wall type and sprite animation frames.
   - Floor/ceiling casting with dithering for depth.
2. **Combat depth**
   - Alternate weapons (spread shotgun rune, charged orb) and enemy melee threats.
   - Add stagger/knockback when enemies are close to give space management.
3. **Encounters**
   - Procedural room layouts with door triggers instead of single arena.
   - Boss encounter with multi-phase attacks and weak points.
4. **UX + Settings**
   - Sensitivity slider, invert look toggle, and a simple minimap overlay.

## Debug & QA Plan
- Keep `window.__gameHubMetrics` mirrored and stamp run start/spawns.
- Track warnings/errors via log + toast; expose manual diagnostics button to force a log line.
- Manual checks: pointer lock acquire/release, run death path, wave transitions, relic pickup routing, HUD sync for ammo/armor.

## Visual/UX Notes
- Palette: deep violets and blues for walls; warm muzzle + enemy colors for contrast.
- HUD: three bars (health/armor/ammo), chips for wave/score/enemies, crosshair overlay on canvas.

## Assets Wishlist
- Stylized billboards for each demon type and glowing relic coins.
- Impact sprites for hitscan/projectile collisions.
- Texture atlas for wall runes and floor tiling.

## Integration Tasks
- Registered in `scripts/games.js` as the sole playable card in the collection.
- Keep HTML/CSS light, pointer-lock friendly, and ensure diagnostics remain reachable.
