import { Fixture } from "ethereum-waffle";
import {
  BeefyMimaticUsdcOpportunity__factory,
  CrowdswapV1Test,
  CrowdswapV1Test__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  UniswapV2Router02Test__factory,
  IUniswapV2Router02,
  BeefyVaultV6Test__factory,
  UniswapV2FactoryTest__factory,
  IUniswapV2PairTest,
  IUniswapV2PairTest__factory,
  BeefyVaultV6Test,
  IWETH,
  WETH__factory,
} from "../artifacts/types";
import { ethers, upgrades } from "hardhat";
import { Address } from "ethereumjs-util";
import { Contract } from "ethers";

const tokenFixture: Fixture<{
  MIMATIC: ERC20PresetMinterPauser;
  USDC: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  WMATIC: IWETH;
  MATIC: Address;
}> = async ([wallet], provider) => {
  const signer = provider.getSigner(wallet.address);
  return {
    MIMATIC: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "MIMATIC minter",
      "MIMATIC"
    ),
    USDC: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "USDC minter",
      "USDC"
    ),
    DAI: await new ERC20PresetMinterPauser__factory(signer).deploy(
      "DAI minter",
      "DAI"
    ),
    WMATIC: await new WETH__factory(signer).deploy(),
    MATIC: Address.fromString("0x0000000000000000000000000000000000001010"),
  };
};

export const beefyMimaticUsdcOpportunityFixture: Fixture<{
  opportunity: Contract;
  crowdswapV1: CrowdswapV1Test;
  sushiswap: IUniswapV2Router02;
  quickswap: IUniswapV2Router02;
  MIMATIC: ERC20PresetMinterPauser;
  USDC: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  MATIC: Address;
  mimaticUsdcPair: IUniswapV2PairTest;
  mimaticUsdcVault: BeefyVaultV6Test;
}> = async ([wallet, revenue], provider) => {
  const signer = provider.getSigner(wallet.address);

  const { MIMATIC, USDC, DAI, MATIC, WMATIC } = await tokenFixture(
    [wallet],
    provider
  );

  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();
  await factory.createPair(MIMATIC.address, USDC.address);
  const mimaticUsdcPairAddress = await factory.getPair(
    MIMATIC.address,
    USDC.address
  );
  const mimaticUsdcPair = IUniswapV2PairTest__factory.connect(
    mimaticUsdcPairAddress,
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

  const mimaticUsdcVault = await new BeefyVaultV6Test__factory(signer).deploy(
    "Moo Mai USDC-miMATIC",
    "mooMaiUSDC-miMATIC",
    mimaticUsdcPairAddress
  );

  const fee = ethers.utils.parseEther("0.1");

  const beefyMimaticUsdcOpportunityFactory =
    new BeefyMimaticUsdcOpportunity__factory(signer);
  const opportunity = await upgrades.deployProxy(
    beefyMimaticUsdcOpportunityFactory,
    [
      MIMATIC.address,
      USDC.address,
      factory.address,
      revenue.address,
      fee,
      fee,
      fee,
      fee,
      crowdswapV1.address,
      quickswap.address,
      mimaticUsdcVault.address,
    ],
    {
      kind: "uups",
    }
  );

  await factory.createPair(MIMATIC.address, DAI.address); //For testing setTokenAandTokenB function

  return {
    opportunity,
    crowdswapV1,
    sushiswap,
    quickswap,
    MIMATIC,
    USDC,
    DAI,
    MATIC,
    mimaticUsdcPair,
    mimaticUsdcVault,
  };
};
