// "The Workshop" - a 3D motorcycle build / strip-down challenge for Apex customers.
// Level 1: assemble every part in a mechanically valid order, torque each bolt with the
//          right spanner (sizes are in the spec sheet), then paint to the customer's work order.
// Level 2: strip the finished bike back to a bare frame in a safe order.
// Finishing within the rules lets the player claim APXP from the GarageChallenge contract.
import * as THREE from "./three.module.min.js";
import { buildBike, assemblyOrder } from "./bike-model.js";

const root = document.getElementById("workshop");
if (root) init();

function init() {
  const $ = s => root.querySelector(s);
  const stageEl = $("#wsStage");

  // ------------------------------------------------------------------ renderer + scene
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stageEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#120d22");
  scene.fog = new THREE.Fog("#120d22", 6, 14);

  // Neutral studio reflections so chrome and paint look real.
  {
    const c = document.createElement("canvas"); c.width = 32; c.height = 256;
    const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#c9cde0"); gr.addColorStop(0.55, "#ff9ab8"); gr.addColorStop(0.6, "#2a2440"); gr.addColorStop(1, "#0b0a12");
    g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(es, 0.02).texture;
  }
  scene.add(new THREE.HemisphereLight("#d6d0ff", "#1a1328", 0.7));
  const key = new THREE.SpotLight("#ffffff", 60, 12, 0.6, 0.5); key.position.set(1.5, 4, 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; scene.add(key);
  const rimL = new THREE.PointLight("#ff3d8b", 8, 6); rimL.position.set(-2, 1.2, -1.5); scene.add(rimL);
  const rimR = new THREE.PointLight("#2de2e6", 8, 6); rimR.position.set(2, 1, 1.8); scene.add(rimR);

  // Workshop floor with painted bay lines.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: "#1b1630", roughness: 0.55, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(12, 48, "#ff3d8b", "#3a2a5a"); grid.material.transparent = true; grid.material.opacity = 0.25; grid.position.y = 0.001; scene.add(grid);
  const bay = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.63, 96), new THREE.MeshBasicMaterial({ color: "#ff8a3d" })); bay.rotation.x = -Math.PI / 2; bay.position.y = 0.002; scene.add(bay);

  // Paddock stands (front and rear) so the bike stands without its wheels.
  const standMat = new THREE.MeshStandardMaterial({ color: "#ff8a3d", metalness: 0.6, roughness: 0.4 });
  [[-0.2, 0.2], [0.42, 0.18]].forEach(([x, h]) => {
    [-0.16, 0.16].forEach(z => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 10), standMat); leg.position.set(x, h / 2, z); leg.castShadow = true; scene.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.03), standMat); foot.position.set(x, 0.008, z); scene.add(foot);
    });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 10), standMat); bar.rotation.x = Math.PI / 2; bar.position.set(x, h, 0); scene.add(bar);
  });

  const bike = buildBike();
  scene.add(bike.root);
  const parts = bike.parts, partIds = Object.keys(parts), bolts = bike.bolts;
  const boltById = Object.fromEntries(bolts.map(b => [b.id, b]));
  const ORDER = assemblyOrder(parts);
  const DEFAULT_PAINT = Object.fromEntries(Object.entries(bike.zones).map(([k, m]) => [k, "#" + m.color.getHexString()]));

  // Invisible "slot" boxes mark where each part belongs (used when installing).
  const slots = {};
  partIds.forEach(id => {
    const box = new THREE.Box3().setFromObject(parts[id].group);
    const size = box.getSize(new THREE.Vector3()).addScalar(0.03), centre = box.getCenter(new THREE.Vector3());
    const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ color: "#2de2e6", transparent: true, opacity: 0.12, depthWrite: false, wireframe: false }));
    m.position.copy(centre); m.visible = false; m.userData.slotId = id;
    scene.add(m); slots[id] = m;
    parts[id].home = parts[id].group.position.clone();
  });
  const hoverBox = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color("#2de2e6")); hoverBox.visible = false; scene.add(hoverBox);

  // ------------------------------------------------------------------ camera orbit
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
  const orbit = { theta: 0.35, phi: 1.25, r: 3.6, target: new THREE.Vector3(0.05, 0.62, 0) };
  const goal = { ...orbit, target: orbit.target.clone() };
  const VIEWS = {
    right: { theta: 0.0, phi: 1.32, r: 2.6, w: 1.2, t: [0.0, 0.6, 0] },
    left: { theta: Math.PI, phi: 1.32, r: 2.6, w: 1.2, t: [0.0, 0.6, 0] },
    front: { theta: Math.PI / 2, phi: 1.2, r: 2.2, w: 0.6, t: [0.2, 0.7, 0] },
    engine: { theta: 0.15, phi: 1.35, r: 1.5, w: 0, t: [0.12, 0.5, 0] },
    top: { theta: 0.3, phi: 0.25, r: 2.6, w: 1.2, t: [0.0, 0.6, 0] }
  };
  function setView(v) {
    const p = VIEWS[v];
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);     // horizontal half-angle
    const r = Math.max(p.r, p.w ? (p.w / Math.tan(halfH)) * 1.08 : p.r);                            // fit the bike's width
    Object.assign(goal, { theta: p.theta, phi: p.phi, r }); goal.target.set(...p.t);
  }
  root.querySelectorAll("[data-view]").forEach(b => (b.onclick = () => setView(b.dataset.view)));

  let down = null;
  const el = renderer.domElement;
  el.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, moved: false }; el.setPointerCapture(e.pointerId); });
  el.addEventListener("pointermove", e => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
      if (down.moved) {
        goal.theta -= (e.movementX || 0) * 0.008; goal.phi = THREE.MathUtils.clamp(goal.phi - (e.movementY || 0) * 0.006, 0.2, 1.52);
      }
    } else hover(e);
  });
  el.addEventListener("pointerup", e => { if (down && !down.moved) click(e); down = null; });
  el.addEventListener("wheel", e => { e.preventDefault(); goal.r = THREE.MathUtils.clamp(goal.r * (1 + Math.sign(e.deltaY) * 0.1), 0.9, 6); }, { passive: false });

  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stageEl); resize();

  // ------------------------------------------------------------------ game state
  const S = { mode: null, phase: "idle", installed: new Set(), tight: new Set(), selected: null, tool: null, mistakes: 0, hints: 0, start: 0, end: 0, order: null, anims: [] };
  const secured = id => S.installed.has(id) && parts[id].bolts.every(b => S.tight.has(b.id));
  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const elapsed = () => ((S.end || performance.now()) - S.start) / 1000 + S.hints * 30;

  function say(msg, type = "info") {
    const li = document.createElement("li"); li.className = type;
    li.innerHTML = msg; $("#wsLog").prepend(li);
    while ($("#wsLog").children.length > 7) $("#wsLog").lastChild.remove();
  }
  function mistake(msg) { S.mistakes++; say("✗ " + msg, "bad"); flash("bad"); updateHud(); }
  function flash(kind) { stageEl.classList.remove("flash-bad", "flash-good"); void stageEl.offsetWidth; stageEl.classList.add("flash-" + kind); }

  function setBoltVisual(b, tight, visible = true) {
    const o = b.object; o.visible = visible;
    o.position.copy(b.pos).addScaledVector(b.axis, tight ? 0 : 0.025);
    b.ring.visible = !tight;
    b.ring.material.color.set(tight ? "#34f5a0" : "#ff8a3d");
  }
  function showPart(id, on) { parts[id].group.visible = on; parts[id].bolts.forEach(b => setBoltVisual(b, S.tight.has(b.id), on)); }

  function animatePart(id, direction) {           // direction: "in" | "out"
    const g = parts[id].group, home = parts[id].home, from = new THREE.Vector3(0, 0.9, 0.6);
    const t0 = performance.now();
    S.anims.push(now => {
      const k = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - k, 3);
      const off = direction === "in" ? from.clone().multiplyScalar(1 - e) : from.clone().multiplyScalar(e);
      g.position.copy(home).add(off);
      if (direction === "out" && k >= 1) { showPart(id, false); g.position.copy(home); }
      return k >= 1;
    });
  }
  function animateBolt(b, tighten) {
    const t0 = performance.now(), start = b.object.position.clone(), end = b.pos.clone().addScaledVector(b.axis, tighten ? 0 : 0.025);
    const spin = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.axis);
    b.ring.visible = true; b.ring.material.color.set(tighten ? "#34f5a0" : "#ff8a3d");
    S.anims.push(now => {
      const k = Math.min(1, (now - t0) / 550);
      b.object.position.lerpVectors(start, end, k);
      b.object.quaternion.copy(spin).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (tighten ? 1 : -1) * k * Math.PI * 4));
      if (k >= 1) { b.object.quaternion.copy(spin); if (tighten) setTimeout(() => (b.ring.visible = false), 500); }
      return k >= 1;
    });
  }

  // ------------------------------------------------------------------ UI: tray, tools, spec sheet, paint
  const TOOLS = [8, 10, 12, 14, 16, 17, 24];
  $("#wsTools").innerHTML = TOOLS.map(s => `<button type="button" class="tool" data-size="${s}"><i>${s}</i>mm</button>`).join("");
  root.querySelectorAll(".tool").forEach(b => (b.onclick = () => {
    S.tool = Number(b.dataset.size);
    root.querySelectorAll(".tool").forEach(x => x.classList.toggle("on", x === b));
  }));

  // Spec sheet: every fastener and its spanner size, grouped by part (shuffled part order).
  const specRows = shuffle(partIds.filter(id => parts[id].bolts.length)).map(id =>
    `<tr class="grp"><td colspan="2">${parts[id].name}</td></tr>` + parts[id].bolts.map(b => `<tr><td>${b.label}</td><td>${b.size} mm</td></tr>`).join("")).join("");
  $("#wsSpec").innerHTML = `<table>${specRows}</table>`;

  function renderTray() {
    const list = S.mode === "assemble" ? S.order.filter(id => !S.installed.has(id)) : [];
    $("#wsTray").innerHTML = list.length ? list.map(id => `
      <button type="button" class="part ${S.selected === id ? "on" : ""}" data-part="${id}">
        <b>${parts[id].name}</b><span>${parts[id].bolts.length ? parts[id].bolts.length + " fastener" + (parts[id].bolts.length > 1 ? "s" : "") : "no fasteners"}</span>
      </button>`).join("")
      : `<p class="ws-empty">${S.mode === "strip" ? "Click a part on the bike to remove it. Loosen its bolts first." : S.phase === "paint" ? "All parts fitted. Time for the paint shop." : "Choose a challenge to begin."}</p>`;
    root.querySelectorAll(".part").forEach(b => (b.onclick = () => {
      S.selected = b.dataset.part; renderTray();
      say(`Picked up: <b>${parts[S.selected].name}</b>. Click where it goes on the bike.`);
    }));
  }

  function updateHud() {
    const totalBolts = bolts.length;
    const tightCount = bolts.filter(b => S.tight.has(b.id)).length;
    $("#wsParts").textContent = S.mode === "strip" ? `${partIds.length - S.installed.size}/${partIds.length}` : `${S.installed.size}/${partIds.length}`;
    $("#wsBolts").textContent = S.mode === "strip" ? `${totalBolts - tightCount}/${totalBolts}` : `${tightCount}/${totalBolts}`;
    $("#wsMistakes").textContent = S.mistakes;
    $("#wsHints").textContent = S.hints;
    $("#wsProgress").style.width = `${progress() * 100}%`;
  }
  function progress() {
    const n = partIds.length + bolts.length;
    if (S.mode === "assemble") return (S.installed.size + S.tight.size) / n * (S.phase === "paint" ? 1 : 0.92);
    if (S.mode === "strip") return ((partIds.length - S.installed.size) + (bolts.length - S.tight.size)) / n;
    return 0;
  }
  setInterval(() => { if (S.phase === "build" || S.phase === "paint") $("#wsTime").textContent = fmtTime(elapsed()); }, 250);

  // ------------------------------------------------------------------ start a challenge
  function start(mode) {
    S.mode = mode; S.phase = "build"; S.selected = null; S.tool = null; S.mistakes = 0; S.hints = 0; S.start = performance.now(); S.end = 0;
    root.querySelectorAll(".tool").forEach(x => x.classList.remove("on"));
    $("#wsLog").innerHTML = ""; $("#wsResult").hidden = true; $("#wsPaint").hidden = true;
    if (mode === "assemble") {
      S.installed = new Set(); S.tight = new Set();
      S.order = shuffle(partIds.slice());
      resetPaint();
      partIds.forEach(id => showPart(id, false));
      say("Bare workshop. Fit the <b>parts</b> from the tray, then torque every bolt with the right spanner. Check the spec sheet!", "info");
      setView("right");
    } else {
      S.installed = new Set(partIds); S.tight = new Set(bolts.map(b => b.id));
      partIds.forEach(id => showPart(id, true));
      say("A finished bike is on the stand. <b>Loosen</b> a part's bolts with the right spanner, then click the part to remove it. Work from the outside in.", "info");
      setView("left");
    }
    root.classList.add("playing");
    renderTray(); updateHud();
    stageEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  root.querySelectorAll("[data-start]").forEach(b => (b.onclick = () => start(b.dataset.start)));

  // ------------------------------------------------------------------ picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e, objects) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objects, true);
  }
  const visibleBoltObjects = () => bolts.filter(b => b.object.visible).map(b => b.object);
  const visiblePartGroups = () => partIds.filter(id => parts[id].group.visible).map(id => parts[id].group);

  function hover(e) {
    if (S.phase !== "build") { hoverBox.visible = false; el.style.cursor = "grab"; return; }
    const hb = pick(e, visibleBoltObjects())[0];
    if (hb) { el.style.cursor = "pointer"; el.title = boltById[hb.object.userData.boltId].label; hoverBox.visible = false; return; }
    el.title = "";
    let id = null;
    if (S.mode === "assemble" && S.selected) {
      const hits = pick(e, partIds.filter(i => !S.installed.has(i)).map(i => slots[i]));
      if (hits.length) id = hits[0].object.userData.slotId;
    } else if (S.mode === "strip") {
      const hit = pick(e, visiblePartGroups())[0];
      if (hit) id = hit.object.userData.partId;
    }
    if (id) { hoverBox.box.setFromObject(S.mode === "strip" ? parts[id].group : slots[id]); hoverBox.visible = true; el.style.cursor = "pointer"; }
    else { hoverBox.visible = false; el.style.cursor = "grab"; }
  }

  function click(e) {
    if (S.phase !== "build") return;
    const hb = pick(e, visibleBoltObjects())[0];
    if (hb) return boltClick(boltById[hb.object.userData.boltId]);
    if (S.mode === "assemble") {
      if (!S.selected) return say("Pick a part from the tray first.");
      const hits = pick(e, partIds.filter(i => !S.installed.has(i)).map(i => slots[i])).map(h => h.object.userData.slotId);
      if (!hits.length) return;
      if (!hits.includes(S.selected)) return mistake(`That's not where the <b>${parts[S.selected].name}</b> goes.`);
      install(S.selected);
    } else {
      const hit = pick(e, visiblePartGroups())[0];
      if (hit) remove(hit.object.userData.partId);
    }
  }

  function install(id) {
    const p = parts[id];
    const missing = p.deps.filter(d => !secured(d));
    if (missing.length) {
      const d = parts[missing[0]];
      return mistake(S.installed.has(missing[0])
        ? `The <b>${d.name}</b> is fitted but not bolted down yet. Torque its bolts before fitting the <b>${p.name}</b>.`
        : `The <b>${d.name}</b> has to go on before the <b>${p.name}</b>.`);
    }
    S.installed.add(id); S.selected = null;
    showPart(id, true); animatePart(id, "in");
    say(`✓ Fitted: <b>${p.name}</b>${p.bolts.length ? ` - now torque its ${p.bolts.length} bolt${p.bolts.length > 1 ? "s" : ""}.` : "."}`, "good");
    flash("good"); renderTray(); updateHud(); checkDone();
  }

  function remove(id) {
    const p = parts[id];
    const loose = p.bolts.filter(b => S.tight.has(b.id));
    if (loose.length) return mistake(`The <b>${p.name}</b> is still bolted on (${loose.length} bolt${loose.length > 1 ? "s" : ""}). Loosen them first.`);
    const blocker = partIds.find(o => S.installed.has(o) && parts[o].deps.includes(id));
    if (blocker) return mistake(`Remove the <b>${parts[blocker].name}</b> first - it's attached to the <b>${p.name}</b>.`);
    S.installed.delete(id);
    animatePart(id, "out");
    say(`✓ Removed: <b>${p.name}</b>`, "good");
    flash("good"); updateHud(); checkDone();
  }

  function boltClick(b) {
    if (!S.tool) return say("Choose a spanner from the tool rack first.");
    const isTight = S.tight.has(b.id);
    if (S.mode === "assemble" && isTight) return say(`The ${b.label} is already torqued.`);
    if (S.mode === "strip" && !isTight) return say(`The ${b.label} is already loose.`);
    if (S.tool !== b.size) return mistake(`A ${S.tool} mm spanner doesn't fit the <b>${b.label}</b>. Check the spec sheet.`);
    if (S.mode === "assemble") {
      S.tight.add(b.id); animateBolt(b, true);
      const p = parts[b.partId];
      if (secured(p.id)) say(`✓ <b>${p.name}</b> is secured.`, "good");
    } else {
      S.tight.delete(b.id); animateBolt(b, false);
    }
    updateHud(); checkDone();
  }

  function checkDone() {
    if (S.mode === "assemble" && S.installed.size === partIds.length && bolts.every(b => S.tight.has(b.id)) && S.phase === "build") {
      S.phase = "paint"; openPaint();
    }
    if (S.mode === "strip" && S.installed.size === 0) finish();
  }

  // ------------------------------------------------------------------ paint shop
  const PALETTE = {
    "Midnight Purple": "#5a1e7a", "Gloss Black": "#141218", "Racing Red": "#b3122e", "Desert Sand": "#c4a06a",
    "Neon Orange": "#ff7a1a", "Lagoon Teal": "#0f8f94", "Pearl White": "#ecebf2", "Forest Green": "#1f5e3a"
  };
  const RIMS = { "Chrome": "#d9dbe3", "Satin Black": "#1b1b20", "Gold": "#c8961e", "Bronze": "#8a5a2b" };
  const ZONES = { tank: "Fuel tank", frame: "Frame & swingarm", fenders: "Mudguards", panels: "Side panels", rims: "Wheel rims" };
  let order = {}, zone = "tank";

  const DEFAULT_NAMES = { tank: "Midnight Purple", frame: "Gloss Black", fenders: "Gloss Black", panels: "Midnight Purple", rims: "Chrome" };
  function resetPaint() { Object.entries(DEFAULT_PAINT).forEach(([k, c]) => { bike.zones[k].color.set(c); bike.zones[k].userData.name = DEFAULT_NAMES[k]; }); }
  function openPaint() {
    const pick1 = obj => { const k = Object.keys(obj); return k[Math.floor(Math.random() * k.length)]; };
    order = { tank: pick1(PALETTE), frame: pick1(PALETTE), fenders: pick1(PALETTE), panels: pick1(PALETTE), rims: pick1(RIMS) };
    $("#wsOrder").innerHTML = `<b>Work order #${Math.floor(1000 + Math.random() * 9000)}</b>` +
      Object.entries(ZONES).map(([k, label]) => `<div><span>${label}</span><em>${order[k]}</em></div>`).join("");
    $("#wsZones").innerHTML = Object.entries(ZONES).map(([k, label]) => `<button type="button" data-zone="${k}" class="${k === zone ? "on" : ""}">${label}</button>`).join("");
    root.querySelectorAll("[data-zone]").forEach(b => (b.onclick = () => { zone = b.dataset.zone; root.querySelectorAll("[data-zone]").forEach(x => x.classList.toggle("on", x === b)); renderSwatches(); }));
    renderSwatches();
    $("#wsPaint").hidden = false;
    say("All parts torqued! Now paint the bike to match the customer's <b>work order</b>.", "good");
    renderTray(); updateHud(); setView("right");
  }
  function renderSwatches() {
    const pal = zone === "rims" ? RIMS : PALETTE;
    $("#wsSwatches").innerHTML = Object.entries(pal).map(([name, hex]) => `<button type="button" class="sw" title="${name}" data-hex="${hex}" style="--c:${hex}"><i></i><span>${name}</span></button>`).join("");
    root.querySelectorAll(".sw").forEach(b => (b.onclick = () => { bike.zones[zone].color.set(b.dataset.hex); bike.zones[zone].userData.name = b.title; }));
  }
  $("#wsSubmitPaint").onclick = () => {
    const wrong = Object.keys(ZONES).filter(k => bike.zones[k].userData.name !== order[k]);
    if (wrong.length) return mistake(`The customer rejected it: ${wrong.length} area${wrong.length > 1 ? "s don't" : " doesn't"} match the work order.`);
    finish();
  };

  // ------------------------------------------------------------------ finish + rewards
  async function finish() {
    S.end = performance.now(); S.phase = "done"; root.classList.remove("playing");
    $("#wsPaint").hidden = true;
    const secs = Math.round(elapsed()), level = S.mode === "assemble" ? 1 : 2;
    const ok = S.mistakes <= 8 && secs >= 120;
    $("#wsResult").hidden = false;
    $("#wsResult").innerHTML = `
      <div class="ws-res-head">${level === 1 ? "Bike built & delivered!" : "Bike stripped to the frame!"}</div>
      <div class="ws-res-stats"><div><b>${fmtTime(secs)}</b><span>time (incl. hint penalty)</span></div><div><b>${S.mistakes}</b><span>mistakes</span></div><div><b>${S.hints}</b><span>hints</span></div></div>
      <p>${ok ? `You qualify for <b>${level === 1 ? 150 : 100} APXP</b> loyalty points.` : S.mistakes > 8 ? "More than 8 mistakes - no reward this time. Try again!" : "Under 2 minutes - that's too fast for a reward."}</p>
      <div class="actions">${ok ? `<button type="button" id="wsClaim">Claim ${level === 1 ? 150 : 100} APXP</button>` : ""}<button type="button" class="secondary" id="wsAgain">Play again</button></div>`;
    say(`🏁 Finished in ${fmtTime(secs)} with ${S.mistakes} mistake${S.mistakes === 1 ? "" : "s"}.`, "good");
    confetti();
    $("#wsAgain").onclick = () => start(S.mode);
    const claim = $("#wsClaim");
    if (claim) claim.onclick = async () => {
      if (!window.App?.account) return App.log("Connect MetaMask first (top right), then claim.", "error");
      if (!App.isConfigured("GarageChallenge")) return App.log("GarageChallenge address is not set in config.js yet.", "error");
      const gc = App.contract("GarageChallenge");
      const wait = Number(await gc.waitTime(App.account, level));
      if (wait > 0) return App.log(`You've already claimed this level today. Try again in ${Math.ceil(wait / 3600)} h.`, "error");
      const r = await App.send(`Claim workshop reward`, () => gc.claim(level, secs, S.mistakes));
      if (r) { claim.disabled = true; claim.textContent = "Reward claimed ✓"; loadBoard(); document.dispatchEvent(new Event("apex-refresh")); }
    };
  }

  // Leaderboard from GameCompleted events.
  async function loadBoard() {
    const box = $("#wsBoard");
    if (!window.App?.provider || !App.isConfigured("GarageChallenge")) { box.innerHTML = `<li class="empty">Connect your wallet to see the leaderboard.</li>`; return; }
    try {
      const gc = App.contract("GarageChallenge");
      const logs = await App.events(gc, "GameCompleted", CONFIG.deployBlock.GarageChallenge);
      const rows = logs.map(l => ({ who: l.args.player, level: Number(l.args.level), secs: Number(l.args.seconds_), m: Number(l.args.mistakes) }))
        .sort((a, b) => a.level - b.level || a.secs - b.secs || a.m - b.m).slice(0, 10);
      box.innerHTML = rows.length ? rows.map((r, i) => `<li><span>${i + 1}. ${App.short(r.who)}${r.who.toLowerCase() === App.account.toLowerCase() ? " (you)" : ""}</span><span>L${r.level} · ${fmtTime(r.secs)} · ${r.m}✗</span></li>`).join("")
        : `<li class="empty">No completions yet - be the first!</li>`;
    } catch (e) { box.innerHTML = `<li class="empty">${App.reason(e)}</li>`; }
  }
  document.addEventListener("wallet-connected", loadBoard);
  $("#wsBoardRefresh").onclick = loadBoard;

  // ------------------------------------------------------------------ hints
  $("#wsHint").onclick = () => {
    if (S.phase !== "build") return;
    S.hints++; updateHud();
    if (S.mode === "assemble") {
      const looseBolt = bolts.find(b => S.installed.has(b.partId) && !S.tight.has(b.id));
      if (looseBolt) { say(`💡 The <b>${looseBolt.label}</b> still needs torquing (+30 s).`, "hint"); pulseBolt(looseBolt); return; }
      const next = ORDER.find(id => !S.installed.has(id) && parts[id].deps.every(secured));
      if (next) { say(`💡 Try fitting the <b>${parts[next].name}</b> next (+30 s).`, "hint"); pulseSlot(next); }
    } else {
      const removable = partIds.find(id => S.installed.has(id) && !partIds.some(o => S.installed.has(o) && parts[o].deps.includes(id)));
      if (removable) {
        const tb = parts[removable].bolts.find(b => S.tight.has(b.id));
        say(`💡 ${tb ? `Loosen the <b>${tb.label}</b>` : `Remove the <b>${parts[removable].name}</b>`} (+30 s).`, "hint");
        tb ? pulseBolt(tb) : pulseSlot(removable);
      }
    }
  };
  function pulseSlot(id) { const s = slots[id]; s.visible = true; setTimeout(() => (s.visible = false), 1800); }
  function pulseBolt(b) { b.ring.visible = true; b.ring.material.color.set("#ffe066"); setTimeout(() => setBoltVisual(b, S.tight.has(b.id), b.object.visible), 1800); }

  // ------------------------------------------------------------------ confetti
  function confetti() {
    const c = document.createElement("canvas"); c.className = "ws-confetti"; stageEl.appendChild(c);
    const w = c.width = stageEl.clientWidth, h = c.height = stageEl.clientHeight, x = c.getContext("2d");
    const bits = Array.from({ length: 160 }, () => ({ x: w / 2, y: h * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: ["#ff3d8b", "#ff8a3d", "#2de2e6", "#ffe066", "#34f5a0"][Math.floor(Math.random() * 5)], a: Math.random() * 6 }));
    let n = 0;
    (function f() {
      x.clearRect(0, 0, w, h);
      bits.forEach(b => { b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.a += 0.2; x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.fillStyle = b.c; x.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); x.restore(); });
      if (++n < 150) requestAnimationFrame(f); else c.remove();
    })();
  }

  // ------------------------------------------------------------------ render loop
  partIds.forEach(id => showPart(id, true));            // idle: show the finished bike slowly turning
  S.installed = new Set(partIds); S.tight = new Set(bolts.map(b => b.id)); partIds.forEach(id => showPart(id, true));
  renderTray(); updateHud(); loadBoard();
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(stageEl);
  renderer.setAnimationLoop(now => {
    if (!visible) return;
    if (S.phase === "idle" && !down) goal.theta += 0.0025;
    orbit.theta += (goal.theta - orbit.theta) * 0.12; orbit.phi += (goal.phi - orbit.phi) * 0.12; orbit.r += (goal.r - orbit.r) * 0.12;
    orbit.target.lerp(goal.target, 0.12);
    camera.position.set(
      orbit.target.x + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      orbit.target.y + orbit.r * Math.cos(orbit.phi),
      orbit.target.z + orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    camera.lookAt(orbit.target);
    S.anims = S.anims.filter(f => !f(now));
    renderer.render(scene, camera);
  });
  window.__workshop = { S, parts, bolts, start, install, remove, boltClick, ORDER, secured, finish, bike };   // for testing
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
