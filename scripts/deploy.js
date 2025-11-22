const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      `No signer available for network "${hre.network.name}". ` +
        "Check that WORLD_PRIVATE_KEY (for world) or PRIVATE_KEY (for sepolia) is set, " +
        "starts with 0x, and is 32 bytes (64 hex chars)."
    );
  }

  console.log("Deploying Affirmations to network:", hre.network.name);
  console.log("Deployer address:", await signers[0].getAddress());

  // With ethers v6 + Hardhat, prefer hre.ethers.deployContract
  const affirmations = await hre.ethers.deployContract("Affirmations");

  await affirmations.waitForDeployment();

  console.log("Affirmations deployed to:", await affirmations.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
