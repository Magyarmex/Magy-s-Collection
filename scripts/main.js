import { debugHub } from "./debug.js";
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

const diagnostics = {
  invalidGameKeys: new Set(),
  placeholderNotified: false,
  emptyRosterNotified: false,
  duplicateNotified: false,
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

function recordIssue(level, message, data = null) {
  const entry = debugHub.record(level, message, data);
  const { counters } = debugHub.snapshot();
  metrics.log.push(entry);
  metrics.errors = counters.error;
  metrics.warnings = counters.warn;
  appendLog(entry);
  updateCounters();
  updateStatusDetails();
  if (els.statusFilter && els.searchInput) {
    updateFilterChips({
      status: els.statusFilter.value,
      query: (els.searchInput.value ?? "").toLowerCase().trim(),
    });
  }
  renderDebugMenu();
  return entry;
}

const appendLog = (entry) => {
  const target = els.eventLog ?? document.createElement("pre");
  target.textContent = `${target.textContent}${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}\n`;
};

function renderDebugMenu() {
  if (!els.debugMenu) return;

  const snapshot = debugHub.snapshot();
  const healthState = snapshot.counters.error > 0 ? "error" : snapshot.counters.warn > 0 ? "warn" : "success";
  const statusLabel = healthState === "error" ? "Errors detected" : healthState === "warn" ? "Warnings active" : "Stable";

  if (els.debugStatus) {
    els.debugStatus.textContent = statusLabel;
    els.debugStatus.className = `chip ${healthState}`;
  }

  if (els.debugIssueCount) els.debugIssueCount.textContent = snapshot.counters.total;
  if (els.debugFlagCount) els.debugFlagCount.textContent = snapshot.flags.length;

  if (els.debugLastIssue) {
    els.debugLastIssue.textContent = snapshot.lastIssue
      ? `${snapshot.lastIssue.message}`
      : "No issues captured yet.";
  }

  if (els.debugLastError) {
    els.debugLastError.textContent = snapshot.lastError
      ? `${snapshot.lastError.message}`
      : "No errors thrown.";
  }

  if (els.debugUptime) {
    const uptime = Math.round(performance.now() - snapshot.startedAt);
    els.debugUptime.textContent = `${uptime} ms`;
  }

  if (els.debugLatency) {
    const latency = metrics.filterDuration || metrics.renderDuration || 0;
    els.debugLatency.textContent = `${latency} ms`;
  }

  if (els.debugFlagList) {
    els.debugFlagList.innerHTML = "";
    if (!snapshot.flags.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No active flags";
      els.debugFlagList.appendChild(li);
    } else {
      snapshot.flags.forEach((flag) => {
        const li = document.createElement("li");
        li.dataset.severity = flag.severity;
        li.innerHTML = `<strong>${flag.code}</strong>: ${flag.message}`;
        if (flag.hint) {
          const hint = document.createElement("small");
          hint.textContent = flag.hint;
          li.appendChild(hint);
        }
        els.debugFlagList.appendChild(li);
      });
    }
  }
}

const formatTags = (tags = []) => (tags.length ? tags.join(", ") : "No tags yet");

const safeStatus = (status) => {
  if (!statusLabels[status]) {
    recordIssue("warn", `Unknown status '${status}', defaulting to prototype`);
    return "prototype";
  }
  return status;
};

async function exportDebugLog() {
  const logText = debugHub
    .snapshot()
    .issues.map((entry) => `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(logText || "No events captured yet.");
    recordIssue("info", "Copied debug log to clipboard");
  } catch (error) {
    recordIssue("warn", "Clipboard unavailable for debug log", { message: error.message });
  }
}

function simulateDebugError() {
  try {
    throw new Error("Simulated launcher error for diagnostics");
  } catch (error) {
    recordIssue("error", error.message, { source: "debug-menu" });
    debugHub.flag({
      code: "simulated-error",
      severity: "warn",
      message: "Simulated error captured",
      hint: "Use this to validate alerting and event forwarding",
      data: { source: "debug" },
    });
    renderDebugMenu();
  }
}

function performHealthSweep() {
  const snapshot = debugHub.snapshot();
  if (snapshot.counters.error === 0) {
    debugHub.flag({
      code: "session-healthy",
      severity: "info",
      message: "No runtime errors detected",
      hint: "Diagnostics will surface issues automatically",
    });
  } else {
    debugHub.clearFlag("session-healthy");
  }

  if (snapshot.counters.warn > 3) {
    debugHub.flag({
      code: "excessive-warnings",
      severity: "warn",
      message: `${snapshot.counters.warn} warnings captured this session`,
      hint: "Inspect the event log for patterns",
    });
  } else {
    debugHub.clearFlag("excessive-warnings");
  }

  renderDebugMenu();
}

function clearDebugFlags() {
  debugHub.snapshot().flags.forEach((flag) => debugHub.clearFlag(flag.code));
  recordIssue("info", "Cleared debug flags");
  renderDebugMenu();
}

function toggleDebugMenu() {
  if (!els.debugMenu) return;
  const isHidden = els.debugMenu.hasAttribute("hidden");
  if (isHidden) {
    els.debugMenu.removeAttribute("hidden");
  } else {
    els.debugMenu.setAttribute("hidden", "");
  }
  if (els.debugMenuButton) {
    els.debugMenuButton.setAttribute("aria-expanded", String(!isHidden));
  }
  renderDebugMenu();
}

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
  const key = game.id ?? JSON.stringify(game);
  const missingFields = [];

  if (!game.id) missingFields.push("id");
  if (!game.title) missingFields.push("title");
  if (!game.launchPath) missingFields.push("launchPath");

  if (missingFields.length) {
    if (!diagnostics.invalidGameKeys.has(key)) {
      diagnostics.invalidGameKeys.add(key);
      recordIssue("error", `Invalid game entry missing: ${missingFields.join(", ")}`, { game });
    }
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
  assessRosterHealth();
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

  if (filtered.length === 0) {
    debugHub.flag({
      code: "empty-results",
      severity: "warn",
      message: "Current filters returned no games",
      hint: "Use Clear filters to restore the full list",
    });
  } else {
    debugHub.clearFlag("empty-results");
  }

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
  debugHub.metric("render.duration", metrics.renderDuration);
  debugHub.metric("filter.duration", metrics.filterDuration);
  debugHub.metric("render.count", metrics.renderCount);
  debugHub.metric("render.cards", metrics.cardsRendered);
  updateCounters(filtered.length);
  updateFilterChips(filter);
  updateMetricsPanel();
  updateSessionInsights();
  performHealthSweep();
  renderDebugMenu();
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
  debugHub.metric("session.lastInteraction", metrics.lastInteraction.toISOString());
  debugHub.incrementMetric("session.interactions", 1);
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

  if (metrics.errors > 0) {
    debugHub.flag({
      code: "session-errors",
      severity: "error",
      message: `${metrics.errors} errors captured`,
      hint: "Open the debug menu for details",
    });
  } else {
    debugHub.clearFlag("session-errors");
  }

  if (metrics.warnings > 0) {
    debugHub.flag({
      code: "session-warnings",
      severity: "warn",
      message: `${metrics.warnings} warnings recorded`,
      hint: "Review event log for potential soft failures",
    });
  } else {
    debugHub.clearFlag("session-warnings");
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
  if (els.debugMenuButton) {
    els.debugMenuButton.addEventListener("click", toggleDebugMenu);
  }
  if (els.debugCopyLogButton) {
    els.debugCopyLogButton.addEventListener("click", exportDebugLog);
  }
  if (els.debugSimulateErrorButton) {
    els.debugSimulateErrorButton.addEventListener("click", simulateDebugError);
  }
  if (els.debugHealthCheckButton) {
    els.debugHealthCheckButton.addEventListener("click", () => {
      recordIssue("info", "Manual health sweep triggered");
      performHealthSweep();
    });
  }
  if (els.debugClearFlagsButton) {
    els.debugClearFlagsButton.addEventListener("click", clearDebugFlags);
  }
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
  els.debugMenu = safeGetElement("debugMenu");
  els.debugMenuButton = safeGetElement("debugMenuButton");
  els.debugStatus = safeGetElement("debugStatus");
  els.debugIssueCount = safeGetElement("debugIssueCount");
  els.debugFlagCount = safeGetElement("debugFlagCount");
  els.debugFlagList = safeGetElement("debugFlagList");
  els.debugLastIssue = safeGetElement("debugLastIssue");
  els.debugLastError = safeGetElement("debugLastError");
  els.debugLatency = safeGetElement("debugLatency");
  els.debugUptime = safeGetElement("debugUptime");
  els.debugCopyLogButton = safeGetElement("debugCopyLogButton");
  els.debugSimulateErrorButton = safeGetElement("debugSimulateErrorButton");
  els.debugHealthCheckButton = safeGetElement("debugHealthCheckButton");
  els.debugClearFlagsButton = safeGetElement("debugClearFlagsButton");
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

const isPlaceholderGame = (game) => {
  const launch = (game.launchPath ?? "").toLowerCase();
  const tags = (game.tags ?? []).map((tag) => tag.toLowerCase());
  return launch.includes("coming-soon") || launch.includes("sample") || tags.includes("placeholder");
};

const assessRosterHealth = () => {
  const placeholderGames = [];
  const playableGames = [];
  const duplicateIds = new Set();
  const seenIds = new Set();

  games.forEach((game) => {
    if (!validateGame(game)) return;
    if (seenIds.has(game.id)) {
      duplicateIds.add(game.id);
    }
    seenIds.add(game.id);

    if (isPlaceholderGame(game)) {
      placeholderGames.push(game);
    } else {
      playableGames.push(game);
    }
  });

  debugHub.metric("roster.total", games.length);
  debugHub.metric("roster.playable", playableGames.length);
  debugHub.metric("roster.placeholder", placeholderGames.length);
  debugHub.metric("roster.duplicates", duplicateIds.size);

  if (!playableGames.length) {
    if (!diagnostics.emptyRosterNotified) {
      diagnostics.emptyRosterNotified = true;
      recordIssue("error", "No playable games are available in the roster.");
    }
    debugHub.flag({
      code: "roster-empty",
      severity: "error",
      message: "Roster has no playable games",
      hint: "Add at least one launchable entry in scripts/games.js",
    });
  } else {
    diagnostics.emptyRosterNotified = false;
    debugHub.clearFlag("roster-empty");
  }

  if (placeholderGames.length) {
    if (!diagnostics.placeholderNotified) {
      diagnostics.placeholderNotified = true;
      recordIssue(
        "warn",
        `${placeholderGames.length} placeholder or stubbed launch paths detected`,
        { placeholders: placeholderGames.map((game) => game.id) }
      );
    }
    debugHub.flag({
      code: "placeholder-launch",
      severity: "warn",
      message: `${placeholderGames.length} games still point to placeholder content`,
      hint: "Update launchPath to the actual build before shipping",
    });
  } else {
    diagnostics.placeholderNotified = false;
    debugHub.clearFlag("placeholder-launch");
  }

  if (duplicateIds.size) {
    if (!diagnostics.duplicateNotified) {
      diagnostics.duplicateNotified = true;
      recordIssue("warn", `Duplicate ids detected in roster: ${Array.from(duplicateIds).join(", ")}`);
    }
    debugHub.flag({
      code: "duplicate-ids",
      severity: "warn",
      message: `Duplicate ids detected: ${Array.from(duplicateIds).join(", ")}`,
      hint: "Ensure each game id is unique to avoid overwriting cards",
    });
  } else {
    diagnostics.duplicateNotified = false;
    debugHub.clearFlag("duplicate-ids");
  }
};

const bootstrap = () => {
  captureElements();
  debugHub.subscribe(() => renderDebugMenu());
  loadPreferences();
  bindEvents();
  assessRosterHealth();
  renderGames();
  updateSessionInsights();
  renderDebugMenu();
};

window.addEventListener("DOMContentLoaded", bootstrap);

// expose metrics for future debugging
window.__gameHubMetrics = metrics;
