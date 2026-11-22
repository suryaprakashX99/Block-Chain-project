// Shared 3D stage for the hero sections (three.js).
// Creates a transparent canvas, sunset-style reflections, drag-to-rotate and an idle spin.
import * as THREE from "./three.module.min.js";

export { THREE };

export function createStage(host, { envTop = "#2a1050", envMid = "#ff3d8b", envLow = "#ff8a3d", fov = 32, camera = [0, 2.2, 9] } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  cam.position.set(...camera);
  cam.lookAt(0, 0.6, 0);

  // Reflections: a gradient "sky" baked into an environment map.
  const c = document.createElement("canvas"); c.width = 16; c.height = 256;
  const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, envTop); grad.addColorStop(0.45, envMid); grad.addColorStop(0.55, envLow); grad.addColorStop(1, "#05040c");
  g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
  const skyTex = new THREE.CanvasTexture(c); skyTex.colorSpace = THREE.SRGBColorSpace;
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  // Soft glow disc on the ground under the model.
  const gc = document.createElement("canvas"); gc.width = gc.height = 128;
  const gg = gc.getContext("2d"), rg = gg.createRadialGradient(64, 64, 4, 64, 64, 64);
  rg.addColorStop(0, "rgba(255,255,255,.9)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(gc);

  const pivot = new THREE.Group();
  scene.add(pivot);

  // Drag to rotate, gentle spin when idle.
  let dragging = false, lastX = 0, velocity = 0, idleSpin = 0.004, lastInput = 0;
  const el = renderer.domElement;
  el.style.touchAction = "pan-y";
  el.addEventListener("pointerdown", e => { dragging = true; lastX = e.clientX; el.setPointerCapture(e.pointerId); host.classList.add("grabbing"); });
  el.addEventListener("pointermove", e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; velocity = dx * 0.008; pivot.rotation.y += velocity; lastInput = performance.now(); });
  const end = () => { dragging = false; host.classList.remove("grabbing"); };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  const tickers = [];
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!dragging) {
      velocity *= 0.94;
      pivot.rotation.y += velocity + (performance.now() - lastInput > 1500 ? idleSpin : 0);
    }
    tickers.forEach(f => f(dt, t));
    renderer.render(scene, cam);
  });

  return { THREE, scene, camera: cam, pivot, renderer, glowTex, onTick: f => tickers.push(f) };
}

// Neon edge outline for a mesh's geometry.
export function neonEdges(geometry, color, threshold = 25) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, threshold),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
}

// Glowing ground disc.
export function glowDisc(stage, color, size = 6) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size * 0.55),
    new THREE.MeshBasicMaterial({ map: stage.glowTex, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
}

// Small switcher buttons (e.g. Car / Bike) inside the stage.
export function switcher(host, labels, onPick) {
  const bar = document.createElement("div");
  bar.className = "stage-switch";
  labels.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    if (i === 0) b.classList.add("on");
    b.onclick = () => { bar.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); onPick(i); };
    bar.appendChild(b);
  });
  const hint = document.createElement("span");
  hint.className = "stage-hint"; hint.textContent = "Drag to rotate";
  bar.appendChild(hint);
  host.appendChild(bar);
}
