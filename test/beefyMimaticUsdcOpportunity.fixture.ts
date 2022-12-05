import { Fixture } from "ethereum-waffle";
import {
  BeefyMimaticUsdcOpportunity__factory,
  CrowdswapV1,
  CrowdswapV1__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  UniswapV2Router02Test__factory,
  IUniswapV2Router02,
  BeefyVaultV6Test__factory,
  IUniswapV3Router,
  UniswapV3RouterTest__factory,
  UniswapV2FactoryTest__factory,
  IUniswapV2Pair,
  IUniswapV2Pair__factory,
  BeefyVaultV6Test,
} from "../../artifacts/types";
import { ethers, upgrades } from "hardhat";
import { Dexchanges } from "@crowdswap/constant";
import { Address } from "ethereumjs-util";
import { Contract } from "ethers";

const tokenFixture: Fixture<{
  MIMATIC: ERC20PresetMinterPauser;
  USDC: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
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
    MATIC: Address.fromString("0x0000000000000000000000000000000000001010"),
  };
};

export const beefyMimaticUsdcOpportunityFixture: Fixture<{
  opportunity: Contract;
  crowdswapV1: CrowdswapV1;
  uniswapV3: IUniswapV3Router;
  sushiswap: IUniswapV2Router02;
  quickswap: IUniswapV2Router02;
  apeswap: IUniswapV2Router02;
  radioshack: IUniswapV2Router02;
  MIMATIC: ERC20PresetMinterPauser;
  USDC: ERC20PresetMinterPauser;
  DAI: ERC20PresetMinterPauser;
  MATIC: Address;
  mimaticUsdcPair: IUniswapV2Pair;
  mimaticUsdcVault: BeefyVaultV6Test;
}> = async ([wallet, revenue], provider) => {
  const signer = provider.getSigner(wallet.address);

  const { MIMATIC, USDC, DAI, MATIC } = await tokenFixture([wallet], provider);

  const factory = await new UniswapV2FactoryTest__factory(signer).deploy();
  await factory.createPair(MIMATIC.address, USDC.address);
  const mimaticUsdcPairAddress = await factory.getPair(
    MIMATIC.address,
    USDC.address
  );
  const mimaticUsdcPair = IUniswapV2Pair__factory.connect(
    mimaticUsdcPairAddress,
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

  const mimaticUsdcVault = await new BeefyVaultV6Test__factory(signer).deploy(
    "Moo Mai USDC-miMATIC",
    "mooMaiUSDC-miMATIC",
    mimaticUsdcPairAddress
  );

  const fee = ethers.utils.parseEther("0.1");

  const beefyMimaticUsdcOpportunityFactory =
    await new BeefyMimaticUsdcOpportunity__factory(signer);
  const opportunity = await upgrades.deployProxy(
    beefyMimaticUsdcOpportunityFactory,
    [
      MIMATIC.address,
      USDC.address,
      mimaticUsdcPairAddress,
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

  return {
    opportunity,
    crowdswapV1,
    uniswapV3,
    sushiswap,
    quickswap,
    apeswap,
    radioshack,
    MIMATIC,
    USDC,
    DAI,
    MATIC,
    mimaticUsdcPair,
    mimaticUsdcVault,
  };
};
