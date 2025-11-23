"use client";

import { useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

const ACTION_ID = "ethercast-presence-check";

export default function Home() {
  const [status, setStatus] = useState<string>("");
  const [details, setDetails] = useState<string>("");

  async function handleVerify() {
    try {
      setStatus("awaiting-world");
      setDetails("open the World App to continue");

      if (!MiniKit.isInstalled()) {
        setStatus("not-in-world-app");
        setDetails("open this mini app from World App to verify");
        return;
      }

      const result = await MiniKit.commands.verify({
        action: ACTION_ID,
        signal: undefined,
      });

      if (result.status !== "success") {
        setStatus("rejected");
        setDetails("verification was not completed");
        return;
      }

      setStatus("verifying");
      setDetails("validating proof in the backend");

      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: result,
          action: ACTION_ID,
          signal: undefined,
        }),
      });

      const body = await response.json();

      if (response.ok && body.verifyRes?.success) {
        setStatus("verified");
        setDetails("the chain remembers you");
      } else {
        setStatus("failed");
        setDetails("verification failed or was already used");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
      setDetails("something echoed back from the void");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
      <main className="flex w-full max-w-xl flex-col items-stretch gap-10 px-6 py-16">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">ethercast · worldchain</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-zinc-300">a small door</span>
            <br />
            <span className="text-zinc-100">into the world below</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-zinc-500">
            this mini app listens for a single proof that you exist.
            no feed. no likes. just a quiet acknowledgement on world chain.
          </p>
        </header>

        <section className="space-y-6">
          <button
            type="button"
            onClick={handleVerify}
            className="w-full rounded-full border border-zinc-700 bg-zinc-950/40 px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-900"
          >
            verify presence
          </button>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent" />

          <div className="text-xs text-zinc-500 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">
              status
            </p>
            <p className="text-sm text-zinc-300">
              {status === "" && "waiting"}
              {status === "awaiting-world" && "awaiting world app"}
              {status === "not-in-world-app" && "open from world app to continue"}
              {status === "verifying" && "verifying proof in the backend"}
              {status === "verified" && "verified on world chain"}
              {status === "rejected" && "verification not completed"}
              {status === "failed" && "verification failed"}
              {status === "error" && "something went wrong"}
            </p>
            {details && <p className="text-xs text-zinc-600">{details}</p>}
          </div>
        </section>

        <footer className="mt-auto flex items-center justify-between text-[11px] text-zinc-600">
          <span>worldchain mini app</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
            proof or nothing
          </span>
        </footer>
      </main>
    </div>
  );
}
