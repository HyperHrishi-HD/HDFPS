import * as THREE from "three";

const canvas = document.getElementById("view");
const hud = document.getElementById("hud");
const menu = document.getElementById("menu");
const pause = document.getElementById("pause");
const respawn = document.getElementById("respawn");
const healthFill = document.getElementById("health-fill");
const ammoFill = document.getElementById("ammo-fill");
const ammoText = document.getElementById("ammo-text");
const weaponName = document.getElementById("weapon-name");
const reloadLabel = document.getElementById("reload-label");
const killsEl = document.getElementById("kills");
const hitMarker = document.getElementById("hit-marker");
const vignette = document.getElementById("damage-vignette");
const killFeed = document.getElementById("kill-feed");
const respawnMsg = document.getElementById("respawn-msg");
const nameInput = document.getElementById("player-name");
const playBtn = document.getElementById("play");
const resumeBtn = document.getElementById("resume");
const pauseMenuBtn = document.getElementById("pause-menu");
const sensSlider = document.getElementById("sens");
const invertToggle = document.getElementById("invert-y");

const savedName = localStorage.getItem("hdfps-name") || "Player";
nameInput.value = savedName;

const WEAPONS = {
  rifle: {
    name: "ASSAULT RIFLE",
    mag: 30,
    interval: 0.1,
    damage: 14,
    spread: 0.012,
    pellets: 1,
    range: 120,
    recoil: 0.55,
    color: 0x5aa0d6,
  },
  shotgun: {
    name: "SHOTGUN",
    mag: 10,
    interval: 0.7,
    damage: 11,
    spread: 0.085,
    pellets: 8,
    range: 28,
    recoil: 1.2,
    color: 0xc9a227,
  },
};

const BOT_NAMES = ["Rook", "Nyx", "Vesper", "Quark", "Helix", "Mara", "Ion", "Wraith"];

const state = {
  running: false,
  paused: false,
  dead: false,
  weaponKey: "rifle",
  playerName: savedName,
  kills: 0,
  health: 100,
  ammo: 30,
  reloading: false,
  reloadT: 0,
  cooldown: 0,
  yaw: 0,
  pitch: 0,
  vel: new THREE.Vector3(),
  onGround: false,
  sprint: false,
  respawnT: 0,
  sensitivity: Number(localStorage.getItem("hdfps-sens") || 3.7),
  invertY: localStorage.getItem("hdfps-inverty") === "1",
  move: { x: 0, z: 0 },
  lookDelta: { x: 0, y: 0 },
  fireHeld: false,
  jumpQueued: false,
  reloadQueued: false,
  bob: 0,
};

sensSlider.value = String(state.sensitivity);
invertToggle.checked = state.invertY;

const keys = new Set();
const colliders = [];
const actors = [];
const decals = [];
const audio = createAudio();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1018);
scene.fog = new THREE.FogExp2(0x0b1018, 0.018);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 220);
const clock = new THREE.Clock();
const tmp = {
  v: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  ray: new THREE.Raycaster(),
  color: new THREE.Color(),
};

const player = {
  height: 1.7,
  radius: 0.38,
  object: new THREE.Object3D(),
};
player.object.position.set(0, 2, 14);
scene.add(player.object);
player.object.add(camera);
camera.position.set(0, 1.55, 0);

const gun = createViewmodel();
camera.add(gun.root);

buildWorld();
spawnBots();
createLights();

window.addEventListener("resize", onResize);
document.addEventListener("keydown", onKey);
document.addEventListener("keyup", (e) => keys.delete(e.code));
document.addEventListener("mousedown", onMouseDown);
document.addEventListener("mouseup", () => { state.fireHeld = false; });
document.addEventListener("mousemove", onMouseMove);
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement && state.running && !state.paused && !state.dead) {
    setPaused(true);
  }
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

playBtn.addEventListener("click", startMatch);
resumeBtn.addEventListener("click", () => setPaused(false));
pauseMenuBtn.addEventListener("click", backToMenu);
sensSlider.addEventListener("input", () => {
  state.sensitivity = Number(sensSlider.value);
  localStorage.setItem("hdfps-sens", String(state.sensitivity));
});
invertToggle.addEventListener("change", () => {
  state.invertY = invertToggle.checked;
  localStorage.setItem("hdfps-inverty", state.invertY ? "1" : "0");
});

