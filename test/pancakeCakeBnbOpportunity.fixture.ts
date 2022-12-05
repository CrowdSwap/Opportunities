import { Fixture } from "ethereum-waffle";
import {
  PancakeCakeBnbOpportunity__factory,
  CrowdswapV1,
  CrowdswapV1__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  UniswapV2Router02Test__factory,
  UniswapV3RouterTest__factory,
  UniswapV2FactoryTest__factory,
  IUniswapV2Pair,
  IUniswapV2Pair__factory,
  IUniswapV2Router02,
  IUniswapV3Router,
  PancakeMasterChefV2Test__factory,
  PancakeMasterChefV2Test,
} from "../../artifacts/types";
import { ethers, upgrades } from "hardhat";
import {
  Dexchanges,
  TokenListBySymbol,
  BSCTEST_NAME,
} from "@crowdswap/constant";
import { Address } from "ethereumjs-util";
import { Contract } from "ethers";

const tokenFixture: Fixture<{
  CAKE: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WBNB: ERC20PresetMinterPauser;
}> = async ([wallet], provider) => {
  const network = await ethers.provider.getNetwork();
  const signer = provider.getSigner(wallet.address);
  const chainId = network.chainId;
  switch (chainId) {
    case 31337:
      return {
        WBNB: await new ERC20PresetMinterPauser__factory(signer).deploy(
          "WBNB minter",
          "WBNB"
        ),
        CAKE: await new ERC20PresetMinterPauser__factory(signer).deploy(
          "CAKE minter",
          "CAKE"
        ),
        DAI: await new ERC20PresetMinterPauser__factory(signer).deploy(
          "DAI minter",
          "DAI"
        ),
      };
    case 80001:
      return {
        WBNB: ERC20PresetMinterPauser__factory.connect(
          TokenListBySymbol.BSCMAIN["WBNB"].address,
          wallet
        ),
        CAKE: ERC20PresetMinterPauser__factory.connect(
          TokenListBySymbol.BSCMAIN["CAKE"].address,
          wallet
        ),
        DAI: ERC20PresetMinterPauser__factory.connect(
          TokenListBySymbol.BSCMAIN["DAI"].address,
          wallet
        ),
      };
  }
};

export const pancakeCakeBnbOpportunityFixture: Fixture<{
  pancakeCakeBnbOpportunity: Contract;
  uniswapV3: IUniswapV3Router;
  crowdswapV1: CrowdswapV1;
  pancake: IUniswapV2Router02;
  sushiswap: IUniswapV2Router02;
  CAKE: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WBNB: ERC20PresetMinterPauser;
  cakeBNBPair: IUniswapV2Pair;
  pancakeMasterChefV2Test: PancakeMasterChefV2Test;
}> = async ([wallet, revenue], provider) => {
  const signer = provider.getSigner(wallet.address);

  const { CAKE, WBNB, DAI } = await tokenFixture([wallet], provider);
  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();
  await factory.createPair(WBNB.address, CAKE.address);
  const cakeBNBPairAddress = await factory.getPair(WBNB.address, CAKE.address);
  const cakeBNBPair = IUniswapV2Pair__factory.connect(
    cakeBNBPairAddress,
    wallet
  );

  const uniswapV3 = await new UniswapV3RouterTest__factory(signer).deploy();
  const pancake = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address
  );
  const sushiswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address
  );
  const quickswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address
  );
  const apeswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address
  );
  const radioshack = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address
  );

  const pancakeMasterChefV2Test = await new PancakeMasterChefV2Test__factory(
    signer
  ).deploy("cake", "WBNB", cakeBNBPairAddress);

  const crowdswapV1 = await new CrowdswapV1__factory(signer).deploy([
    { flag: Dexchanges.UniswapV3.code, adr: uniswapV3.address },
    { flag: Dexchanges.Pancake.code, adr: pancake.address },
    { flag: Dexchanges.Sushiswap.code, adr: sushiswap.address },
    { flag: Dexchanges.Quickswap.code, adr: quickswap.address },
    { flag: Dexchanges.Apeswap.code, adr: apeswap.address },
    { flag: Dexchanges.Radioshack.code, adr: radioshack.address },
  ]);

  const fee = ethers.utils.parseEther("0.1");
  const pancakeCakeBnbOpportunityFactory =
    await new PancakeCakeBnbOpportunity__factory(signer);
  const pancakeCakeBnbOpportunityProxy = await upgrades.deployProxy(
    pancakeCakeBnbOpportunityFactory,
    [
      WBNB.address,
      CAKE.address,
      cakeBNBPairAddress,
      revenue.address,
      fee,
      fee,
      fee,
      fee,
      crowdswapV1.address,
      pancake.address,
      pancakeMasterChefV2Test.address,
      2,
    ],
    {
      kind: "uups",
    }
  );

  return {
    pancakeCakeBnbOpportunity: pancakeCakeBnbOpportunityProxy,
    crowdswapV1: crowdswapV1,
    uniswapV3: uniswapV3,
    pancake: pancake,
    sushiswap: sushiswap,
    WBNB: WBNB,
    DAI: DAI,
    CAKE: CAKE,
    cakeBNBPair: cakeBNBPair,
    pancakeMasterChefV2Test: pancakeMasterChefV2Test,
  };
};
