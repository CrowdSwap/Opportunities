import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Networks, Dexchanges } from "@crowdswap/constant";
import { ethers, upgrades } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const CONTRACT_NAME = "LockableStakingRewards";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;

  if (
      ![Networks.MAINNET_NAME, Networks.POLYGON_MAINNET_NAME, Networks.BSCMAIN_NAME].includes(
          network.name.toUpperCase()
      )
  ) {
    throw Error(
        `Deploying [${CONTRACT_NAME}] contracts on the given network ${network.name} is not supported`
    );
  }
//todo
  if (
    !Dexchanges.CrowdswapAggregator.networks[network.config.chainId]
      .stakingContractAddress
  ) {
    throw Error("LockableStakingRewards Address is missing.");
  }

  console.log("Start [LockableStakingRewards] contract deployment");
  const lockableStakingRewardsFactory = await ethers.getContractFactory(
      CONTRACT_NAME
  );
  const lockableStakingRewardsProxy = await upgrades.upgradeProxy(
    Dexchanges.CrowdswapAggregator.networks[network.config.chainId]
      .stakingContractAddress,
    lockableStakingRewardsFactory
  );
  console.log("Finish [StakingRewards] contract deployment");

  const lockableStakingRewardsImpl = await getImplementationAddress(
    ethers.provider,
    lockableStakingRewardsProxy.address
  );
  console.log("lockableStakingRewardsProxy", lockableStakingRewardsProxy.address);
  console.log("lockableStakingRewardsImpl", lockableStakingRewardsImpl);
};
export default func;
func.tags = ["UpgradeLockableStakingRewards"];