setupMobile();
animate();

function startMatch() {
  audio.prime();
  state.playerName = (nameInput.value || "Player").trim().slice(0, 18);
  localStorage.setItem("hdfps-name", state.playerName);
  state.weaponKey = document.querySelector("input[name=weapon]:checked").value;
  resetPlayer(true);
  state.kills = 0;
  state.running = true;
  state.paused = false;
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  pause.classList.add("hidden");
  respawn.classList.add("hidden");
  canvas.requestPointerLock?.();
  updateHud();
  feed(`${state.playerName} dropped in`);
}

function backToMenu() {
  state.running = false;
  state.paused = false;
  document.exitPointerLock?.();
  hud.classList.add("hidden");
  pause.classList.add("hidden");
  respawn.classList.add("hidden");
  menu.classList.remove("hidden");
}

function setPaused(v) {
  if (!state.running || state.dead) return;
  state.paused = v;
  pause.classList.toggle("hidden", !v);
  if (v) document.exitPointerLock?.();
  else canvas.requestPointerLock?.();
}

function resetPlayer(full) {
  const pads = [
    [0, 14], [0, -14], [14, 0], [-14, 0], [10, 10], [-10, -10],
  ];
  const pad = pads[Math.floor(Math.random() * pads.length)];
  player.object.position.set(pad[0], 2.2, pad[1]);
  state.vel.set(0, 0, 0);
  state.health = 100;
  state.dead = false;
  state.yaw = Math.atan2(-pad[0], -pad[1]);
  state.pitch = 0;
  const w = WEAPONS[state.weaponKey];
  state.ammo = w.mag;
  state.reloading = false;
  state.reloadT = 0;
  state.cooldown = 0;
  if (player.asActor) {
    player.asActor.alive = true;
    player.asActor.health = 100;
    player.asActor.name = state.playerName || "Player";
  }
  if (full) state.kills = 0;
  respawn.classList.add("hidden");
  updateHud();
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function onKey(e) {
  if (e.repeat) {
    keys.add(e.code);
    return;
  }
  keys.add(e.code);
  if (e.code === "Escape" && state.running) {
    if (state.paused) setPaused(false);
    return;
  }
  if (!state.running || state.paused || state.dead) return;
  if (e.code === "KeyR") state.reloadQueued = true;
  if (e.code === "Space") {
    e.preventDefault();
    state.jumpQueued = true;
  }
}

function onMouseDown(e) {
  if (!state.running) return;
  if (e.button === 0) {
    state.fireHeld = true;
    if (!document.pointerLockElement) canvas.requestPointerLock?.();
  }
}

function onMouseMove(e) {
  if (!state.running || state.paused || !document.pointerLockElement) return;
  const sens = state.sensitivity * 0.0022;
  state.lookDelta.x += e.movementX * sens;
  state.lookDelta.y += e.movementY * sens;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  if (state.running && !state.paused) {
    updatePlayer(dt);
    updateBots(dt);
    updateGun(dt);
    updateDecals(dt);
  }
  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  if (state.dead) {
    state.respawnT -= dt;
    respawnMsg.textContent = `RESPAWNING IN ${Math.max(0, Math.ceil(state.respawnT))}`;
    if (state.respawnT <= 0) {
      resetPlayer(false);
      canvas.requestPointerLock?.();
    }
    return;
  }

  state.yaw -= state.lookDelta.x;
  const lookY = state.invertY ? -state.lookDelta.y : state.lookDelta.y;
  state.pitch = THREE.MathUtils.clamp(state.pitch - lookY, -1.2, 1.2);
  state.lookDelta.x = 0;
  state.lookDelta.y = 0;
  player.object.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;

  const forward = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
  const back = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
  const left = keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0;
  const right = keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0;
  let ix = right - left + state.move.x;
  let iz = forward - back + state.move.z;
  const mag = Math.hypot(ix, iz);
  if (mag > 1) { ix /= mag; iz /= mag; }

  state.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || mobile.sprint;
  const speed = (state.sprint && mag > 0.1 ? 7.4 : 5.2);
  const wish = tmp.v.set(ix, 0, -iz).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
  state.vel.x = THREE.MathUtils.damp(state.vel.x, wish.x * speed, 12, dt);
  state.vel.z = THREE.MathUtils.damp(state.vel.z, wish.z * speed, 12, dt);
  state.vel.y += -18 * dt;
  if (state.jumpQueued && state.onGround) {
    state.vel.y = Math.sqrt(1.2 * 2 * 18);
    state.onGround = false;
    audio.jump();
  }
  state.jumpQueued = false;

  moveWithCollisions(player.object.position, state.vel, dt, player.radius, player.height, true);

  if (mag > 0.15 && state.onGround) {
    state.bob += dt * speed * 1.7;
    camera.position.y = 1.55 + Math.abs(Math.sin(state.bob)) * 0.045;
    camera.position.x = Math.sin(state.bob) * 0.02;
    if (Math.sin(state.bob) > 0.92) audio.foot();
  } else {
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.55, 12, dt);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 12, dt);
  }

  const w = WEAPONS[state.weaponKey];
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (state.reloading) {
    state.reloadT -= dt;
    if (state.reloadT <= 0) {
      state.reloading = false;
      state.ammo = w.mag;
      audio.reload();
    }
  } else if ((state.reloadQueued || (state.fireHeld && state.ammo <= 0)) && state.ammo < w.mag) {
    beginReload();
  }
  state.reloadQueued = false;
  if (state.fireHeld && !state.reloading && state.ammo > 0 && state.cooldown <= 0) {
    fire();
  }
  vignette.style.opacity = String(Math.max(0, Number(vignette.style.opacity || 0) - dt * 1.8));
  updateHud();
}

