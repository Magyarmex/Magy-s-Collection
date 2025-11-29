const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusList = document.getElementById("statusList");
const logView = document.getElementById("runtimeLog");
const metricsList = document.getElementById("metrics");
const phaseBadge = document.getElementById("phaseBadge");
const toast = document.getElementById("toast");
const draftLayer = document.getElementById("perkDraft");
const draftOptions = document.getElementById("perkOptions");
const pauseOverlay = document.getElementById("pauseOverlay");

const hudElements = {
  health: document.getElementById("healthValue"),
  mana: document.getElementById("manaValue"),
  dash: document.getElementById("dashValue"),
  wave: document.getElementById("waveLabel"),
  score: document.getElementById("scoreLabel"),
  enemies: document.getElementById("enemyLabel"),
  relics: document.getElementById("relicLabel"),
  fireRate: document.getElementById("fireRateLabel"),
  damage: document.getElementById("damageLabel"),
  speed: document.getElementById("speedLabel"),
  callout: document.getElementById("callout"),
};

const metrics = {
  gameId: "arcane-rift",
  startedAt: performance.now(),
  marks: {},
  warnings: [],
  errors: [],
  frames: 0,
  fps: 0,
  hitsTaken: 0,
  heals: 0,
  kills: 0,
};

const statuses = [
  { label: "Initialize render surface", state: "ready" },
  { label: "Hook up camera + controls", state: "ready" },
  { label: "Seed dungeon slices", state: "ready" },
  { label: "Spawn ranged + melee enemies", state: "ready" },
  { label: "Wire projectile pooling", state: "ready" },
  { label: "Perk drafting + relic stacking", state: "ready" },
  { label: "Debug metrics + error traps", state: "ready" },
];

const world = { width: 960, height: 600 };

const input = {
  keys: new Set(),
  mouse: { x: world.width / 2, y: world.height / 2, down: false },
  paused: false,
};

const game = {
  running: false,
  lastTime: 0,
  wave: 1,
  score: 0,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  particles: [],
  loot: [],
  relics: [],
  perkQueue: [],
  player: null,
  awaitingDraft: false,
  fireCooldown: 0,
  dashCooldown: 0,
};

const perks = [
  {
    id: "rapid_fire",
    name: "Rapid Fire",
    detail: "Increase fire rate by 20%",
    apply: (player) => {
      player.modifiers.fireRate *= 1.2;
    },
  },
  {
    id: "overcharge",
    name: "Overcharge",
    detail: "+30% projectile damage",
    apply: (player) => {
      player.modifiers.damage *= 1.3;
    },
  },
  {
    id: "fleetfoot",
    name: "Fleetfoot",
    detail: "+15% movement speed",
    apply: (player) => {
      player.modifiers.speed *= 1.15;
    },
  },
  {
    id: "vitality",
    name: "Vitality",
    detail: "+20 max health and small heal",
    apply: (player) => {
      player.maxHealth += 20;
      player.health = Math.min(player.health + 20, player.maxHealth);
      metrics.heals += 1;
    },
  },
  {
    id: "manafont",
    name: "Manafont",
    detail: "+35% mana regen",
    apply: (player) => {
      player.modifiers.manaRegen *= 1.35;
    },
  },
  {
    id: "blink",
    name: "Shorter Dash",
    detail: "Reduce dash cooldown by 20%",
    apply: (player) => {
      player.modifiers.dash *= 0.8;
    },
  },
];

const random = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const formatTime = (timestamp) => `${(timestamp / 1000).toFixed(2)}s`;

const renderStatuses = () => {
  statusList.innerHTML = statuses
    .map(
      (item) => `
        <li data-state="${item.state}">
          <span class="status-dot" aria-hidden="true"></span>
          <span>${item.label}</span>
        </li>
      `,
    )
    .join("");
};

