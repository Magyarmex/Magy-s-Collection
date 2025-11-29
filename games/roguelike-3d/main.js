const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusList = document.getElementById("statusList");
const logView = document.getElementById("runtimeLog");
const metricsList = document.getElementById("metrics");
const phaseBadge = document.getElementById("phaseBadge");
const toast = document.getElementById("toast");
const pauseOverlay = document.getElementById("pauseOverlay");

const hudElements = {
  health: document.getElementById("healthValue"),
  armor: document.getElementById("armorValue"),
  ammo: document.getElementById("ammoValue"),
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
  shotsFired: 0,
};

const statuses = [
  { label: "Initialize render surface", state: "ready" },
  { label: "Hook up camera + controls", state: "ready" },
  { label: "Seed dungeon slices", state: "ready" },
  { label: "Spawn demons + fiends", state: "ready" },
  { label: "Wire projectile + ray hits", state: "ready" },
  { label: "Relic drafting + pickups", state: "ready" },
  { label: "Debug metrics + error traps", state: "ready" },
];

const world = { width: 18, height: 18, grid: [] };

const palette = {
  walls: ["#5a4c72", "#3d2c4f", "#2f364f", "#4b313a"],
  sky: "#121018",
  floor: "#201b2c",
  crosshair: "#e0d0ff",
  muzzle: "#ffdd55",
};

const input = {
  keys: new Set(),
  mouseDeltaX: 0,
  fireHeld: false,
  paused: false,
  locked: false,
};

const player = {
  x: 2.5,
  y: 2.5,
  dirX: 1,
  dirY: 0,
  planeX: 0,
  planeY: 0.66,
  speed: 3.4,
  health: 100,
  armor: 50,
  ammo: 60,
  maxHealth: 100,
  weaponCooldown: 0,
  fireRate: 0.16,
  damage: 30,
  sprint: 1.4,
  dashCooldown: 0,
  dashTimer: 0,
  dashRecharge: 3.5,
};

const game = {
  running: false,
  lastTime: 0,
  zBuffer: new Array(canvas.width).fill(0),
  enemies: [],
  projectiles: [],
  loot: [],
  wave: 1,
  score: 0,
  relics: [],
  awaitingRelic: false,
};

const enemyCatalog = {
  imp: { health: 70, speed: 1.8, color: "#ef6b6b", attackDelay: 1.4, damage: 12 },
  knight: { health: 150, speed: 1.2, color: "#7dd0ff", attackDelay: 1.8, damage: 20 },
  wraith: { health: 110, speed: 2.6, color: "#d59bff", attackDelay: 1.2, damage: 10 },
};

const relicPool = [
  { id: "rapid", name: "Rapid Volley", detail: "Fire 20% faster", apply: () => (player.fireRate *= 0.8) },
  { id: "ward", name: "Wardsteel", detail: "+25 armor", apply: () => (player.armor = Math.min(player.armor + 25, 100)) },
  { id: "magnet", name: "Soul Magnet", detail: "+1 pickup range", apply: () => game.pickupRadius = (game.pickupRadius || 1) + 1 },
  { id: "ferocity", name: "Ferocity", detail: "+25% damage", apply: () => (player.damage *= 1.25) },
  { id: "celerity", name: "Celerity", detail: "+10% speed", apply: () => (player.speed *= 1.1) },
];

game.pickupRadius = 1.2;

const random = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
  setTimeout(() => toast.classList.remove("show"), 2600);
};

const recordWarning = (message, data) => {
  metrics.warnings.push({ message, data, at: performance.now() });
  logEvent(message, "warn");
  renderMetrics();
};

const recordError = (message, data) => {
  metrics.errors.push({ message, data, at: performance.now() });
  logEvent(message, "error");
  renderMetrics();
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
    ["Shots", metrics.shotsFired],
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
    warn: recordWarning,
    error: recordError,
  };
};

const initGrid = () => {
  world.grid = Array.from({ length: world.height }, (_, y) =>
    Array.from({ length: world.width }, (_, x) => {
      if (x === 0 || y === 0 || x === world.width - 1 || y === world.height - 1) return 1;
      return Math.random() < 0.07 ? 1 : 0;
    }),
  );
};

