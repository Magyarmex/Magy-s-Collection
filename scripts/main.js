import { games, statusLabels } from "./games.js";

const metrics = {
  startedAt: performance.now(),
  renderDuration: 0,
  filterDuration: 0,
  renderCount: 0,
  cardsRendered: 0,
  warnings: 0,
  errors: 0,
  missingElements: 0,
  preferenceFaults: 0,
  registryFlags: 0,
  slowRenders: 0,
  lastInteraction: null,
  lastRefresh: null,
  lastIssue: "None logged",
  log: [],
};

const STORAGE_KEYS = {
  status: "arcade.statusFilter",
  search: "arcade.searchQuery",
  sort: "arcade.sort",
};

const els = {};

const safeGetElement = (id) => {
  const el = document.getElementById(id);
  if (!el) {
    recordIssue("error", `Missing element #${id}`);
    metrics.missingElements += 1;
  }
  return el;
};

const recordIssue = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, data };
  metrics.log.push(entry);
  if (level === "error") metrics.errors += 1;
  if (level === "warn") metrics.warnings += 1;
  metrics.lastIssue = `${level.toUpperCase()}: ${message}`;
  appendLog(entry);
  updateCounters();
  updateStatusDetails();
  if (els.statusFilter && els.searchInput) {
    updateFilterChips({
      status: els.statusFilter.value,
      query: (els.searchInput.value ?? "").toLowerCase().trim(),
    });
  }
};

const appendLog = (entry) => {
  const target = els.eventLog ?? document.createElement("pre");
  target.textContent = `${target.textContent}${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}\n`;
};

const formatTags = (tags = []) => (tags.length ? tags.join(", ") : "No tags yet");

const safeStatus = (status) => {
  if (!statusLabels[status]) {
    recordIssue("warn", `Unknown status '${status}', defaulting to prototype`);
    return "prototype";
  }
  return status;
};

const readPreference = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    metrics.preferenceFaults += 1;
    recordIssue("warn", "Unable to read preference", { key, message: error.message });
    return null;
  }
};

const writePreference = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    metrics.preferenceFaults += 1;
    recordIssue("warn", "Unable to persist preference", { key, message: error.message });
  }
};

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
  statusDot.dataset.status = safeStatus(game.status);

  const statusLabel = clone.querySelector("[data-status-label]");
  const status = safeStatus(game.status);
  statusLabel.textContent = statusLabels[status] ?? "Unknown";

  clone.querySelector("[data-title]").textContent = game.title;
  clone.querySelector("[data-description]").textContent = game.description ?? "No description provided.";
  clone.querySelector("[data-tags]").textContent = formatTags(game.tags);
  clone.querySelector("[data-duration]").textContent = game.estimatedSession ?? "Length TBD";
  clone.querySelector("[data-updated]").textContent = game.lastUpdated
    ? `Updated ${game.lastUpdated}`
    : "Awaiting first update";

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
    sort: els.sortSelect.value,
  };

  const filtered = games
    .filter((game) => {
      if (!validateGame(game)) return false;
      const matchesStatus = filter.status === "all" || game.status === filter.status;
      const matchesQuery =
        !filter.query ||
        game.title.toLowerCase().includes(filter.query) ||
        (game.tags ?? []).some((tag) => tag.toLowerCase().includes(filter.query));
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => {
      if (filter.sort === "title") {
        return a.title.localeCompare(b.title);
      }
      if (filter.sort === "status") {
        return safeStatus(a.status).localeCompare(safeStatus(b.status));
      }
      const dateA = new Date(a.lastUpdated ?? 0).getTime();
      const dateB = new Date(b.lastUpdated ?? 0).getTime();
      return dateB - dateA;
    });

  filtered.forEach((game) => {
    const cardNode = hydrateGameCard(game, template);
    els.gameList.appendChild(cardNode);
  });

  els.emptyState.hidden = filtered.length !== 0;
  metrics.renderDuration = Math.round(performance.now() - start);
  metrics.filterDuration = metrics.renderDuration;
  metrics.renderCount += 1;
  metrics.cardsRendered = filtered.length;
  if (metrics.renderDuration > 140) {
    metrics.slowRenders += 1;
    recordIssue("warn", `Render exceeded budget: ${metrics.renderDuration}ms`);
  }
  metrics.lastRefresh = metrics.lastRefresh ?? new Date();
  updateCounters(filtered.length);
  updateFilterChips(filter);
  updateMetricsPanel();
  updateSessionInsights();
  updateStatusDetails();
};

