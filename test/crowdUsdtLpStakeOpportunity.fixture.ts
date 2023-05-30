import { Fixture } from "ethereum-waffle";
import {
  CrowdUsdtLpStakeOpportunity__factory,
  CrowdswapV1Test,
  CrowdswapV1Test__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  IUniswapV2PairTest,
  IUniswapV2PairTest__factory,
  IUniswapV2Router02,
  StakingLP__factory,
  UniswapV2FactoryTest__factory,
  UniswapV2Router02Test__factory,
  IWETH,
  WETH__factory,
} from "../artifacts/types";
import { ethers, upgrades } from "hardhat";
import { Address } from "ethereumjs-util";
import { BigNumber, Contract } from "ethers";

const tokenFixture: Fixture<{
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WMATIC: IWETH;
  MATIC: Address;
}> = async ([wallet], provider) => {
  const signer = provider.getSigner(wallet.address);
  return {
    CROWD: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "CROWD minter",
      "CROWD"
    ),
    USDT: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "USDT minter",
      "USDT"
    ),
    DAI: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "DAI minter",
      "DAI"
    ),
    WMATIC: await new WETH__factory(signer).deploy(),
    MATIC: Address.fromString("0x0000000000000000000000000000000000001010"),
  };
};

export const crowdUsdtLpStakeOpportunityFixture: Fixture<{
  opportunity: Contract;
  crowdswapV1: CrowdswapV1Test;
  sushiswap: IUniswapV2Router02;
  quickswap: IUniswapV2Router02;
  stakingCrowdUsdtLP: Contract;
  stakingCrowdWmaticLP: Contract;
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WMATIC: IWETH;
  MATIC: Address;
  crowdUsdtPair: IUniswapV2PairTest;
  crowdWmaticPair: IUniswapV2PairTest;
}> = async ([wallet, revenue], provider) => {
  const signer = provider.getSigner(wallet.address);

  const { CROWD, USDT, DAI, WMATIC, MATIC } = await tokenFixture(
    [wallet],
    provider
  );

  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();

  await factory.createPair(CROWD.address, USDT.address);
  const crowdUsdtPairAddress = await factory.getPair(
    CROWD.address,
    USDT.address
  );
  const crowdUsdtPair = IUniswapV2PairTest__factory.connect(
    crowdUsdtPairAddress,
    wallet
  );
  await factory.createPair(CROWD.address, WMATIC.address);
  const crowdWmaticPairAddress = await factory.getPair(
    CROWD.address,
    WMATIC.address
  );
  const crowdWmaticPair = IUniswapV2PairTest__factory.connect(
    crowdWmaticPairAddress,
    wallet
  );

  const sushiswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address,
    WMATIC.address
  );
  const quickswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address,
    WMATIC.address
  );
  const crowdswapV1 = await new CrowdswapV1Test__factory(signer).deploy([
    { flag: 0x03, adr: sushiswap.address },
    { flag: 0x08, adr: quickswap.address },
  ]);

  let currentTimestamp = await ethers.provider.getBlock("latest");
  const crowdUsdtLpStakingFactory = new StakingLP__factory(signer);
  const stakingCrowdUsdtLP = await upgrades.deployProxy(
    crowdUsdtLpStakingFactory,
    [
      crowdUsdtPairAddress,
      CROWD.address,
      200 * 24 * 3600,
      BigNumber.from(currentTimestamp.timestamp),
    ],
    {
      kind: "uups",
    }
  );
  const stakingCrowdWmaticLP = await upgrades.deployProxy(
    crowdUsdtLpStakingFactory,
    [
      crowdWmaticPairAddress,
      CROWD.address,
      200 * 24 * 3600,
      BigNumber.from(currentTimestamp.timestamp),
    ],
    {
      kind: "uups",
    }
  );

  const fee = ethers.utils.parseEther("0.1");

  const crowdUsdtLpStakeOpportunityFactory =
    new CrowdUsdtLpStakeOpportunity__factory(signer);
  const opportunity = await upgrades.deployProxy(
    crowdUsdtLpStakeOpportunityFactory,
    [
      CROWD.address,
      USDT.address,
      factory.address,
      revenue.address,
      fee,
      fee,
      fee,
      fee,
      crowdswapV1.address,
      quickswap.address,
      stakingCrowdUsdtLP.address,
    ],
    {
      kind: "uups",
    }
  );
  await stakingCrowdUsdtLP.setOpportunityContract(opportunity.address);
  await stakingCrowdUsdtLP.setResonateAdapter(
    "0x127F6e566212d3477b34725C9D1a422d6D960c97"
  );
  await stakingCrowdWmaticLP.setOpportunityContract(opportunity.address);
  await stakingCrowdWmaticLP.setResonateAdapter(
    "0x127F6e566212d3477b34725C9D1a422d6D960c97"
  );

  return {
    opportunity,
    crowdswapV1,
    sushiswap,
    quickswap,
    stakingCrowdUsdtLP,
    stakingCrowdWmaticLP,
    CROWD,
    USDT,
    DAI,
    WMATIC,
    MATIC,
    crowdUsdtPair,
    crowdWmaticPair,
  };
};