function beginReload() {
  if (state.reloading) return;
  state.reloading = true;
  state.reloadT = state.weaponKey === "shotgun" ? 2.2 : 1.6;
  audio.reloadStart();
}

function fire() {
  const w = WEAPONS[state.weaponKey];
  state.ammo -= 1;
  state.cooldown = w.interval;
  state.pitch -= w.recoil * 0.012;
  gun.kick = 0.08;
  audio.shoot(state.weaponKey);
  muzzleFlash();

  camera.getWorldDirection(tmp.v);
  const origin = camera.getWorldPosition(tmp.v2);
  let hitSomeone = false;
  for (let i = 0; i < w.pellets; i++) {
    const dir = tmp.v.clone();
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.y += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();
    const hit = hitscan(origin, dir, w.range, player.asActor);
    if (!hit) continue;
    spawnImpact(hit.point, hit.normal, hit.actor);
    if (hit.actor && hit.actor.alive) {
      damageActor(hit.actor, w.damage, state.playerName);
      hitSomeone = true;
    }
  }
  if (hitSomeone) {
    hitMarker.classList.add("on");
    setTimeout(() => hitMarker.classList.remove("on"), 110);
    audio.hitmarker();
  }
}

function hitscan(origin, dir, range, ignore) {
  tmp.ray.set(origin, dir);
  tmp.ray.far = range;
  const meshes = colliders.map((c) => c.mesh).filter(Boolean);
  const hits = tmp.ray.intersectObjects(meshes, false);
  let best = null;
  for (const h of hits) {
    if (h.distance > range) continue;
    const owner = h.object.userData.actor;
    if (owner === ignore) continue;
    best = { point: h.point.clone(), normal: h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0), actor: owner || null, distance: h.distance };
    break;
  }
  for (const actor of actors) {
    if (actor === ignore || !actor.alive) continue;
    const to = actor.object.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(origin);
    const dist = to.length();
    if (dist > range) continue;
    const t = to.dot(dir);
    if (t < 0) continue;
    const closest = origin.clone().addScaledVector(dir, t);
    const body = actor.object.position.clone().add(new THREE.Vector3(0, 1.0, 0));
    if (closest.distanceTo(body) < 0.55) {
      if (!best || dist < best.distance) {
        best = { point: closest, normal: dir.clone().negate(), actor, distance: dist };
      }
    }
  }
  return best;
}