const updateCounters = (loadedCount = games.length) => {
  els.loadedCount.textContent = loadedCount;
  els.warningCount.textContent = metrics.warnings;
  els.errorCount.textContent = metrics.errors;
};

const updateStatusDetails = () => {
  if (els.lastIssue) {
    els.lastIssue.textContent = metrics.lastIssue || "None logged";
  }
};

const updateMetricsPanel = () => {
  els.metricPageReady.textContent = Math.round(performance.now() - metrics.startedAt);
  els.metricRender.textContent = metrics.renderDuration;
  els.metricWarnings.textContent = metrics.warnings;
  els.metricErrors.textContent = metrics.errors;
  els.metricCards.textContent = metrics.cardsRendered;
  els.metricFilter.textContent = metrics.filterDuration;
  els.metricRegistryFlags.textContent = metrics.registryFlags;
  els.metricMissing.textContent = metrics.missingElements;
  els.metricPrefs.textContent = metrics.preferenceFaults;
  els.metricSlowRenders.textContent = metrics.slowRenders;
};

const updateSessionInsights = () => {
  els.renderCount.textContent = metrics.renderCount;
  els.lastInteraction.textContent = metrics.lastInteraction
    ? metrics.lastInteraction.toLocaleTimeString()
    : "-";
  els.lastRefresh.textContent = metrics.lastRefresh ? metrics.lastRefresh.toLocaleTimeString() : "-";
};

const trackInteraction = (reason) => {
  metrics.lastInteraction = new Date();
  recordIssue("info", `Interaction: ${reason}`);
  updateSessionInsights();
};

