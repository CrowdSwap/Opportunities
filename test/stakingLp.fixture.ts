import { Fixture } from "ethereum-waffle";
import { Address } from "ethereumjs-util";
import { BigNumber, Contract } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  ERC20PresetMinterPauser,
  StakingLP__factory,
  UniswapV2PairTest,
} from "../artifacts/types";
import { crowdUsdtLpStakeOpportunityFixtureV2 } from "./v2/crowdUsdtLpStakeOpportunityV2.fixture";

export const stakingLpFixture: Fixture<{
  crowdUsdtLpStakeOpportunity: Contract;
  stakingLP: Contract;
  stakingLP2: Contract;
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  MATIC: Address;
  crowdUsdtPair: UniswapV2PairTest;
}> = async (
  [wallet, revenue, liquidityProvider1, liquidityProvider2],
  provider
) => {
  const signer = await ethers.getSigner(wallet.address);

  const {
    CROWD,
    USDT,
    DAI,
    MATIC,
    crowdUsdtPair,
    crowdUsdtOpportunity,
    stakingCrowdUsdtLP,
  } = await crowdUsdtLpStakeOpportunityFixtureV2(
    [wallet, revenue, liquidityProvider1, liquidityProvider2],
    provider
  );

  const currentTimestamp = await ethers.provider.getBlock("latest");
  const stakingLPFactory = new StakingLP__factory(signer);

  const stakingLPProxy2 = await upgrades.deployProxy(
    stakingLPFactory,
    [
      crowdUsdtPair.address,
      CROWD.address,
      200 * 24 * 3600,
      BigNumber.from(currentTimestamp.timestamp + 5 * 24 * 3600),
    ],
    {
      kind: "uups",
    }
  );

  const tx = await signer.sendTransaction({
    to: crowdUsdtOpportunity.address,
    value: ethers.utils.parseEther("100"),
  });
  await tx.wait();

  return {
    crowdUsdtLpStakeOpportunity: crowdUsdtOpportunity,
    stakingLP: stakingCrowdUsdtLP,
    stakingLP2: stakingLPProxy2,
    CROWD: CROWD,
    USDT: USDT,
    DAI: DAI,
    MATIC: MATIC,
    crowdUsdtPair: crowdUsdtPair,
  };
};
