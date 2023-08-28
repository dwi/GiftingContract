import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.18',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
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
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { mnemonic: DEFAULT_MNEMONIC },
    },
    saigon: {
      chainId: 2021,
      url: 'https://saigon-testnet.roninchain.com/rpc',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : { mnemonic: DEFAULT_MNEMONIC },
    },
  },
  gasReporter: {
    excludeContracts: ['MockERC20', 'MockERC721', 'ERC20', 'ERC721', 'MockAtiaShrine'],
    gasPrice: 20,
    enabled: true,
  },
};

export default config;
