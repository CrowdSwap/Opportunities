import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Networks, TokensHolder } from "@crowdswap/constant";
import { ethers, upgrades } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const CONTRACT_NAME = "LockableStakingRewards";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;
  const tokenSetting = (<any>config).tokenSetting;

  if (
    ![
      Networks.MAINNET_NAME,
      Networks.POLYGON_MAINNET_NAME,
      Networks.BSCMAIN_NAME,
    ].includes(network.name.toUpperCase())
  ) {
    throw Error(
      `Deploying [${CONTRACT_NAME}] contracts on the given network ${network.name} is not supported`
    );
  }

  if (
    !tokenSetting ||
    !tokenSetting.symbol ||
    !TokensHolder[network.name][tokenSetting.symbol] ||
    !TokensHolder[network.name][tokenSetting.symbol].address
  ) {
    throw Error("Token symbol or address is missing.");
  }

  console.log(`Start [${CONTRACT_NAME}] contract deployment`);
  // console.log(TokensHolder[network.name][tokenSetting.symbol].address);

  const stakingToken = "";
  const feeTo = "";
  const stakeFee = "0";
  const unstakeFee = "100000000000000000";

  const params = [
    stakingToken,
    {
      feeTo,
      stakeFee,
      unstakeFee,
    },
  ];
  const lockableStakingRewardsFactory = await ethers.getContractFactory(
    CONTRACT_NAME
  );
  const lockableStakingRewardsProxy = await upgrades.deployProxy(
    lockableStakingRewardsFactory,
    params,
    {
      kind: "uups",
    }
  );
  await lockableStakingRewardsProxy.deployed();
  console.log(`Finish [${CONTRACT_NAME}] contract deployment`);

  const lockableStakingRewardsImpl = await getImplementationAddress(
    ethers.provider,
    lockableStakingRewardsProxy.address
  );
  console.log(
    "lockableStakingRewardsProxy",
    lockableStakingRewardsProxy.address
  );
  console.log("lockableStakingRewardsImpl", lockableStakingRewardsImpl);

  // try {
  //   console.log(`Start [${CONTRACT_NAME}] contract verification`);
  //   if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
  //     throw Error(
  //       `The Polygonscan api key does not exist in the configuration`
  //     );
  //   }
  //   config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
  //   await hre.run("verify:verify", {
  //     address: lockableStakingRewardsImpl,
  //   });
  //   console.log(`Finish [${CONTRACT_NAME}]] contract verification`);
  // } catch (e) {
  //   console.log(e.message);
  //   throw e;
  // }
};
export default func;
func.tags = [CONTRACT_NAME];