const isWall = (x, y) => {
  const gx = Math.floor(x);
  const gy = Math.floor(y);
  if (gx < 0 || gy < 0 || gx >= world.width || gy >= world.height) return true;
  return world.grid[gy][gx] !== 0;
};

const findOpenCell = () => {
  for (let i = 0; i < 64; i++) {
    const x = Math.floor(random(2, world.width - 2));
    const y = Math.floor(random(2, world.height - 2));
    if (!isWall(x + 0.1, y + 0.1)) return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: 2.5, y: 2.5 };
};

const resetPlayer = () => {
  player.x = 2.5;
  player.y = 2.5;
  player.dirX = 1;
  player.dirY = 0;
  player.planeX = 0;
  player.planeY = 0.66;
  player.health = player.maxHealth;
  player.armor = 50;
  player.ammo = 80;
  player.weaponCooldown = 0;
  player.dashCooldown = 0;
  player.dashTimer = 0;
};

const spawnWave = () => {
  const packSize = 3 + game.wave;
  const roster = [];
  for (let i = 0; i < packSize; i++) {
    const roll = Math.random();
    const type = roll > 0.75 ? "knight" : roll > 0.4 ? "wraith" : "imp";
    const spot = findOpenCell();
    roster.push({
      type,
      x: spot.x,
      y: spot.y,
      health: enemyCatalog[type].health,
      attackTimer: 0,
      anim: 0,
    });
  }
  game.enemies.push(...roster);
  hudElements.enemies.textContent = game.enemies.length;
  logEvent(`Wave ${game.wave} spawns ${roster.length} foes.`);
};

const addLoot = (x, y, type) => {
  game.loot.push({ x, y, type, ttl: 20 });
};

const startRun = () => {
  try {
    initGrid();
    resetPlayer();
    game.enemies = [];
    game.projectiles = [];
    game.loot = [];
    game.wave = 1;
    game.score = 0;
    game.relics = [];
    game.awaitingRelic = false;
    metrics.kills = 0;
    metrics.heals = 0;
    metrics.hitsTaken = 0;
    metrics.shotsFired = 0;
    hudElements.wave.textContent = game.wave;
    hudElements.score.textContent = game.score;
    hudElements.relics.textContent = game.relics.length;
    phaseBadge.textContent = "Running";
    mark("runStart");
    spawnWave();
    game.running = true;
    game.lastTime = performance.now();
    requestAnimationFrame(tick);
  } catch (error) {
    recordError("Failed to start run", { message: error.message, stack: error.stack });
    showToast("Run failed to start");
  }
};

const tryMove = (dx, dy, dt) => {
  const step = dt * player.speed;
  const nx = player.x + dx * step;
  const ny = player.y + dy * step;
  if (!isWall(nx, player.y)) player.x = nx;
  if (!isWall(player.x, ny)) player.y = ny;
};

const handleInput = (dt) => {
  const moveX = (input.keys.has("KeyD") ? 1 : 0) - (input.keys.has("KeyA") ? 1 : 0);
  const moveY = (input.keys.has("KeyW") ? 1 : 0) - (input.keys.has("KeyS") ? 1 : 0);
  const speedMod = input.keys.has("ShiftLeft") ? player.sprint : 1;

  if (moveY !== 0 || moveX !== 0) {
    const forwardX = player.dirX * moveY + -player.dirY * moveX;
    const forwardY = player.dirY * moveY + player.dirX * moveX;
    const len = Math.hypot(forwardX, forwardY) || 1;
    tryMove(forwardX / len * speedMod, forwardY / len * speedMod, dt);
  }

  if (input.mouseDeltaX !== 0) {
    const rot = input.mouseDeltaX * 0.0025;
    const oldDirX = player.dirX;
    player.dirX = player.dirX * Math.cos(rot) - player.dirY * Math.sin(rot);
    player.dirY = oldDirX * Math.sin(rot) + player.dirY * Math.cos(rot);
    const oldPlaneX = player.planeX;
    player.planeX = player.planeX * Math.cos(rot) - player.planeY * Math.sin(rot);
    player.planeY = oldPlaneX * Math.sin(rot) + player.planeY * Math.cos(rot);
    input.mouseDeltaX = 0;
  }

  if (player.dashCooldown > 0) player.dashCooldown -= dt;
  if (input.keys.has("Space") && player.dashCooldown <= 0) {
    const dashDist = 2.5;
    const nx = player.x + player.dirX * dashDist;
    const ny = player.y + player.dirY * dashDist;
    if (!isWall(nx, ny)) {
      player.x = nx;
      player.y = ny;
      player.dashCooldown = player.dashRecharge;
      hudElements.speed.textContent = `${(player.speed * player.sprint).toFixed(1)}x`;
      showToast("Dash!");
    }
  }
};

