import { Fixture } from "ethereum-waffle";
import {
  CrowdUsdtLpStakeOpportunity__factory,
  CrowdswapV1Test__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  UniswapV2Router02Test__factory,
  UniswapV2FactoryTest__factory,
  IUniswapV2PairTest,
  UniswapV2PairTest__factory,
  StakingLP__factory,
} from "../artifacts/types";
import { ethers, upgrades } from "hardhat";
import { Address } from "ethereumjs-util";
import { BigNumber, Contract } from "ethers";
import { getContractAddress } from "ethers/lib/utils";

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

export const stakingLpFixture: Fixture<{
  crowdUsdtLpStakeOpportunity: Contract;
  stakingLP: Contract;
  stakingLP2: Contract;
  CROWD: ERC20PresetMinterPauser;
  USDT: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  MATIC: Address;
  crowdUsdtPair: IUniswapV2PairTest;
}> = async ([wallet, revenue], provider) => {
  const signer = await ethers.getSigner(wallet.address);

  const { CROWD, USDT, DAI, MATIC } = await tokenFixture([wallet], provider);

  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();
  await factory.createPair(CROWD.address, USDT.address);
  const crowdUsdtPairAddress = await factory.getPair(
    CROWD.address,
    USDT.address
  );
  const crowdUsdtPair = UniswapV2PairTest__factory.connect(
    crowdUsdtPairAddress,
    wallet
  );

  const quickswap = await new UniswapV2Router02Test__factory(signer).deploy(
    factory.address
  );
  const crowdswapV1 = await new CrowdswapV1Test__factory(signer).deploy([
    { flag: 0x08, adr: quickswap.address },
  ]);

  const currentTimestamp = await ethers.provider.getBlock("latest");
  const stakingLPFactory = new StakingLP__factory(signer);
  const stakingLPProxy = await upgrades.deployProxy(
    stakingLPFactory,
    [
      crowdUsdtPairAddress,
      CROWD.address,
      200 * 24 * 3600,
      currentTimestamp.timestamp,
    ],
    {
      kind: "uups",
    }
  );
  const stakingLPProxy2 = await upgrades.deployProxy(
    stakingLPFactory,
    [
      crowdUsdtPairAddress,
      CROWD.address,
      200 * 24 * 3600,
      BigNumber.from(currentTimestamp.timestamp + 5 * 24 * 3600),
    ],
    {
      kind: "uups",
    }
  );

  const transactionCount = await signer.getTransactionCount();
  //transactionCount + 1: works when all tests are run together!
  //transactionCount + 2: works when only stakingLP.spec.ts is run!
  const futureAddress = getContractAddress({
    from: signer.address,
    nonce: transactionCount + 1,
  });
  const tx = await signer.sendTransaction({
    to: futureAddress, //opportunityContract
    value: ethers.utils.parseEther("100"),
  });
  await tx.wait();

  const fee = ethers.utils.parseEther("0.1");

  const crowdUsdtLpStakeOpportunityFactory =
    new CrowdUsdtLpStakeOpportunity__factory(signer);
  const crowdUsdtLpStakeOpportunityProxy = await upgrades.deployProxy(
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
      stakingLPProxy.address,
    ],
    {
      kind: "uups",
    }
  );

  await stakingLPProxy.setOpportunityContract(
    crowdUsdtLpStakeOpportunityProxy.address
  );
  await stakingLPProxy.setResonateAdapter(
    "0x127F6e566212d3477b34725C9D1a422d6D960c97"
  );

  return {
    crowdUsdtLpStakeOpportunity: crowdUsdtLpStakeOpportunityProxy,
    stakingLP: stakingLPProxy,
    stakingLP2: stakingLPProxy2,
    CROWD: CROWD,
    USDT: USDT,
    DAI: DAI,
    MATIC: MATIC,
    crowdUsdtPair: crowdUsdtPair,
  };
};
