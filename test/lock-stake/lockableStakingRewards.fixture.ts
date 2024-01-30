import { Fixture } from "ethereum-waffle";
import { ethers, upgrades } from "hardhat";
import {
  LockableStakingRewards__factory,
  LockableStakingRewards,
  ERC20PresetMinterPauser,
  IWETH,
  ERC20PresetMinterPauser__factory,
  WETH__factory,
} from "../../artifacts/types";
import { Address } from "ethereumjs-util";

const tokenFixture: Fixture<{
  CROWD: ERC20PresetMinterPauser;
  TMNG: ERC20PresetMinterPauser;
  WMATIC: IWETH;
  MATIC: Address;
}> = async ([wallet], provider) => {
  const network = await ethers.provider.getNetwork();
  const signer = provider.getSigner(wallet.address);
  const chainId = network.chainId;
  switch (chainId) {
    case 31337:
      return {
        CROWD: await new ERC20PresetMinterPauser__factory(signer).deploy(
          "CROWD minter",
          "CROWD"
        ),
        TMNG: await new ERC20PresetMinterPauser__factory(signer).deploy(
          "TMNG minter",
          "TMNG"
        ),
        WMATIC: await new WETH__factory(signer).deploy(),
        MATIC: Address.fromString("0x0000000000000000000000000000000000001010"),
      };
  }
};

export const lockableStakingRewardsFixture: Fixture<{
  lockableStakingRewards: LockableStakingRewards;
  CROWD: ERC20PresetMinterPauser;
  TMNG: ERC20PresetMinterPauser;
}> = async ([wallet, account1, account2], provider) => {
  const signer = provider.getSigner(wallet.address);
  const { CROWD, TMNG } = await tokenFixture([wallet], provider);
  const lockableStakingRewardsFactory = new LockableStakingRewards__factory(
    signer
  );

  const stakingToken = CROWD.address;
  const feeTo = "0xFD4f361269dCdE0bc1CB410b54c0c30331a4FC99";
  const stakeFee = "0";
  const unstakeFee = "100000000000000000";

  const params = [
    stakingToken,
    {
      feeTo,
      stakeFee,
      unstakeFee,
    },
  ];

  const lockableStakingRewards = (await upgrades.deployProxy(
    lockableStakingRewardsFactory,
    params,
    {
      kind: "uups",
    }
  )) as LockableStakingRewards;
  return {
    lockableStakingRewards,
    CROWD,
    TMNG,
  };
};
