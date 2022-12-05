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
      `Upgrading [CrowdUsdtLpStakeOpportunity] contracts on the given network [${network.name}] is not supported`
    );
  }

  if (!Opportunities.CROWD_USDT_LP_STAKE.contractAddress) {
    throw Error("crowdUsdtLpStakeOpportunity address is missing.");
  }

  console.log("Start [CrowdUsdtLpStakeOpportunity] contract deployment");
  const opportunityFactory = await ethers.getContractFactory(
    "CrowdUsdtLpStakeOpportunity"
  );

  const proxyAddress = Opportunities.CROWD_USDT_LP_STAKE.contractAddress;
  let opportunityImpl = await getImplementationAddress(
    ethers.provider,
    proxyAddress
  );
  console.log("Before upgrade: opportunityProxy", proxyAddress);
  console.log("Before upgrade: opportunityImpl", opportunityImpl);

  const opportunityProxy = await upgrades.upgradeProxy(
    proxyAddress,
    opportunityFactory
  );

  opportunityImpl = await getImplementationAddress(
    ethers.provider,
    opportunityProxy.address
  );
  console.log("After upgrade: opportunityProxy", opportunityProxy.address);
  console.log("After upgrade: opportunityImpl", opportunityImpl);

  console.log("Finish [CrowdUsdtLpStakeOpportunity] contract deployment");

  try {
    console.log("Start [CrowdUsdtLpStakeOpportunity] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
      throw Error(
        `The Polygonscan api key does not exist in the configuration`
      );
    }
    config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
    // await hre.run("verify:verify", {
    //   proxyAddress: opportunityImpl,
    // });
    console.log("Finish [CrowdUsdtLpStakeOpportunity] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["UpgradeCrowdUsdtLpStakeOpportunity"];
