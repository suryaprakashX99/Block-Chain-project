// Visual effects: intro animation, scroll reveals, parallax, scroll-driven vehicles/balls, optional hero video.
// Purely decorative - the blockchain logic lives in web3.js / turf.js / apex.js.

(() => {
  const body = document.body;
  const theme = body.classList.contains("apex") ? "apex" : body.classList.contains("turf") ? "turf" : "home";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - t, 3);

  // ======================================================================
  //  INTRO (once per browser session; click or press any key to skip)
  // ======================================================================
  function seenIntro() { try { return sessionStorage.getItem("intro-" + theme) === "1"; } catch { return false; } }
  function markIntro() { try { sessionStorage.setItem("intro-" + theme, "1"); } catch {} }

  function runIntro(draw, duration, title, subtitle) {
    const wrap = document.createElement("div");
    wrap.className = "intro";
    wrap.innerHTML = `<canvas></canvas><div class="intro-title"><b>${title}</b><span>${subtitle}</span></div><button class="intro-skip" type="button">Skip ›</button>`;
    document.body.appendChild(wrap);
    document.documentElement.classList.add("intro-lock");
    const cv = wrap.querySelector("canvas"), ctx = cv.getContext("2d");
    let W, H, dpr;
    const size = () => { dpr = Math.min(devicePixelRatio, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener("resize", size);

    let start = null, done = false;
    const finish = () => {
      if (done) return; done = true; markIntro();
      wrap.classList.add("out");
      document.documentElement.classList.remove("intro-lock");
      setTimeout(() => wrap.remove(), 700);
    };
    wrap.querySelector(".intro-skip").onclick = finish;
    wrap.addEventListener("click", e => { if (e.target === cv) finish(); });
    addEventListener("keydown", finish, { once: true });

    const state = {};
    const frame = now => {
      if (done) return;
      if (start === null) start = now;
      const t = (now - start) / 1000;
      draw(ctx, W, H, t, state);
      if (t > duration - 1.1) wrap.classList.add("show-title");
      if (t > duration) return finish();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---------- Apex: neon car drifting with tyre smoke and skid trails ----------
  function drawDrift(ctx, W, H, t, s) {
    if (!s.skid) {
      s.skid = document.createElement("canvas"); s.skid.width = W; s.skid.height = H;
      s.sctx = s.skid.getContext("2d"); s.smoke = []; s.prev = null;
    }
    // Background: night road with moving perspective grid.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#07050f"); bg.addColorStop(1, "#1a0b2e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,61,139,.12)"; ctx.lineWidth = 1;
    const off = (t * 120) % 60;
    for (let x = -W; x < W * 2; x += 60) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off - W * 0.3, H); ctx.stroke(); }
    for (let y = off; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Car path: a sweeping curve that ends near the centre.
    const u = ease(clamp(t / 2.0));
    const P0 = [-0.15 * W, 0.92 * H], P1 = [0.62 * W, 1.05 * H], P2 = [0.5 * W, 0.42 * H];
    const bez = (a, b, c, k) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * b + k * k * c;
    const x = bez(P0[0], P1[0], P2[0], u), y = bez(P0[1], P1[1], P2[1], u);
    const dx = 2 * (1 - u) * (P1[0] - P0[0]) + 2 * u * (P2[0] - P1[0]);
    const dy = 2 * (1 - u) * (P1[1] - P0[1]) + 2 * u * (P2[1] - P1[1]);
    const drift = 0.75 * Math.sin(Math.PI * clamp(u * 1.1));      // body angle beyond the travel direction
    const heading = Math.atan2(dy, dx) - drift;
    const L = Math.min(W, H) * 0.2, Wd = L * 0.46;

    // Rear-wheel positions -> skid trails and smoke.
    const rot = (px, py) => [x + px * Math.cos(heading) - py * Math.sin(heading), y + px * Math.sin(heading) + py * Math.cos(heading)];
    const rears = [rot(-L * 0.32, -Wd * 0.48), rot(-L * 0.32, Wd * 0.48)];
    const moving = u < 0.999;
    if (s.prev && moving) {
      s.sctx.lineCap = "round";
      rears.forEach((p, i) => {
        s.sctx.strokeStyle = "rgba(255,61,139,.35)"; s.sctx.lineWidth = Wd * 0.13;
        s.sctx.beginPath(); s.sctx.moveTo(...s.prev[i]); s.sctx.lineTo(...p); s.sctx.stroke();
      });
    }
    s.prev = rears;
    ctx.drawImage(s.skid, 0, 0, W, H);
    if (moving) rears.forEach(([px, py]) => {
      for (let k = 0; k < 4; k++) s.smoke.push({ x: px, y: py, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60 - 10, r: Wd * 0.15, a: 0.55, life: 0 });
    });
    s.smoke.forEach(p => { p.life += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.r += 1.6; p.a *= 0.965; });
    s.smoke = s.smoke.filter(p => p.a > 0.02);
    s.smoke.forEach(p => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(230,215,255,${p.a})`); g.addColorStop(1, "rgba(230,215,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    // Car body (top-down, original design).
    ctx.save(); ctx.translate(x, y); ctx.rotate(heading);
    const beam = ctx.createLinearGradient(L * 0.5, 0, L * 2.2, 0);
    beam.addColorStop(0, "rgba(220,250,255,.35)"); beam.addColorStop(1, "rgba(220,250,255,0)");
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(L * 0.48, -Wd * 0.3); ctx.lineTo(L * 2.2, -Wd * 1.1); ctx.lineTo(L * 2.2, Wd * 1.1); ctx.lineTo(L * 0.48, Wd * 0.3); ctx.fill();
    ctx.shadowColor = "#ff3d8b"; ctx.shadowBlur = 30;
    const paint = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
    paint.addColorStop(0, "#ff3d8b"); paint.addColorStop(1, "#ff8a3d");
    ctx.fillStyle = paint; roundRect(ctx, -L / 2, -Wd / 2, L, Wd, Wd * 0.35); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0d0a1c"; roundRect(ctx, -L * 0.22, -Wd * 0.36, L * 0.5, Wd * 0.72, Wd * 0.2); ctx.fill();
    ctx.fillStyle = "rgba(45,226,230,.55)"; roundRect(ctx, L * 0.12, -Wd * 0.32, L * 0.12, Wd * 0.64, Wd * 0.1); ctx.fill();
    ctx.fillStyle = "#e8fbff"; ctx.fillRect(L * 0.46, -Wd * 0.4, L * 0.04, Wd * 0.18); ctx.fillRect(L * 0.46, Wd * 0.22, L * 0.04, Wd * 0.18);
    ctx.fillStyle = "#ff2d6f"; ctx.fillRect(-L * 0.5, -Wd * 0.42, L * 0.03, Wd * 0.84);
    ctx.restore();
  }

  // ---------- Turf: floodlights, a cricket ball streak and a football bouncing into the camera ----------
  function drawBall(ctx, W, H, t, s) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#050b16"); bg.addColorStop(0.7, "#0b2a2a"); bg.addColorStop(1, "#0d3b2b");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // Floodlight beams.
    const on = clamp((t - 0.1) / 0.3);
    [[0.08, -0.05, 0.6], [0.92, -0.05, -0.6]].forEach(([fx, fy, ang]) => {
      ctx.save(); ctx.translate(fx * W, fy * H); ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, 0, H * 1.2);
      g.addColorStop(0, `rgba(200,255,230,${0.35 * on})`); g.addColorStop(1, "rgba(200,255,230,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-W * 0.35, H * 1.2); ctx.lineTo(W * 0.35, H * 1.2); ctx.lineTo(10, 0); ctx.fill();
      ctx.restore();
    });
    // Pitch lines.
    const ground = H * 0.78;
    ctx.strokeStyle = "rgba(57,255,156,.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, ground + H * 0.08, W * 0.18, H * 0.05, 0, 0, Math.PI * 2); ctx.stroke();

    // Cricket ball streak (top right to bottom left).
    const ct = clamp((t - 0.25) / 0.7);
    if (ct > 0 && ct < 1) {
      const cx = W * (1.05 - ct * 1.2), cy = H * (0.15 + ct * 0.45), r = Math.min(W, H) * 0.025;
      const trail = ctx.createLinearGradient(cx, cy, cx + W * 0.25, cy - H * 0.1);
      trail.addColorStop(0, "rgba(255,60,90,.8)"); trail.addColorStop(1, "rgba(255,60,90,0)");
      ctx.strokeStyle = trail; ctx.lineWidth = r * 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + W * 0.25, cy - H * 0.1); ctx.stroke();
      ctx.fillStyle = "#c8102e"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff4e0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, -0.6, 0.6); ctx.stroke();
    }

    // Football: bounces in from the left, then flies at the camera.
    const R0 = Math.min(W, H) * 0.07;
    let bx, by, R;
    if (t < 1.5) {
      const p = t / 1.5;
      bx = -R0 + p * (W / 2 + R0);
      by = ground - R0 - Math.abs(Math.sin(p * Math.PI * 3)) * H * 0.32 * (1 - p * 0.6);
      R = R0;
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.beginPath(); ctx.ellipse(bx, ground + 4, R * (1.1 - (ground - R - by) / H), R * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const p = ease(clamp((t - 1.5) / 0.75));
      bx = W / 2; by = ground - R0 - p * (ground - R0 - H / 2);
      R = R0 + p * Math.hypot(W, H) * 0.75;
    }
    drawFootball(ctx, bx, by, R, t * 7);
    if (t > 2.1) { ctx.fillStyle = `rgba(57,255,156,${clamp((t - 2.1) / 0.25) * 0.85})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawFootball(ctx, x, y, R, spin) {
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = "#39ff9c"; ctx.shadowBlur = 25;
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
    g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#b9c6d6");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    ctx.rotate(spin);
    ctx.fillStyle = "#0b0d14";
    const pent = (cx, cy, r, a) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const q = a + i * Math.PI * 2 / 5; ctx.lineTo(cx + r * Math.cos(q), cy + r * Math.sin(q)); }
      ctx.closePath(); ctx.fill();
    };
    pent(0, 0, R * 0.32, -Math.PI / 2);
    for (let i = 0; i < 5; i++) { const q = -Math.PI / 2 + i * Math.PI * 2 / 5 + Math.PI / 5; pent(Math.cos(q) * R * 0.88, Math.sin(q) * R * 0.88, R * 0.3, q); }
    ctx.strokeStyle = "#0b0d14"; ctx.lineWidth = Math.max(1, R * 0.03);
    for (let i = 0; i < 5; i++) {
      const q = -Math.PI / 2 + i * Math.PI * 2 / 5;
      ctx.beginPath(); ctx.moveTo(Math.cos(q) * R * 0.32, Math.sin(q) * R * 0.32); ctx.lineTo(Math.cos(q) * R * 0.62, Math.sin(q) * R * 0.62); ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  const forceIntro = /[?&]intro\b/.test(location.search);
  if (!reduced && (forceIntro || !seenIntro())) {
    if (theme === "apex") runIntro(drawDrift, 3.1, "APEX AUTO", "& Trail Mechanics");
    if (theme === "turf") runIntro(drawBall, 3.0, "ELITE STRIKERS", "Turf Club · Dublin");
  }

  // ======================================================================
  //  OPTIONAL HERO VIDEO (set CONFIG.turf.heroVideo / CONFIG.apex.heroVideo)
  // ======================================================================
  const videoSrc = window.CONFIG?.[theme]?.heroVideo;
  const scene = document.querySelector(".hero .scene");
  if (videoSrc && scene) {
    const v = document.createElement("video");
    Object.assign(v, { src: videoSrc, autoplay: true, muted: true, loop: true, playsInline: true });
    v.className = "hero-video";
    scene.prepend(v);
  }

  // ======================================================================
  //  SCROLL REVEALS
  // ======================================================================
  const revealTargets = document.querySelectorAll("main .card, .staff-zone > h3, .ride");
  revealTargets.forEach(el => {
    el.classList.add("reveal");
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 4) * 90}ms`;
  });
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add("in"));
  }

  // ======================================================================
  //  HERO PARALLAX (mouse + scroll)
  // ======================================================================
  const hero = document.querySelector(".hero");
  if (hero && !reduced) {
    hero.addEventListener("pointermove", e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      hero.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  }

  // ======================================================================
  //  TILT CARDS (home page)
  // ======================================================================
  if (!reduced) document.querySelectorAll(".tilt").forEach(card => {
    card.addEventListener("pointermove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      card.style.setProperty("--gx", `${(x + 0.5) * 100}%`); card.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

  // ======================================================================
  //  SCROLL-DRIVEN STRIP: cars & bikes (Apex) / football & cricket (Turf)
  // ======================================================================
  const ride = document.getElementById("ride");
  if (ride) {
    const wheel = (cx, cy, r, cls) => `<g class="wheel ${cls}" style="transform-origin:${cx}px ${cy}px">
        <circle cx="${cx}" cy="${cy}" r="${r}" class="tyre"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" class="rim"/>
        ${[0, 60, 120].map(a => `<line x1="${cx - r * 0.6 * Math.cos(a * Math.PI / 180)}" y1="${cy - r * 0.6 * Math.sin(a * Math.PI / 180)}" x2="${cx + r * 0.6 * Math.cos(a * Math.PI / 180)}" y2="${cy + r * 0.6 * Math.sin(a * Math.PI / 180)}" class="spoke"/>`).join("")}
      </g>`;
    if (theme === "apex") {
      ride.innerHTML = `
        <div class="ride-marquee"><span>Service · Earn · Redeem · Verify · Ride on-chain · Service · Earn · Redeem · Verify · Ride on-chain ·</span></div>
        <div class="ride-track">
          <div class="speed"></div>
          <svg class="veh car" viewBox="0 0 400 130" data-speed="1.5" data-r="26">
            <defs><linearGradient id="carPaint" x1="0" x2="1"><stop offset="0" stop-color="#2a1640"/><stop offset="1" stop-color="#4a1d5e"/></linearGradient></defs>
            <path class="trail" d="M-160 72 H20 M-120 88 H24 M-200 56 H40"/>
            <path class="body" fill="url(#carPaint)" d="M20 96 L28 72 Q60 62 122 58 L172 30 Q192 22 244 24 L302 32 Q334 40 362 60 L386 70 Q394 84 388 96 Z"/>
            <path class="glass" d="M180 34 Q196 28 240 29 L292 36 L300 56 L160 58 Z"/>
            <rect x="380" y="70" width="10" height="6" class="lamp"/><rect x="20" y="70" width="8" height="10" class="tail"/>
            ${wheel(98, 96, 26, "w1")}${wheel(316, 96, 26, "w2")}
          </svg>
          <svg class="veh bike" viewBox="0 0 300 170" data-speed="1.15" data-r="36">
            <path class="trail" d="M-150 96 H30 M-110 120 H40"/>
            <path class="frame" d="M62 128 L128 98 L196 66 L236 128 M128 98 L170 128 L236 128 M196 66 L212 52"/>
            <path class="body" d="M120 70 Q150 52 196 62 L190 82 Q150 84 124 90 Z"/>
            <path class="seat" d="M70 82 Q96 74 124 78 L122 88 Q96 88 74 92 Z"/>
            <path class="rider" d="M104 74 Q120 40 150 36 Q172 34 186 54 L176 60 Q160 48 146 56 Q132 70 128 92 Z"/>
            <circle cx="160" cy="26" r="15" class="helmet"/>
            <rect x="204" y="56" width="10" height="8" class="lamp"/>
            ${wheel(62, 128, 36, "w1")}${wheel(236, 128, 36, "w2")}
          </svg>
        </div>`;
    } else if (theme === "turf") {
      ride.innerHTML = `
        <div class="ride-marquee"><span>Book · Play · Win · Paid on-chain · Book · Play · Win · Paid on-chain · Book · Play · Win ·</span></div>
        <div class="ride-track">
          <div class="speed"></div>
          <svg class="veh fball" viewBox="0 0 120 120" data-speed="1.4" data-r="50">
            <g class="wheel w1" style="transform-origin:60px 60px">
              <circle cx="60" cy="60" r="50" class="ball"/>
              <polygon points="60,38 81,53 73,78 47,78 39,53" class="patch"/>
              <polygon points="60,10 72,18 68,30 52,30 48,18" class="patch"/>
              <polygon points="104,48 110,62 100,72 92,64 96,50" class="patch"/>
              <polygon points="16,48 24,50 28,64 20,72 10,62" class="patch"/>
              <polygon points="34,98 46,92 54,102 46,110 34,108" class="patch"/>
              <polygon points="86,98 86,108 74,110 66,102 74,92" class="patch"/>
            </g>
          </svg>
          <svg class="veh cball" viewBox="0 0 60 60" data-speed="1.9" data-r="22">
            <g class="wheel w1" style="transform-origin:30px 30px">
              <circle cx="30" cy="30" r="22" class="red"/>
              <path d="M14 14 Q30 30 14 46 M46 14 Q30 30 46 46" class="seam"/>
            </g>
          </svg>
          <svg class="stumps" viewBox="0 0 80 140">
            <rect x="12" y="30" width="7" height="105" rx="3"/><rect x="36" y="30" width="7" height="105" rx="3"/><rect x="60" y="30" width="7" height="105" rx="3"/>
            <rect class="bail b1" x="10" y="22" width="30" height="6" rx="3"/><rect class="bail b2" x="40" y="22" width="30" height="6" rx="3"/>
          </svg>
        </div>`;
    }

    const vehicles = [...ride.querySelectorAll(".veh")];
    const marquee = ride.querySelector(".ride-marquee span");
    const stumps = ride.querySelector(".stumps");
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = ride.getBoundingClientRect(), vh = innerHeight;
      const p = clamp((vh - r.top) / (vh + r.height));
      const trackW = ride.clientWidth;
      vehicles.forEach((v, i) => {
        const speed = Number(v.dataset.speed), w = v.getBoundingClientRect().width || 200;
        const x = -w + p * speed * (trackW + w) - i * trackW * 0.25;
        let y = 0;
        if (v.classList.contains("cball")) y = -Math.sin(clamp(p * speed) * Math.PI) * 90;
        if (v.classList.contains("fball")) y = -Math.abs(Math.sin(p * 10)) * 40 * (1 - p);
        v.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        const deg = (x / (Number(v.dataset.r) * (w / v.viewBox.baseVal.width))) * (180 / Math.PI);
        v.querySelectorAll(".wheel").forEach(wh => (wh.style.transform = `rotate(${deg}deg)`));
      });
      if (marquee) marquee.style.transform = `translate3d(${-p * 35}%, 0, 0)`;
      if (stumps) stumps.classList.toggle("hit", p > 0.62);
      ride.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    update();
  }
})();
