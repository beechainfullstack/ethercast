const hre = require("hardhat");

async function main() {
  const Affirmations = await hre.ethers.getContractFactory("Affirmations");
  const affirmations = await Affirmations.deploy();

  await affirmations.waitForDeployment();

  console.log("Affirmations deployed to:", await affirmations.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
