import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { beefyMimaticUsdcOpportunityFixture } from "./beefyMimaticUsdcOpportunity.fixture";
import { UniswapV2Router02Test } from "../artifacts/types";
import { BigNumber } from "ethers";
import { AddressZero } from "@ethersproject/constants";

describe("BeefyMimaticUsdcOpportunity", async () => {
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
    it("User should be able to invest sending USDC and MIMATIC", async () => {
      const { opportunity, MIMATIC, USDC } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const tokenA = MIMATIC;
      const tokenB = USDC;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseUnits("4.317269", 6); // 4.3 + %0.4 fee
      const amountAMin = ethers.utils.parseEther("99");
      const amountBMin = ethers.utils.parseUnits("4.257", 6);

      const totalFee = getAddLiqFee(amountBDesired)
        .add(getAddLiqFee(amountBDesired))
        .add(getStakeFee(amountBDesired))
        .add(getStakeFee(amountBDesired));

      await tokenA.mint(owner.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenA.approve(opportunity.address, amountADesired);
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
      expect(feeDeductedEvent.args.totalFee).to.be.gte(totalFee);

      const addedLiquidityEvent = receipt.events.find(
        (event) => event.event === "AddedLiquidity"
      );
      expect(addedLiquidityEvent).to.not.be.undefined;
      expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
      expect(addedLiquidityEvent.args.amountA).to.be.equal(amountADesired);
      expect(addedLiquidityEvent.args.amountB).to.be.lte(
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

    it("User should be able to invest sending MIMATIC and USDC", async () => {
      const { opportunity, MIMATIC, USDC } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const tokenA = MIMATIC;
      const tokenB = USDC;

      const amountADesired = ethers.utils.parseEther("100.4"); // 100 + %0.4 fee
      const amountBDesired = ethers.utils.parseUnits("4.3", 6);
      const amountAMin = ethers.utils.parseEther("99");
      const amountBMin = ethers.utils.parseUnits("4.257", 6);

      const totalFee = getAddLiqFee(amountADesired)
        .add(getAddLiqFee(amountADesired))
        .add(getStakeFee(amountADesired))
        .add(getStakeFee(amountADesired));

      await tokenA.mint(owner.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenA.approve(opportunity.address, amountADesired);
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
        MIMATIC,
        USDC,
        DAI,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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

    it("User should be able to invest sending MATIC", async () => {
      const {
        opportunity,
        crowdswapV1,
        sushiswap,
        quickswap,
        MIMATIC,
        USDC,
        MATIC,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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

    it("User should be able to invest sending MIMATIC", async () => {
      const { opportunity, crowdswapV1, quickswap, MIMATIC, USDC } =
        await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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

    it("User should be able to invest sending USDC", async () => {
      const { opportunity, crowdswapV1, quickswap, MIMATIC, USDC } =
        await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
      const { opportunity, quickswap, MIMATIC, USDC, mimaticUsdcPair } =
        await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("4.3");
      const amountAMin = ethers.utils.parseEther("99");
      const amountBMin = ethers.utils.parseEther("4.257");

      await tokenA.mint(owner.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenA.approve(quickswap.address, amountADesired);
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

      const liquidity = await mimaticUsdcPair.balanceOf(owner.address);
      await mimaticUsdcPair.approve(opportunity.address, liquidity);

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
      expect(feeDeductedEvent.args.token).to.be.equal(mimaticUsdcPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(liquidity);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(user.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending MIMATIC", async () => {
      const { opportunity, crowdswapV1, quickswap, MIMATIC, USDC } =
        await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending USDC", async () => {
      const { opportunity, crowdswapV1, quickswap, MIMATIC, USDC } =
        await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
        MIMATIC,
        USDC,
        DAI,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
        MIMATIC,
        USDC,
        MATIC,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
        MIMATIC,
        USDC,
        DAI,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
        MIMATIC,
        USDC,
        MATIC,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
        MIMATIC,
        USDC,
        MATIC,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;
      const tokenB = USDC;

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
        beefyMimaticUsdcOpportunityFixture
      );

      await expect(
        opportunity.investByTokenATokenB(user.address, DAI.address, {
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
        beefyMimaticUsdcOpportunityFixture
      );

      await expect(
        opportunity.investByTokenAOrTokenB(
          user.address,
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
        MIMATIC,
        DAI,
        MATIC,
      } = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      const tokenA = MIMATIC;

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

      //intended swap from MATIC to DAI (not USDC) to simulate the error oe05
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
    let opportunity, tokenA, tokenB, mimaticUsdcPair, mimaticUsdcVault;
    let amountMooToken, amountLP;

    const amountADesired = ethers.utils.parseEther("100");
    const amountBDesired = ethers.utils.parseUnits("4.317269", 6); // 4.3 + %0.4 fee
    let amountAMin = ethers.utils.parseEther("99");
    let amountBMin = ethers.utils.parseUnits("4.257", 6);

    beforeEach(async () => {
      const fixture = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      opportunity = fixture.opportunity;
      tokenA = fixture.MIMATIC;
      tokenB = fixture.USDC;
      mimaticUsdcPair = fixture.mimaticUsdcPair;
      mimaticUsdcVault = fixture.mimaticUsdcVault;

      await tokenA.mint(owner.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenA.approve(opportunity.address, amountADesired);
      await tokenB.approve(opportunity.address, amountBDesired);

      await opportunity.investByTokenATokenB(user.address, tokenB.address, {
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
      });

      amountMooToken = await mimaticUsdcVault.balanceOf(user.address);
      const vaultPairBalance = await mimaticUsdcPair.balanceOf(
        mimaticUsdcVault.address
      );
      const vaultTotalSupply = await mimaticUsdcVault.totalSupply();
      amountLP = vaultPairBalance.mul(amountMooToken).div(vaultTotalSupply);
    });

    it("User should be able to leave, unstaking all LP", async () => {
      const balanceBeforeMIMATIC = await tokenA.balanceOf(account1.address);
      const balanceBeforeUSDC = await tokenB.balanceOf(account1.address);

      const totalFee = getUnstakeFee(amountLP).add(getRemoveLiqFee(amountLP));

      await mimaticUsdcVault
        .connect(user)
        .approve(opportunity.address, amountMooToken);

      const transaction = await opportunity.connect(user).leave({
        amount: amountMooToken,
        amountAMin,
        amountBMin,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        receiverAccount: account1.address,
      });
      const receipt = await transaction.wait();

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(user.address);
      expect(feeDeductedEvent.args.token).to.be.equal(mimaticUsdcPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountLP);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const leftEvent = receipt.events.find((event) => event.event === "Left");
      expect(leftEvent).to.not.be.undefined;
      expect(leftEvent.args.user).to.be.equal(user.address);

      const balanceAfterMIMATIC = await tokenA.balanceOf(account1.address);
      const balanceAfterUSDC = await tokenB.balanceOf(account1.address);

      expect(balanceAfterMIMATIC.sub(balanceBeforeMIMATIC)).to.be.at.least(
        amountAMin
      );
      expect(balanceAfterUSDC.sub(balanceBeforeUSDC)).to.be.at.least(
        amountBMin
      );
    });

    it("User should be able to leave, unstaking some LP", async () => {
      amountAMin = ethers.utils.parseEther("49.5");
      amountBMin = ethers.utils.parseUnits("2.1285", 6);

      const balanceBeforeMIMATIC = await tokenA.balanceOf(account1.address);
      const balanceBeforeUSDC = await tokenB.balanceOf(account1.address);

      amountMooToken = amountMooToken.div(BigNumber.from(2));
      amountLP = amountLP.div(BigNumber.from(2));
      const totalFee = getUnstakeFee(amountLP).add(getRemoveLiqFee(amountLP));

      await mimaticUsdcVault
        .connect(user)
        .approve(opportunity.address, amountMooToken);

      const transaction = await opportunity.connect(user).leave({
        amount: amountMooToken,
        amountAMin,
        amountBMin,
        deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        receiverAccount: account1.address,
      });
      const receipt = await transaction.wait();

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(user.address);
      expect(feeDeductedEvent.args.token).to.be.equal(mimaticUsdcPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountLP);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const leftEvent = receipt.events.find((event) => event.event === "Left");
      expect(leftEvent).to.not.be.undefined;
      expect(leftEvent.args.user).to.be.equal(user.address);

      const balanceAfterMIMATIC = await tokenA.balanceOf(account1.address);
      const balanceAfterUSDC = await tokenB.balanceOf(account1.address);

      expect(balanceAfterMIMATIC.sub(balanceBeforeMIMATIC)).to.be.at.least(
        amountAMin
      );
      expect(balanceAfterUSDC.sub(balanceBeforeUSDC)).to.be.at.least(
        amountBMin
      );
    });
  });

  describe("admin operations", async () => {
    it("should change the fee recipient", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await expect(opportunity.setFeeTo(newAddress))
        .to.emit(opportunity, "SetFeeTo")
        .withArgs(owner.address, newAddress);
      await expect(await opportunity.feeTo()).to.eq(newAddress);
    });

    it("should change the add liquidity fee", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await expect(opportunity.setAddLiquidityFee(newFee))
        .to.emit(opportunity, "SetFee")
        .withArgs(owner.address, newFee);
      await expect(await opportunity.addLiquidityFee()).to.eq(newFee);
    });

    it("should change the remove liquidity fee", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await expect(opportunity.setRemoveLiquidityFee(newFee))
        .to.emit(opportunity, "SetFee")
        .withArgs(owner.address, newFee);
      await expect(await opportunity.removeLiquidityFee()).to.eq(newFee);
    });

    it("should change the stake fee", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await expect(opportunity.setStakeFee(newFee))
        .to.emit(opportunity, "SetFee")
        .withArgs(owner.address, newFee);
      await expect(await opportunity.stakeFee()).to.eq(newFee);
    });

    it("should change the unstake fee", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await expect(opportunity.setUnstakeFee(newFee))
        .to.emit(opportunity, "SetFee")
        .withArgs(owner.address, newFee);
      await expect(await opportunity.unstakeFee()).to.eq(newFee);
    });

    it("should change the tokenA and the tokenB", async () => {
      const { opportunity, MIMATIC, DAI } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      await expect(opportunity.setTokenAandTokenB(MIMATIC.address, DAI.address))
        .to.emit(opportunity, "SetTokens")
        .withArgs(owner.address, MIMATIC.address, DAI.address);
      await expect(await opportunity.tokenA()).to.eq(MIMATIC.address);
      await expect(await opportunity.tokenB()).to.eq(DAI.address);
    });

    it("should change the pair factory contract", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await expect(opportunity.setPairFactoryContract(newAddress))
        .to.emit(opportunity, "SetPairFactory")
        .withArgs(owner.address, newAddress);
      await expect(await opportunity.pairFactoryContract()).to.eq(newAddress);
    });

    it("should change the swap contract", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await expect(opportunity.setSwapContract(newAddress))
        .to.emit(opportunity, "SetSwapContact")
        .withArgs(owner.address, newAddress);
      await expect(await opportunity.swapContract()).to.eq(newAddress);
    });

    it("should change the router contract", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await expect(opportunity.setRouter(newAddress))
        .to.emit(opportunity, "SetRouter")
        .withArgs(owner.address, newAddress);
      await expect(await opportunity.router()).to.eq(newAddress);
    });

    it("should change the vault contract", async () => {
      const { opportunity } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await expect(opportunity.setVault(newAddress))
        .to.emit(opportunity, "SetVault")
        .withArgs(owner.address, newAddress);
      await expect(await opportunity.vault()).to.eq(newAddress);
    });

    it("should fail using none owner address", async () => {
      const { opportunity, MIMATIC } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
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
        opportunity.connect(account1).setTokenAandTokenB(newAddress, newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setPairFactoryContract(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setSwapContract(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setRouter(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity.connect(account1).setVault(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        opportunity
          .connect(account1)
          .withdrawFunds(MIMATIC.address, withdrawAmount, owner.address)
      ).to.revertedWith("ce30");
    });

    it("should fail to set addresses to zero", async () => {
      const { opportunity, MIMATIC, USDC, DAI } = await loadFixture(
        beefyMimaticUsdcOpportunityFixture
      );
      const tokenA = MIMATIC;
      const tokenB = USDC;

      await expect(opportunity.setFeeTo(AddressZero)).to.revertedWith("oe12");
      await expect(
        opportunity.setTokenAandTokenB(AddressZero, tokenB.address)
      ).to.revertedWith("oe12");
      await expect(
        opportunity.setTokenAandTokenB(tokenA.address, AddressZero)
      ).to.revertedWith("oe12");
      await expect(
        opportunity.setTokenAandTokenB(tokenB.address, DAI.address)
      ).to.revertedWith("pair is not valid");
      await expect(opportunity.setSwapContract(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(opportunity.setRouter(AddressZero)).to.revertedWith("oe12");
      await expect(opportunity.setVault(AddressZero)).to.revertedWith("oe12");
    });
  });

  describe("Pausable", async () => {
    let opportunity, USDC;

    before(async () => {
      const fixture = await loadFixture(beefyMimaticUsdcOpportunityFixture);
      opportunity = fixture.opportunity;
      USDC = fixture.USDC;
    });

    it("should pause the contract", async () => {
      await expect(opportunity.pause())
        .to.emit(opportunity, "Paused")
        .withArgs(owner.address);
    });

    it("should fail to invest while the contract is paused", async () => {
      await expect(
        opportunity.investByTokenATokenB(user.address, USDC.address, {
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
