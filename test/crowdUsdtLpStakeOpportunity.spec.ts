import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { crowdUsdtLpStakeOpportunityFixture } from "./crowdUsdtLpStakeOpportunity.fixture";
import { UniswapV2Router02Test } from "../artifacts/types";
import { BigNumber } from "ethers";
import { AddressZero } from "@ethersproject/constants";

describe("CrowdUsdtLpStakeOpportunity", async () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let owner, revenue, account1, user;
  let network;

  before(async () => {
    [owner, revenue, account1, user] = await ethers.getSigners();
    loadFixture = waffle.createFixtureLoader(
      [owner, revenue],
      <any>ethers.provider
    );
    network = await ethers.provider.getNetwork();
  });

  describe("invest", async () => {
    it("User should be able to invest sending USDT and CROWD", async () => {
      const { opportunity, CROWD, USDT } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseUnits("4.317269", 6); // 4.3 + %0.4 fee
      const amountAMin = ethers.utils.parseEther("99");
      const amountBMin = ethers.utils.parseUnits("4.257", 6);

      const totalFee = getAddLiqFee(amountBDesired)
        .add(getAddLiqFee(amountBDesired))
        .add(getStakeFee(amountBDesired))
        .add(getStakeFee(amountBDesired));

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(opportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(opportunity.address, amountBDesired);

      const transaction = await opportunity.investByTokenATokenB(
        user.address,
        tokenB.address,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        }
      );
      const receipt = await transaction.wait();

      const investedByTokenATokenBEvent = receipt.events.find(
        (event) => event.event === "InvestedByTokenATokenB"
      );
      expect(investedByTokenATokenBEvent).to.not.be.undefined;
      expect(investedByTokenATokenBEvent.args.user).to.be.equal(user.address);
      expect(investedByTokenATokenBEvent.args.token).to.be.equal(
        tokenB.address
      );
      expect(investedByTokenATokenBEvent.args.amountA).to.be.equal(
        amountADesired
      );
      expect(investedByTokenATokenBEvent.args.amountB).to.be.equal(
        amountBDesired
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountBDesired);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(amountADesired);
      expect(addedLiquidityEvent.args.amountB).to.be.equal(
        amountBDesired.sub(totalFee)
      );
      expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending CROWD and USDT", async () => {
      const { opportunity, CROWD, USDT } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("100.4"); // 100 + %0.4 fee
      const amountBDesired = ethers.utils.parseUnits("4.3", 6);
      const amountAMin = ethers.utils.parseEther("99");
      const amountBMin = ethers.utils.parseUnits("4.257", 6);

      const totalFee = getAddLiqFee(amountADesired)
        .add(getAddLiqFee(amountADesired))
        .add(getStakeFee(amountADesired))
        .add(getStakeFee(amountADesired));

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(opportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(opportunity.address, amountBDesired);

      const transaction = await opportunity.investByTokenATokenB(
        user.address,
        tokenA.address,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        }
      );
      const receipt = await transaction.wait();

      const investedByTokenATokenBEvent = receipt.events.find(
        (event) => event.event === "InvestedByTokenATokenB"
      );
      expect(investedByTokenATokenBEvent).to.not.be.undefined;
      expect(investedByTokenATokenBEvent.args.user).to.be.equal(user.address);
      expect(investedByTokenATokenBEvent.args.token).to.be.equal(
        tokenA.address
      );
      expect(investedByTokenATokenBEvent.args.amountA).to.be.equal(
        amountADesired
      );
      expect(investedByTokenATokenBEvent.args.amountB).to.be.equal(
        amountBDesired
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(tokenA.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountADesired);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(
        amountADesired.sub(totalFee)
      );
      expect(addedLiquidityEvent.args.amountB).to.be.equal(amountBDesired);
      expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending DAI", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        DAI,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      let amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("15.531"); // 15.5 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseUnits("15.5", 6);
      await DAI.mint(owner.address, opportunity_amountIn);
      await DAI.approve(opportunity.address, opportunity_amountIn);
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(quickswap.address, swap2_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransaction(
        sushiswap,
        "Sushiswap",
        DAI,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        opportunity
      );
      amountADesired = swap2_amountOut.sub(getSwapFee(swap2_amountOut));

      const transaction = await opportunity.investByToken(
        user.address,
        DAI.address,
        opportunity_amountIn,
        swap2_amountIn,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        },
        swap1.data,
        swap2.data
      );
      const receipt = await transaction.wait();

      const investedByTokenEvent = receipt.events.find(
        (event) => event.event === "InvestedByToken"
      );
      expect(investedByTokenEvent).to.not.be.undefined;
      expect(investedByTokenEvent.args.user).to.be.equal(user.address);
      expect(investedByTokenEvent.args.token).to.be.equal(DAI.address);
      expect(investedByTokenEvent.args.amount).to.be.equal(
        opportunity_amountIn
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(DAI.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(opportunity_amountIn);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const swappedEvents = receipt.events.filter(
        (event) => event.event === "Swapped"
      );
      expect(swappedEvents[0]).to.not.be.undefined;
      expect(swappedEvents[0].args.user).to.be.equal(owner.address);
      expect(swappedEvents[0].args.fromToken).to.be.equal(DAI.address);
      expect(swappedEvents[0].args.toToken).to.be.equal(tokenB.address);
      expect(swappedEvents[0].args.amountIn).to.be.equal(swap1_amountIn);
      expect(swappedEvents[0].args.amountOut).to.be.equal(
        swap1_amountOut.sub(getSwapFee(swap1_amountOut))
      );
      expect(swappedEvents[1]).to.not.be.undefined;
      expect(swappedEvents[1].args.user).to.be.equal(owner.address);
      expect(swappedEvents[1].args.fromToken).to.be.equal(tokenB.address);
      expect(swappedEvents[1].args.toToken).to.be.equal(CROWD.address);
      expect(swappedEvents[1].args.amountIn).to.be.equal(swap2_amountIn);
      expect(swappedEvents[1].args.amountOut).to.be.equal(amountADesired);

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(amountADesired);
      expect(addedLiquidityEvent.args.amountB).to.be.equal(amountBDesired);
      expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending MATIC", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        MATIC,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      let amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("36.072"); // 36 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseUnits("15.5", 6);
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await CROWD.mint(quickswap.address, swap2_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransactionByMATIC(
        sushiswap,
        "Sushiswap",
        MATIC,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        opportunity
      );
      amountADesired = swap2_amountOut.sub(getSwapFee(swap2_amountOut));

      const transaction = await opportunity.investByToken(
        user.address,
        MATIC.toString(),
        opportunity_amountIn,
        swap2_amountIn,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        },
        swap1.data,
        swap2.data,
        { value: opportunity_amountIn }
      );
      const receipt = await transaction.wait();

      const investedByTokenEvent = receipt.events.find(
        (event) => event.event === "InvestedByToken"
      );
      expect(investedByTokenEvent).to.not.be.undefined;
      expect(investedByTokenEvent.args.user).to.be.equal(user.address);
      expect(investedByTokenEvent.args.token).to.be.equal(MATIC.toString());
      expect(investedByTokenEvent.args.amount).to.be.equal(
        opportunity_amountIn
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(MATIC.toString());
      expect(feeDeductedEvent.args.amount).to.be.equal(opportunity_amountIn);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const swappedEvents = receipt.events.filter(
        (event) => event.event === "Swapped"
      );
      expect(swappedEvents[0]).to.not.be.undefined;
      expect(swappedEvents[0].args.user).to.be.equal(owner.address);
      expect(swappedEvents[0].args.fromToken).to.be.equal(MATIC.toString());
      expect(swappedEvents[0].args.toToken).to.be.equal(tokenB.address);
      expect(swappedEvents[0].args.amountIn).to.be.equal(swap1_amountIn);
      expect(swappedEvents[0].args.amountOut).to.be.equal(
        swap1_amountOut.sub(getSwapFee(swap1_amountOut))
      );
      expect(swappedEvents[1]).to.not.be.undefined;
      expect(swappedEvents[1].args.user).to.be.equal(owner.address);
      expect(swappedEvents[1].args.fromToken).to.be.equal(tokenB.address);
      expect(swappedEvents[1].args.toToken).to.be.equal(tokenA.address);
      expect(swappedEvents[1].args.amountIn).to.be.equal(swap2_amountIn);
      expect(swappedEvents[1].args.amountOut).to.be.equal(amountADesired);

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(amountADesired);
      expect(addedLiquidityEvent.args.amountB).to.be.equal(amountBDesired);
      expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending CROWD", async () => {
      const { opportunity, crowdswapV1, quickswap, CROWD, USDT } =
        await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      let amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("259.518"); // 259 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenA.mint(owner.address, opportunity_amountIn);
      await tokenA.approve(opportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountADesired)
        .sub(totalFee);
      const swap1_amountOut = amountBDesired;
      await tokenB.mint(quickswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap1_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenA,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      amountBDesired = swap1_amountOut.sub(getSwapFee(swap1_amountOut));

      const transaction = await opportunity.investByTokenAOrTokenB(
        user.address,
        tokenA.address,
        opportunity_amountIn,
        swap1_amountIn,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        },
        swap1.data
      );
      const receipt = await transaction.wait();

      const investedByTokenAOrTokenBEvent = receipt.events.find(
        (event) => event.event === "InvestedByTokenAOrTokenB"
      );
      expect(investedByTokenAOrTokenBEvent).to.not.be.undefined;
      expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(user.address);
      expect(investedByTokenAOrTokenBEvent.args.token).to.be.equal(
        tokenA.address
      );
      expect(investedByTokenAOrTokenBEvent.args.amount).to.be.equal(
        opportunity_amountIn
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(tokenA.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(opportunity_amountIn);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const swappedEvent = receipt.events.find(
        (event) => event.event === "Swapped"
      );
      expect(swappedEvent).to.not.be.undefined;
      expect(swappedEvent.args.user).to.be.equal(owner.address);
      expect(swappedEvent.args.fromToken).to.be.equal(tokenA.address);
      expect(swappedEvent.args.toToken).to.be.equal(tokenB.address);
      expect(swappedEvent.args.amountIn).to.be.equal(swap1_amountIn);
      expect(swappedEvent.args.amountOut).to.not.be.undefined;

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(amountADesired);
      expect(addedLiquidityEvent.args.amountB).to.be.equal(amountBDesired);
      expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending USDT", async () => {
      const { opportunity, crowdswapV1, quickswap, CROWD, USDT } =
        await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      let amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("15.3807"); // 15.35 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenB.mint(owner.address, opportunity_amountIn);
      await tokenB.approve(opportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountBDesired)
        .sub(totalFee);
      const swap1_amountOut = amountADesired;
      await tokenA.mint(quickswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap1_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      amountADesired = swap1_amountOut.sub(getSwapFee(swap1_amountOut));

      const transaction = await opportunity.investByTokenAOrTokenB(
        user.address,
        tokenB.address,
        opportunity_amountIn,
        swap1_amountIn,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        },
        swap1.data
      );
      const receipt = await transaction.wait();

      const investedByTokenAOrTokenBEvent = receipt.events.find(
        (event) => event.event === "InvestedByTokenAOrTokenB"
      );
      expect(investedByTokenAOrTokenBEvent).to.not.be.undefined;
      expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(user.address);
      expect(investedByTokenAOrTokenBEvent.args.token).to.be.equal(
        tokenB.address
      );
      expect(investedByTokenAOrTokenBEvent.args.amount).to.be.equal(
        opportunity_amountIn
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(opportunity_amountIn);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const swappedEvent = receipt.events.find(
        (event) => event.event === "Swapped"
      );
      expect(swappedEvent).to.not.be.undefined;
      expect(swappedEvent.args.user).to.be.equal(owner.address);
      expect(swappedEvent.args.fromToken).to.be.equal(tokenB.address);
      expect(swappedEvent.args.toToken).to.be.equal(tokenA.address);
      expect(swappedEvent.args.amountIn).to.be.equal(swap1_amountIn);
      expect(swappedEvent.args.amountOut).to.not.be.undefined;

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(amountADesired);
      expect(addedLiquidityEvent.args.amountB).to.be.equal(amountBDesired);
      expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending LP", async () => {
      const { opportunity, quickswap, CROWD, USDT, crowdUsdtPair } =
        await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("4.3");
      const amountAMin = ethers.utils.parseEther("99");
      const amountBMin = ethers.utils.parseEther("4.257");

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(quickswap.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(quickswap.address, amountBDesired);

      const addLiquidityTx = await quickswap.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        owner.address,
        (await ethers.provider.getBlock("latest")).timestamp + 1000
      );
      await addLiquidityTx.wait();

      const liquidity = await crowdUsdtPair.balanceOf(owner.address);
      await crowdUsdtPair.approve(opportunity.address, liquidity);

      const totalFee = getAddLiqFee(liquidity);

      const transaction = await opportunity.investByLP(user.address, liquidity);
      const receipt = await transaction.wait();

      const investedByLPEvent = receipt.events.find(
        (event) => event.event === "InvestedByLP"
      );
      expect(investedByLPEvent).to.not.be.undefined;
      expect(investedByLPEvent.args.user).to.be.equal(user.address);
      expect(investedByLPEvent.args.amount).to.be.equal(liquidity);

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(crowdUsdtPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(liquidity);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending CROWD", async () => {
      const { opportunity, crowdswapV1, quickswap, CROWD, USDT } =
        await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("259.518"); // 259 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenA.mint(owner.address, opportunity_amountIn);
      await tokenA.approve(opportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountADesired)
        .sub(totalFee);
      const swap1_ExpectedAmountOut = amountBDesired;
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseUnits("0.45", 6)
      );
      await tokenB.mint(quickswap.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(
        swap1_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenA,
        tokenB,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByTokenAOrTokenB(
          owner.address,
          tokenA.address,
          opportunity_amountIn,
          swap1_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data
        )
      ).to.revertedWith("oe01");
    });

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending USDT", async () => {
      const { opportunity, crowdswapV1, quickswap, CROWD, USDT } =
        await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("15.3807"); // 15.35 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenB.mint(owner.address, opportunity_amountIn);
      await tokenB.approve(opportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountBDesired)
        .sub(totalFee);
      const swap1_ExpectedAmountOut = amountADesired;
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseUnits("1")
      );
      await tokenA.mint(quickswap.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(
        swap1_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByTokenAOrTokenB(
          owner.address,
          tokenB.address,
          opportunity_amountIn,
          swap1_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data
        )
      ).to.revertedWith("oe01");
    });

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending DAI", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        DAI,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("15.531"); // 15.5 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await DAI.mint(owner.address, opportunity_amountIn);
      await DAI.approve(opportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_ExpectedAmountOut = ethers.utils.parseUnits("15.5", 6);
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseUnits("0.5", 6)
      );
      await tokenB.mint(sushiswap.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(
        swap1_actualAmountOut
      );
      const swap2_amountIn = swap1_ExpectedAmountOut
        .sub(getSwapFee(swap1_ExpectedAmountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(quickswap.address, swap2_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransaction(
        sushiswap,
        "Sushiswap",
        DAI,
        tokenB,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByToken(
          owner.address,
          DAI.address,
          opportunity_amountIn,
          swap2_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data,
          swap2.data
        )
      ).to.revertedWith("oe01");
    });

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending MATIC", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        MATIC,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("36.072"); // 36 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_ExpectedAmountOut = ethers.utils.parseUnits("15.5", 6);
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseUnits("0.5", 6)
      );
      await tokenB.mint(sushiswap.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(
        swap1_actualAmountOut
      );
      const swap2_amountIn = swap1_ExpectedAmountOut
        .sub(getSwapFee(swap1_ExpectedAmountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(quickswap.address, swap2_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransactionByMATIC(
        sushiswap,
        "Sushiswap",
        MATIC,
        tokenB,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByToken(
          owner.address,
          MATIC.toString(),
          opportunity_amountIn,
          swap2_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data,
          swap2.data,
          { value: opportunity_amountIn }
        )
      ).to.revertedWith("oe01");
    });

    it("Should fail when the amountOut of the second swap is not equal or greater than the expected amountOut, sending DAI", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        DAI,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("15.531"); // 15.5 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await DAI.mint(owner.address, opportunity_amountIn);
      await DAI.approve(opportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseUnits("15.5", 6);
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_ExpectedAmountOut = amountADesired;
      const swap2_actualAmountOut = swap2_ExpectedAmountOut.sub(
        ethers.utils.parseUnits("0.5")
      );
      await tokenA.mint(quickswap.address, swap2_actualAmountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(
        swap2_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransaction(
        sushiswap,
        "Sushiswap",
        DAI,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_ExpectedAmountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByToken(
          owner.address,
          DAI.address,
          opportunity_amountIn,
          swap2_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data,
          swap2.data
        )
      ).to.revertedWith("oe02");
    });

    it("Should fail when the amountOut of the second swap is not equal or greater than the expected amountOut, sending MATIC", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        MATIC,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("36.072"); // 36 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseUnits("15.5", 6);
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_ExpectedAmountOut = amountADesired;
      const swap2_actualAmountOut = swap2_ExpectedAmountOut.sub(
        ethers.utils.parseUnits("0.5")
      );
      await tokenA.mint(quickswap.address, swap2_actualAmountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(
        swap2_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransactionByMATIC(
        sushiswap,
        "Sushiswap",
        MATIC,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_ExpectedAmountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByToken(
          owner.address,
          MATIC.toString(),
          opportunity_amountIn,
          swap2_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data,
          swap2.data,
          { value: opportunity_amountIn }
        )
      ).to.revertedWith("oe02");
    });

    it("Should fail when the msg.value is lower than the input amount", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        USDT,
        MATIC,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;
      const tokenB = USDT;

      const amountADesired = ethers.utils.parseEther("150");
      const amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("36.072"); // 36 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseUnits("15.5", 6);
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(quickswap.address, swap2_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransactionByMATIC(
        sushiswap,
        "Sushiswap",
        MATIC,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByToken(
          owner.address,
          MATIC.toString(),
          opportunity_amountIn,
          swap2_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data,
          swap2.data,
          { value: opportunity_amountIn.sub(ethers.utils.parseUnits("1")) }
        )
      ).to.revertedWith("oe03");
    });

    it("Should fail when unknown token is sent to investByTokenATokenB function", async () => {
      const { opportunity, DAI } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );

      await expect(
        opportunity.investByTokenATokenB(owner.address, DAI.address, {
          amountADesired: ethers.utils.parseEther("100"),
          amountBDesired: ethers.utils.parseUnits("4.3", 6),
          amountAMin: ethers.utils.parseEther("99"),
          amountBMin: ethers.utils.parseUnits("4.257", 6),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        })
      ).to.revertedWith("oe04");
    });

    it("Should fail when unknown token is sent to investByTokenAOrTokenB function", async () => {
      const { opportunity, DAI } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );

      await expect(
        opportunity.investByTokenAOrTokenB(
          owner.address,
          DAI.address,
          ethers.utils.parseEther("259"),
          ethers.utils.parseEther("59"),
          {
            amountADesired: ethers.utils.parseEther("100"),
            amountBDesired: ethers.utils.parseUnits("4.3", 6),
            amountAMin: ethers.utils.parseEther("99"),
            amountBMin: ethers.utils.parseUnits("4.257", 6),
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          "0x"
        )
      ).to.revertedWith("oe04");
    });

    it("Should fail when wrong swap data is sent to investByToken function", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        CROWD,
        DAI,
        MATIC,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      const tokenA = CROWD;

      let amountADesired = ethers.utils.parseEther("150");
      let amountBDesired = ethers.utils.parseUnits("6.45", 6);
      const amountAMin = ethers.utils.parseEther("148.5");
      const amountBMin = ethers.utils.parseUnits("6.38", 6);

      const opportunity_amountIn = ethers.utils.parseEther("36.072"); // 36 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseUnits("15.5", 6);
      await DAI.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(quickswap.address, swap2_amountOut);
      await (<UniswapV2Router02Test>quickswap).setAmountOut(swap2_amountOut);

      //intended swap from MATIC to DAI (not USDT) to simulate the error oe05
      const swap1 = await getCrowdSwapAggregatorTransactionByMATIC(
        sushiswap,
        "Sushiswap",
        MATIC,
        DAI,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        opportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        quickswap,
        "Quickswap",
        DAI,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        opportunity
      );

      await expect(
        opportunity.investByToken(
          owner.address,
          MATIC.toString(),
          opportunity_amountIn,
          swap2_amountIn,
          {
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          swap1.data,
          swap2.data,
          { value: opportunity_amountIn }
        )
      ).to.revertedWith("oe05");
    });
  });

  describe("leave", async () => {
    let opportunity, tokenA, tokenB, crowdUsdtPair, stakingLP;
    let amountLP;

    const totalRewards = ethers.utils.parseEther("10000000");
    const amountADesired = ethers.utils.parseEther("100");
    const amountBDesired = ethers.utils.parseUnits("4.317269", 6); // 4.3 + %0.4 fee
    let amountAMin = ethers.utils.parseEther("99");
    let amountBMin = ethers.utils.parseUnits("4.257", 6);

    beforeEach(async () => {
      const fixture = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      opportunity = fixture.opportunity;
      tokenA = fixture.CROWD;
      tokenB = fixture.USDT;
      crowdUsdtPair = fixture.crowdUsdtPair;
      stakingLP = fixture.stakingLP;

      await tokenA.mint(stakingLP.address, totalRewards);
      await stakingLP.notifyRewardAmount(totalRewards);
      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(opportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(opportunity.address, amountBDesired);

      await opportunity.investByTokenATokenB(user.address, tokenB.address, {
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
      });

      amountLP = await stakingLP.balanceOf(user.address);
    });

    it("User should be able to leave, unstaking all LP", async () => {
      await moveTimeForward(10);
      const rewards = await stakingLP.earned(user.address); // rewards so far
      expect(rewards).to.be.gt(0);

      const balanceBeforeCROWD = await tokenA.balanceOf(account1.address);
      const balanceBeforeUSDT = await tokenB.balanceOf(account1.address);

      const totalFee = getUnstakeFee(amountLP).add(getRemoveLiqFee(amountLP));

      const transaction = await opportunity.connect(user).leave({
        amount: amountLP,
        amountAMin: amountAMin,
        amountBMin: amountBMin,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        receiverAccount: account1.address,
      });
      const receipt = await transaction.wait();

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(user.address);
      expect(feeDeductedEvent.args.token).to.be.equal(crowdUsdtPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountLP);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const leftEvent = receipt.events.find((event) => event.event === "Left");
      expect(leftEvent).to.not.be.undefined;
      expect(leftEvent.args.user).to.be.equal(user.address);

      const balanceAfterCROWD = await tokenA.balanceOf(account1.address);
      const balanceAfterUSDT = await tokenB.balanceOf(account1.address);

      expect(balanceAfterCROWD.sub(balanceBeforeCROWD)).to.be.at.least(
        amountAMin.add(rewards)
      );
      expect(balanceAfterUSDT.sub(balanceBeforeUSDT)).to.be.at.least(
        amountBMin
      );
    });

    it("User should be able to leave, unstaking some LP", async () => {
      await moveTimeForward(10);
      const rewards = await stakingLP.earned(user.address); // rewards so far
      expect(rewards).to.be.gt(0);

      amountAMin = ethers.utils.parseEther("49.5");
      amountBMin = ethers.utils.parseUnits("2.1285", 6);

      const balanceBeforeCROWD = await tokenA.balanceOf(account1.address);
      const balanceBeforeUSDT = await tokenB.balanceOf(account1.address);

      amountLP = amountLP.div(BigNumber.from(2));
      const totalFee = getUnstakeFee(amountLP).add(getRemoveLiqFee(amountLP));

      const transaction = await opportunity.connect(user).leave({
        amount: amountLP,
        amountAMin: amountAMin,
        amountBMin: amountBMin,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        receiverAccount: account1.address,
      });
      const receipt = await transaction.wait();

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(user.address);
      expect(feeDeductedEvent.args.token).to.be.equal(crowdUsdtPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountLP);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const leftEvent = receipt.events.find((event) => event.event === "Left");
      expect(leftEvent).to.not.be.undefined;
      expect(leftEvent.args.user).to.be.equal(user.address);

      const balanceAfterCROWD = await tokenA.balanceOf(account1.address);
      const balanceAfterUSDT = await tokenB.balanceOf(account1.address);

      expect(balanceAfterCROWD.sub(balanceBeforeCROWD)).to.be.at.least(
        amountAMin
      );
      expect(balanceAfterCROWD.sub(balanceBeforeCROWD)).to.be.lt(
        amountAMin.add(rewards)
      );
      expect(balanceAfterUSDT.sub(balanceBeforeUSDT)).to.be.at.least(
        amountBMin
      );
    });
  });

  describe("admin operations", async () => {
    it("should change the fee recipient", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setFeeTo(newAddress);
      await expect(await opportunity.feeTo()).to.eq(newAddress);
    });

    it("should change the add liquidity fee", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setAddLiquidityFee(newFee);
      await expect(await opportunity.addLiquidityFee()).to.eq(newFee);
    });

    it("should change the remove liquidity fee", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setRemoveLiquidityFee(newFee);
      await expect(await opportunity.removeLiquidityFee()).to.eq(newFee);
    });

    it("should change the stake fee", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setStakeFee(newFee);
      await expect(await opportunity.stakeFee()).to.eq(newFee);
    });

    it("should change the unstake fee", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setUnstakeFee(newFee);
      await expect(await opportunity.unstakeFee()).to.eq(newFee);
    });

    it("should change the tokenA", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setTokenA(newAddress);
      await expect(await opportunity.tokenA()).to.eq(newAddress);
    });

    it("should change the tokenB", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setTokenB(newAddress);
      await expect(await opportunity.tokenB()).to.eq(newAddress);
    });

    it("should change the pair contract", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setPair(newAddress);
      await expect(await opportunity.pair()).to.eq(newAddress);
    });

    it("should change the swap contract", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setSwapContract(newAddress);
      await expect(await opportunity.swapContract()).to.eq(newAddress);
    });

    it("should change the router contract", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setRouter(newAddress);
      await expect(await opportunity.router()).to.eq(newAddress);
    });

    it("should change the stakingLP contract", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setStakingLP(newAddress);
      await expect(await opportunity.stakingLP()).to.eq(newAddress);
    });

    it("should fail using none owner address", async () => {
      const { opportunity, CROWD } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      const newFee = ethers.utils.parseEther("0.2");
      const withdrawAmount = ethers.utils.parseEther("1");

      await expect(
        opportunity.connect(account1).setFeeTo(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setAddLiquidityFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setRemoveLiquidityFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setStakeFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setUnstakeFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setTokenA(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setTokenB(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setPair(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setSwapContract(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setRouter(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setStakingLP(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity
          .connect(account1)
          .withdrawFunds(CROWD.address, withdrawAmount, owner.address)
      ).to.revertedWith("ce30");
    });

    it("should fail to set addresses to zero", async () => {
      const { opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixture
      );
      await expect(opportunity.setFeeTo(AddressZero)).to.revertedWith("oe12");
      await expect(opportunity.setTokenA(AddressZero)).to.revertedWith("oe12");
      await expect(opportunity.setTokenB(AddressZero)).to.revertedWith("oe12");
      await expect(opportunity.setPair(AddressZero)).to.revertedWith("oe12");
      await expect(opportunity.setSwapContract(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(opportunity.setRouter(AddressZero)).to.revertedWith("oe12");
      await expect(opportunity.setStakingLP(AddressZero)).to.revertedWith(
        "oe12"
      );
    });
  });

  describe("Pausable", async () => {
    let opportunity, USDT;

    before(async () => {
      const fixture = await loadFixture(crowdUsdtLpStakeOpportunityFixture);
      opportunity = fixture.opportunity;
      USDT = fixture.USDT;
    });

    it("should pause the contract", async () => {
      await expect(opportunity.pause())
        .to.emit(opportunity, "Paused")
        .withArgs(owner.address);
    });

    it("should fail to invest while the contract is paused", async () => {
      await expect(
        opportunity.investByTokenATokenB(user.address, USDT.address, {
          amountADesired: ethers.utils.parseEther("100"),
          amountBDesired: ethers.utils.parseUnits("4.317269", 6),
          amountAMin: ethers.utils.parseEther("99"),
          amountBMin: ethers.utils.parseUnits("4.257", 6),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        })
      ).to.revertedWith("Pausable: paused");
    });

    it("should fail to leave while the contract is paused", async () => {
      await expect(
        opportunity.leave({
          amount: ethers.utils.parseEther("10"),
          amountAMin: ethers.utils.parseEther("99"),
          amountBMin: ethers.utils.parseUnits("4.257", 6),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
          receiverAccount: account1.address,
        })
      ).to.revertedWith("Pausable: paused");
    });

    it("should unpause the contract", async () => {
      await expect(opportunity.unpause())
        .to.emit(opportunity, "Unpaused")
        .withArgs(owner.address);
    });

    it("should fail using none owner address", async () => {
      await expect(opportunity.connect(account1).pause()).to.revertedWith(
        "ce30"
      );

      await expect(opportunity.connect(account1).unpause()).to.revertedWith(
        "ce30"
      );
    });
  });

  function getSwapFee(amountOut) {
    return BigNumber.from(1).mul(amountOut).div(BigNumber.from(10)).div(100);
  }

  function getAddLiqFee(amount) {
    return amount.div(1000);
  }

  function getRemoveLiqFee(amount) {
    return amount.div(1000);
  }

  function getStakeFee(amount) {
    return amount.div(1000);
  }

  function getUnstakeFee(amount) {
    return amount.div(1000);
  }

  async function moveTimeForward(seconds) {
    let currentTimestamp = await ethers.provider.getBlock("latest");
    await ethers.provider.send("evm_mine", [
      currentTimestamp.timestamp + seconds,
    ]);
  }

  async function getCrowdSwapAggregatorTransaction(
    dex,
    dexName,
    fromToken,
    toToken,
    amountIn,
    amountOut,
    crowdswapV1,
    opportunity
  ) {
    const swapTx_onDex = await dex.populateTransaction.swapExactTokensForTokens(
      amountIn,
      amountOut,
      [fromToken.address, toToken.address],
      crowdswapV1.address,
      (await ethers.provider.getBlock("latest")).timestamp + 1000
    );
    return crowdswapV1.populateTransaction.swap(
      fromToken.address,
      toToken.address,
      opportunity.address,
      amountIn,
      getDexFlag(dexName),
      swapTx_onDex.data
    );
  }

  async function getCrowdSwapAggregatorTransactionByMATIC(
    dex,
    dexName,
    fromToken,
    toToken,
    amountIn,
    amountOut,
    crowdswapV1,
    opportunity
  ) {
    const swapTx_onDex = await dex.populateTransaction.swapExactETHForTokens(
      amountOut,
      [fromToken.toString(), toToken.address],
      crowdswapV1.address,
      (await ethers.provider.getBlock("latest")).timestamp + 1000
    );
    return crowdswapV1.populateTransaction.swap(
      fromToken.toString(),
      toToken.address,
      opportunity.address,
      amountIn,
      getDexFlag(dexName),
      swapTx_onDex.data
    );
  }

  function getDexFlag(dexName: string) {
    if (dexName == "Sushiswap") {
      return 0x03;
    } else if (dexName == "Quickswap") {
      return 0x08;
    }
  }
});
