import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  Dexchanges,
  Networks,
  Opportunities,
  TokenListBySymbol,
} from "@crowdswap/constant";
import { ethers, upgrades } from "hardhat";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;
  const chainId = network.config.chainId;
  const networkName = network.name;
  const opportunitySetting = (<any>config).opportunitySetting;

  if (
    ![Networks.POLYGON_MAINNET_NAME, Networks.POLYGON_MUMBAI_NAME].includes(
      networkName
    )
  ) {
    throw Error(
      `Deploying [CrowdUsdtLpStakeOpportunity] contracts on the given network ${networkName} is not supported`
    );
  }

  if (
    !TokenListBySymbol[networkName]["CROWD"].address ||
    !TokenListBySymbol[networkName]["USDT"].address ||
    !opportunitySetting ||
    !Opportunities.CROWD_USDT_LP_STAKE.poolAddress ||
    !opportunitySetting[chainId].feeTo ||
    !opportunitySetting.addLiquidityFee ||
    !opportunitySetting.removeLiquidityFee ||
    !opportunitySetting.stakeFee ||
    !opportunitySetting.unstakeFee ||
    !Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress ||
    !Dexchanges.Quickswap.networks[chainId].contractAddress ||
    !Opportunities.CROWD_USDT_LP_STAKE.stakingLPContractAddress
  ) {
    throw Error("Required data is missing.");
  }

  console.log("Start [CrowdUsdtLpStakeOpportunity] contract deployment");
  const opportunityFactory = await ethers.getContractFactory(
    "CrowdUsdtLpStakeOpportunity"
  );
  const params = [
    TokenListBySymbol[networkName]["CROWD"].address,
    TokenListBySymbol[networkName]["USDT"].address,
    Opportunities.CROWD_USDT_LP_STAKE.poolAddress,
    opportunitySetting[chainId].feeTo,
    opportunitySetting.addLiquidityFee,
    opportunitySetting.removeLiquidityFee,
    opportunitySetting.stakeFee,
    opportunitySetting.unstakeFee,
    Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress,
    Dexchanges.Quickswap.networks[chainId].contractAddress,
    Opportunities.CROWD_USDT_LP_STAKE.stakingLPContractAddress,
  ];
  console.log(params);
  const opportunityProxy = await upgrades.deployProxy(
    opportunityFactory,
    [
      TokenListBySymbol[networkName]["CROWD"].address,
      TokenListBySymbol[networkName]["USDT"].address,
      Opportunities.CROWD_USDT_LP_STAKE.poolAddress,
      opportunitySetting[chainId].feeTo,
      opportunitySetting.addLiquidityFee,
      opportunitySetting.removeLiquidityFee,
      opportunitySetting.stakeFee,
      opportunitySetting.unstakeFee,
      Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress,
      Dexchanges.Quickswap.networks[chainId].contractAddress,
      Opportunities.CROWD_USDT_LP_STAKE.stakingLPContractAddress,
    ],
    {
      kind: "uups",
    }
  );
  await opportunityProxy.deployed();
  console.log("Finish [CrowdUsdtLpStakeOpportunity] contract deployment");

  const opportunityImpl = await getImplementationAddress(
    ethers.provider,
    opportunityProxy.address
  );
  console.log("opportunityProxy", opportunityProxy.address);
  console.log("opportunityImpl", opportunityImpl);

  try {
    console.log("Start [CrowdUsdtLpStakeOpportunity] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
      throw Error(
        `The Polygonscan api key does not exist in the configuration`
      );
    }
    config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
    // await hre.run("verify:verify", {
    //   address: opportunityImpl,
    // });
    console.log("Finish [CrowdUsdtLpStakeOpportunity] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["CrowdUsdtLpStakeOpportunity"];
