import { games, statusLabels } from "./games.js";

const metrics = {
  startedAt: performance.now(),
  renderDuration: 0,
  warnings: 0,
  errors: 0,
  log: [],
};

const els = {};

const safeGetElement = (id) => {
  const el = document.getElementById(id);
  if (!el) {
    recordIssue("error", `Missing element #${id}`);
  }
  return el;
};

const recordIssue = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, data };
  metrics.log.push(entry);
  if (level === "error") metrics.errors += 1;
  if (level === "warn") metrics.warnings += 1;
  appendLog(entry);
  updateCounters();
};

const appendLog = (entry) => {
  const target = els.eventLog ?? document.createElement("pre");
  target.textContent = `${target.textContent}${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}\n`;
};

const formatTags = (tags = []) => (tags.length ? tags.join(", ") : "No tags yet");

const validateGame = (game) => {
  if (!game.id || !game.title || !game.launchPath) {
    recordIssue("error", `Invalid game entry: ${JSON.stringify(game)}`);
    return false;
  }
  return true;
};

const hydrateGameCard = (game, template) => {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector(".game-card");
  card.dataset.gameId = game.id;

  const statusDot = clone.querySelector("[data-status]");
  statusDot.dataset.status = game.status;

  const statusLabel = clone.querySelector("[data-status-label]");
  statusLabel.textContent = statusLabels[game.status] ?? "Unknown";

  clone.querySelector("[data-title]").textContent = game.title;
  clone.querySelector("[data-description]").textContent = game.description ?? "No description provided.";
  clone.querySelector("[data-tags]").textContent = formatTags(game.tags);
  clone.querySelector("[data-duration]").textContent = game.estimatedSession ?? "Length TBD";

  const launchLink = clone.querySelector("[data-launch]");
  launchLink.href = game.launchPath;
  launchLink.addEventListener("click", () =>
    recordIssue("info", `Launching game ${game.id}`, { gameId: game.id })
  );

  const reportButton = clone.querySelector("[data-report]");
  reportButton.addEventListener("click", () => openReportDialog(game));

  return clone;
};

const renderGames = () => {
  const start = performance.now();
  const template = document.getElementById("gameCardTemplate");
  if (!template) {
    recordIssue("error", "Missing card template");
    return;
  }

  els.gameList.innerHTML = "";
  const filter = {
    status: els.statusFilter.value,
    query: els.searchInput.value.toLowerCase().trim(),
  };

  const filtered = games.filter((game) => {
    if (!validateGame(game)) return false;
    const matchesStatus = filter.status === "all" || game.status === filter.status;
    const matchesQuery =
      !filter.query ||
      game.title.toLowerCase().includes(filter.query) ||
      (game.tags ?? []).some((tag) => tag.toLowerCase().includes(filter.query));
    return matchesStatus && matchesQuery;
  });

  filtered.forEach((game) => {
    const cardNode = hydrateGameCard(game, template);
    els.gameList.appendChild(cardNode);
  });

  els.emptyState.hidden = filtered.length !== 0;
  metrics.renderDuration = Math.round(performance.now() - start);
  updateCounters(filtered.length);
  updateMetricsPanel();
};

const updateCounters = (loadedCount = games.length) => {
  els.loadedCount.textContent = loadedCount;
  els.warningCount.textContent = metrics.warnings;
  els.errorCount.textContent = metrics.errors;
};

const updateMetricsPanel = () => {
  els.metricPageReady.textContent = Math.round(performance.now() - metrics.startedAt);
  els.metricRender.textContent = metrics.renderDuration;
  els.metricWarnings.textContent = metrics.warnings;
  els.metricErrors.textContent = metrics.errors;
};

const toggleMetrics = () => {
  const isHidden = els.metricsPanel.hasAttribute("hidden");
  if (isHidden) {
    els.metricsPanel.removeAttribute("hidden");
  } else {
    els.metricsPanel.setAttribute("hidden", "");
  }
  els.toggleMetricsButton.setAttribute("aria-expanded", String(!isHidden));
};

const resetFilters = () => {
  els.statusFilter.value = "all";
  els.searchInput.value = "";
  renderGames();
};

const openReportDialog = (game) => {
  const dialog = document.getElementById("reportDialog");
  const textArea = document.getElementById("reportText");
  textArea.value = `Game: ${game.title}\nIssue: `;
  dialog.showModal();
  dialog.addEventListener(
    "close",
    () => {
      if (dialog.returnValue === "submit" && textArea.value.trim()) {
        recordIssue("warn", `Report submitted for ${game.id}`, { body: textArea.value });
      }
    },
    { once: true }
  );
};

const bindEvents = () => {
  els.statusFilter.addEventListener("change", renderGames);
  els.searchInput.addEventListener("input", () => {
    window.clearTimeout(window.__searchTimer);
    window.__searchTimer = window.setTimeout(renderGames, 120);
  });
  els.refreshButton.addEventListener("click", () => {
    recordIssue("info", "Manual refresh triggered");
    renderGames();
  });
  els.clearFiltersButton.addEventListener("click", resetFilters);
  els.toggleMetricsButton.addEventListener("click", toggleMetrics);
};

const captureElements = () => {
  els.loadedCount = safeGetElement("loadedCount");
  els.warningCount = safeGetElement("warningCount");
  els.errorCount = safeGetElement("errorCount");
  els.gameList = safeGetElement("gameList");
  els.statusFilter = safeGetElement("statusFilter");
  els.searchInput = safeGetElement("searchInput");
  els.emptyState = safeGetElement("emptyState");
  els.clearFiltersButton = safeGetElement("clearFiltersButton");
  els.metricsPanel = safeGetElement("metricsPanel");
  els.metricPageReady = safeGetElement("metricPageReady");
  els.metricRender = safeGetElement("metricRender");
  els.metricWarnings = safeGetElement("metricWarnings");
  els.metricErrors = safeGetElement("metricErrors");
  els.eventLog = safeGetElement("eventLog");
  els.toggleMetricsButton = safeGetElement("toggleMetricsButton");
  els.refreshButton = safeGetElement("refreshButton");
};

const ensureComingSoonWarning = () => {
  const missingGames = games.filter((game) => !validateGame(game));
  if (missingGames.length) {
    recordIssue("warn", `${missingGames.length} game entries failed validation.`);
  }

  games
    .filter((game) => game.launchPath && game.launchPath.includes("coming-soon"))
    .forEach((game) =>
      recordIssue("warn", `Game ${game.id} has a placeholder launch path: ${game.launchPath}`)
    );
};

const bootstrap = () => {
  captureElements();
  bindEvents();
  ensureComingSoonWarning();
  renderGames();
};

window.addEventListener("error", (event) => {
  recordIssue("error", event.message, { source: event.filename, line: event.lineno });
});

window.addEventListener("unhandledrejection", (event) => {
  recordIssue("error", `Unhandled rejection: ${event.reason}`);
});

window.addEventListener("DOMContentLoaded", bootstrap);

// expose metrics for future debugging
window.__gameHubMetrics = metrics;