const fire = () => {
  if (player.weaponCooldown > 0 || player.ammo <= 0) return;
  player.weaponCooldown = player.fireRate;
  player.ammo -= 1;
  metrics.shotsFired += 1;
  const speed = 10;
  game.projectiles.push({
    x: player.x,
    y: player.y,
    dx: player.dirX * speed,
    dy: player.dirY * speed,
    damage: player.damage,
    owner: "player",
    ttl: 4,
  });
  hudElements.ammo.textContent = player.ammo;
};

const spawnEnemyShot = (enemy, targetX, targetY) => {
  const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  const speed = 6;
  game.projectiles.push({
    x: enemy.x,
    y: enemy.y,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    damage: enemyCatalog[enemy.type].damage,
    owner: "enemy",
    ttl: 5,
  });
};

const updateProjectiles = (dt) => {
  for (const proj of game.projectiles) {
    proj.x += proj.dx * dt;
    proj.y += proj.dy * dt;
    proj.ttl -= dt;
    if (isWall(proj.x, proj.y)) proj.ttl = 0;
  }

  game.projectiles = game.projectiles.filter((proj) => {
    if (proj.ttl <= 0) return false;

    if (proj.owner === "player") {
      for (const enemy of game.enemies) {
        const d = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (d < 0.5) {
          enemy.health -= proj.damage;
          proj.ttl = 0;
          if (enemy.health <= 0) {
            metrics.kills += 1;
            game.score += 50;
            hudElements.score.textContent = game.score;
            addLoot(enemy.x, enemy.y, Math.random() > 0.5 ? "health" : "ammo");
          }
          break;
        }
      }
    } else if (proj.owner === "enemy") {
      const d = Math.hypot(player.x - proj.x, player.y - proj.y);
      if (d < 0.4) {
        const damage = proj.damage;
        const absorbed = Math.min(player.armor, damage * 0.6);
        player.armor = clamp(player.armor - absorbed, 0, 120);
        player.health -= damage - absorbed;
        metrics.hitsTaken += 1;
        hudElements.health.textContent = Math.max(0, Math.round(player.health));
        hudElements.armor.textContent = Math.round(player.armor);
        proj.ttl = 0;
        if (player.health <= 0) {
          endRun("You were shattered in the Rift.");
          return false;
        }
      }
    }
    return proj.ttl > 0;
  });
};

const updateEnemies = (dt) => {
  for (const enemy of game.enemies) {
    enemy.attackTimer -= dt;
    enemy.anim += dt;
    const toPlayerX = player.x - enemy.x;
    const toPlayerY = player.y - enemy.y;
    const dist = Math.hypot(toPlayerX, toPlayerY);
    if (dist > 0.6) {
      const speed = enemyCatalog[enemy.type].speed;
      const nx = (toPlayerX / dist) * speed * dt;
      const ny = (toPlayerY / dist) * speed * dt;
      if (!isWall(enemy.x + nx, enemy.y)) enemy.x += nx;
      if (!isWall(enemy.x, enemy.y + ny)) enemy.y += ny;
    }
    if (dist < 8 && enemy.attackTimer <= 0) {
      spawnEnemyShot(enemy, player.x, player.y);
      enemy.attackTimer = enemyCatalog[enemy.type].attackDelay + Math.random() * 0.4;
    }
  }
  game.enemies = game.enemies.filter((enemy) => enemy.health > 0);
  hudElements.enemies.textContent = game.enemies.length;
};

