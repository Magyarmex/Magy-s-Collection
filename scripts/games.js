export const games = [
  {
    id: "arcane-rift",
    title: "Arcane Rift: Live Run",
    description: "Playable roguelike slice with waves, relic drafts, and telemetry-rich debugging.",
    launchPath: "games/roguelike-3d/index.html",
    status: "beta",
    estimatedSession: "8-12 min",
    tags: ["roguelike", "3d", "fantasy", "shooter"],
    lastUpdated: "2024-07-01",
  },
  {
    id: "sample",
    title: "Sample Dungeon Dash",
    description: "A placeholder scene proving the pipeline works. Replace this with your first real game.",
    launchPath: "games/sample/index.html",
    status: "prototype",
    estimatedSession: "2-3 min",
    tags: ["demo", "onboarding"],
    lastUpdated: "2024-06-01",
  },
  {
    id: "dicey-duel",
    title: "Dicey Duel",
    description: "Speed-run a set of dice rolls and route the best score. A simple playground for future combat sims.",
    launchPath: "games/sample/index.html",
    status: "beta",
    estimatedSession: "5 min",
    tags: ["combat", "dice", "arcade"],
    lastUpdated: "2024-06-15",
  },
  {
    id: "coming-soon",
    title: "Mystery Quest (Coming soon)",
    description: "Reserved slot for the next idea. Flesh it out and plug in your own assets.",
    launchPath: "games/coming-soon/index.html",
    status: "beta",
    estimatedSession: "TBD",
    tags: ["placeholder"],
    lastUpdated: "2024-06-01",
  },
];

export const statusLabels = {
  prototype: "Prototype",
  beta: "Beta",
  released: "Released",
};
