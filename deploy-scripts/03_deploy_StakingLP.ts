import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  Networks,
  Opportunities,
  TokenListBySymbol,
} from "@crowdswap/constant";
import { ethers, upgrades } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;
  const networkName = network.name;
  const stakingLpSetting = (<any>config).stakingLpSetting;
  if (
    ![Networks.POLYGON_MAINNET_NAME, Networks.POLYGON_MUMBAI_NAME].includes(
      networkName
    )
  ) {
    throw Error(
      `Deploying [StakingLP] contracts on the given network ${networkName} is not supported`
    );
  }

  if (
    !Opportunities.CROWD_USDT_LP_STAKE.poolAddress ||
    !TokenListBySymbol[networkName]["CROWD"].address ||
    !stakingLpSetting ||
    !stakingLpSetting.rewardsDuration ||
    !stakingLpSetting.startTime
  ) {
    throw Error("Required data is missing.");
  }
  console.log(Opportunities.CROWD_USDT_LP_STAKE.poolAddress);
  console.log(TokenListBySymbol[networkName]["CROWD"].address);
  console.log(stakingLpSetting.rewardsDuration);
  console.log(stakingLpSetting.startTime);

  console.log("Start [StakingLP] contract deployment");
  const stakingLPFactory = await ethers.getContractFactory("StakingLP");
  const stakingLPProxy = await upgrades.deployProxy(
    stakingLPFactory,
    [
      Opportunities.CROWD_USDT_LP_STAKE.poolAddress,
      TokenListBySymbol[networkName]["CROWD"].address,
      stakingLpSetting.rewardsDuration,
      stakingLpSetting.startTime,
    ],
    {
      kind: "uups",
    }
  );
  await stakingLPProxy.deployed();
  console.log("Finish [StakingLP] contract deployment");

  const stakingLPImpl = await getImplementationAddress(
    ethers.provider,
    stakingLPProxy.address
  );
  console.log("stakingLPProxy", stakingLPProxy.address);
  console.log("stakingLPImpl", stakingLPImpl);

  try {
    console.log("Start [StakingLP] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
      throw Error(
        `The Polygonscan api key does not exist in the configuration`
      );
    }
    config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
    // await hre.run("verify:verify", {
    //   address: stakingLPImpl,
    // });
    console.log("Finish [StakingLP] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["StakingLP"];
