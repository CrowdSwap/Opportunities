import { Fixture } from "ethereum-waffle";
import {
  PancakeOpportunity__factory,
  CrowdswapV1Test,
  CrowdswapV1Test__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  UniswapV2Router02Test__factory,
  UniswapV2FactoryTest__factory,
  IUniswapV2PairTest,
  IUniswapV2PairTest__factory,
  IUniswapV2Router02,
  PancakeMasterChefV2Test__factory,
  PancakeMasterChefV2Test,
  IWETH,
  WETH__factory,
} from "../artifacts/types";
import { ethers, upgrades } from "hardhat";
import { Address } from "ethereumjs-util";
import { Contract } from "ethers";
import { AddressZero } from "@ethersproject/constants";

const tokenFixture: Fixture<{
  BUSD: ERC20PresetMinterPauser;
  CAKE: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  WBNB: IWETH;
  BNB: Address;
}> = async ([wallet], provider) => {
  const signer = provider.getSigner(wallet.address);
  return {
    CAKE: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "CAKE minter",
      "CAKE"
    ),
    WBNB: await new WETH__factory(signer).deploy(),
    BUSD: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "BUSD minter",
      "BUSD"
    ),
    USDT: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "USDT minter",
      "USDT"
    ),
    DAI: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "DAI minter",
      "DAI"
    ),
    BNB: Address.fromString("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"),
  };
};

