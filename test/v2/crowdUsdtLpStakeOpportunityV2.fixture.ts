import { Fixture } from "ethereum-waffle";
import { Address } from "ethereumjs-util";
import { BigNumber, Wallet } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  CrowdUsdtLpStakeOpportunityV2,
  CrowdUsdtLpStakeOpportunityV2__factory,
  CrowdswapV1Test__factory,
  CrowdswapV1Test,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory as Erc20Test__factory,
  StakingLP,
  StakingLP__factory,
  UniswapV2FactoryTest as UniswapV2Factory,
  IUniswapV2PairTest as UniswapV2Pair,
  IUniswapV2PairTest__factory as UniswapV2Pair__factory,
  IUniswapV2Router02 as UniswapV2Router02,
  WETH,
  WETH__factory,
} from "../../artifacts/types";
import { createDexUniswapV2 } from "./uniswapV2.fixture";

export const ADD_LIQUIDITY_FEE_PERCENTAGE = 0.1;
export const REMOVE_LIQUIDITY_FEE_PERCENTAGE = 0.1;
export const STAKE_FEE_PERCENTAGE = 0.1;
export const UNSTAKE_FEE_PERCENTAGE = 0.1;
export const DEX_FEE_PERCENTAGE = 0.3;
export const AGGREGATOR_FEE_PERCENTAGE = 0.1;

const tokenFixture: Fixture<{
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WMATIC: WETH;
  MATIC: Address;
}> = async ([wallet], provider) => {
  const signer = provider.getSigner(wallet.address);

  let token = {
    chainId: 137,
    address: "0x483dd3425278C1f79F377f1034d9d2CaE55648B6",
    name: "Crowd Token",
    symbol: "CROWD",
    decimals: 18,
  };
  const CROWD = await new Erc20Test__factory(signer).deploy(
    token.name,
    token.symbol
    // token.decimals
  );

  token = {
    chainId: 137,
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    name: "USDT-Tether USD (PoS)",
    symbol: "USDT",
    decimals: 6,
  };
  const USDT = await new Erc20Test__factory(signer).deploy(
    token.name,
    token.symbol
    // token.decimals
  );

  token = {
    chainId: 137,
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    name: "DAI-Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
  };
  const DAI = await new Erc20Test__factory(signer).deploy(
    token.name,
    token.symbol
    // token.decimals
  );

  token = {
    chainId: 137,
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    name: "Wrapped Matic",
    symbol: "WMATIC",
    decimals: 18,
  };
  const WMATIC = await new WETH__factory(signer).deploy();

  return {
    CROWD: CROWD,
    USDT: USDT,
    DAI: DAI,
    WMATIC: WMATIC,
    MATIC: Address.fromString("0x0000000000000000000000000000000000001010"),
  };
};