function damageActor(actor, amount, src) {
  actor.health -= amount;
  if (actor === player.asActor) {
    state.health = Math.max(0, actor.health);
    vignette.style.opacity = String(Math.min(0.85, 0.35 + amount / 80));
    audio.hurt();
  }
  if (actor.health <= 0 && actor.alive) {
    actor.alive = false;
    actor.health = 0;
    if (actor !== player.asActor) {
      actor.object.visible = false;
      if (actor.mesh) actor.mesh.visible = false;
    }
    if (src === state.playerName && actor !== playerRef()) {
      state.kills += 1;
    }
    feed(`${src} killed ${actor.name}`);
    audio.kill();
    if (actor === player.asActor) {
      state.dead = true;
      state.health = 0;
      state.respawnT = 5;
      document.exitPointerLock?.();
      respawn.classList.remove("hidden");
    } else {
      setTimeout(() => reviveBot(actor), 2800);
    }
  }
}

function playerRef() {
  return player.asActor;
}

function updateBots(dt) {
  for (const bot of actors) {
    if (bot === player.asActor || !bot.alive) continue;
    bot.thinkT -= dt;
    const toPlayer = player.object.position.clone().sub(bot.object.position);
    const dist = toPlayer.length();
    toPlayer.y = 0;
    if (toPlayer.lengthSq() > 0.001) toPlayer.normalize();
    bot.object.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    const speed = dist > 8 ? 3.6 : 1.6;
    bot.vel.x = toPlayer.x * speed;
    bot.vel.z = toPlayer.z * speed;
    bot.vel.y += -18 * dt;
    if (dist < 3.2) {
      bot.vel.x = -toPlayer.x * 2.2;
      bot.vel.z = -toPlayer.z * 2.2;
    }
    moveWithCollisions(bot.object.position, bot.vel, dt, 0.38, 1.7, false);
    bot.cooldown = Math.max(0, bot.cooldown - dt);
    if (dist < 32 && bot.cooldown <= 0 && canSeePlayer(bot)) {
      bot.cooldown = 0.45 + Math.random() * 0.35;
      const origin = bot.object.position.clone().add(new THREE.Vector3(0, 1.45, 0));
      const dir = player.object.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(origin).normalize();
      dir.x += (Math.random() - 0.5) * 0.04;
      dir.y += (Math.random() - 0.5) * 0.03;
      const hit = hitscan(origin, dir.normalize(), 80, bot);
      if (hit) spawnImpact(hit.point, hit.normal, hit.actor);
      if (hit?.actor === player.asActor) {
        damageActor(player.asActor, 8 + Math.random() * 6, bot.name);
      }
      audio.shootFar();
    }
  }
}

function canSeePlayer(bot) {
  const origin = bot.object.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const target = player.object.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const dir = target.clone().sub(origin);
  const dist = dir.length();
  dir.normalize();
  const hit = hitscan(origin, dir, dist + 0.2, bot);
  return !hit || hit.actor === player.asActor || hit.distance > dist - 0.4;
}

function reviveBot(bot) {
  const pads = [[18, 18], [-18, 18], [18, -18], [-18, -18], [0, 20], [20, 0]];
  const p = pads[Math.floor(Math.random() * pads.length)];
  bot.object.position.set(p[0], 2, p[1]);
  bot.health = 100;
  bot.alive = true;
  bot.object.visible = true;
  if (bot.mesh) bot.mesh.visible = true;
}

function moveWithCollisions(pos, vel, dt, radius, height, isPlayer) {
  pos.x += vel.x * dt;
  resolve(pos, vel, radius, height, "x", isPlayer);
  pos.z += vel.z * dt;
  resolve(pos, vel, radius, height, "z", isPlayer);
  pos.y += vel.y * dt;
  const grounded = resolve(pos, vel, radius, height, "y", isPlayer);
  if (grounded) {
    if (vel.y < 0) vel.y = 0;
    if (isPlayer) state.onGround = true;
  } else if (isPlayer) {
    state.onGround = false;
  }
  pos.x = THREE.MathUtils.clamp(pos.x, -38, 38);
  pos.z = THREE.MathUtils.clamp(pos.z, -38, 38);
  if (pos.y < -8) {
    pos.y = 6;
    vel.set(0, 0, 0);
  }
}