const updateLoot = (dt) => {
  for (const drop of game.loot) drop.ttl -= dt;
  game.loot = game.loot.filter((drop) => drop.ttl > 0);

  for (const drop of game.loot) {
    const d = Math.hypot(drop.x - player.x, drop.y - player.y);
    if (d < game.pickupRadius) {
      if (drop.type === "health") {
        const heal = 25;
        player.health = clamp(player.health + heal, 0, player.maxHealth);
        metrics.heals += 1;
        hudElements.health.textContent = player.health;
      }
      if (drop.type === "ammo") {
        player.ammo += 12;
        hudElements.ammo.textContent = player.ammo;
      }
      if (drop.type === "relic") {
        game.relics.push(drop.detail);
        drop.detail.apply();
        hudElements.relics.textContent = game.relics.length;
        showToast(`${drop.detail.name} bound.`);
      }
      drop.ttl = 0;
    }
  }
  game.loot = game.loot.filter((drop) => drop.ttl > 0);
};

const checkWaveClear = () => {
  if (game.enemies.length === 0 && !game.awaitingRelic) {
    game.wave += 1;
    hudElements.wave.textContent = game.wave;
    game.awaitingRelic = true;
    promptRelic();
  }
};

const promptRelic = () => {
  const options = [...relicPool].sort(() => 0.5 - Math.random()).slice(0, 3);
  const choice = options[Math.floor(Math.random() * options.length)];
  addLoot(player.x + 0.5, player.y, "relic");
  game.loot[game.loot.length - 1].detail = choice;
  logEvent(`Relic available: ${choice.name}`);
  game.awaitingRelic = false;
  spawnWave();
};

const updateHud = () => {
  hudElements.health.textContent = Math.round(player.health);
  hudElements.armor.textContent = Math.round(player.armor);
  hudElements.ammo.textContent = player.ammo;
  hudElements.fireRate.textContent = `${(1 / player.fireRate).toFixed(1)}rps`;
  hudElements.damage.textContent = `${player.damage.toFixed(0)}`;
  hudElements.speed.textContent = `${player.speed.toFixed(1)}x`;
  hudElements.health.parentElement.style.setProperty("--fill", `${(player.health / player.maxHealth) * 100}%`);
  hudElements.armor.parentElement.style.setProperty("--fill", `${(player.armor / 120) * 100}%`);
  hudElements.ammo.parentElement.style.setProperty("--fill", `${Math.min(100, (player.ammo / 120) * 100)}%`);
};

const endRun = (message) => {
  game.running = false;
  phaseBadge.textContent = "Down";
  showToast(message);
  logEvent(message, "error");
};

const renderBackground = () => {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
};

const castWalls = () => {
  for (let x = 0; x < canvas.width; x++) {
    const cameraX = (2 * x) / canvas.width - 1;
    const rayDirX = player.dirX + player.planeX * cameraX;
    const rayDirY = player.dirY + player.planeY * cameraX;

    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);

    const deltaDistX = Math.abs(1 / rayDirX || 1e9);
    const deltaDistY = Math.abs(1 / rayDirY || 1e9);

    let sideDistX;
    let sideDistY;

    let stepX;
    let stepY;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (player.x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - player.x) * deltaDistX;
    }
    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (player.y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - player.y) * deltaDistY;
    }

    let hit = 0;
    let side = 0;

    while (hit === 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (isWall(mapX, mapY)) hit = 1;
    }

    const perpWallDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
    game.zBuffer[x] = perpWallDist;
    const lineHeight = Math.floor(canvas.height / perpWallDist);
    const drawStart = Math.max(-lineHeight / 2 + canvas.height / 2, 0);
    const drawEnd = Math.min(lineHeight / 2 + canvas.height / 2, canvas.height);
    const color = palette.walls[(mapX + mapY) % palette.walls.length];
    ctx.fillStyle = side === 1 ? `${color}cc` : color;
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
  }
};

