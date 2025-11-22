require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { SiweMessage } = require("siwe");

const app = express();
const PORT = process.env.PORT || 4000;

// Simple in-memory nonce store (sufficient for hackathon-style usage)
const nonces = new Set();

app.use(cors());
app.use(express.json());

// Serve static EtherCast frontend
const frontendDir = path.join(__dirname, "frontend");
app.use(express.static(frontendDir));

// Wallet auth: issue nonce
app.get("/api/nonce", (req, res) => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  nonces.add(nonce);
  res.json({ nonce });
});

// Wallet auth: complete SIWE verification
app.post("/api/complete-siwe", async (req, res) => {
  try {
    const { payload, nonce } = req.body || {};
    if (!payload || !nonce || !nonces.has(nonce)) {
      return res.status(400).json({ ok: false, error: "invalid-nonce-or-payload" });
    }

    nonces.delete(nonce);

    if (payload.status !== "success") {
      return res.status(400).json({ ok: false, error: "wallet-auth-error" });
    }

    const { message, signature, address } = payload;
    if (!message || !signature || !address) {
      return res.status(400).json({ ok: false, error: "missing-fields" });
    }

    const siweMessage = new SiweMessage(message);
    await siweMessage.verify({ signature, nonce });

    // For this minimal backend we just echo the verified address.
    // You could set a real session or JWT here.
    return res.json({ ok: true, address });
  } catch (err) {
    console.error("/api/complete-siwe error", err);
    return res.status(500).json({ ok: false, error: "internal-error" });
  }
});

// Fallback to index.html for SPA-like routing
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`EtherCast backend + frontend server listening on http://localhost:${PORT}`);
});
