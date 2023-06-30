import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { stakingLpFixture } from "./stakingLp.fixture";
import { UniswapV2PairTest } from "../artifacts/types";
import { BigNumber } from "ethers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("StakingLP", async () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let owner, revenue, userAccount, userAccount2, userAccount3;
  let network;

  before(async () => {
    [owner, revenue, userAccount, userAccount2, userAccount3] =
      await ethers.getSigners();
    loadFixture = waffle.createFixtureLoader(
      [owner, revenue],
      <any>ethers.provider
    );
    network = await ethers.provider.getNetwork();
  });

  describe("stakeLP", async () => {
    it("should fail before setting the OpportunityContract", async () => {
      const { stakingLP2 } = await loadFixture(stakingLpFixture);
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP2.stakeLP(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: address is not valid");
    });

    it("should fail before setting the ResonateAdapter", async () => {
      const { stakingLP2, crowdUsdtLpStakeOpportunity } = await loadFixture(
        stakingLpFixture
      );
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP2.stakeLP(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: address is not valid");
    });

    it("should fail before setting both contracts", async () => {
      const { stakingLP2 } = await loadFixture(stakingLpFixture);
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP2.stakeLP(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: address is not valid");
    });

    it("should fail if the caller is not the OpportunityContract", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP.stakeLP(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: caller is not verified");
    });

    it("should fail before the start of the opportunity", async () => {
      const { stakingLP2, crowdUsdtPair, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );

      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      ).to.be.revertedWith(
        "LPStaking: only eligible users are able to stake before start time"
      );
    });

    it("should fail sending zero", async () => {
      const { stakingLP, crowdUsdtLpStakeOpportunity } = await loadFixture(
        stakingLpFixture
      );
      const amountLP = ethers.utils.parseEther("0");
      const opportunity = await ethers.getImpersonatedSigner(
        crowdUsdtLpStakeOpportunity.address
      );
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: cannot stake 0");
    });

    it("User should be able to stake if they are eligible", async () => {
      const { stakingLP2, crowdUsdtPair, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );
      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );

      stakingLP2.addToEligibleUsers([userAccount.address]);

      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP2, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(
        amountLP
      );
    });

    it("User should be able to stake", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);
    });
  });

  describe("withdrawRewards", async () => {
    it("should fail sending zero", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);
      const amountLP = ethers.utils.parseEther("0");
      await expect(
        stakingLP
          .connect(userAccount)
          .withdrawRewards(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: cannot withdraw 0");
    });

    it("should fail when stakeholder does not exist", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP
          .connect(userAccount)
          .withdrawRewards(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: lpStakeholder does not exist");
    });

    it("should fail when trying to withdraw more rewards", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      let earned = await stakingLP.earned(userAccount.address);
      earned = earned + ethers.utils.parseEther("1000");
      await expect(
        stakingLP
          .connect(userAccount)
          .withdrawRewards(earned, userAccount.address)
      ).to.be.revertedWith("LPStaking: not enough balance");
    });

    it("User should be able to withdraw rewards", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      await moveTimeForward(180); //3 minutes
      expect(await stakingLP.earned(userAccount.address)).to.gte(
        "833333333333333333220"
      );

      expect(await CROWD.balanceOf(userAccount.address)).to.equal(0);
      const earned = await stakingLP.earned(userAccount.address);
      await expect(
        stakingLP
          .connect(userAccount)
          .withdrawRewards(earned, userAccount.address)
      )
        .to.emit(stakingLP, "WithdrawnRewards")
        .withArgs(userAccount.address, earned);
      expect(await CROWD.balanceOf(userAccount.address)).to.equal(earned);
    });
  });

  describe("withdraw", async () => {
    it("should fail before setting the OpportunityContract", async () => {
      const { stakingLP2 } = await loadFixture(stakingLpFixture);
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP2.withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: address is not valid");
    });

    it("should fail before setting the ResonateAdapter", async () => {
      const { stakingLP2, crowdUsdtLpStakeOpportunity } = await loadFixture(
        stakingLpFixture
      );
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP2.withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: address is not valid");
    });

    it("should fail before setting both contracts", async () => {
      const { stakingLP2 } = await loadFixture(stakingLpFixture);
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP2.withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: address is not valid");
    });

    it("should fail if the caller is not the OpportunityContract", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);
      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP.withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: caller is not verified");
    });

    it("should fail sending zero", async () => {
      const { stakingLP, crowdUsdtLpStakeOpportunity } = await loadFixture(
        stakingLpFixture
      );
      const amountLP = ethers.utils.parseEther("0");
      const opportunity = await ethers.getImpersonatedSigner(
        crowdUsdtLpStakeOpportunity.address
      );
      await expect(
        stakingLP.connect(opportunity).withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: cannot withdraw 0");
    });

    it("should fail when stakeholder does not exist", async () => {
      const { stakingLP, crowdUsdtLpStakeOpportunity } = await loadFixture(
        stakingLpFixture
      );
      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await ethers.getImpersonatedSigner(
        crowdUsdtLpStakeOpportunity.address
      );
      await expect(
        stakingLP.connect(opportunity).withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: lpStakeholder does not exist");
    });

    it("should fail when trying to withdraw more LP tokens", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      await expect(
        stakingLP
          .connect(opportunity)
          .withdraw(amountLP.add(1), userAccount.address)
      ).to.be.revertedWith("LPStaking: not enough balance");
    });

    it("should fail when trying to withdraw for an account other than resonateAdapter", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      const resonateAdapter = await ethers.getImpersonatedSigner(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      await expect(
        stakingLP
          .connect(resonateAdapter)
          .withdraw(amountLP, userAccount.address)
      ).to.be.revertedWith("LPStaking: _originAccount is not valid");
    });

    it("User should be able to withdraw some LP tokens", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountStakedLP = ethers.utils.parseEther("5");
      const amountWithdrawLP = ethers.utils.parseEther("2");
      const amountRemainedLP = ethers.utils.parseEther("3");

      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountStakedLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(opportunity)
          .stakeLP(amountStakedLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountStakedLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountStakedLP
      );

      expect(await crowdUsdtPair.balanceOf(opportunity.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(opportunity)
          .withdraw(amountWithdrawLP, userAccount.address)
      )
        .to.emit(stakingLP, "Withdrawn")
        .withArgs(userAccount.address, amountWithdrawLP, anyValue);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountRemainedLP
      );
      expect(await crowdUsdtPair.balanceOf(opportunity.address)).to.equal(
        amountWithdrawLP
      );
      expect(await CROWD.balanceOf(opportunity.address)).to.equal(0);
    });

    it("User should be able to withdraw all LP tokens and receive all rewards", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountStakedLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountStakedLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(opportunity)
          .stakeLP(amountStakedLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountStakedLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountStakedLP
      );

      await moveTimeForward(120); //2 minutes
      const earned = await stakingLP.earned(userAccount.address);

      expect(await CROWD.balanceOf(opportunity.address)).to.equal(0);
      expect(await crowdUsdtPair.balanceOf(opportunity.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(opportunity)
          .withdraw(amountStakedLP, userAccount.address)
      )
        .to.emit(stakingLP, "Withdrawn")
        .withArgs(userAccount.address, amountStakedLP, anyValue);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      expect(await stakingLP.earned(userAccount.address)).to.equal(0);
      expect(await CROWD.balanceOf(opportunity.address)).to.gte(earned);
      expect(await crowdUsdtPair.balanceOf(opportunity.address)).to.equal(
        amountStakedLP
      );
    });
  });

  describe("withdrawByOwner", async () => {
    it("should fail using none owner address", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);

      const amountLP = ethers.utils.parseEther("1");
      await expect(
        stakingLP
          .connect(userAccount)
          .withdrawByOwner(amountLP, userAccount.address)
      ).to.be.revertedWith("ce30");
    });

    it("Owner should be able to withdraw some LP tokens", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountStakedLP = ethers.utils.parseEther("5");
      const amountWithdrawLP = ethers.utils.parseEther("2");
      const amountRemainedLP = ethers.utils.parseEther("3");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountStakedLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(opportunity)
          .stakeLP(amountStakedLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountStakedLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountStakedLP
      );

      expect(await crowdUsdtPair.balanceOf(owner.address)).to.equal(0);
      await expect(
        stakingLP.withdrawByOwner(amountWithdrawLP, userAccount.address)
      )
        .to.emit(stakingLP, "Withdrawn")
        .withArgs(userAccount.address, amountWithdrawLP, anyValue);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountRemainedLP
      );
      expect(await crowdUsdtPair.balanceOf(userAccount.address)).to.equal(
        amountWithdrawLP
      );
      expect(await CROWD.balanceOf(userAccount.address)).to.equal(0);
    });

    it("Owner should be able to withdraw all LP tokens and receive all rewards", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountStakedLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountStakedLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(opportunity)
          .stakeLP(amountStakedLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountStakedLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountStakedLP
      );

      await moveTimeForward(120); //2 minutes
      const earned = await stakingLP.earned(userAccount.address);

      expect(await CROWD.balanceOf(userAccount.address)).to.equal(0);
      expect(await crowdUsdtPair.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.withdrawByOwner(amountStakedLP, userAccount.address)
      )
        .to.emit(stakingLP, "Withdrawn")
        .withArgs(userAccount.address, amountStakedLP, anyValue);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      expect(await stakingLP.earned(userAccount.address)).to.equal(0);
      expect(await CROWD.balanceOf(userAccount.address)).to.gte(earned);
      expect(await crowdUsdtPair.balanceOf(userAccount.address)).to.equal(
        amountStakedLP
      );
    });
  });

  describe("notifyRewardAmount", async () => {
    it("rewards are changed during the opportunity", async () => {
      const { stakingLP, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);
      expect(await CROWD.balanceOf(stakingLP.address)).to.equal(rewards);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      await moveTimeForward(10 * 24 * 3600); //10 days
      let earned = await stakingLP.earned(userAccount.address);
      expect(earned).to.gte(ethers.utils.parseEther("3999999"));
      expect(earned).to.lte(ethers.utils.parseEther("4000000"));

      await notify(CROWD, rewards, stakingLP);
      expect(await CROWD.balanceOf(stakingLP.address)).to.equal(
        rewards.add(rewards)
      );
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("9.02777")
      );

      await moveTimeForward(60); // 1 minute
      expect(await stakingLP.earned(userAccount.address)).to.gte(
        ethers.utils.parseEther("4000550")
      );
    });

    it("rewards are changed before the start of the opportunity", async () => {
      const { stakingLP2, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP2);
      expect(await CROWD.balanceOf(stakingLP2.address)).to.equal(rewards);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP2.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      await stakingLP2.addToEligibleUsers([userAccount.address]);

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP2, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(
        amountLP
      );

      await moveTimeForward(4 * 24 * 3600); //4 days
      expect(await stakingLP2.earned(userAccount.address)).to.gte(0);

      await notify(CROWD, rewards, stakingLP2);
      expect(await CROWD.balanceOf(stakingLP2.address)).to.equal(
        rewards.add(rewards)
      );
      // 160000000 / (200 * 24 * 3600)
      expect(await stakingLP2.rewardRate()).to.gte(
        ethers.utils.parseEther("9.2592592")
      );

      await moveTimeForward(2 * 24 * 3600); //2 days
      // 9.2592592 * (24 * 3600)
      expect(await stakingLP2.earned(userAccount.address)).to.gte(
        ethers.utils.parseEther("800000")
      );
    });

    it("reward situation when reward < rewardsDuration", async () => {
      const { stakingLP2, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      console.log(`rewards: 0.000000000008  rewardDuration: 200`);
      const rewards = ethers.utils.parseEther("0.000000000008");
      await notify(CROWD, rewards, stakingLP2); // Duration 17,280,000
      expect(await CROWD.balanceOf(stakingLP2.address)).to.equal(rewards);
      // 8000000 * 1e6 / (200 * 24 * 3600) = 462962.962962963
      const rewartRate1 = await stakingLP2.rewardRate();
      expect(+ethers.utils.formatUnits(rewartRate1, 6)).to.gte(0.462962);

      console.log("rewardRate", +ethers.utils.formatUnits(rewartRate1, 6));
      await stakingLP2.addToEligibleUsers([userAccount.address]);

      await moveTimeForward(5 * 24 * 3600); //day 0

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP2, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(
        amountLP
      );
      const earn1 = await stakingLP2.earned(userAccount.address);
      console.log("earn after start time", earn1);
      expect(await stakingLP2.earned(userAccount.address)).to.gte(0);

      await moveTimeForward(5 * 24 * 3600); //day 5

      const earn2 = await stakingLP2.earned(userAccount.address);
      console.log("earn after 5 days", ethers.utils.formatEther(earn2));

      await moveTimeForward(5 * 24 * 3600); //day 10

      const earn3 = await stakingLP2.earned(userAccount.address);
      console.log("earn after 10 days", ethers.utils.formatEther(earn3));
    });
  });

  describe("setRewardsDuration", async () => {
    it("should fail passing invalid duration", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);

      await moveTimeForward(11 * 24 * 3600); //11 days

      await expect(
        stakingLP.setRewardsDuration(BigNumber.from(10 * 24 * 3600))
      ).to.be.revertedWith(
        "LPStaking: The new interval must be greater than the passed time of the previous interval"
      );
    });

    it("rewards are changed during the opportunity", async () => {
      const { stakingLP, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);
      expect(await CROWD.balanceOf(stakingLP.address)).to.equal(rewards);
      // 80000000 / (200 * 24 * 3600)
      let rewardRate = await stakingLP.rewardRate();
      expect(rewardRate).to.gte(ethers.utils.parseEther("4.6296296"));

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      await moveTimeForward(10 * 24 * 3600); //10 days
      const earned = await stakingLP.earned(userAccount.address);
      expect(earned).to.gte(ethers.utils.parseEther("3999999"));
      expect(earned).to.lte(ethers.utils.parseEther("4000000"));

      const oldRewardsDuration = await stakingLP.rewardsDuration(); //200 * 24 * 3600
      const newRewardsDuration = BigNumber.from(100 * 24 * 3600);
      const currentTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;
      const expectedRewardRate = (await stakingLP.periodFinish())
        .sub(currentTimestamp)
        .mul(rewardRate)
        .div(
          newRewardsDuration
            .add(await stakingLP.startTime())
            .sub(currentTimestamp)
        );

      expect(await stakingLP.rewardsDuration()).to.equal(oldRewardsDuration);
      await expect(stakingLP.setRewardsDuration(newRewardsDuration))
        .to.emit(stakingLP, "RewardsDurationUpdated")
        .withArgs(oldRewardsDuration, newRewardsDuration);
      expect(await stakingLP.rewardsDuration()).to.equal(newRewardsDuration);
      const newRewardRate = (await stakingLP.rewardRate()).div(1e6);
      expect(newRewardRate).to.gte(expectedRewardRate.div(1e6));

      await moveTimeForward(10 * 24 * 3600); //10 days
      const newEarned = await stakingLP.earned(userAccount.address);
      expect(newEarned).to.gte(
        earned.add(newRewardRate.mul(BigNumber.from(10 * 24 * 3600)))
      );
    });

    it("rewards are changed before the start of the opportunity", async () => {
      const { stakingLP2, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP2);
      expect(await CROWD.balanceOf(stakingLP2.address)).to.equal(rewards);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP2.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      expect(await stakingLP2.rewardsDuration()).to.equal(200 * 24 * 3600);
      await expect(
        stakingLP2.setRewardsDuration(BigNumber.from(100 * 24 * 3600))
      )
        .to.emit(stakingLP2, "RewardsDurationUpdated")
        .withArgs(
          BigNumber.from(200 * 24 * 3600),
          BigNumber.from(100 * 24 * 3600)
        );
      expect(await stakingLP2.rewardsDuration()).to.equal(100 * 24 * 3600);
      expect((await stakingLP2.rewardRate()).div(1e6)).to.equal(
        rewards.div(BigNumber.from("8640000"))
      );
    });

    it("duration is changed during the opportunity", async () => {
      const { stakingLP, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      await moveTimeForward(50 * 24 * 3600); //50 days

      const earnedBeforeChangeDuration = await stakingLP.earned(
        userAccount.address
      );
      expect(earnedBeforeChangeDuration).to.gte(
        ethers.utils.parseEther("19999999.872")
      );

      await expect(stakingLP.setRewardsDuration(BigNumber.from(60 * 24 * 3600)))
        .to.emit(stakingLP, "RewardsDurationUpdated")
        .withArgs(
          BigNumber.from(200 * 24 * 3600),
          BigNumber.from(60 * 24 * 3600)
        );
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("37")
      );

      expect(
        (await stakingLP.lpStakeholders(userAccount.address)).lpRewards
      ).to.gte(earnedBeforeChangeDuration);

      await moveTimeForward(60);

      const earnedAfterChangeDuration = await stakingLP.earned(
        userAccount.address
      );
      expect(earnedAfterChangeDuration).to.gte(
        earnedBeforeChangeDuration.add(ethers.utils.parseEther("2220"))
      );

      await moveTimeForward(60);

      expect(await stakingLP.earned(userAccount.address)).to.gte(
        earnedAfterChangeDuration.add(ethers.utils.parseEther("2220"))
      );
    });

    it("duration is changed before the start of the opportunity", async () => {
      const { stakingLP2, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP2);
      expect(await CROWD.balanceOf(stakingLP2.address)).to.equal(rewards);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP2.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );

      await stakingLP2.addToEligibleUsers([userAccount.address]);

      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP2, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(
        amountLP
      );

      await moveTimeForward(60);

      expect(await stakingLP2.earned(userAccount.address)).to.equal(0);

      await expect(
        stakingLP2.setRewardsDuration(BigNumber.from(10 * 24 * 3600))
      )
        .to.emit(stakingLP2, "RewardsDurationUpdated")
        .withArgs(
          BigNumber.from(200 * 24 * 3600),
          BigNumber.from(10 * 24 * 3600)
        );
      await moveTimeForward(60);

      expect(await stakingLP2.earned(userAccount.address)).to.equal(0);

      await moveTimeForward(5 * 24 * 3600); // 5 days

      expect(await stakingLP2.earned(userAccount.address)).to.gt(0);
    });

    it("opportunity has started with couple of users", async () => {
      const { stakingLP, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      const amountLP_1 = ethers.utils.parseEther("5");
      const amountLP_2 = ethers.utils.parseEther("10");

      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP_1.add(amountLP_1).add(amountLP_1).add(amountLP_2),
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_1, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP_1);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountLP_1
      );

      await moveTimeForward(10 * 24 * 3600); //10 days

      expect(await stakingLP.balanceOf(userAccount2.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_1, userAccount2.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount2.address, amountLP_1);
      expect(await stakingLP.balanceOf(userAccount2.address)).to.equal(
        amountLP_1
      );

      await moveTimeForward(10 * 24 * 3600); //10 days

      expect(await stakingLP.balanceOf(userAccount3.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_1, userAccount3.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount3.address, amountLP_1);
      expect(await stakingLP.balanceOf(userAccount3.address)).to.equal(
        amountLP_1
      );

      await moveTimeForward(10 * 24 * 3600); //10 days

      expect(await stakingLP.totalSupply()).to.equal(
        amountLP_1.add(amountLP_1).add(amountLP_1)
      );

      // (10 days + 5 days + 3.33 days) * 4.6296296
      const earned_user1 = await stakingLP.earned(userAccount.address);
      expect(earned_user1).to.gte(ethers.utils.parseEther("7331999.9530752"));
      // (5 days + 3.33 days) * 4.6296296
      const earned_user2 = await stakingLP.earned(userAccount2.address);
      expect(earned_user2).to.gte(ethers.utils.parseEther("3331999.9786752"));
      // (3.33 days) * 4.6296296
      const earned_user3 = await stakingLP.earned(userAccount3.address);
      expect(earned_user3).to.gte(ethers.utils.parseEther("1331999.9914752"));

      await moveTimeForward(10 * 24 * 3600); //10 days

      await expect(stakingLP.setRewardsDuration(BigNumber.from(60 * 24 * 3600)))
        .to.emit(stakingLP, "RewardsDurationUpdated")
        .withArgs(
          BigNumber.from(200 * 24 * 3600),
          BigNumber.from(60 * 24 * 3600)
        );
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("37")
      );

      await moveTimeForward(10 * 24 * 3600); //10 days

      // (3.33 days) * 4.6296296 + (3.33 days) * 37
      const earned_user1_2 = await stakingLP.earned(userAccount.address);
      expect(earned_user1_2).to.gte(
        earned_user1.add(ethers.utils.parseEther("11977343.9914752"))
      );
      // (3.33 days) * 4.6296296 + (3.33 days) * 37
      const earned_user2_2 = await stakingLP.earned(userAccount2.address);
      expect(earned_user2_2).to.gte(
        earned_user2.add(ethers.utils.parseEther("11977343.9914752"))
      );
      // (3.33 days) * 4.6296296 + (3.33 days) * 37
      const earned_user3_2 = await stakingLP.earned(userAccount3.address);
      expect(earned_user3_2).to.gte(
        earned_user3.add(ethers.utils.parseEther("11977343.9914752"))
      );

      expect(await stakingLP.balanceOf(owner.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_2, owner.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(owner.address, amountLP_2);
      expect(await stakingLP.balanceOf(owner.address)).to.equal(amountLP_2);

      await moveTimeForward(10 * 24 * 3600); //10 days

      // (2 days) * 37
      const earned_user1_3 = await stakingLP.earned(userAccount.address);
      expect(earned_user1_3).to.gte(
        earned_user1_2.add(ethers.utils.parseEther("6393600"))
      );
      // (2 days) * 37
      const earned_user2_3 = await stakingLP.earned(userAccount2.address);
      expect(earned_user2_3).to.gte(
        earned_user2_2.add(ethers.utils.parseEther("6393600"))
      );
      // (2 days) * 37
      const earned_user3_3 = await stakingLP.earned(userAccount3.address);
      expect(earned_user3_3).to.gte(
        earned_user3_2.add(ethers.utils.parseEther("6393600"))
      );
      // (4 days) * 37
      const earned_owner = await stakingLP.earned(owner.address);
      expect(earned_owner).to.gte(ethers.utils.parseEther("12787200"));
    });
  });

  describe("earned", () => {
    it("The eligible user stakes and their rewards should be calculated after startTime", async () => {
      const { stakingLP2, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP2);

      const amountLP = ethers.utils.parseEther("1");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );

      await stakingLP2.addToEligibleUsers([userAccount.address]);

      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP2, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(
        amountLP
      );

      await moveTimeForward(24 * 3600); //1 day
      expect(await stakingLP2.earned(userAccount.address)).to.equal(0);

      await moveTimeForward(4 * 24 * 3600); //4 days
      expect(await stakingLP2.earned(userAccount.address)).to.gte(
        ethers.utils.parseEther("74.074074")
      );

      await moveTimeForward(50 * 24 * 3600); //50 days
      expect(await stakingLP2.earned(userAccount.address)).to.gte(
        ethers.utils.parseEther("19999999.872")
      );
    });

    it("The rewards calculation should stop when the opportunity ends", async () => {
      const { stakingLP, crowdUsdtPair, crowdUsdtLpStakeOpportunity, CROWD } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(amountLP);

      await moveTimeForward(60);
      const earned_1 = await stakingLP.earned(userAccount.address);
      await moveTimeForward(60);
      const earned_2 = await stakingLP.earned(userAccount.address);
      expect(earned_2).to.gt(earned_1);
      await moveTimeForward(5 * 24 * 3600); //5 days later
      const earned_3 = await stakingLP.earned(userAccount.address);
      expect(earned_3).to.gt(earned_2);
      await moveTimeForward(200 * 24 * 3600); //200 days later
      const earned = await stakingLP.earned(userAccount.address);
      expect(earned).to.gt(earned_3);
      expect(await stakingLP.earned(userAccount.address)).to.equal(earned); //The opportunity is finished

      expect(await CROWD.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP
          .connect(userAccount)
          .withdrawRewards(earned, userAccount.address)
      )
        .to.emit(stakingLP, "WithdrawnRewards")
        .withArgs(userAccount.address, earned);
      expect(await CROWD.balanceOf(userAccount.address)).to.equal(earned);

      await moveTimeForward(5 * 24 * 3600); //5 days later
      expect(await stakingLP.earned(userAccount.address)).to.equal(0);
    });

    it("Multiple users", async () => {
      const { stakingLP, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      const amountLP_1 = ethers.utils.parseEther("5");
      const amountLP_2 = ethers.utils.parseEther("10");

      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP_1.add(amountLP_1).add(amountLP_2),
        crowdUsdtLpStakeOpportunity,
        stakingLP
      );

      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_1, userAccount.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount.address, amountLP_1);
      expect(await stakingLP.balanceOf(userAccount.address)).to.equal(
        amountLP_1
      );

      await moveTimeForward(100);

      expect(await stakingLP.balanceOf(userAccount2.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_1, userAccount2.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount2.address, amountLP_1);
      expect(await stakingLP.balanceOf(userAccount2.address)).to.equal(
        amountLP_1
      );

      await moveTimeForward(200);

      expect(await stakingLP.balanceOf(userAccount3.address)).to.equal(0);
      await expect(
        stakingLP.connect(opportunity).stakeLP(amountLP_2, userAccount3.address)
      )
        .to.emit(stakingLP, "LPStaked")
        .withArgs(userAccount3.address, amountLP_2);
      expect(await stakingLP.balanceOf(userAccount3.address)).to.equal(
        amountLP_2
      );

      await moveTimeForward(100);

      // (100 + 100 + 25) * 4.6296296
      expect(await stakingLP.earned(userAccount.address)).to.gte(
        ethers.utils.parseEther("1041.66666")
      );
      // (100 + 25) * 4.6296296
      expect(await stakingLP.earned(userAccount2.address)).to.gte(
        ethers.utils.parseEther("578.7037")
      );
      // (50) * 4.6296296
      expect(await stakingLP.earned(userAccount3.address)).to.gte(
        ethers.utils.parseEther("231.48148")
      );
    });
  });

  describe("startTime", () => {
    it("should fail sending passed timestamp", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);
      let currentTimestamp =
        (await ethers.provider.getBlock("latest")).timestamp - 86400;
      await expect(stakingLP.setStartTime(currentTimestamp)).to.be.revertedWith(
        "LPStaking: entered time must be greater than timestamp"
      );
    });

    it("should fail when the startTime has passed", async () => {
      const { stakingLP } = await loadFixture(stakingLpFixture);
      let currentTimestamp =
        (await ethers.provider.getBlock("latest")).timestamp + 86400;
      await expect(stakingLP.setStartTime(currentTimestamp)).to.be.revertedWith(
        "LPStaking: changing start time is impossible"
      );
    });

    it("combination of change duration and start time", async () => {
      const { stakingLP2, crowdUsdtPair, CROWD, crowdUsdtLpStakeOpportunity } =
        await loadFixture(stakingLpFixture);
      await stakingLP2.setOpportunityContract(
        crowdUsdtLpStakeOpportunity.address
      );
      await stakingLP2.setResonateAdapter(
        "0x127F6e566212d3477b34725C9D1a422d6D960c97"
      );

      const rewards = ethers.utils.parseEther("80000000");
      await notify(CROWD, rewards, stakingLP2);
      expect(await CROWD.balanceOf(stakingLP2.address)).to.equal(rewards);
      // 80000000 / (200 * 24 * 3600)
      expect(await stakingLP2.rewardRate()).to.gte(
        ethers.utils.parseEther("4.6296296")
      );

      const oldStartTime = await stakingLP2.startTime();
      const newStartTime =
        (await ethers.provider.getBlock("latest")).timestamp + 2 * 24 * 3600;
      await expect(stakingLP2.setStartTime(newStartTime))
        .to.emit(stakingLP2, "StartTime")
        .withArgs(oldStartTime, newStartTime);

      const amountLP = ethers.utils.parseEther("5");
      const opportunity = await mintAndApprove(
        crowdUsdtPair,
        amountLP,
        crowdUsdtLpStakeOpportunity,
        stakingLP2
      );

      await stakingLP2.addToEligibleUsers([userAccount.address]);

      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(0);
      await expect(
        stakingLP2.connect(opportunity).stakeLP(amountLP, userAccount.address)
      )
        .to.emit(stakingLP2, "LPStaked")
        .withArgs(userAccount.address, amountLP);
      expect(await stakingLP2.balanceOf(userAccount.address)).to.equal(
        amountLP
      );

      await moveTimeForward(120); //2 minutes

      expect(await stakingLP2.earned(userAccount.address)).to.equal(0);

      const newerStartTime =
        (await ethers.provider.getBlock("latest")).timestamp + 5;
      await expect(stakingLP2.setStartTime(newerStartTime))
        .to.emit(stakingLP2, "StartTime")
        .withArgs(newStartTime, newerStartTime);

      await moveTimeForward(60);

      const earned = await stakingLP2.earned(userAccount.address);
      expect(earned).to.gte(ethers.utils.parseEther("231.48148"));

      await expect(
        stakingLP2.setRewardsDuration(BigNumber.from(100 * 24 * 3600))
      )
        .to.emit(stakingLP2, "RewardsDurationUpdated")
        .withArgs(
          BigNumber.from(200 * 24 * 3600),
          BigNumber.from(100 * 24 * 3600)
        );
      expect(await stakingLP2.rewardRate()).to.gte(
        ethers.utils.parseEther("9.2592592")
      );

      await moveTimeForward(60);

      const earned_2 = await stakingLP2.earned(userAccount.address);
      expect(earned_2).to.gte(earned);
    });
  });

  describe("Pausable", async () => {
    let stakingLP;

    before(async () => {
      const fixture = await loadFixture(stakingLpFixture);
      stakingLP = fixture.stakingLP;
    });

    it("should pause the contract", async () => {
      await expect(stakingLP.pause())
        .to.emit(stakingLP, "Paused")
        .withArgs(owner.address);
    });

    it("should fail to withdrawRewards while the contract is paused", async () => {
      await expect(
        stakingLP.withdrawRewards(BigNumber.from(10), userAccount.address)
      ).to.revertedWith("Pausable: paused");
    });

    it("should unpause the contract", async () => {
      await expect(stakingLP.unpause())
        .to.emit(stakingLP, "Unpaused")
        .withArgs(owner.address);
    });

    it("should fail using none owner address", async () => {
      await expect(stakingLP.connect(userAccount).pause()).to.revertedWith(
        "ce30"
      );

      await expect(stakingLP.connect(userAccount).unpause()).to.revertedWith(
        "ce30"
      );
    });
  });

  async function moveTimeForward(seconds) {
    let currentTimestamp = await ethers.provider.getBlock("latest");
    await ethers.provider.send("evm_mine", [
      currentTimestamp.timestamp + seconds,
    ]);
  }

  async function mintAndApprove(
    pair,
    amount,
    caller,
    stakingLP
  ): Promise<SignerWithAddress | undefined> {
    if (network.chainId === 31337) {
      await (<UniswapV2PairTest>pair)._mint(caller.address ?? caller, amount);
      const impersonated = await ethers.getImpersonatedSigner(
        caller.address ?? caller
      );

      await owner.sendTransaction({
        to: caller.address,
        value: ethers.utils.parseEther("1"),
      });

      await pair.connect(impersonated).approve(stakingLP.address, amount);
      return impersonated;
    }
    return undefined;
  }

  async function notify(CROWD, amount, stakingLP) {
    if (network.chainId === 31337) {
      await CROWD.mint(stakingLP.address, amount);
      await stakingLP.notifyRewardAmount(amount);
    }
  }
});
