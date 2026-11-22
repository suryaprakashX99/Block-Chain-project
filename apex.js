// Apex Auto & Trail Mechanics page logic.
// Contracts: ApexPoints (ERC-20, decimals 0) and ApexGear (ERC-721).

(() => {
  const $ = id => App.$(id);
  const cfg = CONFIG.apex;
  let pts, gear, isGarage = false;

  const euro = points => `€${(Number(points) * cfg.euroPer100Points / 100).toFixed(2)}`;

  $("redeemPts").addEventListener("input", () => { $("redeemValue").textContent = euro($("redeemPts").value || 0); });
  $("rewEuro").addEventListener("input", () => {
    $("rewPts").textContent = Math.floor(Number($("rewEuro").value || 0) * cfg.pointsPerEuro);
  });

  // ---------- reads ----------
  async function refresh() {
    if (App.isConfigured("ApexPoints")) {
      const bal = await pts.balanceOf(App.account);
      $("ptsBalance").textContent = `${bal.toLocaleString()} pts`;
      $("ptsValue").textContent = euro(bal);
    }
    if (App.isConfigured("ApexGear")) {
      $("gearCount").textContent = String(await gear.balanceOf(App.account));
    }
    loadFeed();
  }

  function showVerify(ok, html) {
    $("verifyResult").innerHTML = `<div class="result ${ok ? "good" : "bad"}">${html}</div>`;
  }

  async function verifyById(id) {
    try {
      const [product, serial, owner, at] = await gear.verifyGear(id);
      const date = new Date(Number(at) * 1000).toLocaleDateString();
      showVerify(true, `<b>✓ Authentic: certified by Apex Auto</b>
        <dl><dt>Certificate</dt><dd>#${id}</dd><dt>Product</dt><dd>${App.escape(product)}</dd>
        <dt>Serial</dt><dd>${App.escape(serial)}</dd>
        <dt>Current owner</dt><dd><a href="${App.addrLink(owner)}" target="_blank" rel="noopener">${App.short(owner)}</a>${owner.toLowerCase() === App.account.toLowerCase() ? " (you)" : ""}</dd>
        <dt>Certified on</dt><dd>${date}</dd></dl>`);
    } catch (e) {
      showVerify(false, `<b>✗ No certificate #${App.escape(id)}</b><br>This item was not certified by Apex Auto. Treat it as unverified.`);
    }
  }

  async function verifyBySerial(serial) {
    const used = await gear.serialUsed(ethers.keccak256(ethers.toUtf8Bytes(serial)));
    if (!used) {
      return showVerify(false, `<b>✗ Serial ${App.escape(serial)} has no certificate</b><br>Ask the seller for the certificate number. A missing certificate is a warning sign of counterfeit gear.`);
    }
    // Find which certificate holds this serial from the GearCertified events.
    const logs = await App.events(gear, "GearCertified", CONFIG.deployBlock.ApexGear);
    const hit = logs.find(l => l.args.serialNumber === serial);
    if (hit) return verifyById(hit.args.tokenId);
    showVerify(true, `<b>✓ This serial is certified</b><br>Enter the certificate number to see the current owner.`);
  }

  async function loadFeed() {
    const jobs = [];
    if (App.isConfigured("ApexPoints")) {
      jobs.push(App.events(pts, "PointsRewarded", CONFIG.deployBlock.ApexPoints).then(ls => ls.map(l => ({
        block: l.blockNumber, hash: l.transactionHash, text: `+${l.args.points} pts · ${l.args.invoiceRef}`, who: l.args.customer, kind: "Reward" }))));
      jobs.push(App.events(pts, "PointsRedeemed", CONFIG.deployBlock.ApexPoints).then(ls => ls.map(l => ({
        block: l.blockNumber, hash: l.transactionHash, text: `−${l.args.points} pts · ${l.args.invoiceRef}`, who: l.args.customer, kind: "Redeem" }))));
    }
    if (App.isConfigured("ApexGear")) {
      jobs.push(App.events(gear, "GearCertified", CONFIG.deployBlock.ApexGear).then(ls => ls.map(l => ({
        block: l.blockNumber, hash: l.transactionHash, text: `#${l.args.tokenId} ${l.args.product}`, who: l.args.buyer, kind: "Certified" }))));
    }
    const rows = (await Promise.all(jobs)).flat().sort((a, b) => b.block - a.block).slice(0, 25);
    $("feed").innerHTML = rows.length ? rows.map(r => `
      <li><div>${App.escape(r.text)}<br><span class="muted">${r.kind} · ${App.short(r.who)}</span></div>
      <div><a href="${App.txLink(r.hash)}" target="_blank" rel="noopener">↗</a></div></li>`).join("")
      : `<li class="empty">No activity yet.</li>`;
  }

  // ---------- writes ----------
  $("verifyBtn").onclick = async () => {
    if (!App.account) return App.log("Connect MetaMask first.", "error");
    const id = $("verifyId").value.trim(), serial = $("verifySerial").value.trim();
    if (id) return verifyById(BigInt(id));
    if (serial) return verifyBySerial(serial);
    App.log("Enter a certificate number or a serial number.", "error");
  };

  $("redeemBtn").onclick = async () => {
    const r = await App.send("Redeem points", () => pts.redeemPoints(BigInt($("redeemPts").value || 0), $("redeemInv").value.trim()));
    if (r) refresh();
  };

  $("xferBtn").onclick = async () => {
    const r = await App.send("Transfer certificate", () =>
      gear.transferFrom(App.account, $("xferTo").value.trim(), BigInt($("xferId").value || 0)));
    if (r) refresh();
  };

  $("rewBtn").onclick = async () => {
    const points = BigInt(Math.floor(Number($("rewEuro").value || 0) * cfg.pointsPerEuro));
    const r = await App.send("Reward points", () => pts.rewardService($("rewTo").value.trim(), points, $("rewInv").value.trim()));
    if (r) refresh();
  };

  // Picks the certificate artwork that matches the product.
  function gearImage(product) {
    const p = product.toLowerCase();
    if (p.includes("helmet")) return "apex-gear-helmet.png";
    if (p.includes("glove")) return "apex-gear-gloves.png";
    if (p.includes("boot")) return "apex-gear-boots.png";
    return "apex-gear-jacket.png";
  }

  $("gearBtn").onclick = async () => {
    const id = BigInt($("gearId").value || 0);
    const size = $("gearSize").value.trim();
    const serial = $("gearSerial").value.trim();
    const product = $("gearProduct").value + (size ? ` - Size ${size}` : "");

    // Use a typed URI if given, otherwise build the metadata from the form.
    const uri = $("gearUri").value.trim() || App.dataUri({
      name: `Apex Authentic Gear #${id}`,
      description: "Certificate of authenticity issued by Apex Auto & Trail Mechanics at point of sale. Transfers with the item on resale.",
      image: App.assetUrl(gearImage(product)),
      attributes: [
        { trait_type: "Product", value: $("gearProduct").value },
        { trait_type: "Size", value: size || "-" },
        { trait_type: "Serial", value: serial },
        { trait_type: "Sold by", value: "Apex Auto & Trail Mechanics" },
        { trait_type: "Certified", value: new Date().toISOString().slice(0, 10) }
      ]
    });

    const r = await App.send("Certify gear", () => gear.mint($("gearTo").value.trim(), id, uri, product, serial));
    if (r) refresh();
  };

  // ---------- connect ----------
  $("connectBtn").onclick = async () => {
    if (!(await App.connect())) return;
    try {
      if (App.isConfigured("ApexPoints")) {
        pts = App.contract("ApexPoints");
        isGarage = (await pts.tokenOwner()).toLowerCase() === App.account.toLowerCase();
      }
      if (App.isConfigured("ApexGear")) {
        gear = App.contract("ApexGear");
        isGarage = isGarage || (await gear.owner()).toLowerCase() === App.account.toLowerCase();
      }
      App.setupRole(isGarage, "Signed in as garage staff", "Signed in as customer");
      await refresh();
    } catch (e) {
      App.log(App.reason(e), "error");
    }
  };

  document.addEventListener("apex-refresh", () => { if (App.account) refresh(); });

  App.configNotice(["ApexPoints", "ApexGear", "GarageChallenge"]);
})();
