// Elite Strikers Turf Club page logic.
// Contracts: StrikeCoin (ERC-20) and ElitePass (ERC-721).

(() => {
  const $ = id => App.$(id);
  const cfg = CONFIG.turf;
  let strk, pass, decimals = 18n, discount = 0, isClub = false, rate = 10000n, cbPct = 5, xMode = "buy";

  // ---------- booking form setup ----------
  cfg.pitches.forEach((p, i) => $("pitch").add(new Option(p, String.fromCharCode(65 + i))));
  for (let h = 7; h <= 21; h++) $("bookHour").add(new Option(`${String(h).padStart(2, "0")}:00`, String(h).padStart(2, "0")));
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  $("bookDate").value = tomorrow;
  $("bookDate").min = new Date().toISOString().slice(0, 10);

  const fmt = v => Number(ethers.formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });

  function basePrice() { return $("bookType").value === "day" ? cfg.priceFullDay : cfg.priceHourly; }
  function finalPrice() { return Math.round(basePrice() * (100 - discount)) / 100; }

  // Booking reference format: BK|<date>|<pitch>|<hour or DAY>
  function bookingRef() {
    const slot = $("bookType").value === "day" ? "DAY" : $("bookHour").value;
    return `BK|${$("bookDate").value}|${$("pitch").value}|${slot}`;
  }

  function updatePrice() {
    $("hourWrap").hidden = $("bookType").value === "day";
    $("price").textContent = `${finalPrice()} STRK`;
    $("priceNote").textContent = discount ? `(${basePrice()} less ${discount}% Elite Pass discount)` : "";
    $("cashback").textContent = cbPct ? `+${Math.round(finalPrice() * cbPct) / 100} STRK back` : "";
  }
  ["bookType", "bookHour", "bookDate", "pitch"].forEach(id => $(id).addEventListener("change", updatePrice));
  updatePrice();

  // ---------- reads ----------
  async function refresh() {
    $("ethBalance").textContent = `${Number(ethers.formatEther(await App.provider.getBalance(App.account))).toFixed(4)} ETH`;
    if (App.isConfigured("StrikeCoin")) {
      $("strkBalance").textContent = `${fmt(await strk.balanceOf(App.account))} STRK`;
      rate = await strk.tokensPerEth();
      cbPct = Number(await strk.rewardPercent());
      const [res, req, circ] = await Promise.all([strk.reserveBalance(), strk.requiredReserve(), strk.circulatingSupply()]);
      $("rate").textContent = Number(rate).toLocaleString();
      $("cbPct").textContent = `${cbPct}%`;
      $("reserve").textContent = `${Number(ethers.formatEther(res)).toFixed(4)} ETH`;
      $("circ").textContent = `${fmt(circ)} STRK`;
      $("sReserve").textContent = `${Number(ethers.formatEther(res)).toFixed(4)} ETH`;
      $("sRequired").textContent = `${Number(ethers.formatEther(req)).toFixed(4)} ETH`;
      updateQuote();
    }
    if (App.isConfigured("ElitePass")) {
      const id = await pass.passOf(App.account);
      if (id > 0n) {
        discount = Number(await pass.discountPercent(id));
        const season = Number(await pass.seasonOf(id));
        $("passStatus").textContent = `Active · #${id}`;
        $("passSeason").textContent = String(season);
        $("passDiscount").textContent = `${discount}%`;
        renderLounge(id, season, discount);
      } else {
        discount = 0;
        $("passStatus").textContent = "None";
        $("passSeason").textContent = "-";
        $("passDiscount").textContent = "0%";
        renderLounge(null);
      }
    }
    updatePrice();
    loadFeed();
  }

  // Paid booking references, read from MatchFeePaid events.
  async function paidRefs() {
    const logs = await App.events(strk, "MatchFeePaid", CONFIG.deployBlock.StrikeCoin);
    return logs.map(l => l.args.bookingRef);
  }

  // A full-day booking clashes with any hour on that pitch/date, and vice versa.
  function clashes(ref, existing) {
    const [, date, pitch, slot] = ref.split("|");
    return existing.some(r => {
      const [, d, p, s] = r.split("|");
      return d === date && p === pitch && (s === slot || s === "DAY" || slot === "DAY");
    });
  }

  async function loadFeed() {
    if (!App.isConfigured("StrikeCoin")) return;
    const [fees, prizes, rewards, buys, sells] = await Promise.all(
      ["MatchFeePaid", "PrizePaid", "RewardEarned", "TokensBought", "TokensSold"].map(n => App.events(strk, n, CONFIG.deployBlock.StrikeCoin)));
    const rows = [
      ...fees.map(l => ({ block: l.blockNumber, hash: l.transactionHash,
        text: `Booking ${l.args.bookingRef.replaceAll("|", " ")}`, who: l.args.team, amt: l.args.amount, kind: "Fee" })),
      ...prizes.map(l => ({ block: l.blockNumber, hash: l.transactionHash,
        text: `Prize · ${l.args.tournament}`, who: l.args.winner, amt: l.args.amount, kind: "Prize" })),
      ...rewards.map(l => ({ block: l.blockNumber, hash: l.transactionHash,
        text: `Cashback reward`, who: l.args.team, amt: l.args.amount, kind: "Reward" })),
      ...buys.map(l => ({ block: l.blockNumber, hash: l.transactionHash,
        text: `Bought with ${Number(ethers.formatEther(l.args.ethIn)).toFixed(4)} ETH`, who: l.args.buyer, amt: l.args.strkOut, kind: "Buy" })),
      ...sells.map(l => ({ block: l.blockNumber, hash: l.transactionHash,
        text: `Sold for ${Number(ethers.formatEther(l.args.ethOut)).toFixed(4)} ETH`, who: l.args.seller, amt: l.args.strkIn, kind: "Sell" }))
    ].sort((a, b) => b.block - a.block).slice(0, 25);

    $("feed").innerHTML = rows.length ? rows.map(r => `
      <li><div>${App.escape(r.text)}<br><span class="muted">${r.kind} · ${App.short(r.who)}</span></div>
      <div><b>${fmt(r.amt)}</b> <a href="${App.txLink(r.hash)}" target="_blank" rel="noopener">↗</a></div></li>`).join("")
      : `<li class="empty">No payments yet.</li>`;
  }

  // ---------- writes ----------
  $("payBtn").onclick = async () => {
    if (!App.account) return App.log("Connect MetaMask first.", "error");
    const ref = bookingRef();
    if (!$("bookDate").value) return App.log("Choose a date.", "error");
    // The contract rejects an exact duplicate; the website also blocks hour/full-day overlaps.
    if (await strk.isBooked(ref) || clashes(ref, await paidRefs())) {
      return App.log("That slot is already booked. Pick another time or pitch.", "error");
    }
    const amount = ethers.parseUnits(String(finalPrice()), decimals);
    const r = await App.send(`Booking ${ref.replaceAll("|", " ")}`, () => strk.payMatchFee(amount, ref));
    if (r) refresh();
  };

  $("sellBtn").onclick = async () => {
    const amount = ethers.parseUnits($("sellAmt").value || "0", decimals);
    const r = await App.send("Send STRK", () => strk.transfer($("sellTo").value.trim(), amount));
    if (r) refresh();
  };

  $("prizeBtn").onclick = async () => {
    const amount = ethers.parseUnits($("prizeAmt").value || "0", decimals);
    const r = await App.send("Prize payment", () => strk.payPrize($("prizeTo").value.trim(), amount, $("prizeName").value.trim()));
    if (r) refresh();
  };

  $("mintPassBtn").onclick = async () => {
    const id = BigInt($("passId").value || 0);
    const season = Number($("passSeasonIn").value);
    const disc = Number($("passDisc").value);

    // Use a typed URI if given, otherwise build the metadata from the form.
    const uri = $("passUri").value.trim() || App.dataUri({
      name: `Elite Strikers Season Pass #${id}`,
      description: "Seasonal membership of Elite Strikers Turf Club, Dublin. Grants member booking discounts for the season shown. Non-transferable.",
      image: App.assetUrl("elite-pass.png"),
      attributes: [
        { trait_type: "Season", value: season },
        { trait_type: "Booking discount", value: `${disc}%` },
        { trait_type: "Club", value: "Elite Strikers Turf Club" }
      ]
    });

    const r = await App.send("Mint Elite Pass", () => pass.mint($("passTo").value.trim(), id, uri, season, disc));
    if (r) { refresh(); loadDashboard(); }
  };

  $("revokeBtn").onclick = async () => {
    const r = await App.send("Revoke Elite Pass", () => pass.revoke(BigInt($("revokeId").value || 0)));
    if (r) { refresh(); loadDashboard(); }
  };

  // ---------- Member lounge + 3D Elite Pass card ----------
  const hero = document.querySelector(".hero h1"), heroP = document.querySelector(".hero p");
  const heroDefault = [hero.innerHTML, heroP.innerHTML];
  async function renderLounge(id, season, disc) {
    const member = id !== null;
    document.body.classList.toggle("member", member);
    $("lounge").classList.toggle("locked", !member);
    // Members can book 30 days ahead, everyone else 7.
    const max = new Date(Date.now() + (member ? 30 : 7) * 86400000).toISOString().slice(0, 10);
    $("bookDate").max = max;
    if ($("bookDate").value > max) $("bookDate").value = max;
    $("bfCash").textContent = `${cbPct}% STRK cashback`;
    if (!member) {
      hero.innerHTML = heroDefault[0]; heroP.innerHTML = heroDefault[1];
      $("loungeTitle").textContent = "Unlock the Elite Pass";
      $("loungeStats").hidden = true; $("passLock").hidden = false;
      $("pcOwner").textContent = "MEMBERS ONLY"; $("pcNum").textContent = "#----";
      return;
    }
    hero.innerHTML = "Welcome back,<br>Elite member";
    heroP.innerHTML = `Your Season ${season} pass is active: <b>${disc}% off</b> every booking, a 30-day booking window and ${cbPct}% STRK back on every game.`;
    $("loungeTitle").textContent = "Your Elite Pass";
    $("loungeTag").textContent = `Member #${id} · Season ${season}`;
    $("loungeSub").textContent = "Your membership lives in your wallet as a non-transferable NFT. These benefits are applied automatically whenever you book.";
    $("bfDisc").textContent = `${disc}% off every booking`;
    $("passLock").hidden = true;
    $("pcSeason").textContent = `SEASON ${season}`; $("pcSeason2").textContent = String(season);
    $("pcNum").textContent = `#${String(id).padStart(4, "0")}`;
    $("pcOwner").textContent = App.short(App.account);
    $("pcWallet").textContent = App.account; $("pcToken").textContent = `#${id}`; $("pcDisc").textContent = `${disc}%`;
    $("pcContract").textContent = App.short(CONFIG.contracts.ElitePass);
    // Decorative member code generated from the wallet address.
    const hex = App.account.slice(2).toLowerCase();
    $("pcQr").innerHTML = Array.from({ length: 49 }, (_, i) => `<i style="opacity:${parseInt(hex[i % 40], 16) > 6 ? 1 : 0.12}"></i>`).join("");
    // Personal stats from on-chain events.
    if (App.isConfigured("StrikeCoin")) {
      const [fees, rewards] = await Promise.all([App.events(strk, "MatchFeePaid", CONFIG.deployBlock.StrikeCoin), App.events(strk, "RewardEarned", CONFIG.deployBlock.StrikeCoin)]);
      const mine = fees.filter(l => l.args.team.toLowerCase() === App.account.toLowerCase());
      const paid = mine.reduce((s, l) => s + Number(ethers.formatUnits(l.args.amount, decimals)), 0);
      const cash = rewards.filter(l => l.args.team.toLowerCase() === App.account.toLowerCase()).reduce((s, l) => s + Number(ethers.formatUnits(l.args.amount, decimals)), 0);
      $("lsBookings").textContent = mine.length;
      $("lsSaved").textContent = `${(paid * disc / (100 - disc)).toFixed(1)} STRK`;
      $("lsCash").textContent = `${cash.toFixed(1)} STRK`;
      $("loungeStats").hidden = false;
    }
  }
  // Card interaction: tilt with the pointer, click to flip.
  const card = $("pass3d"), inner = $("passInner");
  let flipped = false;
  card.addEventListener("pointermove", e => {
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    inner.style.transform = `rotateY(${(flipped ? 180 : 0) + x * 28}deg) rotateX(${-y * 22}deg)`;
    card.style.setProperty("--hx", `${(x + 0.5) * 100}%`); card.style.setProperty("--hy", `${(y + 0.5) * 100}%`);
  });
  card.addEventListener("pointerleave", () => { inner.style.transform = `rotateY(${flipped ? 180 : 0}deg)`; });
  card.addEventListener("click", () => { flipped = !flipped; inner.style.transform = `rotateY(${flipped ? 180 : 0}deg)`; });

  // ---------- Club dashboard (staff) ----------
  async function loadDashboard() {
    if (!App.isConfigured("StrikeCoin") || !App.isConfigured("ElitePass")) return;
    const [issued, revoked, fees, rewards] = await Promise.all([
      App.events(pass, "PassIssued", CONFIG.deployBlock.ElitePass), App.events(pass, "PassRevoked", CONFIG.deployBlock.ElitePass),
      App.events(strk, "MatchFeePaid", CONFIG.deployBlock.StrikeCoin), App.events(strk, "RewardEarned", CONFIG.deployBlock.StrikeCoin)]);
    const gone = new Set(revoked.map(l => String(l.args.tokenId)));
    const members = issued.filter(l => !gone.has(String(l.args.tokenId))).reverse();
    const memberSet = new Set(members.map(l => l.args.member.toLowerCase()));
    const bookingsBy = {};
    fees.forEach(l => { const k = l.args.team.toLowerCase(); bookingsBy[k] = (bookingsBy[k] || 0) + 1; });

    const revenue = fees.reduce((s, l) => s + Number(ethers.formatUnits(l.args.amount, decimals)), 0);
    const cash = rewards.reduce((s, l) => s + Number(ethers.formatUnits(l.args.amount, decimals)), 0);
    const memberBookings = fees.filter(l => memberSet.has(l.args.team.toLowerCase())).length;
    $("kMembers").textContent = members.length;
    $("kBookings").textContent = fees.length;
    $("kRevenue").textContent = `${revenue.toLocaleString(undefined, { maximumFractionDigits: 1 })} STRK`;
    $("kCash").textContent = `${cash.toLocaleString(undefined, { maximumFractionDigits: 1 })} STRK`;
    $("kShare").textContent = fees.length ? `${Math.round(memberBookings / fees.length * 100)}%` : "-";

    const memberRows = await Promise.all(members.map(async l => `<tr>
      <td><b>#${l.args.tokenId}</b></td><td>${App.addrCell(l.args.member)}</td><td>${l.args.season}</td><td>${l.args.discount}%</td>
      <td>${App.fmtDate(await App.blockTime(l.blockNumber))}</td><td>${bookingsBy[l.args.member.toLowerCase()] || 0}</td></tr>`));
    $("tMembers").innerHTML = memberRows.join("") || `<tr><td colspan="6" class="empty">No active members yet.</td></tr>`;

    // Pitch usage (hours booked per pitch; a full day counts as 12 h).
    const hours = {};
    fees.forEach(l => { const [, , p, s] = l.args.bookingRef.split("|"); if (p) hours[p] = (hours[p] || 0) + (s === "DAY" ? 12 : 1); });
    const maxH = Math.max(1, ...Object.values(hours));
    $("pitchBars").innerHTML = cfg.pitches.map((name, i) => {
      const k = String.fromCharCode(65 + i), h = hours[k] || 0;
      return `<div class="bar"><span>${name}</span><div><i style="width:${h / maxH * 100}%"></i></div><b>${h} h</b></div>`;
    }).join("");

    const today = new Date().toISOString().slice(0, 10);
    const rows = await Promise.all(fees.map(async l => {
      const [, date, p, slot] = l.args.bookingRef.split("|");
      return { date: date || "-", pitch: p ? cfg.pitches[p.charCodeAt(0) - 65] || p : "-", slot: slot === "DAY" ? "Full day" : slot ? `${slot}:00` : "-",
        team: l.args.team, member: memberSet.has(l.args.team.toLowerCase()), amt: Number(ethers.formatUnits(l.args.amount, decimals)),
        at: await App.blockTime(l.blockNumber), hash: l.transactionHash, upcoming: (date || "") >= today };
    }));
    const draw = () => {
      const f = $("bookFilter").value;
      const list = rows.filter(r => f === "all" || (f === "upcoming" && r.upcoming) || (f === "past" && !r.upcoming) || (f === "members" && r.member))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      $("tBookings").innerHTML = list.map(r => `<tr class="${r.upcoming ? "" : "past"}">
        <td><b>${r.date}</b></td><td>${App.escape(r.pitch)}</td><td>${r.slot}</td><td>${App.addrCell(r.team)}</td>
        <td>${r.member ? '<span class="pill gold">Elite</span>' : "-"}</td><td>${r.amt.toLocaleString(undefined, { maximumFractionDigits: 2 })} STRK</td>
        <td>${App.fmtDate(r.at)}</td><td><a href="${App.txLink(r.hash)}" target="_blank" rel="noopener">↗</a></td></tr>`).join("")
        || `<tr><td colspan="8" class="empty">No bookings match.</td></tr>`;
    };
    $("bookFilter").onchange = draw; draw();
  }
  $("dashRefresh").onclick = () => loadDashboard().catch(e => App.log(App.reason(e), "error"));

  // ---------- STRK exchange ----------
  function updateQuote() {
    const v = Number($("xAmt").value || 0);
    if (xMode === "buy") $("xOut").textContent = (v * Number(rate)).toLocaleString(undefined, { maximumFractionDigits: 2 });
    else $("xOut").textContent = (v / Number(rate)).toFixed(6);
  }
  document.querySelectorAll("[data-x]").forEach(b => (b.onclick = () => {
    xMode = b.dataset.x;
    document.querySelectorAll("[data-x]").forEach(x => x.classList.toggle("on", x === b));
    $("xLabel").textContent = xMode === "buy" ? "You pay (SepoliaETH)" : "You sell (STRK)";
    $("xUnit").textContent = xMode === "buy" ? "STRK" : "SepoliaETH";
    $("xBtn").textContent = xMode === "buy" ? "Buy STRK" : "Sell STRK";
    $("xAmt").step = xMode === "buy" ? "0.001" : "1";
    $("xAmt").placeholder = xMode === "buy" ? "0.01" : "100";
    updateQuote();
  }));
  $("xAmt").addEventListener("input", updateQuote);
  $("xBtn").onclick = async () => {
    if (!App.account) return App.log("Connect MetaMask first.", "error");
    const v = $("xAmt").value.trim();
    if (!v || Number(v) <= 0) return App.log("Enter an amount.", "error");
    const r = xMode === "buy"
      ? await App.send("Buy STRK", () => strk.buyTokens({ value: ethers.parseEther(v) }))
      : await App.send("Sell STRK", () => strk.sellTokens(ethers.parseUnits(v, decimals)));
    if (r) { $("xAmt").value = ""; refresh(); }
  };
  $("fundBtn").onclick = async () => {
    const v = $("fundAmt").value.trim();
    if (!v) return App.log("Enter an amount of SepoliaETH.", "error");
    const r = await App.send("Fund reserve", () => strk.fundReserve({ value: ethers.parseEther(v) }));
    if (r) refresh();
  };
  $("withdrawBtn").onclick = async () => {
    const r = await App.send("Withdraw excess ETH", () => strk.withdrawExcess());
    if (r) refresh();
  };

  // ---------- connect ----------
  $("connectBtn").onclick = async () => {
    if (!(await App.connect())) return;
    try {
      if (App.isConfigured("StrikeCoin")) {
        strk = App.contract("StrikeCoin");
        decimals = BigInt(await strk.decimals());
        isClub = (await strk.tokenOwner()).toLowerCase() === App.account.toLowerCase();
      }
      if (App.isConfigured("ElitePass")) {
        pass = App.contract("ElitePass");
        isClub = isClub || (await pass.owner()).toLowerCase() === App.account.toLowerCase();
      }
      App.setupRole(isClub, "Signed in as club treasury", "Signed in as team / member");
      if (isClub) loadDashboard().catch(e => App.log(App.reason(e), "error"));
      await refresh();
    } catch (e) {
      App.log(App.reason(e), "error");
    }
  };

  App.configNotice(["StrikeCoin", "ElitePass"]);
})();
