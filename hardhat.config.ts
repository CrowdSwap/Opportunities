import * as dotenv from "dotenv";

import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "@openzeppelin/hardhat-upgrades";

dotenv.config();

const FEE_TO_ADDRESS = process.env.FEE_TO_ADDRESS;

const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    hardhat: {},
  },
  mocha: {
    timeout: 500000,
  },
  typechain: {
    outDir: "artifacts/types",
  },
  etherscan: {
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  opportunitySetting: {
    addLiquidityFee: "100000000000000000",
    removeLiquidityFee: "300000000000000000",
    stakeFee: "0",
    unstakeFee: "300000000000000000",
    crossChainFee: "200000000000000000",
    ['POLYGON_MAINNET']: {
      feeTo: FEE_TO_ADDRESS,
    },
    ['BSCMAIN']: {
      feeTo: FEE_TO_ADDRESS,
    },
  },
  stakingLpSetting: {
    rewardsDuration: 200 * 24 * 3600,
    startTime: 1659693600,
  },
};
export default config;