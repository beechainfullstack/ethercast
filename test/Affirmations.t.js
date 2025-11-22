const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Affirmations", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const Affirmations = await ethers.getContractFactory("Affirmations");
    const affirmations = await Affirmations.deploy();
    await affirmations.waitForDeployment();
    return { affirmations, owner, other };
  }

  it("deploys correctly", async function () {
    const { affirmations } = await deployFixture();
    const addr = await affirmations.getAddress();
    expect(addr).to.properAddress;
  });

  it("emits AffirmationCreated and stores fields correctly", async function () {
    const { affirmations, owner } = await deployFixture();
    const text = "I am a luminous node in the cosmic ledger";
    const hash = ethers.keccak256(ethers.toUtf8Bytes(text));
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const effectiveAt = now + 60;

    const tx = await affirmations.createAffirmation(hash, effectiveAt);
    await expect(tx)
      .to.emit(affirmations, "AffirmationCreated")
      .withArgs(hash, owner.address, anyValue => anyValue > 0, effectiveAt);

    const stored = await affirmations.getAffirmations();
    expect(stored.length).to.equal(1);
    const a = stored[0];
    expect(a.affirmationHash).to.equal(hash);
    expect(a.author).to.equal(owner.address);
    expect(a.effectiveAt).to.equal(effectiveAt);
  });

  it("rejects non-future effectiveAt", async function () {
    const { affirmations } = await deployFixture();
    const text = "Time-locked intention";
    const hash = ethers.keccak256(ethers.toUtf8Bytes(text));
    const now = (await ethers.provider.getBlock("latest")).timestamp;

    await expect(
      affirmations.createAffirmation(hash, now)
    ).to.be.revertedWith("effectiveAt must be future");

    await expect(
      affirmations.createAffirmation(hash, now - 1)
    ).to.be.revertedWith("effectiveAt must be future");
  });

  it("allows multiple affirmations", async function () {
    const { affirmations, other } = await deployFixture();
    const now = (await ethers.provider.getBlock("latest")).timestamp;

    const texts = [
      "I am a clear channel for benevolent timelines",
      "My code and consciousness are in resonance",
      "Retrocausal blessings ripple through my work"
    ];

    for (let i = 0; i < texts.length; i++) {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(texts[i]));
      const effectiveAt = now + 60 * (i + 1);
      const signer = i === 0 ? other : undefined;
      const contract = signer ? affirmations.connect(signer) : affirmations;
      await contract.createAffirmation(hash, effectiveAt);
    }

    const stored = await affirmations.getAffirmations();
    expect(stored.length).to.equal(texts.length);
  });
});
