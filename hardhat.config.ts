import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-toolbox';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.21',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: 'paris',
        },
      },
    ],
  },
  networks: {
    hardhat: {
      accounts: {
        count: 11,
      },
    },
    ronin: {
      chainId: 2020,
      url: 'https://api.roninchain.com/rpc',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { mnemonic: DEFAULT_MNEMONIC },
    },
    saigon: {
      chainId: 2021,
      url: 'https://saigon-testnet.roninchain.com/rpc',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { mnemonic: DEFAULT_MNEMONIC },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  gasReporter: {
    excludeContracts: ['MockERC20', 'MockERC721', 'ERC20', 'ERC721', 'MockAtiaShrine', 'MockWRON', 'ERC1155'],
    gasPrice: 20,
    enabled: true,
    token: 'RON',
  },
};

export default config;
