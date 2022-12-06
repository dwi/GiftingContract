require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    hardhat: {
        accounts: {
            count: 1000
        }
    }
},
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000
      }
    }
  },
  gasReporter: {
    excludeContracts: ['MockAxie', 'ERC721'],
    gasPrice: 20,
    enabled: true
  }
};
