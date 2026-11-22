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
        $("passStatus").textContent = `Active · #${id}`;
        $("passSeason").textContent = String(await pass.seasonOf(id));
        $("passDiscount").textContent = `${discount}%`;
      } else {
        discount = 0;
        $("passStatus").textContent = "None";
        $("passSeason").textContent = "-";
        $("passDiscount").textContent = "0%";
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
    if (r) refresh();
  };

  $("revokeBtn").onclick = async () => {
    const r = await App.send("Revoke Elite Pass", () => pass.revoke(BigInt($("revokeId").value || 0)));
    if (r) refresh();
  };

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
      await refresh();
    } catch (e) {
      App.log(App.reason(e), "error");
    }
  };

  App.configNotice(["StrikeCoin", "ElitePass"]);
})();
