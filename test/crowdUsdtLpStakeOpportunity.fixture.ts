import { Fixture } from "ethereum-waffle";
import {
  CrowdswapV1,
  CrowdswapV1__factory,
  CrowdUsdtLpStakeOpportunity__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  IUniswapV2Pair,
  IUniswapV2Pair__factory,
  IUniswapV2Router02,
  IUniswapV3Router,
  StakingLP__factory,
  UniswapV2FactoryTest__factory,
  UniswapV2Router02Test__factory,
  UniswapV3RouterTest__factory,
} from "../../artifacts/types";
import { ethers, upgrades } from "hardhat";
import { Dexchanges } from "@crowdswap/constant";
import { Address } from "ethereumjs-util";
import { BigNumber, Contract } from "ethers";

const tokenFixture: Fixture<{
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
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
    MATIC: Address.fromString("0x0000000000000000000000000000000000001010"),
  };
};

export const crowdUsdtLpStakeOpportunityFixture: Fixture<{
  opportunity: Contract;
  crowdswapV1: CrowdswapV1;
  uniswapV3: IUniswapV3Router;
  sushiswap: IUniswapV2Router02;
  quickswap: IUniswapV2Router02;
  apeswap: IUniswapV2Router02;
  radioshack: IUniswapV2Router02;
  stakingLP: Contract;
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  MATIC: Address;
  crowdUsdtPair: IUniswapV2Pair;
}> = async ([wallet, revenue], provider) => {
  const signer = provider.getSigner(wallet.address);

  const { CROWD, USDT, DAI, MATIC } = await tokenFixture([wallet], provider);

  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();
  await factory.createPair(CROWD.address, USDT.address);
  const crowdUsdtPairAddress = await factory.getPair(
    CROWD.address,
    USDT.address
  );
  const crowdUsdtPair = IUniswapV2Pair__factory.connect(
    crowdUsdtPairAddress,
    wallet
  );

  const uniswapV3 = await new UniswapV3RouterTest__factory(signer).deploy();
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
  const crowdswapV1 = await new CrowdswapV1__factory(signer).deploy([
    { flag: Dexchanges.UniswapV3.code, adr: uniswapV3.address },
    { flag: Dexchanges.Sushiswap.code, adr: sushiswap.address },
    { flag: Dexchanges.Quickswap.code, adr: quickswap.address },
    { flag: Dexchanges.Apeswap.code, adr: apeswap.address },
    { flag: Dexchanges.Radioshack.code, adr: radioshack.address },
  ]);

  let currentTimestamp = await ethers.provider.getBlock("latest");
  const crowdUsdtLpStakingFactory = new StakingLP__factory(signer);
  const stakingLP = await upgrades.deployProxy(
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

  const fee = ethers.utils.parseEther("0.1");

  const crowdUsdtLpStakeOpportunityFactory =
    new CrowdUsdtLpStakeOpportunity__factory(signer);
  const opportunity = await upgrades.deployProxy(
    crowdUsdtLpStakeOpportunityFactory,
    [
      CROWD.address,
      USDT.address,
      crowdUsdtPairAddress,
      revenue.address,
      fee,
      fee,
      fee,
      fee,
      crowdswapV1.address,
      quickswap.address,
      stakingLP.address,
    ],
    {
      kind: "uups",
    }
  );
  await stakingLP.setOpportunityContract(opportunity.address);
  await stakingLP.setResonateAdapter(
    "0x127F6e566212d3477b34725C9D1a422d6D960c97"
  );

  return {
    opportunity,
    crowdswapV1,
    uniswapV3,
    sushiswap,
    quickswap,
    apeswap,
    radioshack,
    stakingLP,
    CROWD,
    USDT,
    DAI,
    MATIC,
    crowdUsdtPair,
  };
};
