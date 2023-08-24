import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-deploy';
import 'dotenv/config';
import 'solidity-coverage';

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.18',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        count: 1000,
      },
    },
    ronin: {
      chainId: 2020,
      url: 'https://api.roninchain.com/rpc',
      accounts: [PRIVATE_KEY!],
    },
    saigon: {
      chainId: 2021,
      url: 'https://saigon-testnet.roninchain.com/rpc',
      accounts: [PRIVATE_KEY!],
    },
  },
  gasReporter: {
    excludeContracts: ['MockERC20', 'MockERC721', 'ERC20', 'ERC721'],
    gasPrice: 20,
    enabled: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
      1337: 0, //<-use chain id to tell which network the use the 0th account as deployer.
    },
    player: {
      default: 1,
    },
  },
};

export default config;
