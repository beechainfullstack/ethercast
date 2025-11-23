"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

const AFFIRMATIONS_ABI = [
  "event AffirmationCreated(bytes32 indexed affirmationHash, address indexed author, uint256 createdAt, uint256 effectiveAt)",
  "function createAffirmation(bytes32 affirmationHash, uint256 effectiveAt) external",
  "function getAffirmations() view returns (tuple(bytes32 affirmationHash, address author, uint256 createdAt, uint256 effectiveAt)[] memory)"
];

const CONTRACT_ADDRESS = "0xBB5Fb3b6e9E51dcDBC2dfd0B16208242dEc20B97"; // World Chain
const WORLD_RPC_URL = "https://worldchain-mainnet.g.alchemy.com/public";

type TimelineItem = {
  affirmationHash: string;
  author: string;
  createdAt: number;
  effectiveAt: number;
  text: string;
};

function shortenAddress(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fromUnixToString(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function toUnixFromLocalInput(value: string) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.floor(dt.getTime() / 1000);
}

export default function HomePage() {
  const [status, setStatus] = useState<string>("");
  const [statusKind, setStatusKind] = useState<"" | "error" | "success">("");
  const [affirmationText, setAffirmationText] = useState("");
  const [effectiveAtLocal, setEffectiveAtLocal] = useState("");
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const charCount = affirmationText.length;

  const provider = useMemo(() => new ethers.JsonRpcProvider(WORLD_RPC_URL), []);
  const contract = useMemo(
    () => new ethers.Contract(CONTRACT_ADDRESS, AFFIRMATIONS_ABI, provider),
    [provider]
  );

  function setStatusTyped(message: string, kind: "" | "error" | "success" = "") {
    setStatus(message);
    setStatusKind(kind);
  }

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ethercast_texts") : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, string>;
        // just ensuring it's valid JSON; mapping is done per-item when rendering
      } catch {
        // ignore
      }
    }
  }, []);

  async function refreshTimeline() {
    try {
      const logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        topics: [ethers.id("AffirmationCreated(bytes32,address,uint256,uint256)")],
        fromBlock: 0,
        toBlock: "latest"
      });

      const iface = new ethers.Interface(AFFIRMATIONS_ABI);
      const stored = typeof window !== "undefined" ? localStorage.getItem("ethercast_texts") : null;
      let localMap: Record<string, string> = {};
      if (stored) {
        try {
          localMap = JSON.parse(stored) as Record<string, string>;
        } catch {
          localMap = {};
        }
      }

      const items: TimelineItem[] = logs.map((log) => {
        const parsed = iface.decodeEventLog("AffirmationCreated", log.data, log.topics) as any;
        const affirmationHash = parsed.affirmationHash as string;
        const author = parsed.author as string;
        const createdAt = Number(parsed.createdAt);
        const effectiveAt = Number(parsed.effectiveAt);
        const text = localMap[affirmationHash] || "(off-chain text unknown on this device)";
        return { affirmationHash, author, createdAt, effectiveAt, text };
      });

      items.sort((a, b) => a.effectiveAt - b.effectiveAt);
      setTimeline(items);
    } catch (err) {
      console.error(err);
      setStatusTyped("Failed to read timeline from World Chain.", "error");
    }
  }

  useEffect(() => {
    refreshTimeline();
  }, []);

  async function handleSignIn() {
    try {
      const MiniKit = (window as any).MiniKit;
      if (!MiniKit || typeof MiniKit.isInstalled !== "function" || !MiniKit.isInstalled()) {
        setStatusTyped("Open EtherCast inside World App to sign in with your wallet.", "error");
        return;
      }

      const nonceRes = await fetch("/api/nonce");
      const { nonce } = await nonceRes.json();

      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
        nonce,
        requestId: "0",
        statement: "Sign in to EtherCast to cast retrocausal affirmations on World Chain.",
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000)
      });

      if (!finalPayload || finalPayload.status === "error") {
        setStatusTyped("Wallet authentication was cancelled or failed.", "error");
        return;
      }

      const completeRes = await fetch("/api/complete-siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: finalPayload, nonce })
      });

      const completeData = await completeRes.json();
      if (!completeData.ok || !completeData.address) {
        console.error("complete-siwe error", completeData);
        setStatusTyped("Wallet authentication verification failed.", "error");
        return;
      }

      setCurrentAccount(completeData.address as string);
      setStatusTyped("Signed in with World App wallet. You can cast affirmations.", "success");
    } catch (err) {
      console.error(err);
      setStatusTyped("Failed to authenticate with World App wallet.", "error");
    }
  }

  async function handleSubmit() {
    if (!currentAccount) {
      setStatusTyped("Sign in with your World App wallet first.", "error");
      return;
    }

    const text = affirmationText.trim();
    const whenStr = effectiveAtLocal;

    if (!text) {
      setStatusTyped("Affirmation text is required.", "error");
      return;
    }
    if (text.length > 256) {
      setStatusTyped("Text must be 256 characters or fewer.", "error");
      return;
    }

    const effectiveAt = toUnixFromLocalInput(whenStr ?? "");
    const now = Math.floor(Date.now() / 1000);
    if (!effectiveAt || effectiveAt <= now) {
      setStatusTyped("Effective time must be in the future.", "error");
      return;
    }

    try {
      const MiniKit = (window as any).MiniKit;
      if (!MiniKit || typeof MiniKit.isInstalled !== "function" || !MiniKit.isInstalled()) {
        setStatusTyped("Open EtherCast inside World App to cast affirmations.", "error");
        return;
      }

      setSubmitting(true);
      setStatusTyped("Submitting affirmation to chain...", "");

      const hash = ethers.keccak256(ethers.toUtf8Bytes(text));

      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
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
        setStatusTyped("World App transaction was cancelled or failed.", "error");
        return;
      }

      // persist text mapping locally
      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("ethercast_texts") || "{}") as Record<
            string,
            string
          >;
          stored[hash] = text;
          localStorage.setItem("ethercast_texts", JSON.stringify(stored));
        } catch {
          // ignore
        }
      }

      setStatusTyped("Affirmation cast via World App. It may take a moment to appear on the timeline.", "success");
      setAffirmationText("");
      setEffectiveAtLocal("");
      await refreshTimeline();
    } catch (err) {
      console.error(err);
      setStatusTyped("Transaction failed or was rejected.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cosmos-bg">
      <main className="shell">
        <header className="header">
          <div className="logo-mark">⟠</div>
          <div>
            <h1>EtherCast</h1>
            <p className="subtitle">Retrocausal affirmations inscribed on the cosmic ledger.</p>
          </div>
          <button className="btn" onClick={handleSignIn}>
            {currentAccount ? shortenAddress(currentAccount) : "Sign in with World App"}
          </button>
        </header>

        <section className="panel">
          <h2>Cast a Retrocausal Affirmation</h2>
          <label className="field">
            <span>Affirmation Text (≤ 256 chars)</span>
            <textarea
              value={affirmationText}
              maxLength={256}
              placeholder="I am a luminous node in a benevolent multiverse..."
              onChange={(e) => setAffirmationText(e.target.value)}
            />
            <div className="field-meta">
              <span>{charCount}</span>/256
            </div>
          </label>

          <label className="field">
            <span>Effective At (future time)</span>
            <input
              type="datetime-local"
              value={effectiveAtLocal}
              onChange={(e) => setEffectiveAtLocal(e.target.value)}
            />
            <div className="field-meta">Timeline only accepts future coordinates.</div>
          </label>

          <button className="btn primary" onClick={handleSubmit} disabled={submitting}>
            Cast to Chain
          </button>
          <div className={`status ${statusKind}`}>{status}</div>
        </section>

        <section className="panel timeline-panel">
          <h2>Retrocausal Timeline</h2>
          <p className="subtitle small">
            Nodes ordered by effectiveAt. Later dates radiate further along the line.
          </p>
          <div className="timeline">
            {timeline.length === 0 ? (
              <div className="timeline-empty">
                No affirmations yet. The line awaits your first signal.
              </div>
            ) : (
              timeline.map((item) => (
                <div key={item.affirmationHash + item.effectiveAt} className="timeline-node">
                  <div className="meta">
                    {fromUnixToString(item.effectiveAt)} • {shortenAddress(item.author)}
                  </div>
                  <div className="hash">{String(item.affirmationHash).slice(0, 10)}…</div>
                  <div className="text">{item.text}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
