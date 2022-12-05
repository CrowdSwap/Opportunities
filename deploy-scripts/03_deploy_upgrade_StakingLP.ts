import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Networks, Opportunities } from "@crowdswap/constant";
import { ethers, upgrades } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;
  if (
    ![Networks.POLYGON_MAINNET_NAME, Networks.POLYGON_MUMBAI_NAME].includes(
      network.name.toUpperCase()
    )
  ) {
    throw Error(
      `Deploying [StakingLP] contracts on the given network ${network.name} is not supported`
    );
  }

  if (!Opportunities.CROWD_USDT_LP_STAKE.stakingLPContractAddress) {
    throw Error("stakingLP is missing.");
  }

  console.log("Start [StakingLP] contract deployment");
  console.log(
    "stakingLPProxy",
    Opportunities.CROWD_USDT_LP_STAKE.stakingLPContractAddress
  );
  const stakingLPFactory = await ethers.getContractFactory("StakingLP");
  const stakingLPProxy = await upgrades.upgradeProxy(
    Opportunities.CROWD_USDT_LP_STAKE.stakingLPContractAddress,
    stakingLPFactory
  );
  console.log("Finish [StakingLP] contract deployment");

  const stakingLPImpl = await getImplementationAddress(
    ethers.provider,
    stakingLPProxy.address
  );
  console.log("stakingLPProxy", stakingLPProxy.address);
  console.log("stakingLPImpl", stakingLPImpl);

  /*try {
    console.log("Start [StakingLP] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
      throw Error(
        `The Polygonscan api key does not exist in the configuration`
      );
    }
    config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
    await hre.run("verify:verify", {
      //stakingLPImpl
      address: "0x0a9a96ac569878b328292e747d307eb49e03b91d",
    });
    console.log("Finish [StakingLP] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }*/
};
export default func;
func.tags = ["UpgradeStakingLP"];
