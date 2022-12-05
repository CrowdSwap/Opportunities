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
import * as hre from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { network, config } = hre;
  const chainId = network.config.chainId;
  const networkName = network.name;
  const opportunitySetting = (<any>config).opportunitySetting;

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xFD4f361269dCdE0bc1CB410b54c0c30331a4FC99"],
  });

  const signer = await ethers.getSigner(
    "0xFD4f361269dCdE0bc1CB410b54c0c30331a4FC99"
  );
  // if (![Networks.BSCMAIN_NAME, Networks.BSCTEST_NAME].includes(networkName)) {
  //   throw Error(
  //     `Deploying [PancakeCakeBnbOpportunity] contracts on the given network ${networkName} is not supported`
  //   );
  // }

  if (!Opportunities.CAKE_WBNB_PANCAKE.contractAddress) {
    throw Error("Required data is missing.");
  }

  const proxyAddress = Opportunities.CAKE_WBNB_PANCAKE.contractAddress;

  let opportunityAdapterImpl = await getImplementationAddress(
    ethers.provider,
    proxyAddress
  );
  console.log("Before upgrade: opportunityAdapterProxy", proxyAddress);
  console.log("Before upgrade: opportunityAdapterImpl", opportunityAdapterImpl);

  console.log("Start [PancakeCakeBnbOpportunity] contract deployment");
  const opportunityFactory = await ethers.getContractFactory(
    "PancakeOpportunity",
    signer
  );

  const opportunityProxy = await upgrades.upgradeProxy(
    proxyAddress,
    opportunityFactory
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
      address: "0x2834C9557a016517D7e706354bBa498ee5138f50",
    });*/
    console.log("Finish [PancakeCakeBnbOpportunity] contract verification");
  } catch (e) {
    console.log(e.message);
    throw e;
  }
};
export default func;
func.tags = ["UpgradePancakeCakeBnbOpportunity"];
