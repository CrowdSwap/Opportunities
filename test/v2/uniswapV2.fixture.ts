import { Fixture } from "ethereum-waffle";
import { Wallet } from "ethers";

import {
  IUniswapV2Router02,
  IWETH,
  IWETH__factory,
  UniswapV2FactoryTest,
  UniswapV2FactoryTest__factory,
  UniswapV2Router02Test__factory,
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
  factory: UniswapV2FactoryTest;
  router: IUniswapV2Router02;
}> {
  /* ================= DEPLOY UNISWAPV2 FACTORY CONTRACT ================= */
  // const uniswapV2FactoryFactory = await ethers.getContractFactory(
  //   "UniswapV2FactoryTest"
  // );
  // const factory = (await upgrades.deployProxy(
  //   uniswapV2FactoryFactory,
  //   [wallet.address],
  //   {
  //     kind: "uups",
  //   }
  // )) as UniswapV2FactoryTest;

  const factory = await new UniswapV2FactoryTest__factory(wallet).deploy();

  /* ================= DEPLOY UNISWAPV2 ROUTER02 CONTRACT ================= */
  // const uniswapV2RouterFactory = await ethers.getContractFactory(
  //   "UniswapV2Router02"
  // );
  // const router = (await upgrades.deployProxy(
  //   uniswapV2RouterFactory,
  //   [factory.address, weth.address],
  //   {
  //     kind: "uups",
  //   }
  // )) as IUniswapV2Router02;

  const router = await new UniswapV2Router02Test__factory(wallet).deploy(
    factory.address,
    weth.address
  );

  return {
    factory,
    router,
  };
}
export const uniswapV2Fixture: Fixture<{
  factory: UniswapV2FactoryTest;
  router: IUniswapV2Router02;
  WETH: IWETH;
}> = async ([wallet], provider) => {
  const { WETH } = await tokenFixture([wallet], provider);
  return {
    ...(await createDexUniswapV2(wallet, WETH)),
    WETH,
  };
};
