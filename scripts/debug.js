const normalizeLevel = (level) => {
  if (!level) return "info";
  const lower = String(level).toLowerCase();
  if (["info", "warn", "error", "debug"].includes(lower)) return lower;
  return "info";
};

export class DebugHub {
  constructor() {
    this.issues = [];
    this.flags = [];
    this.metrics = {
      startedAt: performance.now(),
      info: 0,
      warn: 0,
      error: 0,
      total: 0,
    };
    this.subscribers = new Set();
    this.globalHandlersAttached = false;
  }

  record(level, message, data = null) {
    const normalizedLevel = normalizeLevel(level);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      level: normalizedLevel,
      message,
      data,
    };
    this.issues.push(entry);
    this.metrics[normalizedLevel] = (this.metrics[normalizedLevel] ?? 0) + 1;
    this.metrics.total = (this.metrics.total ?? 0) + 1;
    this.emit("issue", entry);
    return entry;
  }

  flag({ code, severity = "warn", message, hint = "", data = null }) {
    const normalizedSeverity = normalizeLevel(severity);
    const flag = {
      code: code ?? `flag-${this.flags.length + 1}`,
      severity: normalizedSeverity,
      message,
      hint,
      data,
      createdAt: new Date().toISOString(),
    };
    const existingIndex = this.flags.findIndex((entry) => entry.code === flag.code);
    if (existingIndex >= 0) {
      this.flags.splice(existingIndex, 1, flag);
    } else {
      this.flags.push(flag);
    }
    this.emit("flag", flag);
    return flag;
  }

  clearFlag(code) {
    const initialLength = this.flags.length;
    this.flags = this.flags.filter((flag) => flag.code !== code);
    if (initialLength !== this.flags.length) {
      this.emit("flag:cleared", { code });
    }
  }

  metric(key, value) {
    this.metrics[key] = value;
    this.emit("metric", { key, value });
    return value;
  }

  incrementMetric(key, amount = 1) {
    const current = Number(this.metrics[key]) || 0;
    return this.metric(key, current + amount);
  }

  guard(label, action, fallback = null) {
    try {
      return action();
    } catch (error) {
      this.record("error", `${label} failed`, { message: error?.message, stack: error?.stack });
      if (typeof fallback === "function") return fallback(error);
      return fallback;
    }
  }

  snapshot() {
    const counters = {
      info: this.metrics.info ?? 0,
      warn: this.metrics.warn ?? 0,
      error: this.metrics.error ?? 0,
      total: this.metrics.total ?? 0,
    };
    const lastIssue = this.issues[this.issues.length - 1] ?? null;
    const lastError = [...this.issues].reverse().find((issue) => issue.level === "error") ?? null;
    return {
      counters,
      flags: [...this.flags],
      issues: [...this.issues],
      metrics: { ...this.metrics },
      lastIssue,
      lastError,
      startedAt: this.metrics.startedAt,
    };
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  emit(type, payload) {
    const snapshot = this.snapshot();
    this.subscribers.forEach((listener) => listener({ type, payload, snapshot }));
  }

  attachGlobalHandlers() {
    if (this.globalHandlersAttached) return;
    window.addEventListener("error", (event) => {
      this.record("error", event.message, {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.record("error", `Unhandled rejection: ${event.reason}`);
    });

    this.globalHandlersAttached = true;
  }
}

export const debugHub = new DebugHub();
debugHub.attachGlobalHandlers();
window.__debugHub = debugHub;
