export const games = [
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