export const pancakeOpportunitiesFixture: Fixture<{
  cakeWbnbOpportunity: Contract;
  cakeUsdtOpportunity: Contract;
  cakeBusdOpportunity: Contract;
  busdWbnbOpportunity: Contract;
  crowdswapV1: CrowdswapV1Test;
  pancake: IUniswapV2Router02;
  sushiswap: IUniswapV2Router02;
  pancakeMasterChefV2Test: PancakeMasterChefV2Test;
  BUSD: ERC20PresetMinterPauser;
  CAKE: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  WBNB: IWETH;
  BNB: Address;
  cakeWbnbPair: IUniswapV2PairTest;
  cakeUsdtPair: IUniswapV2PairTest;
  cakeBusdPair: IUniswapV2PairTest;
  busdWbnbPair: IUniswapV2PairTest;
}> = async ([wallet, revenue], provider) => {
  const signer = provider.getSigner(wallet.address);

  const { CAKE, WBNB, BUSD, USDT, DAI, BNB } = await tokenFixture(
    [wallet],
    provider
  );

  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();
  await factory.createPair(CAKE.address, WBNB.address);
  await factory.createPair(CAKE.address, USDT.address);
  await factory.createPair(CAKE.address, BUSD.address);
  await factory.createPair(BUSD.address, WBNB.address);

  const cakeWbnbPairAddress = await factory.getPair(CAKE.address, WBNB.address);
  const cakeWbnbPair = IUniswapV2PairTest__factory.connect(
    cakeWbnbPairAddress,
    wallet
  );
  const cakeUsdtPairAddress = await factory.getPair(CAKE.address, USDT.address);
  const cakeUsdtPair = IUniswapV2PairTest__factory.connect(
    cakeUsdtPairAddress,
    wallet
  );
  const cakeBusdPairAddress = await factory.getPair(CAKE.address, BUSD.address);
  const cakeBusdPair = IUniswapV2PairTest__factory.connect(
    cakeBusdPairAddress,
    wallet
  );
  const busdWbnbPairAddress = await factory.getPair(BUSD.address, WBNB.address);
  const busdWbnbPair = IUniswapV2PairTest__factory.connect(
    busdWbnbPairAddress,
    wallet
  );

  const sushiswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address,
    WBNB.address
  );
  const pancake = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address,
    WBNB.address
  );
  const crowdswapV1 = await new CrowdswapV1Test__factory(signer).deploy([
    { flag: 0x03, adr: sushiswap.address },
    { flag: 0x07, adr: pancake.address },
  ]);

  const pancakeMasterChefV2Test = await new PancakeMasterChefV2Test__factory(
    signer
  ).deploy(CAKE.address);
  CAKE.mint(pancakeMasterChefV2Test.address, ethers.utils.parseEther("4000"));

  for (let i = 0; i < 50; i++) {
    if (i == 2) {
      await pancakeMasterChefV2Test.add(
        ethers.utils.parseUnits("0.004", 6), //4000
        cakeWbnbPair.address,
        true
      );
    } else if (i == 3) {
      await pancakeMasterChefV2Test.add(
        ethers.utils.parseUnits("0.0011", 6), //1100
        busdWbnbPair.address,
        false
      );
    } else if (i == 39) {
      await pancakeMasterChefV2Test.add(
        ethers.utils.parseUnits("0.00025", 6), //250
        cakeBusdPair.address,
        false
      );
    } else if (i == 47) {
      await pancakeMasterChefV2Test.add(
        ethers.utils.parseUnits("0.0002", 6), //200
        cakeUsdtPair.address,
        false
      );
    } else {
      await pancakeMasterChefV2Test.add(
        ethers.utils.parseUnits("0.000001", 6), //1
        AddressZero,
        false
      );
    }
  }

  const fee = ethers.utils.parseEther("0.1");

  const pancakeOpportunityFactory = new PancakeOpportunity__factory(signer);
  const cakeWbnbOpportunity = await upgrades.deployProxy(
    pancakeOpportunityFactory,
    [
      CAKE.address,
      WBNB.address,
      CAKE.address,
      factory.address,
      {
        feeTo: revenue.address,
        addLiquidityFee: fee,
        removeLiquidityFee: fee,
        stakeFee: fee,
        unstakeFee: fee,
      },
      crowdswapV1.address,
      pancake.address,
      pancakeMasterChefV2Test.address,
      2,
    ],
    {
      kind: "uups",
    }
  );
  const cakeUsdtOpportunity = await upgrades.deployProxy(
    pancakeOpportunityFactory,
    [
      CAKE.address,
      USDT.address,
      CAKE.address,
      factory.address,
      {
        feeTo: revenue.address,
        addLiquidityFee: fee,
        removeLiquidityFee: fee,
        stakeFee: fee,
        unstakeFee: fee,
      },
      crowdswapV1.address,
      pancake.address,
      pancakeMasterChefV2Test.address,
      47,
    ],
    {
      kind: "uups",
    }
  );
  const cakeBusdOpportunity = await upgrades.deployProxy(
    pancakeOpportunityFactory,
    [
      CAKE.address,
      BUSD.address,
      CAKE.address,
      factory.address,
      {
        feeTo: revenue.address,
        addLiquidityFee: fee,
        removeLiquidityFee: fee,
        stakeFee: fee,
        unstakeFee: fee,
      },
      crowdswapV1.address,
      pancake.address,
      pancakeMasterChefV2Test.address,
      39,
    ],
    {
      kind: "uups",
    }
  );
  const busdWbnbOpportunity = await upgrades.deployProxy(
    pancakeOpportunityFactory,
    [
      WBNB.address,
      BUSD.address,
      CAKE.address,
      factory.address,
      {
        feeTo: revenue.address,
        addLiquidityFee: fee,
        removeLiquidityFee: fee,
        stakeFee: fee,
        unstakeFee: fee,
      },
      crowdswapV1.address,
      pancake.address,
      pancakeMasterChefV2Test.address,
      3,
    ],
    {
      kind: "uups",
    }
  );

  return {
    cakeWbnbOpportunity,
    cakeUsdtOpportunity,
    cakeBusdOpportunity,
    busdWbnbOpportunity,
    crowdswapV1,
    pancake,
    sushiswap,
    pancakeMasterChefV2Test,
    BUSD,
    CAKE,
    DAI,
    USDT,
    WBNB,
    BNB,
    cakeWbnbPair,
    cakeUsdtPair,
    cakeBusdPair,
    busdWbnbPair,
  };
};
