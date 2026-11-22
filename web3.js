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

  // ---------- notifications (bottom-right) ----------
  // Returns a handle so one transaction can update a single toast in place.
  log(message, type = "info", link) {
    const box = this.$("log");
    if (!box) return { update() {}, close() {} };
    if (!box.dataset.ready) {
      box.dataset.ready = "1";
      box.innerHTML = `<button class="log-clear" type="button">Clear all</button>`;
      box.querySelector(".log-clear").onclick = () => { box.querySelectorAll(".log-item").forEach(n => n.remove()); box.classList.remove("show"); };
    }
    const item = document.createElement("div");
    let timer = null;
    const handle = {
      update: (msg, t = type, l) => {
        item.className = `log-item ${t}`;
        item.innerHTML = `<div class="log-body"><span>${this.escape(msg)}</span>` +
          (l ? ` <a href="${l}" target="_blank" rel="noopener">View on Etherscan ↗</a>` : "") +
          `</div><button class="log-x" type="button" aria-label="Dismiss">×</button>`;
        item.querySelector(".log-x").onclick = handle.close;
        clearTimeout(timer);
        if (t === "ok" || t === "info") timer = setTimeout(handle.close, 7000);   // success fades by itself
        return handle;
      },
      close: () => {
        clearTimeout(timer);
        item.classList.add("leaving");
        setTimeout(() => {
          item.remove();
          if (!box.querySelector(".log-item")) box.classList.remove("show");
        }, 250);
      }
    };
    handle.update(message, type, link);
    box.querySelector(".log-clear").after(item);
    box.classList.add("show");
    const items = box.querySelectorAll(".log-item");
    for (let i = 4; i < items.length; i++) items[i].remove();      // keep at most 4
    return handle;
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
      if (btn) {
        btn.textContent = this.short(this.account);
        btn.title = "Connected account";
        btn.classList.add("connected");
        if (!this.$("switchBtn")) {
          const sw = document.createElement("button");
          sw.id = "switchBtn"; sw.type = "button"; sw.className = "ghost";
          sw.textContent = "Switch account";
          sw.onclick = () => this.switchAccount();
          btn.after(sw);
        }
      }
      this.log(`Connected ${this.short(this.account)} on ${CONFIG.network.name}`, "ok");
      setTimeout(() => document.dispatchEvent(new Event("wallet-connected")), 0);
      return true;
    } catch (e) {
      this.log(this.reason(e), "error");
      return false;
    }
  },

  // Opens MetaMask's account picker so a different account can connect to this site.
  async switchAccount() {
    try {
      await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      location.reload();
    } catch (e) {
      this.log(this.reason(e), "error");
    }
  },

  // Staff accounts see the staff tools; they can also flip to the customer view.
  setupRole(isStaff, staffLabel, customerLabel) {
    const chip = this.$("roleChip"), zone = this.$("staffZone");
    const apply = staffView => {
      zone.hidden = !staffView;
      chip.textContent = staffView ? staffLabel : customerLabel;
      if (toggle) toggle.textContent = staffView ? "View as customer" : "View as staff";
    };
    let toggle = null;
    if (isStaff && !this.$("viewToggle")) {
      toggle = document.createElement("button");
      toggle.id = "viewToggle"; toggle.type = "button"; toggle.className = "ghost";
      let staffView = true;
      toggle.onclick = () => { staffView = !staffView; apply(staffView); };
      this.$("switchBtn")?.after(toggle);
      const dash = document.createElement("button");
      dash.type = "button"; dash.className = "ghost"; dash.textContent = "Dashboard";
      dash.onclick = () => { if (zone.hidden) toggle.click(); zone.scrollIntoView({ behavior: "smooth", block: "start" }); };
      toggle.after(dash);
    }
    apply(isStaff);
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

  // Sends a transaction and reports each stage in ONE toast that updates in place.
  async send(label, makeTx) {
    const toast = this.log(`${label}: confirm in MetaMask...`, "pending");
    try {
      const tx = await makeTx();
      toast.update(`${label}: submitted, waiting for a block...`, "pending", this.txLink(tx.hash));
      const receipt = await tx.wait();
      toast.update(`${label}: confirmed in block ${receipt.blockNumber}`, "ok", this.txLink(tx.hash));
      return receipt;
    } catch (e) {
      toast.update(`${label} failed: ${this.reason(e)}`, "error");
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

  // Block timestamp (cached) -> Date, used by the dashboards.
  _blockCache: {},
  async blockTime(n) {
    if (!this._blockCache[n]) this._blockCache[n] = this.provider.getBlock(n).then(b => new Date(Number(b.timestamp) * 1000));
    return this._blockCache[n];
  },
  fmtDate(d) { return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); },
  addrCell(a) {
    const me = this.account && a.toLowerCase() === this.account.toLowerCase();
    return `<a href="${this.addrLink(a)}" target="_blank" rel="noopener" class="mono">${this.short(a)}</a>${me ? ' <span class="pill">you</span>' : ""}`;
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

// Expose for ES modules (workshop.js) - top-level const is not a window property.
window.App = App;
