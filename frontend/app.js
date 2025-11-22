// Minimal ABI: only what the frontend uses
const AFFIRMATIONS_ABI = [
  "event AffirmationCreated(bytes32 indexed affirmationHash, address indexed author, uint256 createdAt, uint256 effectiveAt)",
  "function createAffirmation(bytes32 affirmationHash, uint256 effectiveAt) external",
  "function getAffirmations() view returns (tuple(bytes32 affirmationHash, address author, uint256 createdAt, uint256 effectiveAt)[] memory)"
];

// TODO: paste your deployed contract address here (World Chain)
const CONTRACT_ADDRESS = "0xBB5Fb3b6e9E51dcDBC2dfd0B16208242dEc20B97";

let provider; // JsonRpcProvider on World Chain
let contract;
let currentAccount;
let isWorldMiniApp = false;

const WORLD_RPC_URL = "https://worldchain-mainnet.g.alchemy.com/public";
const BACKEND_BASE = ""; // same origin; backend is server.js serving /api/*

// Local mapping of affirmationHash -> text (purely off-chain)
const localTextByHash = new Map();

const connectButton = document.getElementById("connectButton");
const submitButton = document.getElementById("submitButton");
const affirmationInput = document.getElementById("affirmationInput");
const effectiveAtInput = document.getElementById("effectiveAtInput");
const statusEl = document.getElementById("status");
const timelineEl = document.getElementById("timeline");
const charCountEl = document.getElementById("charCount");

function setStatus(message, kind) {
  statusEl.textContent = message || "";
  statusEl.className = "status" + (kind ? " " + kind : "");
}

function shortenAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function toUnixFromLocalInput(value) {
  if (!value) return null;
  // value like "2025-11-21T20:37"
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.floor(dt.getTime() / 1000);
}