const renderSprites = () => {
  const sprites = [
    ...game.enemies.map((e) => ({ x: e.x, y: e.y, color: enemyCatalog[e.type].color, size: 0.9 })),
    ...game.projectiles.map((p) => ({ x: p.x, y: p.y, color: p.owner === "player" ? "#ffeb99" : "#ff6b9d", size: 0.3 })),
    ...game.loot.map((l) => ({ x: l.x, y: l.y, color: l.type === "health" ? "#6bffb5" : l.type === "ammo" ? "#ffd86b" : "#8bc2ff", size: 0.6 })),
  ];

  sprites.sort((a, b) => {
    const distA = (player.x - a.x) ** 2 + (player.y - a.y) ** 2;
    const distB = (player.x - b.x) ** 2 + (player.y - b.y) ** 2;
    return distB - distA;
  });

  for (const sprite of sprites) {
    const spriteX = sprite.x - player.x;
    const spriteY = sprite.y - player.y;
    const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
    const transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY);
    const transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY);
    if (transformY <= 0) continue;

    const spriteScreenX = Math.floor((canvas.width / 2) * (1 + transformX / transformY));
    const spriteHeight = Math.abs(Math.floor(canvas.height / transformY)) * sprite.size;
    const drawStartY = Math.max(-spriteHeight / 2 + canvas.height / 2, 0);
    const drawEndY = Math.min(spriteHeight / 2 + canvas.height / 2, canvas.height);
    const spriteWidth = spriteHeight;
    const drawStartX = Math.max(-spriteWidth / 2 + spriteScreenX, 0);
    const drawEndX = Math.min(spriteWidth / 2 + spriteScreenX, canvas.width);

    for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
      if (transformY > 0 && stripe > 0 && stripe < canvas.width && transformY < game.zBuffer[stripe]) {
        ctx.fillStyle = sprite.color;
        ctx.fillRect(stripe, drawStartY, 1, drawEndY - drawStartY);
      }
    }
  }
};

const renderCrosshair = () => {
  const x = canvas.width / 2;
  const y = canvas.height / 2;
  ctx.strokeStyle = palette.crosshair;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
};

const render = () => {
  renderBackground();
  castWalls();
  renderSprites();
  renderCrosshair();
};

const tick = (time) => {
  if (!game.running) return;
  const dt = Math.min((time - game.lastTime) / 1000, 0.05);
  game.lastTime = time;
  if (input.paused) {
    render();
    requestAnimationFrame(tick);
    return;
  }
  metrics.frames += 1;
  metrics.fps = 1 / dt;
  if (player.weaponCooldown > 0) player.weaponCooldown -= dt;

  handleInput(dt);
  if (input.fireHeld) fire();
  updateProjectiles(dt);
  updateEnemies(dt);
  updateLoot(dt);
  checkWaveClear();
  updateHud();
  render();

  requestAnimationFrame(tick);
};

const requestPointerLock = () => {
  canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
  if (canvas.requestPointerLock) canvas.requestPointerLock();
};

const onPointerLockChange = () => {
  input.locked = document.pointerLockElement === canvas;
  if (!input.locked) input.fireHeld = false;
};

const bindControls = () => {
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") {
      input.paused = !input.paused;
      pauseOverlay.classList.toggle("hidden", !input.paused);
      if (!input.paused) game.lastTime = performance.now();
    }
    if (input.paused) return;
    input.keys.add(e.code);
  });

  document.addEventListener("keyup", (e) => {
    input.keys.delete(e.code);
  });

  canvas.addEventListener("mousedown", (e) => {
    if (!input.locked) requestPointerLock();
    if (e.button === 0) input.fireHeld = true;
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.fireHeld = false;
  });

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", (e) => {
    if (!input.locked) return;
    input.mouseDeltaX += e.movementX;
  });
};

const updateStatusPills = () => {
  statuses.forEach((item) => (item.state = "ready"));
  renderStatuses();
};

const attachUI = () => {
  document.getElementById("startRun").addEventListener("click", () => {
    startRun();
    requestPointerLock();
  });
  document.getElementById("healthCheck").addEventListener("click", () => {
    recordWarning("Manual diagnostics trigger", { grid: world.grid.length });
    showToast("Diagnostics queued");
  });
  document.getElementById("clearLog").addEventListener("click", () => {
    logView.innerHTML = "";
    logEvent("Log cleared", "warn");
  });
};

const init = () => {
  renderStatuses();
  attachMetricsSurface();
  attachUI();
  bindControls();
  updateStatusPills();
  updateHud();
  render();
  logEvent("Arcane Rift: Doomcaster ready");
  hudElements.callout.textContent = "Click the viewport to lock mouse. WASD to move, LMB to fire.";
};

init();
