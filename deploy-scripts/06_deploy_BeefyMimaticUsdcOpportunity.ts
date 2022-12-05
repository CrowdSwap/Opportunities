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
      `Deploying [BeefyMimaticUsdcOpportunity] contracts on the given network ${networkName} is not supported`
    );
  }

  if (
    !TokenListBySymbol[networkName]["MIMATIC"].address ||
    !TokenListBySymbol[networkName]["USDC"].address ||
    !opportunitySetting ||
    !Opportunities["mai-usdc-mimatic"].poolAddress ||
    !opportunitySetting[chainId].feeTo ||
    !opportunitySetting.addLiquidityFee ||
    !opportunitySetting.removeLiquidityFee ||
    !opportunitySetting.stakeFee ||
    !opportunitySetting.unstakeFee ||
    !Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress ||
    !Dexchanges.Quickswap.networks[chainId].contractAddress ||
    !Opportunities["mai-usdc-mimatic"].stakingLPContractAddress
  ) {
    throw Error("Required data is missing.");
  }

  console.log("Start [BeefyMimaticUsdcOpportunity] contract deployment");
  const opportunityFactory = await ethers.getContractFactory(
    "BeefyMimaticUsdcOpportunity"
  );
  const params = [
    TokenListBySymbol[networkName]["MIMATIC"].address,
    TokenListBySymbol[networkName]["USDC"].address,
    Opportunities["mai-usdc-mimatic"].poolAddress,
    opportunitySetting[chainId].feeTo,
    opportunitySetting.addLiquidityFee,
    opportunitySetting.removeLiquidityFee,
    opportunitySetting.stakeFee,
    opportunitySetting.unstakeFee,
    Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress,
    Dexchanges.Quickswap.networks[chainId].contractAddress,
    Opportunities["mai-usdc-mimatic"].stakingLPContractAddress,
  ];
  console.log(params);
  const opportunityProxy = await upgrades.deployProxy(
    opportunityFactory,
    [
      TokenListBySymbol[networkName]["MIMATIC"].address,
      TokenListBySymbol[networkName]["USDC"].address,
      Opportunities["mai-usdc-mimatic"].poolAddress,
      opportunitySetting[chainId].feeTo,
      opportunitySetting.addLiquidityFee,
      opportunitySetting.removeLiquidityFee,
      opportunitySetting.stakeFee,
      opportunitySetting.unstakeFee,
      Dexchanges.CrowdswapAggregator.networks[chainId].contractAddress,
      Dexchanges.Quickswap.networks[chainId].contractAddress,
      Opportunities["mai-usdc-mimatic"].stakingLPContractAddress,
    ],
    {
      kind: "uups",
    }
  );
  await opportunityProxy.deployed();
  console.log("Finish [BeefyMimaticUsdcOpportunity] contract deployment");

  const opportunityImpl = await getImplementationAddress(
    ethers.provider,
    opportunityProxy.address
  );
  console.log("opportunityProxy", opportunityProxy.address);
  console.log("opportunityImpl", opportunityImpl);

  try {
    console.log("Start [BeefyMimaticUsdcOpportunity] contract verification");
    if (!config.etherscan || !config.etherscan[Networks.POLYGON_MAINNET]) {
      throw Error(
        `The Polygonscan api key does not exist in the configuration`
      );
    }
    config.etherscan.apiKey = config.etherscan[Networks.POLYGON_MAINNET].apiKey;
    // await hre.run("verify:verify", {
    //   address: opportunityImpl,
    // });
    console.log("Finish [BeefyMimaticUsdcOpportunity] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["BeefyMimaticUsdcOpportunity"];
