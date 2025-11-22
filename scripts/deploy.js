const hre = require("hardhat");

async function main() {
  // With ethers v6 + Hardhat, prefer hre.ethers.deployContract
  const affirmations = await hre.ethers.deployContract("Affirmations");

  await affirmations.waitForDeployment();

  console.log("Affirmations deployed to:", await affirmations.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
