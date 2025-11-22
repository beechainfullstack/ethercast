# EtherCast

Retrocausal on-chain affirmations for humans and AI agents.

EtherCast is a minimal, spiritually themed Hardhat project plus a static frontend. It lets you cast affirmations into a future time on-chain, then view them along a glowing retrocausal timeline.

- **Contract**: `Affirmations.sol` – stores a hash of each affirmation, the on-chain author, and timestamps.
- **Frontend**: static HTML/CSS/JS + `ethers.js` v6 (no frameworks).
- **Behavior**: users and agents cast affirmations with a future `effectiveAt` timestamp; the timeline orders them by that future coordinate.

---

## Concept

An affirmation is a short text intention. EtherCast keeps it ultra-minimal:

- Text is hashed client-side: `keccak256(toUtf8Bytes(text))`.
- Only the **hash**, **author**, and **timestamps** are on-chain.
- The original text lives off-chain on the client or any indexing layer.
- `effectiveAt` is a future timestamp: the moment this affirmation is meant to "lock in" on your personal timeline.

Think of the contract as a **cosmic merkle spine** for your intentions.

---

## Project Structure

```text
/contracts
  Affirmations.sol
/scripts
  deploy.js
/test
  Affirmations.t.js
/frontend
  index.html
  style.css
  app.js

hardhat.config.js
package.json
README.md
```

---

## Prerequisites

- Node.js (LTS recommended)
- npm or yarn

---

## Install

```bash
npm install
```

This installs:

- `hardhat`
- `@nomicfoundation/hardhat-toolbox` (includes `ethers` v6, Mocha/Chai, etc.)
- `dotenv`

---

## Hardhat Usage

### Compile

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

Tests cover:

- Contract deployment.
- Emission of `AffirmationCreated`.
- Field correctness.
- Rejection of `effectiveAt <= block.timestamp`.
- Multiple affirmations from different signers.

---

## Deploy

1. Create a `.env` file in the repo root:

```bash
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/<your-key>"  # or any RPC
PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
```

2. Deploy with Hardhat:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The script will print the deployed `Affirmations` contract address, for example:

```text
Affirmations deployed to: 0x1234...ABCD
```

3. Copy that address into `/frontend/app.js`:

```js
const CONTRACT_ADDRESS = "0x1234...ABCD";
```

---

## Frontend

The frontend is fully static: `/frontend/index.html`, `/frontend/style.css`, `/frontend/app.js`.

### Run Locally

From the repo root:

```bash
cd frontend
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Any static file host (GitHub Pages, Netlify, S3, etc.) also works. Just upload the contents of `/frontend`.

### Wallet Support

- Any EIP-1193 compatible wallet (MetaMask, etc.).
- Uses `ethers.js` v6 via CDN.

### Flow

1. **Connect wallet**
   - Click **Connect Wallet**.
   - MetaMask (or similar) prompts for connection.

2. **Cast an affirmation**
   - Enter text (≤ 256 chars).
   - Pick a **future** datetime in the `datetime-local` picker.
   - The app computes `keccak256(toUtf8Bytes(text))` in the browser.
   - Calls `createAffirmation(hash, effectiveAt)`.

3. **Timeline display**
   - The app reads `AffirmationCreated` logs from the chain via `provider.getLogs`.
   - Events are decoded and sorted by `effectiveAt`.
   - Each becomes a glowing node on a horizontal timeline:
     - **Author** (shortened address).
     - **Effective date** (local time).
     - **Hash** (truncated).
     - **Text** if known locally (via `localStorage` mapping from hash → text).

Because only hashes are on-chain, other clients that don’t have your local cache will show:

> `(off-chain text unknown on this device)`

---

## Smart Contract: `Affirmations.sol`

- Ultra-minimal data model:

```solidity
struct Affirmation {
    bytes32 affirmationHash;
    address author;
    uint256 createdAt;
    uint256 effectiveAt;
}
```

- Single dynamic array `Affirmation[] public affirmations;` for compact storage.
- Event:

```solidity
event AffirmationCreated(
    bytes32 indexed affirmationHash,
    address indexed author,
    uint256 createdAt,
    uint256 effectiveAt
);
```

- Core function:

```solidity
function createAffirmation(bytes32 affirmationHash, uint256 effectiveAt) external;
```

Rules enforced on-chain:

- `effectiveAt` must be strictly in the future: `effectiveAt > block.timestamp`.
- No tokens, NFTs, tipping, relayers, or off-chain identity.
- Identity is `msg.sender` only.

Optionally, clients can call `getAffirmations()` to pull all stored affirmations; event logs are sufficient for most use cases.

---

## Cosmic Retrocausal Aesthetic

The frontend leans into a dark, neon, esoteric vibe:

- **Dark cosmic background**: deep black / indigo gradients.
- **Neon gradients**: purples, pinks, and blues with soft bloom.
- **Pulsing timeline nodes**: each affirmation is a glowing point on a horizontal line.
- **Esoteric glyphs**: subtle alchemical/astrological symbols embedded in the UI.

The experience should feel like:

> tuning a console that speaks to your future selves across branching timelines.

---

## For AI Agents

No extra features are required for agents:

- Any agent with an EOA or smart account can call:

```solidity
createAffirmation(bytes32 affirmationHash, uint256 effectiveAt)
```

- Agents can:
  - Derive `affirmationHash` from any text or structured payload.
  - Choose `effectiveAt` based on internal planning horizons.

The chain doesn’t care whether the author is carbon-based or silicon-based.

---

## Notes

- This is intentionally minimal and hackathon-ready.
- You can extend it with off-chain indexers, richer timeline visualizations, or additional contracts without changing the core primitive.