const updateFilterChips = (filter) => {
  const searchActive = Boolean(filter.query);
  const statusActive = filter.status !== "all";

  els.searchChip.hidden = !searchActive;
  els.statusChip.hidden = !statusActive;

  if (searchActive) {
    els.searchChip.textContent = `Search: "${filter.query}"`;
  }
  if (statusActive) {
    els.statusChip.textContent = `Status: ${statusLabels[filter.status] ?? filter.status}`;
  }

  const active = [];
  if (statusActive) active.push(statusLabels[filter.status] ?? filter.status);
  if (searchActive) active.push(`"${filter.query}"`);
  els.activeFilters.textContent = active.length ? active.join(" · ") : "All";

  if (metrics.warnings > 0) {
    els.healthChip.textContent = `Warnings detected (${metrics.warnings})`;
    els.healthChip.classList.add("warn");
    els.healthChip.classList.remove("success", "error");
  } else if (metrics.errors > 0) {
    els.healthChip.textContent = `Errors detected (${metrics.errors})`;
    els.healthChip.classList.add("error");
    els.healthChip.classList.remove("success", "warn");
  } else {
    els.healthChip.textContent = "Diagnostics idle";
    els.healthChip.classList.add("success");
    els.healthChip.classList.remove("warn", "error");
  }
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
  els.sortSelect.value = "recent";
  [STORAGE_KEYS.status, STORAGE_KEYS.search, STORAGE_KEYS.sort].forEach((key) =>
    writePreference(key, "")
  );
  trackInteraction("Filters cleared");
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
  els.statusFilter.addEventListener("change", () => {
    writePreference(STORAGE_KEYS.status, els.statusFilter.value);
    trackInteraction("Status filter change");
    renderGames();
  });
  els.sortSelect.addEventListener("change", () => {
    writePreference(STORAGE_KEYS.sort, els.sortSelect.value);
    trackInteraction("Sort change");
    renderGames();
  });
  els.searchInput.addEventListener("input", () => {
    window.clearTimeout(window.__searchTimer);
    window.__searchTimer = window.setTimeout(() => {
      writePreference(STORAGE_KEYS.search, els.searchInput.value);
      trackInteraction("Search query");
      renderGames();
    }, 120);
  });
  els.refreshButton.addEventListener("click", () => {
    recordIssue("info", "Manual refresh triggered");
    metrics.lastRefresh = new Date();
    updateSessionInsights();
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
  els.sortSelect = safeGetElement("sortSelect");
  els.searchInput = safeGetElement("searchInput");
  els.emptyState = safeGetElement("emptyState");
  els.clearFiltersButton = safeGetElement("clearFiltersButton");
  els.metricsPanel = safeGetElement("metricsPanel");
  els.metricPageReady = safeGetElement("metricPageReady");
  els.metricRender = safeGetElement("metricRender");
  els.metricWarnings = safeGetElement("metricWarnings");
  els.metricErrors = safeGetElement("metricErrors");
  els.metricCards = safeGetElement("metricCards");
  els.metricFilter = safeGetElement("metricFilter");
  els.metricRegistryFlags = safeGetElement("metricRegistryFlags");
  els.metricMissing = safeGetElement("metricMissing");
  els.metricPrefs = safeGetElement("metricPrefs");
  els.metricSlowRenders = safeGetElement("metricSlowRenders");
  els.eventLog = safeGetElement("eventLog");
  els.toggleMetricsButton = safeGetElement("toggleMetricsButton");
  els.refreshButton = safeGetElement("refreshButton");
  els.activeFilters = safeGetElement("activeFilters");
  els.healthChip = safeGetElement("healthChip");
  els.searchChip = safeGetElement("searchChip");
  els.statusChip = safeGetElement("statusChip");
  els.persistedNotice = safeGetElement("persistedNotice");
  els.lastInteraction = safeGetElement("lastInteraction");
  els.renderCount = safeGetElement("renderCount");
  els.lastRefresh = safeGetElement("lastRefresh");
  els.lastIssue = safeGetElement("lastIssue");
};

const loadPreferences = () => {
  const persistedStatus = readPreference(STORAGE_KEYS.status);
  const persistedSearch = readPreference(STORAGE_KEYS.search);
  const persistedSort = readPreference(STORAGE_KEYS.sort);

  let restored = false;
  if (persistedStatus && els.statusFilter.querySelector(`[value="${persistedStatus}"]`)) {
    els.statusFilter.value = persistedStatus;
    restored = true;
  }
  if (typeof persistedSearch === "string") {
    els.searchInput.value = persistedSearch;
    restored = restored || Boolean(persistedSearch);
  }
  if (persistedSort && els.sortSelect.querySelector(`[value="${persistedSort}"]`)) {
    els.sortSelect.value = persistedSort;
    restored = true;
  }

  els.persistedNotice.hidden = !restored;
  if (restored) {
    recordIssue("info", "Restored saved filters");
  }
};

const ensureComingSoonWarning = () => {
  const missingGames = games.filter((game) => !validateGame(game));
  if (missingGames.length) {
    recordIssue("warn", `${missingGames.length} game entries failed validation.`);
  }

  games
    .filter((game) => game.launchPath && game.launchPath.includes("coming-soon"))
    .forEach((game) => {
      metrics.registryFlags += 1;
      recordIssue("warn", `Game ${game.id} has a placeholder launch path: ${game.launchPath}`);
    });
};

const flagRegistryAnomalies = () => {
  const ids = new Set();
  games.forEach((game) => {
    if (ids.has(game.id)) {
      metrics.registryFlags += 1;
      recordIssue("warn", `Duplicate game id detected: ${game.id}`);
    } else {
      ids.add(game.id);
    }

    if (!game.launchPath || !game.launchPath.endsWith("index.html")) {
      metrics.registryFlags += 1;
      recordIssue("warn", `Launch path for ${game.id} may be misconfigured: ${game.launchPath}`);
    }

    if (!game.description || game.description.length < 12) {
      metrics.registryFlags += 1;
      recordIssue("warn", `Description is thin for ${game.id}`);
    }
  });
};

const bootstrap = () => {
  captureElements();
  loadPreferences();
  bindEvents();
  ensureComingSoonWarning();
  flagRegistryAnomalies();
  renderGames();
  updateSessionInsights();
  updateStatusDetails();
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