export const crowdUsdtLpStakeOpportunityFixtureV2: Fixture<{
  crowdUsdtOpportunity: CrowdUsdtLpStakeOpportunityV2;
  crowdWmaticOpportunity: CrowdUsdtLpStakeOpportunityV2;
  crowdswapV1: CrowdswapV1Test;
  uniswapV2: UniswapV2Router02;
  sushiswap: UniswapV2Router02;
  quickswap: UniswapV2Router02;
  apeswap: UniswapV2Router02;
  radioshack: UniswapV2Router02;
  stakingCrowdUsdtLP: StakingLP;
  stakingCrowdWmaticLP: StakingLP;
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WMATIC: WETH;
  MATIC: Address;
  crowdUsdtPair: UniswapV2Pair;
  crowdWmaticPair: UniswapV2Pair;
}> = async (
  [wallet, revenue, liquidityProvider1, liquidityProvider2],
  provider
) => {
  const signer = provider.getSigner(wallet.address);

  const { CROWD, USDT, DAI, MATIC, WMATIC } = await tokenFixture(
    [wallet],
    provider
  );

  /* ================= CREATE DEXes ================= */
  const availableDexesList = [
    "UniswapV2",
    "Sushiswap",
    "Quickswap",
    "Apeswap",
    "Radioshack",
  ]; //to register in CrowdSwapV1
  //liquidityProvider1 does not have enough ETH to create ETH/token pool. So it should be borrow other (liquidityProvider2)
  const liquidityProvider2Balance = await liquidityProvider2.getBalance();
  await liquidityProvider2.sendTransaction({
    to: liquidityProvider1.address,
    value: liquidityProvider2Balance.sub(ethers.utils.parseEther("10")),
  });

  const dexes: { [key: string]: UniswapV2Fork } = {};
  for (let dexName of availableDexesList) {
    //All values are in eth
    const initialAmountCrowdInPair = "20000";
    const initialAmountUsdtInPair = "1000";
    const initialAmountDaiInPair = "1000";
    const initialAmountWmaticInPair = "1000";
    const { router, factory } = await createDexUniswapV2(wallet, WMATIC);
    // const d =
    //   Dexchanges[dexName].networks[Networks.MAINNET] ??
    //   Dexchanges[dexName].networks[Networks.POLYGON_MAINNET];
    const flag = getDexFlag(dexName);
    const dex: UniswapV2Fork = new UniswapV2Fork(router, factory, flag);
    await dex.createPair(
      CROWD,
      USDT,
      initialAmountCrowdInPair,
      initialAmountUsdtInPair,
      liquidityProvider1
    );
    await dex.createPair(
      DAI,
      USDT,
      initialAmountDaiInPair,
      initialAmountUsdtInPair,
      liquidityProvider1
    );
    await dex.createPairEth(
      USDT,
      WMATIC,
      initialAmountUsdtInPair,
      initialAmountWmaticInPair,
      liquidityProvider1
    );
    await dex.createPairEth(
      DAI,
      WMATIC,
      initialAmountDaiInPair,
      initialAmountWmaticInPair,
      liquidityProvider1
    );
    await dex.createPairEth(
      CROWD,
      WMATIC,
      initialAmountCrowdInPair,
      initialAmountWmaticInPair,
      liquidityProvider1
    );
    dexes[dexName] = dex;
  }

  const crowdUsdtPair = await dexes["UniswapV2"].getPair(
    CROWD,
    USDT,
    liquidityProvider1
  );
  const crowdWmaticPair = await dexes["UniswapV2"].getPair(
    CROWD,
    WMATIC,
    liquidityProvider1
  );

  /* ================= CREATING AGGREGATOR CONTRACT ================= */

  const dexAddressFlags = Object.values(dexes).map((dex: UniswapV2Fork) => {
    return { adr: dex.router.address, flag: dex.flag };
  });

  const crowdswapV1 = await new CrowdswapV1Test__factory(signer).deploy(
    dexAddressFlags
  );

  const currentTimestamp = await ethers.provider.getBlock("latest");
  const crowdUsdtLpStakingFactory = new StakingLP__factory(signer);
  const crowdUsdtLpStaking = (await upgrades.deployProxy(
    crowdUsdtLpStakingFactory,
    [
      crowdUsdtPair.address,
      CROWD.address,
      200 * 24 * 3600,
      BigNumber.from(currentTimestamp.timestamp),
    ],
    {
      kind: "uups",
    }
  )) as StakingLP;

  const crowdWmaticLpStakingFactory = new StakingLP__factory(signer);
  const crowdWmaticLpStaking = (await upgrades.deployProxy(
    crowdWmaticLpStakingFactory,
    [
      crowdWmaticPair.address,
      CROWD.address,
      200 * 24 * 3600,
      BigNumber.from(currentTimestamp.timestamp),
    ],
    {
      kind: "uups",
    }
  )) as StakingLP;

  const addLiquidityFee = ethers.utils.parseEther(
    ADD_LIQUIDITY_FEE_PERCENTAGE.toString()
  );
  const removeLiquidityFee = ethers.utils.parseEther(
    REMOVE_LIQUIDITY_FEE_PERCENTAGE.toString()
  );
  const stakeFee = ethers.utils.parseEther(STAKE_FEE_PERCENTAGE.toString());
  const unstakeFee = ethers.utils.parseEther(UNSTAKE_FEE_PERCENTAGE.toString());
  const dexFee = ethers.utils.parseEther(DEX_FEE_PERCENTAGE.toString());
  const aggregatorFee = ethers.utils.parseEther(
    AGGREGATOR_FEE_PERCENTAGE.toString()
  );
  const feeStruct = {
    feeTo: revenue.address,
    addLiquidityFee: addLiquidityFee,
    removeLiquidityFee: removeLiquidityFee,
    stakeFee: stakeFee,
    unstakeFee: unstakeFee,
    dexFee: dexFee,
    aggregatorFee: aggregatorFee,
  };

  const crowdUsdtOpportunityFactory =
    new CrowdUsdtLpStakeOpportunityV2__factory(signer);
  const crowdUsdtOpportunity = (await upgrades.deployProxy(
    crowdUsdtOpportunityFactory,
    [
      CROWD.address,
      USDT.address,
      crowdUsdtPair.address,
      feeStruct,
      crowdswapV1.address,
      dexes["UniswapV2"].router.address,
      crowdUsdtLpStaking.address,
    ],
    {
      kind: "uups",
    }
  )) as CrowdUsdtLpStakeOpportunityV2;

  const crowdWmaticOpportunityFactory =
    new CrowdUsdtLpStakeOpportunityV2__factory(signer);
  const crowdWmaticOpportunity = (await upgrades.deployProxy(
    crowdWmaticOpportunityFactory,
    [
      CROWD.address,
      WMATIC.address,
      crowdWmaticPair.address,
      feeStruct,
      crowdswapV1.address,
      dexes["UniswapV2"].router.address,
      crowdWmaticLpStaking.address,
    ],
    {
      kind: "uups",
    }
  )) as CrowdUsdtLpStakeOpportunityV2;
  await crowdWmaticOpportunity.setCoinWrapper(WMATIC.address);
  await crowdUsdtLpStaking.setOpportunityContract(crowdUsdtOpportunity.address);
  await crowdUsdtLpStaking.setResonateAdapter(
    "0x127F6e566212d3477b34725C9D1a422d6D960c97"
  );
  await crowdWmaticLpStaking.setOpportunityContract(
    crowdWmaticOpportunity.address
  );
  await crowdWmaticLpStaking.setResonateAdapter(
    "0x127F6e566212d3477b34725C9D1a422d6D960c97"
  );
  return {
    crowdUsdtOpportunity,
    crowdWmaticOpportunity,
    crowdswapV1,
    uniswapV2: dexes["UniswapV2"].router,
    sushiswap: dexes["Sushiswap"].router,
    quickswap: dexes["Quickswap"].router,
    apeswap: dexes["Apeswap"].router,
    radioshack: dexes["Radioshack"].router,
    stakingCrowdUsdtLP: crowdUsdtLpStaking,
    stakingCrowdWmaticLP: crowdWmaticLpStaking,
    CROWD,
    USDT,
    DAI,
    WMATIC,
    MATIC,
    crowdUsdtPair,
    crowdWmaticPair,
  };
};
function getDexFlag(dexName: string): any {
  if (dexName == "UniswapV2") {
    return 0x1;
  } else if (dexName == "Sushiswap") {
    return 0x03;
  } else if (dexName == "Quickswap") {
    return 0x08;
  } else if (dexName == "Apeswap") {
    return 0x09;
  } else if (dexName == "Radioshack") {
    return 0x20;
  }
}