function fromUnixToString(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function persistLocalText(hash, text) {
  if (!hash) return;
  localTextByHash.set(hash, text);
  try {
    const stored = JSON.parse(localStorage.getItem("ethercast_texts") || "{}");
    stored[hash] = text;
    localStorage.setItem("ethercast_texts", JSON.stringify(stored));
  } catch (_) {}
}

function loadLocalTexts() {
  try {
    const stored = JSON.parse(localStorage.getItem("ethercast_texts") || "{}");
    Object.entries(stored).forEach(([hash, text]) => {
      localTextByHash.set(hash, text);
    });
  } catch (_) {}
}

async function connectWallet() {
  if (!isWorldMiniApp) {
    setStatus("This version of EtherCast is meant to run inside World App.", "error");
    return;
  }

  try {
    if (!window.MiniKit || !window.MiniKit.commandsAsync?.walletAuth) {
      setStatus("MiniKit wallet auth is not available in this environment.", "error");
      return;
    }

    // 1. Get nonce from backend
    const nonceResp = await fetch(`${BACKEND_BASE}/api/nonce`);
    const { nonce } = await nonceResp.json();

    // 2. Ask World App wallet to sign SIWE message
    const { finalPayload } = await window.MiniKit.commandsAsync.walletAuth({
      nonce,
      requestId: "0",
      statement:
        "Sign in to EtherCast to cast retrocausal affirmations on World Chain.",
      expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });

    if (!finalPayload || finalPayload.status === "error") {
      setStatus("Wallet authentication was cancelled or failed.", "error");
      return;
    }

    // 3. Verify SIWE on backend
    const completeResp = await fetch(`${BACKEND_BASE}/api/complete-siwe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: finalPayload, nonce })
    });

    const completeData = await completeResp.json();
    if (!completeData.ok) {
      console.error("complete-siwe error", completeData);
      setStatus("Wallet authentication verification failed.", "error");
      return;
    }

    currentAccount = completeData.address;

    connectButton.textContent = shortenAddress(currentAccount);
    connectButton.disabled = true;
    submitButton.disabled = false;
    setStatus("Signed in with World App wallet. You can cast affirmations.", "success");
  } catch (err) {
    console.error(err);
    setStatus("Failed to authenticate with World App wallet.", "error");
  }
}

async function submitAffirmation() {
  if (!isWorldMiniApp) {
    setStatus("This version of EtherCast is meant to run inside World App.", "error");
    return;
  }

  if (!currentAccount) {
    setStatus("Sign in with your World App wallet first.", "error");
    return;
  }

  const text = affirmationInput.value.trim();
  const whenStr = effectiveAtInput.value;

  if (!text) {
    setStatus("Affirmation text is required.", "error");
    return;
  }
  if (text.length > 256) {
    setStatus("Text must be 256 characters or fewer.", "error");
    return;
  }

  const effectiveAt = toUnixFromLocalInput(whenStr);
  const now = Math.floor(Date.now() / 1000);
  if (!effectiveAt || effectiveAt <= now) {
    setStatus("Effective time must be in the future.", "error");
    return;
  }

  try {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(text));
    setStatus("Submitting affirmation to chain...", "");
    submitButton.disabled = true;

    if (!window.MiniKit || !window.MiniKit.commandsAsync?.sendTransaction) {
      setStatus("MiniKit sendTransaction is not available.", "error");
      return;
    }

    const { finalPayload } = await window.MiniKit.commandsAsync.sendTransaction({
      transaction: [
        {
          address: CONTRACT_ADDRESS,
          abi: AFFIRMATIONS_ABI,
          functionName: "createAffirmation",
          args: [hash, effectiveAt]
        }
      ]
    });

    if (!finalPayload || finalPayload.status === "error") {
      setStatus("World App transaction was cancelled or failed.", "error");
      return;
    }

    persistLocalText(hash, text);
    setStatus("Affirmation cast via World App. It may take a moment to appear on the timeline.", "success");

    affirmationInput.value = "";
    charCountEl.textContent = "0";

    await refreshTimeline();
  } catch (err) {
    console.error(err);
    setStatus("Transaction failed or was rejected.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function refreshTimeline() {
  if (!provider || !contract) {
    renderTimeline([]);
    return;
  }

  try {
    const logs = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [ethers.id("AffirmationCreated(bytes32,address,uint256,uint256)")],
      fromBlock: 0,
      toBlock: "latest"
    });

    const iface = new ethers.Interface(AFFIRMATIONS_ABI);

    const items = logs.map((log) => {
      const parsed = iface.decodeEventLog("AffirmationCreated", log.data, log.topics);
      const affirmationHash = parsed.affirmationHash;
      const author = parsed.author;
      const createdAt = Number(parsed.createdAt);
      const effectiveAt = Number(parsed.effectiveAt);
      const text = localTextByHash.get(affirmationHash) || "(off-chain text unknown on this device)";
      return { affirmationHash, author, createdAt, effectiveAt, text };
    });

    items.sort((a, b) => a.effectiveAt - b.effectiveAt);
    renderTimeline(items);
  } catch (err) {
    console.error(err);
    setStatus("Failed to read timeline from chain.", "error");
  }
}

function renderTimeline(items) {
  timelineEl.innerHTML = "";

  if (!items.length) {
    const msg = document.createElement("div");
    msg.className = "timeline-empty";
    msg.textContent = "No affirmations yet. The line awaits your first signal.";
    timelineEl.appendChild(msg);
    return;
  }

  for (const item of items) {
    const node = document.createElement("div");
    node.className = "timeline-node";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${fromUnixToString(item.effectiveAt)} • ${shortenAddress(item.author)}`;

    const hashEl = document.createElement("div");
    hashEl.className = "hash";
    const shortHash = String(item.affirmationHash).slice(0, 10);
    hashEl.textContent = shortHash + "…";

    const textEl = document.createElement("div");
    textEl.className = "text";
    textEl.textContent = item.text;

    node.appendChild(meta);
    node.appendChild(hashEl);
    node.appendChild(textEl);
    timelineEl.appendChild(node);
  }
}

function initCharCounter() {
  if (!affirmationInput || !charCountEl) return;
  const update = () => {
    charCountEl.textContent = String(affirmationInput.value.length);
  };
  affirmationInput.addEventListener("input", update);
  update();
}

window.addEventListener("load", () => {
  if (window.MiniKit && typeof window.MiniKit.isInstalled === "function") {
    try {
      isWorldMiniApp = window.MiniKit.isInstalled();
      if (isWorldMiniApp) {
        console.log("EtherCast running as a World mini app.");
      }
    } catch (e) {
      console.warn("MiniKit detection failed", e);
    }
  }

  loadLocalTexts();
  initCharCounter();
  connectButton.addEventListener("click", connectWallet);
  submitButton.addEventListener("click", submitAffirmation);
});