function resolve(pos, vel, radius, height, axis, isPlayer) {
  let grounded = false;
  const minY = pos.y;
  const maxY = pos.y + height;
  for (const c of colliders) {
    if (maxY < c.min.y - 0.2 || minY > c.max.y + 0.2) continue;
    const nx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const nz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (axis === "y") {
      if (pos.x > c.min.x - radius && pos.x < c.max.x + radius && pos.z > c.min.z - radius && pos.z < c.max.z + radius) {
        if (pos.y <= c.max.y + 0.08 && pos.y + height > c.max.y && vel.y <= 0.05) {
          if (c.max.y - pos.y < 0.85) {
            pos.y = c.max.y;
            grounded = true;
          }
        } else if (isPlayer && pos.y + height > c.min.y && pos.y < c.min.y && vel.y > 0) {
          pos.y = c.min.y - height;
          vel.y = 0;
        }
      }
    } else if (d2 < radius * radius && pos.y + 0.35 < c.max.y && pos.y + height > c.min.y) {
      const d = Math.sqrt(Math.max(d2, 1e-6));
      const push = (radius - d) / d;
      if (axis === "x") pos.x += dx * push;
      if (axis === "z") pos.z += dz * push;
    }
  }
  return grounded;
}

function updateGun(dt) {
  gun.kick = THREE.MathUtils.damp(gun.kick, 0, 14, dt);
  gun.root.position.z = 0.42 - gun.kick;
  gun.root.rotation.x = gun.kick * 1.4;
  gun.flash.intensity = THREE.MathUtils.damp(gun.flash.intensity, 0, 18, dt);
  gun.flashMesh.material.opacity = Math.min(1, gun.flash.intensity / 8);
}

function muzzleFlash() {
  gun.flash.intensity = 12;
}

function spawnImpact(point, normal, actor) {
  const geo = new THREE.SphereGeometry(actor ? 0.07 : 0.05, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: actor ? 0xff3344 : 0x9ad7ff });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(point);
  scene.add(m);
  decals.push({ mesh: m, t: 0.45 });
}

function updateDecals(dt) {
  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i].t -= dt;
    decals[i].mesh.scale.multiplyScalar(1.015);
    if (decals[i].t <= 0) {
      scene.remove(decals[i].mesh);
      decals[i].mesh.geometry.dispose();
      decals.splice(i, 1);
    }
  }
}

function updateHud() {
  const w = WEAPONS[state.weaponKey];
  healthFill.style.transform = `scaleX(${Math.max(0, state.health) / 100})`;
  healthFill.style.background = state.health < 30 ? "#e85d4c" : "var(--fill)";
  ammoFill.style.transform = `scaleX(${w.mag ? state.ammo / w.mag : 0})`;
  ammoText.textContent = `${state.ammo} / ${w.mag}`;
  ammoText.style.color = state.ammo === 0 ? "#ff3b3b" : state.ammo <= w.mag * 0.3 ? "#ffd24a" : "#fff";
  weaponName.textContent = w.name;
  reloadLabel.classList.toggle("hidden", !state.reloading);
  killsEl.textContent = String(state.kills);
}

function feed(text) {
  const row = document.createElement("div");
  row.textContent = text;
  killFeed.prepend(row);
  setTimeout(() => row.remove(), 3800);
  while (killFeed.children.length > 6) killFeed.lastChild.remove();
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x1a1c22, 0.55));
  const sun = new THREE.DirectionalLight(0xcfe6ff, 1.05);
  sun.position.set(18, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  scene.add(sun);
  const neon = new THREE.PointLight(0x3aa0ff, 24, 40);
  neon.position.set(0, 6, 0);
  scene.add(neon);
}

