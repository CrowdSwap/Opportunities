import { Fixture } from "ethereum-waffle";
import { Wallet } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  IUniswapV2Factory,
  IUniswapV2Router02,
  IWETH,
  IWETH__factory,
} from "../../artifacts/types";

const tokenFixture: Fixture<{
  WETH: IWETH;
}> = async ([wallet], provider) => {
  const signer = provider.getSigner(wallet.address);
  return {
    WETH: await new IWETH__factory(signer).deploy(),
  };
};

export async function createDexUniswapV2(
  wallet: Wallet,
  weth: IWETH
): Promise<{
  factory: IUniswapV2Factory;
  router: IUniswapV2Router02;
}> {
  /* ================= DEPLOY UNISWAPV2 FACTORY CONTRACT ================= */
  const uniswapV2FactoryFactory = await ethers.getContractFactory(
    "UniswapV2Factory"
  );
  const factory = (await upgrades.deployProxy(
    uniswapV2FactoryFactory,
    [wallet.address],
    {
      kind: "uups",
    }
  )) as IUniswapV2Factory;

  /* ================= DEPLOY UNISWAPV2 ROUTER02 CONTRACT ================= */
  const uniswapV2RouterFactory = await ethers.getContractFactory(
    "UniswapV2Router02"
  );
  const router = (await upgrades.deployProxy(
    uniswapV2RouterFactory,
    [factory.address, weth.address],
    {
      kind: "uups",
    }
  )) as IUniswapV2Router02;

  await factory.setRouter(router.address);

  return {
    factory,
    router,
  };
}
export const uniswapV2Fixture: Fixture<{
  factory: IUniswapV2Factory;
  router: IUniswapV2Router02;
  WETH: IWETH;
}> = async ([wallet], provider) => {
  const { WETH } = await tokenFixture([wallet], provider);
  return {
    ...(await createDexUniswapV2(wallet, WETH)),
    WETH,
  };
};
