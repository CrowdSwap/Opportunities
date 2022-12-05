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

  if (![Networks.BSCMAIN_NAME, Networks.BSCTEST_NAME].includes(networkName)) {
    throw Error(
      `Deploying [PancakeCakeBnbOpportunity] contracts on the given network ${networkName} is not supported`
    );
  }

  if (
    !TokenListBySymbol[networkName]["CAKE"].address ||
    !TokenListBySymbol[networkName]["WBNB"].address ||
    !TokenListBySymbol[networkName]["CAKE"].address ||
    !opportunitySetting ||
    !Opportunities.CAKE_WBNB_PANCAKE.poolAddress ||
    !opportunitySetting[chainId].feeTo ||
    !opportunitySetting.addLiquidityFee ||
    !opportunitySetting.removeLiquidityFee ||
    !opportunitySetting.stakeFee ||
    !opportunitySetting.unstakeFee ||
    !Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress ||
    !Dexchanges.Pancake.networks[chainId].contractAddress ||
    !Opportunities.CAKE_WBNB_PANCAKE.stakingLPContractAddress ||
    !Opportunities.CAKE_WBNB_PANCAKE.pid
  ) {
    throw Error("Required data is missing.");
  }

  console.log("Start [PancakeCakeBnbOpportunity] contract deployment");
  const opportunityFactory = await ethers.getContractFactory(
    "PancakeOpportunity"
  );
  const params = [
    TokenListBySymbol[networkName]["CAKE"].address,
    TokenListBySymbol[networkName]["WBNB"].address,
    TokenListBySymbol[networkName]["CAKE"].address,
    Opportunities.CAKE_WBNB_PANCAKE.poolAddress,
    {
      feeTo: opportunitySetting[chainId].feeTo,
      addLiquidityFee: opportunitySetting.addLiquidityFee,
      removeLiquidityFee: opportunitySetting.removeLiquidityFee,
      stakeFee: opportunitySetting.stakeFee,
      unstakeFee: opportunitySetting.unstakeFee,
    },
    Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress,
    Dexchanges.Pancake.networks[chainId].contractAddress,
    Opportunities.CAKE_WBNB_PANCAKE.stakingLPContractAddress,
    Opportunities.CAKE_WBNB_PANCAKE.pid,
  ];
  console.log(params);
  const opportunityProxy = await upgrades.deployProxy(
    opportunityFactory,
    [
      TokenListBySymbol[networkName]["CAKE"].address,
      TokenListBySymbol[networkName]["WBNB"].address,
      Opportunities.CAKE_WBNB_PANCAKE.rewardToken,
      Opportunities.CAKE_WBNB_PANCAKE.poolAddress,
      {
        feeTo: opportunitySetting[chainId].feeTo,
        addLiquidityFee: opportunitySetting.addLiquidityFee,
        removeLiquidityFee: opportunitySetting.removeLiquidityFee,
        stakeFee: opportunitySetting.stakeFee,
        unstakeFee: opportunitySetting.unstakeFee,
      },
      Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress,
      Dexchanges.Pancake.networks[chainId].contractAddress,
      Opportunities.CAKE_WBNB_PANCAKE.stakingLPContractAddress,
      Opportunities.CAKE_WBNB_PANCAKE.pid,
    ],
    {
      kind: "uups",
    }
  );
  await opportunityProxy.deployed();
  console.log("Finish [PancakeCakeBnbOpportunity] contract deployment");

  const opportunityImpl = await getImplementationAddress(
    ethers.provider,
    opportunityProxy.address
  );
  console.log("opportunityProxy", opportunityProxy.address);
  console.log("opportunityImpl", opportunityImpl);

  try {
    console.log("Start [PancakeCakeBnbOpportunity] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.BSCMAIN_NAME]) {
      throw Error(`The BSCscan api key does not exist in the configuration`);
    }
    console.log("apiKey : ", config.etherscan[Networks.BSCMAIN_NAME].apiKey);
    config.etherscan.apiKey = config.etherscan[Networks.BSCMAIN_NAME].apiKey;
    /*await hre.run("verify:verify", {
      address: opportunityImpl,
    });*/
    console.log("Finish [PancakeCakeBnbOpportunity] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["PancakeCakeBnbOpportunity"];