function buildWorld() {
  const floorTex = makeGridTexture("#1a2330", "#2f70a5", 64);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(24, 24);
  addBox(0, -0.5, 0, 80, 1, 80, 0x223044, true, floorTex);

  addBox(0, 6, -40, 80, 12, 2, 0x1c2736);
  addBox(0, 6, 40, 80, 12, 2, 0x1c2736);
  addBox(-40, 6, 0, 2, 12, 80, 0x1c2736);
  addBox(40, 6, 0, 2, 12, 80, 0x1c2736);

  addBox(0, 1, 0, 10, 2, 10, 0x2a3b50);
  addBox(0, 3.5, 0, 4, 3, 4, 0x314860);
  ring(0, 2.05, 0, 3.4, 0x3aa0ff);

  for (const [x, z] of [[12, 8], [-12, 8], [12, -8], [-12, -8], [22, 0], [-22, 0], [0, 22], [0, -22]]) {
    addBox(x, 1.2, z, 3.2, 2.4, 3.2, 0x243246);
  }
  for (const [x, z] of [[18, 18], [-18, 18], [18, -18], [-18, -18]]) {
    addBox(x, 2.5, z, 2.2, 5, 2.2, 0x1e2c3d);
    ring(x, 0.06, z, 1.6, 0x83b4de);
  }
  for (let i = 0; i < 10; i++) {
    addBox(-8 + i * 1.6, 0.35 + i * 0.28, -16, 1.6, 0.7, 4, 0x2b3d52);
  }
  addBox(8, 3.4, -16, 8, 0.5, 6, 0x2b3d52);
  addBox(-16, 1.5, 12, 8, 3, 1.2, 0x25364a);
  addBox(16, 1.5, -6, 1.2, 3, 8, 0x25364a);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x101826, side: THREE.BackSide })
  );
  scene.add(sky);
}

function ring(x, y, z, r, color) {
  const g = new THREE.RingGeometry(r * 0.72, r, 32);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  scene.add(mesh);
}

function addBox(x, y, z, w, h, d, color, receive = true, map = null) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    map,
    roughness: 0.72,
    metalness: 0.18,
    emissive: new THREE.Color(color).multiplyScalar(0.04),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = receive;
  scene.add(mesh);
  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  colliders.push({
    mesh,
    min: mesh.position.clone().sub(half),
    max: mesh.position.clone().add(half),
  });
  return mesh;
}

function makeGridTexture(bg, line, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = line;
  g.lineWidth = 2;
  g.strokeRect(1, 1, size - 2, size - 2);
  g.beginPath();
  g.moveTo(size / 2, 0);
  g.lineTo(size / 2, size);
  g.moveTo(0, size / 2);
  g.lineTo(size, size / 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function spawnBots() {
  player.asActor = {
    name: "You",
    object: player.object,
    alive: true,
    health: 100,
    isPlayer: true,
  };
  actors.push(player.asActor);
  const spots = [[16, 16], [-16, 16], [16, -16], [-16, -16], [8, -20], [-22, 6]];
  spots.forEach((p, i) => {
    const bot = createBot(BOT_NAMES[i % BOT_NAMES.length], p[0], p[1], i);
    actors.push(bot);
  });
}

function createBot(name, x, z, hue) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL((0.55 + hue * 0.07) % 1, 0.45, 0.42),
    metalness: 0.3,
    roughness: 0.45,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 6, 12), bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), bodyMat);
  head.position.y = 1.72;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x79d7ff, emissive: 0x3aa0ff, emissiveIntensity: 1.4 })
  );
  visor.position.set(0, 1.74, 0.22);
  root.add(body, head, visor);
  scene.add(root);
  body.userData.actor = { dummy: true };
  const actor = {
    name,
    object: root,
    mesh: body,
    alive: true,
    health: 100,
    vel: new THREE.Vector3(),
    cooldown: 1 + Math.random(),
    thinkT: 0,
  };
  body.userData.actor = actor;
  head.userData.actor = actor;
  return actor;
}

function createViewmodel() {
  const root = new THREE.Group();
  root.position.set(0.28, -0.28, 0.42);
  const metal = new THREE.MeshStandardMaterial({ color: 0x8ea0b5, metalness: 0.7, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.4, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.55), metal);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.42;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.22), dark);
  stock.position.set(0, -0.04, 0.28);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.12), dark);
  mag.position.set(0, -0.16, 0.02);
  root.add(body, barrel, stock, mag);
  const flash = new THREE.PointLight(0xfff1c1, 0, 6);
  flash.position.set(0, 0, -0.7);
  root.add(flash);
  const flashMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false })
  );
  flashMesh.position.copy(flash.position);
  root.add(flashMesh);
  return { root, flash, flashMesh, kick: 0 };
}