class UniswapV2Fork {
  private readonly _router: UniswapV2Router02;
  private readonly _factory: UniswapV2Factory;
  private readonly _flag: number;
  constructor(
    router: UniswapV2Router02,
    factory: UniswapV2Factory,
    flag: number
  ) {
    this._router = router;
    this._factory = factory;
    this._flag = flag;
  }
  async createPair(
    token0: ERC20PresetMinterPauser,
    token1: ERC20PresetMinterPauser,
    initialAmount0InEth: string,
    initialAmount1InEth: string,
    liquidityProvider: Wallet
  ): Promise<UniswapV2Pair> {
    let decimals = await token0.decimals();
    const initialAmount0 = ethers.utils.parseUnits(
      initialAmount0InEth,
      decimals
    );

    decimals = await token1.decimals();
    const initialAmount1 = ethers.utils.parseUnits(
      initialAmount1InEth,
      decimals
    );

    const amountMin0 = ethers.utils.parseUnits("0");
    const amountMin1 = ethers.utils.parseUnits("0");
    const deadline =
      (await ethers.provider.getBlock("latest")).timestamp + 1000;

    await token0.mint(liquidityProvider.address, initialAmount0);
    await token0
      .connect(liquidityProvider)
      .approve(this._router.address, initialAmount0);

    await token1.mint(liquidityProvider.address, initialAmount1);
    await token1
      .connect(liquidityProvider)
      .approve(this._router.address, initialAmount1);

    await this._router
      .connect(liquidityProvider)
      .addLiquidity(
        token0.address,
        token1.address,
        initialAmount0,
        initialAmount1,
        amountMin0,
        amountMin1,
        liquidityProvider.address,
        deadline
      );

    return this.getPair(token0, token1, liquidityProvider);
  }
  async createPairEth(
    token0: ERC20PresetMinterPauser,
    token1: WETH,
    initialAmount0InEth: string,
    initialAmount1InEth: string,
    liquidityProvider: Wallet
  ): Promise<UniswapV2Pair> {
    let decimals = await token0.decimals();
    const initialAmount0 = ethers.utils.parseUnits(
      initialAmount0InEth,
      decimals
    );

    decimals = 18; //decimals of ETH
    const initialAmount1 = ethers.utils.parseUnits(
      initialAmount1InEth,
      decimals
    );

    const amountMin0 = ethers.utils.parseUnits("0");
    const amountMin1 = ethers.utils.parseUnits("0");
    const deadline =
      (await ethers.provider.getBlock("latest")).timestamp + 1000;

    await token0.mint(liquidityProvider.address, initialAmount0);
    await token0
      .connect(liquidityProvider)
      .approve(this._router.address, initialAmount0);

    await this._router
      .connect(liquidityProvider)
      .addLiquidityETH(
        token0.address,
        initialAmount0,
        amountMin0,
        amountMin1,
        liquidityProvider.address,
        deadline,
        { value: initialAmount1 }
      );

    return this.getPair(token0, token1, liquidityProvider);
  }

  async getPair(
    token0: ERC20PresetMinterPauser,
    token1: ERC20PresetMinterPauser | WETH,
    liquidityProvider: Wallet
  ): Promise<UniswapV2Pair> {
    const pairAddress = await this._factory.getPair(
      token0.address,
      token1.address
    );
    return UniswapV2Pair__factory.connect(pairAddress, liquidityProvider);
  }
  get router(): UniswapV2Router02 {
    return this._router;
  }
  get factory(): UniswapV2Factory {
    return this._factory;
  }
  get flag(): number {
    return this._flag;
  }
}