const logEvent = (message, level = "info") => {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.dataset.level = level;
  entry.innerHTML = `<time>${time}</time><span>${message}</span>`;
  logView.appendChild(entry);
  logView.scrollTop = logView.scrollHeight;
};

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
};

const mark = (label) => {
  metrics.marks[label] = performance.now();
  renderMetrics();
};

const renderMetrics = () => {
  const entries = [
    ["Started", formatTime(metrics.startedAt)],
    ["Run start", metrics.marks.runStart ? formatTime(metrics.marks.runStart) : "pending"],
    ["FPS", metrics.fps.toFixed(1)],
    ["Frames", metrics.frames],
    ["Kills", metrics.kills],
    ["Hits taken", metrics.hitsTaken],
    ["Heals", metrics.heals],
    ["Warnings", metrics.warnings.length],
    ["Errors", metrics.errors.length],
  ];

  metricsList.innerHTML = entries
    .map(
      ([label, value]) => `
      <div>
        <dt>${label}</dt>
        <dd>${value}</dd>
      </div>
    `,
    )
    .join("");
};

const attachMetricsSurface = () => {
  window.__gameHubMetrics = {
    metrics,
    stamp: mark,
    log: logEvent,
    reportWarning: (message) => {
      metrics.warnings.push({ message, at: performance.now() });
      logEvent(`⚠️ ${message}`, "warn");
      renderMetrics();
    },
    reportError: (message, meta = {}) => {
      metrics.errors.push({ message, at: performance.now(), meta });
      logEvent(`❌ ${message}`, "error");
      showToast(message);
      renderMetrics();
    },
  };
};

const updatePhase = (label, state = "active") => {
  phaseBadge.textContent = label;
  phaseBadge.dataset.state = state;
};

const clearLog = () => {
  logView.innerHTML = "";
  logEvent("Log cleared");
};

const resetGameState = () => {
  game.running = false;
  game.wave = 1;
  game.score = 0;
  game.enemies = [];
  game.projectiles = [];
  game.enemyProjectiles = [];
  game.particles = [];
  game.loot = [];
  game.relics = [];
  game.awaitingDraft = false;
  game.fireCooldown = 0;
  game.dashCooldown = 0;
  metrics.frames = 0;
  metrics.fps = 0;
  metrics.kills = 0;
  metrics.hitsTaken = 0;
  metrics.heals = 0;
  metrics.warnings = [];
  metrics.errors = [];
  metrics.startedAt = performance.now();
  metrics.marks = {};
  window.__gameHubMetrics.marks = metrics.marks;
};

const createPlayer = () => ({
  x: world.width / 2,
  y: world.height - 120,
  radius: 14,
  color: "#8b5cf6",
  speed: 240,
  maxHealth: 120,
  health: 120,
  mana: 100,
  maxMana: 100,
  dashTime: 0,
  dashDuration: 0.2,
  dashSpeed: 520,
  dashReady: true,
  invuln: 0,
  modifiers: {
    fireRate: 1,
    damage: 1,
    speed: 1,
    manaRegen: 24,
    dash: 1,
  },
});

const spawnEnemy = (wave) => {
  const type = Math.random() > 0.4 ? "brute" : "acolyte";
  const edge = Math.random() > 0.5 ? 0 : world.width;
  const x = edge === 0 ? -30 : world.width + 30;
  const y = random(60, world.height - 60);
  const baseHealth = type === "brute" ? 45 : 32;
  const baseSpeed = type === "brute" ? 80 : 95;

  return {
    type,
    x,
    y,
    radius: type === "brute" ? 16 : 14,
    speed: baseSpeed + wave * 2,
    health: baseHealth + wave * 4,
    fireCooldown: 0,
    alive: true,
    knockback: { x: 0, y: 0, decay: 8 },
  };
};

