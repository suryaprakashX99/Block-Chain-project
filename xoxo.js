// Half-time XOXO: noughts & crosses with a football (player) vs a cricket ball (bot / player 2).
(() => {
  const board = document.getElementById("xoBoard");
  if (!board) return;
  const $ = id => document.getElementById(id);
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const S = { cells: Array(9).fill(null), turn: "F", mode: "ai", level: "pro", over: false, starter: "F", score: { F: 0, C: 0, D: 0 }, streak: 0, sound: true, busy: false };

  // ---------- board ----------
  board.innerHTML = Array.from({ length: 9 }, (_, i) => `<button type="button" class="xo-cell" data-i="${i}" aria-label="Square ${i + 1}"></button>`).join("");
  const cells = [...board.children];
  cells.forEach(c => (c.onclick = () => play(Number(c.dataset.i), true)));

  function render() {
    cells.forEach((c, i) => {
      const v = S.cells[i];
      if (v && !c.firstChild) c.innerHTML = `<svg viewBox="0 0 100 100"><use href="#${v === "F" ? "xo-football" : "xo-cricket"}"/></svg>`;
      if (!v) c.innerHTML = "";
      c.disabled = !!v || S.over || S.busy;
    });
    $("xoS1").textContent = S.score.F; $("xoS2").textContent = S.score.C; $("xoSD").textContent = S.score.D; $("xoStreak").textContent = S.streak;
    $("xoP1").classList.toggle("turn", !S.over && S.turn === "F");
    $("xoP2").classList.toggle("turn", !S.over && S.turn === "C");
    $("xoP2Name").textContent = S.mode === "ai" ? "Club bot" : "Player 2";
    $("xoP1Name").textContent = S.mode === "ai" ? "You" : "Player 1";
  }

  const winner = b => {
    for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { who: b[l[0]], line: l };
    return b.every(Boolean) ? { who: "D", line: [] } : null;
  };

  function play(i, human) {
    if (S.over || S.cells[i] || S.busy) return;
    if (human && S.mode === "ai" && S.turn === "C") return;
    S.cells[i] = S.turn;
    sfx(S.turn === "F" ? "kick" : "bat");
    const w = winner(S.cells);
    if (w) return end(w);
    S.turn = S.turn === "F" ? "C" : "F";
    banner(S.mode === "ai" ? (S.turn === "F" ? "Your move" : "Club bot is thinking…") : (S.turn === "F" ? "Player 1 - football" : "Player 2 - cricket ball"));
    render();
    if (S.mode === "ai" && S.turn === "C") {
      S.busy = true; render();
      setTimeout(() => { S.busy = false; play(botMove(), false); }, 420 + Math.random() * 380);
    }
  }

  function end(w) {
    S.over = true;
    if (w.who === "D") { S.score.D++; banner("Draw - honours even"); sfx("draw"); }
    else {
      S.score[w.who]++;
      w.line.forEach(i => cells[i].classList.add("win"));
      const youWon = w.who === "F";
      if (S.mode === "ai") {
        S.streak = youWon ? S.streak + 1 : 0;
        banner(youWon ? (S.level === "legend" ? "Impossible… you beat Legend!" : "GOAL! You win!") : "Howzat! The bot wins");
      } else banner(youWon ? "Player 1 wins!" : "Player 2 wins!");
      sfx(youWon || S.mode === "pvp" ? "win" : "lose");
      if (youWon || S.mode === "pvp") confetti(w.who === "F" ? ["#ffffff", "#39ff9c", "#2de2e6", "#0b0d14"] : ["#ff3d5a", "#fff4e0", "#ffe066"]);
    }
    render();
  }

  function newGame() {
    S.cells = Array(9).fill(null); S.over = false; S.busy = false;
    cells.forEach(c => c.classList.remove("win"));
    S.starter = S.starter === "F" ? "C" : "F";          // alternate who kicks off
    S.turn = S.starter;
    render();
    if (S.mode === "ai" && S.turn === "C") { banner("Bot kicks off…"); S.busy = true; render(); setTimeout(() => { S.busy = false; play(botMove(), false); }, 600); }
    else banner(S.mode === "ai" ? "Your kick-off" : S.turn === "F" ? "Player 1 - football" : "Player 2 - cricket ball");
  }

  // ---------- bot ----------
  function minimax(b, player, depth) {
    const w = winner(b);
    if (w) return { score: w.who === "C" ? 10 - depth : w.who === "F" ? depth - 10 : 0 };
    const moves = [];
    b.forEach((v, i) => {
      if (v) return;
      b[i] = player;
      moves.push({ i, score: minimax(b, player === "C" ? "F" : "C", depth + 1).score });
      b[i] = null;
    });
    return moves.reduce((best, m) => (player === "C" ? m.score > best.score : m.score < best.score) ? m : best, { score: player === "C" ? -Infinity : Infinity });
  }
  function botMove() {
    const free = S.cells.map((v, i) => (v ? null : i)).filter(i => i !== null);
    const random = () => free[Math.floor(Math.random() * free.length)];
    const blunder = { rookie: 0.65, pro: 0.22, legend: 0 }[S.level];
    if (Math.random() < blunder) return random();
    if (free.length === 9) return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)];
    return minimax(S.cells.slice(), "C", 0).i;
  }

  // ---------- controls ----------
  document.querySelectorAll("[data-mode]").forEach(b => (b.onclick = () => {
    S.mode = b.dataset.mode; S.score = { F: 0, C: 0, D: 0 }; S.streak = 0; S.starter = "C";
    document.querySelectorAll("[data-mode]").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll("[data-level]").forEach(x => (x.style.display = S.mode === "ai" ? "" : "none"));
    newGame();
  }));
  document.querySelectorAll("[data-level]").forEach(b => (b.onclick = () => {
    S.level = b.dataset.level; S.streak = 0;
    document.querySelectorAll("[data-level]").forEach(x => x.classList.toggle("on", x === b));
    newGame();
  }));
  $("xoNew").onclick = newGame;
  $("xoSound").onclick = () => { S.sound = !S.sound; $("xoSound").textContent = S.sound ? "🔊 Sound" : "🔇 Muted"; };

  function banner(t) { const b = $("xoBanner"); b.textContent = t; b.animate([{ transform: "scale(1.15)", opacity: 0.4 }, { transform: "scale(1)", opacity: 1 }], { duration: 260, easing: "ease-out" }); }

  // ---------- sound (synthesised, no audio files) ----------
  let ctx;
  function sfx(kind) {
    if (!S.sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      const tone = (f, t, d, type = "sine", g = 0.18) => {
        const o = ctx.createOscillator(), a = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, now + t);
        a.gain.setValueAtTime(g, now + t); a.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        o.connect(a).connect(ctx.destination); o.start(now + t); o.stop(now + t + d);
      };
      if (kind === "kick") { tone(140, 0, 0.15, "sine", 0.35); tone(70, 0.02, 0.18, "sine", 0.3); }
      if (kind === "bat") { tone(900, 0, 0.06, "square", 0.08); tone(420, 0.01, 0.1, "triangle", 0.15); }
      if (kind === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, "triangle", 0.16));
      if (kind === "lose") [392, 330, 262].forEach((f, i) => tone(f, i * 0.14, 0.3, "sawtooth", 0.07));
      if (kind === "draw") [440, 440].forEach((f, i) => tone(f, i * 0.16, 0.14, "triangle", 0.1));
    } catch {}
  }

  // ---------- confetti ----------
  function confetti(colours) {
    const c = $("xoConfetti"), r = c.parentElement.getBoundingClientRect();
    const w = c.width = r.width, h = c.height = r.height, x = c.getContext("2d");
    const bits = Array.from({ length: 120 }, () => ({ x: w / 2, y: h / 2, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 11 - 3, s: Math.random() * 6 + 3, a: Math.random() * 6, c: colours[Math.floor(Math.random() * colours.length)] }));
    let n = 0;
    (function f() {
      x.clearRect(0, 0, w, h);
      bits.forEach(b => { b.vy += 0.32; b.x += b.vx; b.y += b.vy; b.a += 0.2; x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.fillStyle = b.c; x.fillRect(-b.s, -b.s / 2, b.s * 2, b.s); x.restore(); });
      if (++n < 130) requestAnimationFrame(f); else x.clearRect(0, 0, w, h);
    })();
  }

  S.starter = "C"; newGame();
})();
