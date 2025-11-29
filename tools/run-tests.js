import { readFileSync } from "fs";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { games, statusLabels } from "../scripts/games.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const allowedStatuses = Object.keys(statusLabels);
let failures = 0;
let warnings = 0;

const report = (level, message, extra = {}) => {
  const payload = Object.keys(extra).length ? ` | ${JSON.stringify(extra)}` : "";
  // eslint-disable-next-line no-console
  console.log(`${level.toUpperCase()}: ${message}${payload}`);
};

const validateRegistry = () => {
  if (!Array.isArray(games) || games.length === 0) {
    report("error", "Game registry is empty or not an array");
    failures += 1;
    return;
  }

  games.forEach((game) => {
    const context = { id: game.id };
    ["id", "title", "launchPath", "status"].forEach((key) => {
      if (!game[key]) {
        report("error", `Missing ${key} on game`, context);
        failures += 1;
      }
    });

    if (!allowedStatuses.includes(game.status)) {
      report("error", `Invalid status '${game.status}'`, context);
      failures += 1;
    }

    const absolutePath = path.join(repoRoot, game.launchPath);
    if (!existsSync(absolutePath)) {
      report("warn", `Launch path missing on disk: ${game.launchPath}`, context);
      warnings += 1;
    }

    if (!game.description) {
      report("warn", "Missing description", context);
      warnings += 1;
    }
  });
};

const validateReadme = () => {
  try {
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    if (!readme.toLowerCase().includes("npm test")) {
      report("warn", "README is missing test instructions");
      warnings += 1;
    }
  } catch (error) {
    report("error", `Unable to read README.md: ${error.message}`);
    failures += 1;
  }
};

const run = () => {
  validateRegistry();
  validateReadme();

  if (failures > 0) {
    report("error", `${failures} failing checks`, { failures, warnings });
    process.exitCode = 1;
    return;
  }

  report("info", "All checks passed", { warnings });
};

run();