const spawnWave = () => {
  const count = 4 + Math.floor(game.wave * 1.5);
  for (let i = 0; i < count; i += 1) {
    game.enemies.push(spawnEnemy(game.wave));
  }
  window.__gameHubMetrics?.log(`Wave ${game.wave} spawned with ${count} foes.`);
  window.__gameHubMetrics?.stamp(`wave_${game.wave}_spawn`);
  updatePhase(`Wave ${game.wave}`, "active");
  hudElements.wave.textContent = game.wave;
};

const drawPlayer = (player) => {
  ctx.save();
  ctx.translate(player.x, player.y);
  const angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
  ctx.rotate(angle);
  ctx.fillStyle = player.dashTime > 0 ? "#99f6e4" : player.color;
  ctx.beginPath();
  ctx.moveTo(player.radius + 6, 0);
  ctx.lineTo(-player.radius, -player.radius * 0.8);
  ctx.lineTo(-player.radius, player.radius * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawEnemy = (enemy) => {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const color = enemy.type === "brute" ? "#f59e0b" : "#38bdf8";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawProjectiles = () => {
  ctx.fillStyle = "#c084fc";
  game.projectiles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#38bdf8";
  game.enemyProjectiles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawParticles = () => {
  game.particles.forEach((p) => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
};

const drawLoot = () => {
  game.loot.forEach((l) => {
    ctx.fillStyle = l.type === "heal" ? "#10b981" : "#7c3aed";
    ctx.beginPath();
    ctx.arc(l.x, l.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
};

const spawnParticles = (x, y, count, color) => {
  for (let i = 0; i < count; i += 1) {
    game.particles.push({
      x,
      y,
      vx: random(-80, 80),
      vy: random(-80, 80),
      radius: random(2, 4),
      life: 0.4,
      maxLife: 0.4,
      color,
    });
  }
};

const applyPerk = (perk) => {
  perk.apply(game.player);
  game.relics.push(perk.id);
  hudElements.relics.textContent = game.relics.length;
  hudElements.fireRate.textContent = `${game.player.modifiers.fireRate.toFixed(2)}x`;
  hudElements.damage.textContent = `${game.player.modifiers.damage.toFixed(2)}x`;
  hudElements.speed.textContent = `${game.player.modifiers.speed.toFixed(2)}x`;
};

const presentDraft = () => {
  game.awaitingDraft = true;
  draftLayer.classList.add("active");
  draftOptions.innerHTML = "";
  const options = [...perks].sort(() => 0.5 - Math.random()).slice(0, 3);
  options.forEach((perk) => {
    const btn = document.createElement("button");
    btn.className = "draft-option";
    btn.innerHTML = `<strong>${perk.name}</strong><p class="muted">${perk.detail}</p>`;
    btn.addEventListener("click", () => {
      applyPerk(perk);
      logEvent(`Relic chosen: ${perk.name}`);
      draftLayer.classList.remove("active");
      game.awaitingDraft = false;
      game.wave += 1;
      window.__gameHubMetrics?.stamp(`wave_${game.wave}_prepare`);
      spawnWave();
    });
    draftOptions.appendChild(btn);
  });
};

const updateHudBars = () => {
  const healthBar = document.querySelector(".bar.health");
  const manaBar = document.querySelector(".bar.mana");
  const dashBar = document.querySelector(".bar.dash");
  healthBar.style.setProperty("--fill", `${(game.player.health / game.player.maxHealth) * 100}%`);
  manaBar.style.setProperty("--fill", `${(game.player.mana / game.player.maxMana) * 100}%`);
  dashBar.style.setProperty("--fill", `${game.dashCooldown <= 0 ? 100 : 20}%`);
  hudElements.health.textContent = `${Math.round(game.player.health)}`;
  hudElements.mana.textContent = `${Math.round(game.player.mana)}`;
  hudElements.dash.textContent = game.dashCooldown <= 0 ? "Ready" : `${game.dashCooldown.toFixed(1)}s`;
  hudElements.score.textContent = game.score;
  hudElements.enemies.textContent = game.enemies.length;
};

const updateMetricsHeartbeat = (delta) => {
  metrics.frames += 1;
  metrics.fps = 1 / delta;
  if (metrics.frames % 60 === 0) {
    window.__gameHubMetrics?.log(`FPS sample: ${metrics.fps.toFixed(1)}`);
  }
  renderMetrics();
};

const handleInput = (player, delta) => {
  if (!player) return;
  let vx = 0;
  let vy = 0;
  if (input.keys.has("w")) vy -= 1;
  if (input.keys.has("s")) vy += 1;
  if (input.keys.has("a")) vx -= 1;
  if (input.keys.has("d")) vx += 1;
  const length = Math.hypot(vx, vy) || 1;
  const speed = player.speed * player.modifiers.speed;

  if (player.dashTime > 0) {
    player.dashTime -= delta;
  } else {
    player.x += (vx / length) * speed * delta;
    player.y += (vy / length) * speed * delta;
  }

  if (input.keys.has(" ") && game.dashCooldown <= 0) {
    player.dashTime = player.dashDuration;
    game.dashCooldown = 2.5 * player.modifiers.dash;
    player.invuln = 0.4;
    spawnParticles(player.x, player.y, 10, "#67e8f9");
    logEvent("Dash engaged");
  }

  player.invuln = Math.max(0, player.invuln - delta);
  game.dashCooldown = Math.max(0, game.dashCooldown - delta);

  player.x = clamp(player.x, player.radius + 6, world.width - player.radius - 6);
  player.y = clamp(player.y, player.radius + 6, world.height - player.radius - 6);
};

const fireProjectile = (player) => {
  if (!input.mouse.down) return;
  if (game.fireCooldown > 0) return;
  if (player.mana < 4) return;

  const angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
  const speed = 460;
  const projectile = {
    x: player.x + Math.cos(angle) * (player.radius + 4),
    y: player.y + Math.sin(angle) * (player.radius + 4),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    damage: 16 * player.modifiers.damage,
    life: 1.2,
  };
  player.mana = Math.max(0, player.mana - 4);
  game.projectiles.push(projectile);
  game.fireCooldown = 0.22 / player.modifiers.fireRate;
};

const updateProjectiles = (delta) => {
  game.fireCooldown = Math.max(0, game.fireCooldown - delta);
  game.projectiles = game.projectiles.filter((p) => {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.life -= delta;
    return p.life > 0 && p.x > -10 && p.x < world.width + 10 && p.y > -10 && p.y < world.height + 10;
  });
};

const updateEnemyProjectiles = (delta, player) => {
  game.enemyProjectiles = game.enemyProjectiles.filter((p) => {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.life -= delta;
    const hit = dist(p, player) < player.radius + p.radius;
    if (hit && player.invuln <= 0) {
      player.health -= p.damage;
      metrics.hitsTaken += 1;
      spawnParticles(player.x, player.y, 8, "#fecdd3");
      window.__gameHubMetrics?.reportWarning("Player hit by arcane bolt");
      hudElements.callout.textContent = "Keep moving!";
    }
    return p.life > 0 && p.x > -10 && p.x < world.width + 10 && p.y > -10 && p.y < world.height + 10 && !hit;
  });
};

const updateParticles = (delta) => {
  game.particles = game.particles.filter((p) => {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.life -= delta;
    return p.life > 0;
  });
};

const updateLoot = (delta, player) => {
  game.loot = game.loot.filter((l) => {
    l.life -= delta;
    const collected = dist(l, player) < player.radius + 8;
    if (collected) {
      if (l.type === "heal") {
        player.health = clamp(player.health + 18, 0, player.maxHealth);
        metrics.heals += 1;
        hudElements.callout.textContent = "Armor patched.";
      } else {
        player.mana = clamp(player.mana + 24, 0, player.maxMana);
      }
      spawnParticles(l.x, l.y, 6, "#34d399");
      game.score += 15;
    }
    return l.life > 0 && !collected;
  });
};

const tickPlayerRegen = (player, delta) => {
  player.mana = clamp(player.mana + player.modifiers.manaRegen * delta, 0, player.maxMana);
};

const enemyAI = (enemy, player, delta) => {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const speed = enemy.speed;
  enemy.x += Math.cos(angle) * speed * delta + enemy.knockback.x * delta;
  enemy.y += Math.sin(angle) * speed * delta + enemy.knockback.y * delta;
  enemy.knockback.x *= Math.exp(-enemy.knockback.decay * delta);
  enemy.knockback.y *= Math.exp(-enemy.knockback.decay * delta);

  enemy.x = clamp(enemy.x, enemy.radius + 6, world.width - enemy.radius - 6);
  enemy.y = clamp(enemy.y, enemy.radius + 6, world.height - enemy.radius - 6);

  if (enemy.type === "acolyte") {
    enemy.fireCooldown -= delta;
    if (enemy.fireCooldown <= 0) {
      const boltSpeed = 280 + game.wave * 4;
      game.enemyProjectiles.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * boltSpeed,
        vy: Math.sin(angle) * boltSpeed,
        radius: 4,
        life: 3,
        damage: 10,
      });
      enemy.fireCooldown = Math.max(0.7 - game.wave * 0.02, 0.35);
    }
  }
};

const resolveHits = (player) => {
  game.enemies.forEach((enemy) => {
    game.projectiles.forEach((p) => {
      if (!enemy.alive) return;
      const hit = dist(enemy, p) < enemy.radius + p.radius;
      if (hit) {
        enemy.health -= p.damage;
        enemy.knockback.x += p.vx * 0.02;
        enemy.knockback.y += p.vy * 0.02;
        p.life = -1;
        if (enemy.health <= 0) {
          enemy.alive = false;
          metrics.kills += 1;
          game.score += 50 + game.wave * 5;
          spawnParticles(enemy.x, enemy.y, 10, "#e0f2fe");
          if (Math.random() < 0.35) {
            game.loot.push({ x: enemy.x, y: enemy.y, type: Math.random() > 0.5 ? "heal" : "mana", life: 8 });
          }
        }
      }
    });
  });

  game.enemies = game.enemies.filter((e) => e.alive);
};

const handleEnemyCollisions = (player, delta) => {
  game.enemies.forEach((enemy) => {
    const touching = dist(enemy, player) < enemy.radius + player.radius;
    if (touching && player.invuln <= 0) {
      player.health -= 12;
      player.invuln = 0.8;
      metrics.hitsTaken += 1;
      enemy.knockback.x += (enemy.x - player.x) * 2;
      enemy.knockback.y += (enemy.y - player.y) * 2;
      spawnParticles(player.x, player.y, 8, "#fecdd3");
      hudElements.callout.textContent = "Armor compromised!";
      window.__gameHubMetrics?.reportWarning("Player collided with brute");
    }
  });
};

const checkWaveCompletion = () => {
  if (game.enemies.length === 0 && !game.awaitingDraft) {
    window.__gameHubMetrics?.log(`Wave ${game.wave} cleared.`);
    window.__gameHubMetrics?.stamp(`wave_${game.wave}_clear`);
    game.awaitingDraft = true;
    presentDraft();
  }
};

const renderBackground = () => {
  const gradient = ctx.createRadialGradient(world.width / 2, world.height / 2, 80, world.width / 2, world.height / 2, 520);
  gradient.addColorStop(0, "rgba(124, 58, 237, 0.14)");
  gradient.addColorStop(1, "rgba(5, 7, 18, 1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, world.width, world.height);
};

const render = () => {
  ctx.clearRect(0, 0, world.width, world.height);
  renderBackground();
  drawLoot();
  drawParticles();
  drawProjectiles();
  game.enemies.forEach(drawEnemy);
  if (game.player) drawPlayer(game.player);
};

const update = (delta) => {
  const player = game.player;
  if (!player) return;
  handleInput(player, delta);
  fireProjectile(player);
  updateProjectiles(delta);
  updateEnemyProjectiles(delta, player);
  updateParticles(delta);
  updateLoot(delta, player);
  game.enemies.forEach((enemy) => enemyAI(enemy, player, delta));
  resolveHits(player);
  handleEnemyCollisions(player, delta);
  tickPlayerRegen(player, delta);
  checkWaveCompletion();
  updateHudBars();
  if (player.health <= 0) {
    game.running = false;
    updatePhase("Down", "alert");
    showToast("Run failed. Tap start to try again.");
    logEvent("Player downed. Run over.", "error");
  }
};

const gameLoop = (timestamp) => {
  if (!game.running) return;
  const delta = Math.min((timestamp - game.lastTime) / 1000, 0.05);
  game.lastTime = timestamp;

  if (!input.paused && !game.awaitingDraft) {
    update(delta);
    render();
    updateMetricsHeartbeat(delta);
  }

  requestAnimationFrame(gameLoop);
};

const runHealthCheck = () => {
  logEvent("Diagnostics: verifying surfaces + metrics");
  if (!window.__gameHubMetrics) {
    showToast("Metrics surface missing");
    metrics.errors.push({ message: "Metrics surface missing", at: performance.now() });
  }
  const viewportExists = !!document.getElementById("renderSurface");
  if (!viewportExists) {
    window.__gameHubMetrics?.reportError("Render surface missing from DOM");
  } else {
    window.__gameHubMetrics?.reportWarning("Render surface present. Ensure canvas bounds match viewport.");
  }
  const canvasBound = canvas.getBoundingClientRect();
  if (canvasBound.width < 200) {
    window.__gameHubMetrics?.reportWarning("Canvas appears small; check responsive layout.");
  }
};

const registerGlobalErrorTrap = () => {
  window.addEventListener("error", (event) => {
    window.__gameHubMetrics?.reportError(`Unhandled error: ${event.message}`, { source: event.filename });
  });

  window.addEventListener("unhandledrejection", (event) => {
    window.__gameHubMetrics?.reportError(`Unhandled promise rejection: ${event.reason}`);
  });
};

const bootstrap = () => {
  renderStatuses();
  attachMetricsSurface();
  mark("domReady");
  logEvent("UI loaded. Metrics surface attached.");
  updatePhase("Idle");
  renderMetrics();
  renderBackground();
};

const startRun = () => {
  resetGameState();
  game.player = createPlayer();
  hudElements.callout.textContent = "Stay mobile. Relics await.";
  updateHudBars();
  mark("runStart");
  logEvent("Run started. Spawning initial wave...");
  game.running = true;
  game.lastTime = performance.now();
  spawnWave();
  requestAnimationFrame(gameLoop);
};

const togglePause = () => {
  if (!game.running || game.awaitingDraft) return;
  input.paused = !input.paused;
  pauseOverlay.classList.toggle("hidden", !input.paused);
  updatePhase(input.paused ? "Paused" : `Wave ${game.wave}`, input.paused ? "alert" : "active");
};

const wireInput = () => {
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "p") {
      togglePause();
      return;
    }
    input.keys.add(e.key.toLowerCase());
  });

  window.addEventListener("keyup", (e) => {
    input.keys.delete(e.key.toLowerCase());
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = ((e.clientX - rect.left) / rect.width) * world.width;
    input.mouse.y = ((e.clientY - rect.top) / rect.height) * world.height;
  });

  canvas.addEventListener("mousedown", () => {
    input.mouse.down = true;
  });

  window.addEventListener("mouseup", () => {
    input.mouse.down = false;
  });
};

const init = () => {
  bootstrap();
  registerGlobalErrorTrap();
  wireInput();
  document.getElementById("startRun").addEventListener("click", startRun);
  document.getElementById("healthCheck").addEventListener("click", runHealthCheck);
  document.getElementById("clearLog").addEventListener("click", clearLog);
};

init();
