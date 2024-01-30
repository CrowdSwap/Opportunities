import { expect } from "chai";
import {ethers, upgrades, waffle} from "hardhat";
import { BigNumber, ContractReceipt } from "ethers";
import {lockableStakingRewardsFixture} from "./lockableStakingRewards.fixture";
import { LockableStakingRewards } from "../../artifacts/types";
import { Result } from "ethers/lib/utils";


describe("LockableStakingRewards", () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let owner, account1, account2;
  let network;

  beforeEach(async () => {
    [owner, account1, account2] = await ethers.getSigners();
    loadFixture = waffle.createFixtureLoader(
        [owner, account1, account2],
        <any>ethers.provider
    );
    network = await ethers.provider.getNetwork();

  });

  describe("createPlan", () => {
    it("should allow the owner to create a new staking plan", async () => {

      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);
      const planId=await createPlan(hardhatLockableStakingRewards,BigNumber.from(30),BigNumber.from(1000),BigNumber.from(500));

      const plan = await hardhatLockableStakingRewards.plans(planId);
      expect(plan.exists).to.be.true;
    });
  });

  describe("stake", () => {
    it("should allow a user to stake tokens", async () => {

      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      // Stake tokens
      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);

      // Check the stake
      const stake = await hardhatLockableStakingRewards.userStakes(
        account1.address,
        0
      );
      expect(stake.amount).to.equal(stakingAmount); // Use the exact staking amount for comparison
    });

    it("should stake", async () => {
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      await expect(
        hardhatLockableStakingRewards.connect(account1).stake(planId, stakingAmount)
      ).to.emit(hardhatLockableStakingRewards, "Staked");
    });

    it("shouldn't be able to stake in deactivate plan", async () => {
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);
      await hardhatLockableStakingRewards
          .connect(owner)
          .changePlanActiveStatus(planId,false);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .stake(planId, stakingAmount)
      ).to.be.revertedWith("LockableStakingRewards: Plan does not active.");

    });

    it("should not allow staking for an invalid plan", async function () {
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .stake(999, stakingAmount)
      ).to.be.revertedWith("LockableStakingRewards: Invalid plan ID");
    });

    it("should allow a user to stake tokens", async function () {
      const stakingAmount = ethers.utils.parseUnits("100", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);

      // Verify that the user's stake has been recorded
      const userStakes =
        await hardhatLockableStakingRewards.userStakes(
          account1.address,
          0
        );
      expect(userStakes.amount).to.equal(stakingAmount);
    });

    it("should allow multiple users to stake in a plan", async function () {
      const amountToStake = ethers.utils.parseEther("100");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          amountToStake,
          account1);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          amountToStake,
          account2);

      // Create a staking plan
      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, amountToStake);

      await hardhatLockableStakingRewards
        .connect(account2)
        .stake(planId, amountToStake);

      const user1Stakes =
        await hardhatLockableStakingRewards.userStakes(
          account1.address,
          0
        );
      const user2Stakes =
        await hardhatLockableStakingRewards.userStakes(
          account2.address,
          0
        );

      expect(user1Stakes.amount).to.equal(amountToStake);
      expect(user2Stakes.amount).to.equal(amountToStake);
    });

    it("should retrieve and verify the details of a staked amount", async function () {

      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);

      // Retrieve the stakes for the user
      const userStakes =
        await hardhatLockableStakingRewards.getUserStakingRecords(
          account1.address
        );
      let currentTimestamp = await ethers.provider.getBlock("latest");
      // We assume that the user has only one stake for simplicity
      const stake = userStakes[0]; // The first element of the array for the given planId
      // Verify the stake details
      expect(stake.amount).to.equal(stakingAmount); // Amount staked should match
      expect(stake.startTime).to.be.equal(currentTimestamp.timestamp); // Start time should be set
      expect(stake.endTime).to.be.equal(stake.startTime.add(BigNumber.from(30 * 24 * 60 * 60))); // End time should be set after start time
      expect(stake.lastWithdrawalTime).to.equal(stake.startTime);
      expect(stake.reward).to.equal(0); // Rewards should not be paid yet
      expect(stake.planId).to.equal(planId); 
      expect(stake.archived).to.be.false; 
      expect(stake.paidAmount).to.equal(0);
    });

    it("should add address to addresses array when staking", async function () {
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);

      // Now you can check if user1's address is in the addresses array.
      // You would need a way in your contract or in your tests to fetch the addresses array or a function to check if an address exists in it.
      // For the sake of this example, let's assume there's a function called `getAddresses` that returns the array of addresses.
      const stakedAddressCount =
        await hardhatLockableStakingRewards.getStakedAddressCount();
      expect(stakedAddressCount).to.equal(1);
    });

  });

  describe("withdraw", () => {

    it("should allow a user to withdraw by max value", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);

      const balanceStakingContract = await hardhatCrowdToken.balanceOf(
        hardhatLockableStakingRewards.address
      );
      expect(balanceStakingContract).to.equal(initial);

      const stakeTx = await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      const balanceAfterStaking = await hardhatCrowdToken.balanceOf(
        hardhatLockableStakingRewards.address
      );
      expect(balanceAfterStaking).to.equal(initial.add(stakingAmount));

      await moveTimeForward(30 * 24 * 60 * 60);

      await hardhatLockableStakingRewards
        .connect(account1)
        .withdraw(stakeId, 0, true);

        const expectedReward: BigNumber = stakingAmount
        .mul(apr)
        .mul(duration)
        .div(360 * 24 * 60 * 60 * 10000);

      const balanceAfterWithdraw = await hardhatCrowdToken.balanceOf(
        hardhatLockableStakingRewards.address
      );
      expect(balanceAfterWithdraw).to.equal(
        balanceAfterStaking.sub(stakingAmount.add(expectedReward))
      );

      const user1Stakes =
        await hardhatLockableStakingRewards.userStakes(
          account1.address,
          0
        );
      expect(user1Stakes.amount.add(user1Stakes.reward)).to.equal(user1Stakes.paidAmount);
    });

    it("shouldn't be able to withdraw again after withdraw max value", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);

      const balanceStakingContract = await hardhatCrowdToken.balanceOf(
          hardhatLockableStakingRewards.address
      );
      expect(balanceStakingContract).to.equal(initial);

      const stakeTx = await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      const balanceAfterStaking = await hardhatCrowdToken.balanceOf(
          hardhatLockableStakingRewards.address
      );
      expect(balanceAfterStaking).to.equal(initial.add(stakingAmount));

      await moveTimeForward(30 * 24 * 60 * 60);

      await hardhatLockableStakingRewards
          .connect(account1)
          .withdraw(stakeId, 0, true);

      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);

      const balanceAfterWithdraw = await hardhatCrowdToken.balanceOf(
          hardhatLockableStakingRewards.address
      );
      expect(balanceAfterWithdraw).to.equal(
          balanceAfterStaking.sub(stakingAmount.add(expectedReward))
      );

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .withdraw(stakeId, 0, true)).to.be.revertedWith(
          "LockableStakingRewards: The stake has been archived"
      );

    });

    it("shouldn't be able to withdraw after extend", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);
      const fee=await hardhatLockableStakingRewards.feeInfo();
      await setFee(hardhatLockableStakingRewards,fee.feeTo,fee.stakeFee,BigNumber.from(0));
      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);

      const stakeTx = await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      await moveTimeForward(30 * 24 * 60 * 60);

      //expected reward for 30 days
      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);

      // Call reStake function
      await hardhatLockableStakingRewards.connect(account1).extend(stakeId);

      // Assertions
      const userStakesBefore =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,0
          );
      expect(userStakesBefore.archived).to.be.true;

      const userStakesAfter =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,1
          );

      expect(userStakesAfter.amount).to.equal(
          stakingAmount.add(expectedReward)
      );

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .withdraw(stakeId, 0, true)).to.be.revertedWith(
          "LockableStakingRewards: The stake has been archived"
      );      
    });

    it("shouldn't be able to withdraw more than the user can", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);

     await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);

      await moveTimeForward(30 * 24 * 60 * 60);

      //expected reward for 30 days
      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .withdraw(0, stakingAmount.add(expectedReward).add(2), false)).to.be.revertedWith(
          "LockableStakingRewards: Amount is greater that stakedAmount + rewards"
      );

    });

    it("shouldn't be able to withdraw more than the user can, after one time withdraw", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);

      await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);

      await moveTimeForward(30 * 24 * 60 * 60);

      //expected reward for 30 days
      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);

      await hardhatLockableStakingRewards
          .connect(account1)
          .withdraw(0, stakingAmount, false);

      const user1Stakes =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,
              0
          );

      expect(user1Stakes.reward).to.equal(expectedReward);
      expect(user1Stakes.paidAmount).to.equal(stakingAmount);
      expect(user1Stakes.lastWithdrawalTime).to.equal((await ethers.provider.getBlock("latest")).timestamp);
      expect(user1Stakes.amount).to.equal(ethers.utils.parseUnits("10", "ether"));

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .withdraw(0, expectedReward.add(2), false)).to.be.revertedWith(
          "LockableStakingRewards: Amount is greater that stakedAmount + rewards"
      );

    });

    it("shouldn't be able to withdraw before end time of plan", async () => {
     const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const planId = await createPlan(hardhatLockableStakingRewards);
      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);


      const stakeTx = await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      //20 days
      await moveTimeForward(20 * 24 * 60 * 60);

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .withdraw(stakeId, 0, true)).to.be.revertedWith(
          "LockableStakingRewards: Staking period has not ended yet"
      );
    });

    it("4-should allow a user to withdraw part of staked amount", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);

      const balanceStakingContract = await hardhatCrowdToken.balanceOf(
          hardhatLockableStakingRewards.address
      );
      expect(balanceStakingContract).to.equal(initial);

      await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);

      const balanceAfterStaking = await hardhatCrowdToken.balanceOf(
          hardhatLockableStakingRewards.address
      );
      expect(balanceAfterStaking).to.equal(initial.add(stakingAmount));

      await moveTimeForward(30 * 24 * 60 * 60);

      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);

      const reward = await hardhatLockableStakingRewards.getUserReward(account1.address,0);
      expect(reward).to.equal(
          expectedReward
      );

      await hardhatLockableStakingRewards
          .connect(account1)
          .withdraw(0, ethers.utils.parseUnits("5", "ether"), false);

      const user1Stakes =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,
              0
          );
      expect(user1Stakes.reward).to.equal(expectedReward);
      expect(user1Stakes.paidAmount).to.equal(ethers.utils.parseUnits("5", "ether"));
      expect(user1Stakes.lastWithdrawalTime).to.equal((await ethers.provider.getBlock("latest")).timestamp);
      expect(user1Stakes.amount).to.equal(ethers.utils.parseUnits("10", "ether"));


    });

    it("should calculate reward correctly for valid stake", async function () {
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const initial = ethers.utils.parseUnits("1000000", "ether");
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, initial);
      const stakingAmount = ethers.utils.parseUnits("10", "ether");


      const planId = await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      const balanceStakingContract = await hardhatCrowdToken.balanceOf(
        hardhatLockableStakingRewards.address
      );
      expect(balanceStakingContract).to.equal(initial);
      const stakeTx = await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      const balanceAfterStaking = await hardhatCrowdToken.balanceOf(
        hardhatLockableStakingRewards.address
      );
      expect(balanceAfterStaking).to.equal(initial.add(stakingAmount));
      await moveTimeForward(30 * 24 * 60 * 60);

      const expectedReward: BigNumber = stakingAmount
        .mul(apr)
        .mul(duration)
        .div(360 * 24 * 60 * 60 * 10000);

      await hardhatLockableStakingRewards
        .connect(account1)
        .withdraw(stakeId, expectedReward, false);

      const balanceAfterWithdraw = await hardhatCrowdToken.balanceOf(
        hardhatLockableStakingRewards.address
      );
      expect(balanceAfterWithdraw).to.equal(
        balanceAfterStaking.sub(expectedReward)
      );
    });

    it("after withdraw couldn't staked by checking the archived flag", async function () {
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      const stakingAmount = ethers.utils.parseUnits("10", "ether");
      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);
      await hardhatCrowdToken.mint(hardhatLockableStakingRewards.address, stakingAmount.add(expectedReward));

      const planId= await createPlan(hardhatLockableStakingRewards);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount,
          account1);

      const stakeTx = await hardhatLockableStakingRewards
          .connect(account1)
          .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      await moveTimeForward(30 * 24 * 60 * 60);

      const fee=await hardhatLockableStakingRewards.feeInfo();
      await setFee(hardhatLockableStakingRewards,fee.feeTo,fee.stakeFee,BigNumber.from(0));

      await hardhatLockableStakingRewards
          .connect(account1)
          .withdraw(stakeId.toString(), 0, true);

      const userStakesBefore =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,0
          );
      expect(userStakesBefore.archived).to.be.true;

      await expect(
          hardhatLockableStakingRewards
              .connect(account1)
              .withdraw(stakeId.toString(), 0, true)
      ).to.be.revertedWith(
          "LockableStakingRewards: The stake has been archived"
      );

    });
  });

  describe("extend", () => {

    it("should allow a user to extend", async function () {
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);

      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      // Stake some amount first
      const stakingAmount = ethers.utils.parseUnits("100", "ether");
      const expectedReward: BigNumber = stakingAmount
        .mul(apr)
        .mul(duration)
        .div(360 * 24 * 60 * 60 * 10000);

      const planId= await createPlan(hardhatLockableStakingRewards);

      const fee=await hardhatLockableStakingRewards.feeInfo();
      await setFee(hardhatLockableStakingRewards,fee.feeTo,fee.stakeFee,BigNumber.from(0));
      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount.add(expectedReward),
          account1);

      const stakeTx = await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId, stakingAmount);
      const stakeReceipt= await stakeTx.wait();
      const stakeLog= getLog(stakeReceipt, "Staked");
      const stakeId= stakeLog.stakeId;

      await moveTimeForward(30 * 24 * 60 * 60);

      // Call reStake function
      await hardhatLockableStakingRewards.connect(account1).extend(stakeId);

      // Assertions
      const userStakesBefore =
        await hardhatLockableStakingRewards.userStakes(
          account1.address,0
        );
        expect(userStakesBefore.archived).to.be.true;

      const userStakesAfter =
        await hardhatLockableStakingRewards.userStakes(
          account1.address,1
        );
      expect(userStakesAfter.amount).to.equal(
        stakingAmount.add(expectedReward)
      );
    });

    it("checking the staked amount, after renewing a few days after the end time", async function () {
      let currentTimestamp = await ethers.provider.getBlock("latest");
      let apr: BigNumber = ethers.BigNumber.from(3000); // 30%
      let duration: BigNumber = ethers.BigNumber.from(30 * 24 * 60 * 60);
      let defaultApr: BigNumber = ethers.BigNumber.from(2000); // 20%

      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      // Stake some amount first
      const stakingAmount = ethers.utils.parseUnits("100", "ether");

      await hardhatLockableStakingRewards
          .connect(owner)
          .createPlan(duration, apr, defaultApr);

      const fee = await hardhatLockableStakingRewards.feeInfo();
      await setFee(hardhatLockableStakingRewards,fee.feeTo,fee.stakeFee,BigNumber.from(0));

      //expected reward for 30 days (plan duration)
      const expectedReward: BigNumber = stakingAmount
          .mul(apr)
          .mul(duration)
          .div(360 * 24 * 60 * 60 * 10000);
      //expected reward for 3 days (after plan duration based on default apr)
      const expectedRewardBasedOnDefaultApr: BigNumber = stakingAmount
          .mul(defaultApr)
          .mul(ethers.BigNumber.from(3 * 24 * 60 * 60))
          .div(360 * 24 * 60 * 60 * 10000);

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          stakingAmount.add(expectedReward.add(expectedRewardBasedOnDefaultApr)),
          account1);

       await hardhatLockableStakingRewards
          .connect(account1)
          .stake(0, stakingAmount);

      //moved 30 days
      await moveTimeForward(30 * 24 * 60 * 60);
      const reward = await hardhatLockableStakingRewards.getUserReward(account1.address,0);
      expect(reward).to.equal(
          expectedReward
      );

      //moved 3 days
      await moveTimeForward(3 * 24 * 60 * 60);
      const rewardWithDefaultApr = await hardhatLockableStakingRewards.getUserReward(account1.address,0);
      expect(rewardWithDefaultApr).to.equal(
          expectedReward.add(expectedRewardBasedOnDefaultApr)
      );
      // Call reStake function
      await hardhatLockableStakingRewards.connect(account1).extend(0);

      // Assertions
      const userStakesBefore =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,0
          );
      expect(userStakesBefore.archived).to.be.true;

      const userStakesAfter =
          await hardhatLockableStakingRewards.userStakes(
              account1.address,1
          );
      expect(userStakesAfter.amount).to.gte(
          stakingAmount.add(expectedReward.add(expectedRewardBasedOnDefaultApr))
      );
    });

    it("extend without stake", async function () {

      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      // Call reStake function
      await expect(
          hardhatLockableStakingRewards.connect(owner).extend(0)
      ).to.be.revertedWith(
          "LockableStakingRewards: Invalid stake ID"
      );
    });

  });

  describe("UserDetails", () => {
    it("should return staking records for a user", async function () {
      const amountToStake = ethers.utils.parseEther("500");
      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      // Create a staking plan
      const planId1 = await createPlan(
        hardhatLockableStakingRewards,
        BigNumber.from(30),
        BigNumber.from(2000)
      );
      const planId2 = await createPlan(
        hardhatLockableStakingRewards,
        BigNumber.from(60),
        BigNumber.from(3000)
      );

      await mintAndApprove(
        hardhatCrowdToken,
        hardhatLockableStakingRewards,
        amountToStake,
        account1
      );

      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId1, ethers.utils.parseEther("100"));
      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId2, ethers.utils.parseEther("200"));

      const user1Stakes = await hardhatLockableStakingRewards.userStakes(
        account1.address,
        0
      );
      const user2Stakes = await hardhatLockableStakingRewards.userStakes(
        account1.address,
        1
      );

      const stakingRecords =
        await hardhatLockableStakingRewards.getUserStakingRecords(
          account1.address
        );
      expect(stakingRecords.length).to.equal(2);

      expect(stakingRecords[0].amount).to.equal(ethers.utils.parseEther("100")); //plan 0 , record 0
      expect(stakingRecords[1].amount).to.equal(ethers.utils.parseEther("200")); //plan 1 , record 0
      //expect(stakingRecords[0][1].startTime).to.be.a("Number");  // Verify the start time
    });

    it("should return correct total staked amount for a user", async function () {
      const amountToStake = ethers.utils.parseEther("500");

      const {
        lockableStakingRewards: hardhatLockableStakingRewards,
        CROWD: hardhatCrowdToken,
      } = await loadFixture(lockableStakingRewardsFixture);

      // Create a staking plan
      const planId1 = await createPlan(
        hardhatLockableStakingRewards,
        BigNumber.from(30),
        BigNumber.from(2000)
      );
      const planId2 = await createPlan(
        hardhatLockableStakingRewards,
        BigNumber.from(60),
        BigNumber.from(3000)
      );

      await mintAndApprove(
          hardhatCrowdToken,
          hardhatLockableStakingRewards,
          amountToStake,
          account1);

      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId1, ethers.utils.parseEther("100"));
      await hardhatLockableStakingRewards
        .connect(account1)
        .stake(planId2, ethers.utils.parseEther("200"));

      const user1TotalStakedAmount =
        await hardhatLockableStakingRewards.getUserTotalStakedAmount(
          account1.address
        );

      expect(user1TotalStakedAmount).to.equal(
        ethers.utils.parseUnits("300", "ether")
      );
    });
  });

  async function moveTimeForward(seconds,current?) {
    let currentTimestamp = await ethers.provider.getBlock("latest");
    await ethers.provider.send("evm_mine", [
      (current ?? currentTimestamp.timestamp) + seconds,
    ]);
  }

 function getLog(txReceipt:ContractReceipt, eventName:string):Result {
    const event = txReceipt.events.find(
      (event) => event.event === eventName
    );
    return event.args;
    
  }


  async function createPlan(
    contract: LockableStakingRewards,
    duration?: BigNumber,
    apr?: BigNumber,
    defaultApr?: BigNumber
  ): Promise<BigNumber> {
    apr ??= BigNumber.from(3000); // 30%
    duration ??= BigNumber.from(30 * 24 * 60 * 60);
    defaultApr ??= BigNumber.from(0);

    // Create a staking plan
    const tx = await contract
      .connect(owner)
      .createPlan(duration, apr, defaultApr);
    const txReceipt = await tx.wait();

    const createPlanLogs = getLog(txReceipt, "PlanCreated");
    const planId = createPlanLogs.planId;
    return planId;
  }


  async function mintAndApprove(
      token,
      contract,
      amount,
      user
  ) {
    //if (network.chainId === 31337) {
      await token.mint(user.address ?? user, amount);
      await token.connect(user).approve(contract.address, amount);
   // }
  }

  async function setFee(hardhatLockableStakingRewards:LockableStakingRewards,feeTo:string,stakeFee:BigNumber,unstakeFee:BigNumber) {
    await hardhatLockableStakingRewards.pause();
    await hardhatLockableStakingRewards.setFee({
      feeTo: feeTo,
      stakeFee: stakeFee,
      unstakeFee: unstakeFee,
    });
    await hardhatLockableStakingRewards.unpause();
  }
});
