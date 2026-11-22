// Shared Web3 helper used by both client pages.
// Uses ethers.js v6 (js/ethers.umd.min.js) and MetaMask (window.ethereum).

const App = {
  provider: null,
  signer: null,
  account: null,

  // ---------- small DOM helpers ----------
  $(id) { return document.getElementById(id); },
  short(addr) { return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : ""; },
  txLink(hash) { return `${CONFIG.network.explorer}/tx/${hash}`; },
  addrLink(addr) { return `${CONFIG.network.explorer}/address/${addr}`; },
  escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  // ---------- activity log (bottom-right panel) ----------
  log(message, type = "info", link) {
    const box = this.$("log");
    if (!box) return;
    const item = document.createElement("div");
    item.className = `log-item ${type}`;
    item.innerHTML = `<span>${this.escape(message)}</span>` +
      (link ? ` <a href="${link}" target="_blank" rel="noopener">View on Etherscan</a>` : "");
    box.prepend(item);
    box.classList.add("show");
    while (box.children.length > 5) box.lastChild.remove();          // keep the panel short
    if (type === "ok" || type === "info") setTimeout(() => item.remove(), 15000);
  },

  // ---------- NFT metadata ----------
  // Full public URL of an image hosted with the site.
  assetUrl(file) { return new URL((CONFIG.assetPath || "") + file, location.href).href; },

  // Packs a metadata object into a self-contained tokenURI
  // (data:application/json;base64,...), so no JSON file needs hosting.
  dataUri(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return "data:application/json;base64," + btoa(bin);
  },

  // ---------- wallet connection ----------
  async connect() {
    if (!window.ethereum) {
      this.log("MetaMask was not found. Install the MetaMask browser extension and reload.", "error");
      return false;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await this.ensureNetwork();
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.account = await this.signer.getAddress();

      window.ethereum.on?.("accountsChanged", () => location.reload());
      window.ethereum.on?.("chainChanged", () => location.reload());

      const btn = this.$("connectBtn");
      if (btn) { btn.textContent = this.short(this.account); btn.classList.add("connected"); }
      this.log(`Connected ${this.short(this.account)} on ${CONFIG.network.name}`, "ok");
      return true;
    } catch (e) {
      this.log(this.reason(e), "error");
      return false;
    }
  },

  async ensureNetwork() {
    const current = await window.ethereum.request({ method: "eth_chainId" });
    if (current.toLowerCase() === CONFIG.network.chainIdHex) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIG.network.chainIdHex }]
      });
    } catch (e) {
      throw new Error(`Please switch MetaMask to the ${CONFIG.network.name} test network.`);
    }
  },

  // ---------- contracts ----------
  isConfigured(name) { return ethers.isAddress(CONFIG.contracts[name] || ""); },

  contract(name) {
    if (!this.isConfigured(name)) {
      throw new Error(`${name} address is not set. Paste the deployed address into js/config.js.`);
    }
    return new ethers.Contract(CONFIG.contracts[name], ABIS[name], this.signer);
  },

  // Sends a transaction and reports each stage in the activity log.
  async send(label, makeTx) {
    try {
      this.log(`${label}: confirm in MetaMask...`, "pending");
      const tx = await makeTx();
      this.log(`${label}: submitted, waiting for a block...`, "pending", this.txLink(tx.hash));
      const receipt = await tx.wait();
      this.log(`${label}: confirmed in block ${receipt.blockNumber}`, "ok", this.txLink(tx.hash));
      return receipt;
    } catch (e) {
      this.log(`${label} failed: ${this.reason(e)}`, "error");
      return null;
    }
  },

  // Event history, newest first. Falls back to a recent window if the RPC limits the range.
  async events(contract, eventName, deployBlock) {
    const filter = contract.filters[eventName]();
    // Ask the node for the latest block directly (ethers caches it for a few seconds).
    const latest = Number(await this.provider.send("eth_blockNumber", []));
    try {
      return (await contract.queryFilter(filter, deployBlock || 0, latest)).reverse();
    } catch (e) {
      return (await contract.queryFilter(filter, Math.max(0, latest - 9000), latest)).reverse();
    }
  },

  // Turns ethers/MetaMask errors into a readable sentence (e.g. the contract's require message).
  reason(e) {
    if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "You rejected the request in MetaMask.";
    return e?.reason || e?.revert?.args?.[0] || e?.info?.error?.message || e?.shortMessage || e?.message || String(e);
  },

  // Shows a gentle notice if a page loads before addresses are configured.
  configNotice(names) {
    const missing = names.filter(n => !this.isConfigured(n));
    const el = this.$("configNotice");
    if (el && missing.length) {
      el.innerHTML = `Setup needed: add the deployed address for <b>${missing.join(", ")}</b> in <code>js/config.js</code>.`;
      el.hidden = false;
    }
  }
};
