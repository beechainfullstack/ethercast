require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const sepoliaPk = process.env.PRIVATE_KEY;
const sepoliaAccounts = sepoliaPk && sepoliaPk.startsWith("0x") && sepoliaPk.length === 66 ? [sepoliaPk] : [];

const worldPk = process.env.WORLD_PRIVATE_KEY;
const worldAccounts = worldPk && worldPk.startsWith("0x") && worldPk.length === 66 ? [worldPk] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: sepoliaAccounts
    },
    world: {
      url: process.env.WORLD_RPC_URL || "",
      accounts: worldAccounts
    }
  }
};