function createAudio() {
  let ctx;
  let lastFoot = 0;
  const ensure = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const beep = (freq, dur, type, gain, decay) => {
    const a = ensure();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(a.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + decay);
    o.stop(a.currentTime + dur);
  };
  const noise = (dur, gain) => {
    const a = ensure();
    const buffer = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1800;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(a.destination);
    src.start();
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  };
  return {
    shoot(kind) {
      noise(kind === "shotgun" ? 0.18 : 0.08, kind === "shotgun" ? 0.45 : 0.22);
      beep(kind === "shotgun" ? 120 : 220, 0.08, "square", 0.08, 0.09);
    },
    shootFar() { noise(0.06, 0.08); },
    hitmarker() { beep(980, 0.05, "square", 0.05, 0.05); },
    hurt() { beep(140, 0.12, "sawtooth", 0.07, 0.14); },
    kill() { beep(520, 0.12, "triangle", 0.05, 0.16); },
    jump() { beep(240, 0.08, "sine", 0.04, 0.1); },
    reloadStart() { beep(180, 0.08, "triangle", 0.04, 0.1); },
    reload() { beep(320, 0.06, "triangle", 0.04, 0.08); },
    foot() {
      const t = performance.now();
      if (t - lastFoot < 280) return;
      lastFoot = t;
      noise(0.04, 0.05);
    },
    prime() { ensure(); },
  };
}

const mobile = { sprint: false, lookId: null, moveId: null, origin: { x: 0, y: 0 } };
function setupMobile() {
  const fire = document.getElementById("btn-fire");
  const jump = document.getElementById("btn-jump");
  const reload = document.getElementById("btn-reload");
  const sprint = document.getElementById("btn-sprint");
  const movePad = document.getElementById("mobile-move");
  const knob = document.getElementById("stick-knob");
  const lookPad = document.getElementById("mobile-look");

  const hold = (el, on, off) => {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); on(); });
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  };
  hold(fire, () => { state.fireHeld = true; }, () => { state.fireHeld = false; });
  hold(jump, () => { state.jumpQueued = true; }, () => {});
  hold(reload, () => { state.reloadQueued = true; }, () => {});
  hold(sprint, () => { mobile.sprint = true; state.sprint = true; }, () => { mobile.sprint = false; });

  movePad.addEventListener("pointerdown", (e) => {
    mobile.moveId = e.pointerId;
    mobile.origin = { x: e.clientX, y: e.clientY };
    movePad.setPointerCapture(e.pointerId);
  });
  movePad.addEventListener("pointermove", (e) => {
    if (e.pointerId !== mobile.moveId) return;
    const dx = (e.clientX - mobile.origin.x) / 55;
    const dy = (e.clientY - mobile.origin.y) / 55;
    const l = Math.min(1, Math.hypot(dx, dy));
    const nx = l ? dx / Math.hypot(dx, dy) * l : 0;
    const ny = l ? dy / Math.hypot(dx, dy) * l : 0;
    state.move.x = nx;
    state.move.z = -ny;
    knob.style.left = `${38 + nx * 36}px`;
    knob.style.top = `${38 + ny * 36}px`;
  });
  const endMove = () => {
    mobile.moveId = null;
    state.move.x = 0;
    state.move.z = 0;
    knob.style.left = "38px";
    knob.style.top = "38px";
  };
  movePad.addEventListener("pointerup", endMove);
  movePad.addEventListener("pointercancel", endMove);

  lookPad.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#mobile-actions") || e.target.closest("#mobile-move")) return;
    mobile.lookId = e.pointerId;
    lookPad.setPointerCapture(e.pointerId);
  });
  lookPad.addEventListener("pointermove", (e) => {
    if (e.pointerId !== mobile.lookId) return;
    state.lookDelta.x += e.movementX * 0.0045 * state.sensitivity;
    state.lookDelta.y += e.movementY * 0.0045 * state.sensitivity;
  });
  lookPad.addEventListener("pointerup", () => { mobile.lookId = null; });
}
