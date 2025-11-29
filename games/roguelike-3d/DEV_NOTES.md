# Arcane Rift Development Notes

A living plan for the 3D-inspired roguelike fantasy shooter being built for the arcade. This page tracks the concept, mood, and
execution steps.

## Concept Pillars
- **Arcane firearm + spellblade hybrid:** Swap between arcane pistols and close-range glyph slashes. Elemental cartridges modify both.
- **Readable danger:** Telegraphs, muzzle flashes, and contrasting shaders to keep chaos legible even with many projectiles.
- **Risk-for-power cadence:** Route through cursed rooms for aggressive relics; clean rooms reward consistency and resource stability.
- **Web-first performance:** Lightweight meshes, compressed textures, and pooled projectiles to keep FPS stable on mid-tier laptops.

## Current Slice (playable)
- Twin-stick-inspired canvas loop with WASD movement, mouse aiming, and hold-to-fire projectiles.
- Dash with i-frames and cooldown, mana economy for primary fire, passive regen, and health pickups.
- Two enemy archetypes (brute charger and acolyte caster) with scaling stats and ranged bolts.
- Wave-based progression with loot drops and a three-option relic draft between waves (fire rate, damage, speed, regen, dash, vitality).
- Telemetry: FPS sampling, per-wave stamps, kill/hit/heal counters, toast-backed error traps, and metrics mirrored to `window.__gameHubMetrics`.

## Next Steps
1. **Room Variety & Hazards**
   - Add tile obstacles and environmental hazards (vents, crystals) that can be detonated for area effects.
   - Implement minimap overlay and fog-of-war to emphasize navigation.
2. **Weapon Verbs & FX**
   - Secondary melee/glyph cone attack with short cooldown; status effects (ignite/freeze/arcane weaken).
   - Impact decals, damage number popups, camera shake, and audio cues for stronger feedback.
3. **Boss Layer & Events**
   - Mini-boss at wave 5 with telegraphed slams and add phases; arena modifiers per wave.
   - Event shrines with curses/boons that alter the next wave composition.
4. **Persistence & Polish**
   - Meta-progression hooks for unlocking relics, scoreboards, and seed sharing.
   - Settings menu for mouse sensitivity, aim smoothing, and accessibility palettes.

## Debug & QA Plan
- Maintain `window.__gameHubMetrics` with marks for DOM ready, run start, per-wave spawn/clear, FPS sampling, and error counts.
- Error traps for uncaught errors and unhandled promise rejections surface as toasts + log entries.
- Manual smoke checks: run health diagnostics, clear a few waves, confirm relic draft behaves, and ensure HUD bars stay in sync.
- Warnings fire when canvas bounds look suspiciously small or when the player takes hits from projectiles/collisions.

## Visual/UX Notes
- Palette: deep space blues with violet/aqua energy accents.
- Typography: Inter for UI, monospace for debug overlays; rounded chips for HUD callouts.
- HUD: compact bars with chips for wave/score/enemy count; relic draft overlay for between-wave selections.

## Assets Wishlist
- Low-poly spellblade + pistol GLTFs.
- Elemental muzzle flash spritesheets (fire, frost, arcane).
- Modular dungeon tiles with emissive runes; hazard props (crystals, vents, traps).

## Integration Tasks
- Registered the game in `scripts/games.js` with a launch path to this folder.
- Keep the HTML/CSS lightweight to avoid blocking the arcade shell.
- Document any new debug toggles inside this file as they are added.
