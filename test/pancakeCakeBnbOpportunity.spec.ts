import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { pancakeOpportunitiesFixture } from "./pancakeCakeBnbOpportunity.fixture";
import { UniswapV2Router02Test } from "../artifacts/types";
import { BigNumber } from "ethers";
import { AddressZero } from "@ethersproject/constants";

describe("PancakeCakeBnbOpportunity", async () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let owner, revenue, account1;
  let network;

  before(async () => {
    [owner, revenue, account1] = await ethers.getSigners();
    loadFixture = waffle.createFixtureLoader(
      [owner, revenue],
      <any>ethers.provider
    );
    network = await ethers.provider.getNetwork();
  });

  describe("invest", async () => {
    it("User should be able to invest sending CAKE and WBNB", async () => {
      const { cakeWbnbOpportunity, WBNB, CAKE } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100.4"); // 100 + %0.4 fee
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const totalFee = getAddLiqFee(amountADesired)
        .add(getAddLiqFee(amountADesired))
        .add(getStakeFee(amountADesired))
        .add(getStakeFee(amountADesired));

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(cakeWbnbOpportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(cakeWbnbOpportunity.address, amountBDesired);

      const transaction = await cakeWbnbOpportunity.investByTokenATokenB(
        owner.address,
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
      expect(investedByTokenATokenBEvent.args.user).to.be.equal(owner.address);
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
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending WBNB and CAKE", async () => {
      const { cakeWbnbOpportunity, WBNB, CAKE } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100.4");
      const amountBDesired = ethers.utils.parseEther("1.506"); // 1.5 + %0.4 fee
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const totalFee = getAddLiqFee(amountBDesired)
        .add(getAddLiqFee(amountBDesired))
        .add(getStakeFee(amountBDesired))
        .add(getStakeFee(amountBDesired));

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(cakeWbnbOpportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(cakeWbnbOpportunity.address, amountBDesired);

      const transaction = await cakeWbnbOpportunity.investByTokenATokenB(
        owner.address,
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
      expect(investedByTokenATokenBEvent.args.user).to.be.equal(owner.address);
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
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending DAI", async () => {
      const {
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        DAI,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      let amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("901.8"); // 900 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await DAI.mint(owner.address, opportunity_amountIn);
      await DAI.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseEther("3");
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap2_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap2_amountOut);
      amountADesired = swap2_amountOut.sub(getSwapFee(swap2_amountOut));

      const swap1 = await getCrowdSwapAggregatorTransaction(
        sushiswap,
        "Sushiswap",
        DAI,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      const transaction = await cakeWbnbOpportunity.investByToken(
        owner.address,
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
      expect(investedByTokenEvent.args.user).to.be.equal(owner.address);
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
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending BNB", async () => {
      const {
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        BNB,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      let amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("3.006"); // 3 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseEther("3");
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap2_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap2_amountOut);
      amountADesired = swap2_amountOut.sub(getSwapFee(swap2_amountOut));

      const swap1 = await getCrowdSwapAggregatorTransactionByBNB(
        sushiswap,
        "Sushiswap",
        BNB,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      const transaction = await cakeWbnbOpportunity.investByToken(
        owner.address,
        BNB.toString(),
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
      expect(investedByTokenEvent.args.user).to.be.equal(owner.address);
      expect(investedByTokenEvent.args.token.toLowerCase()).to.be.equal(
        BNB.toString()
      );
      expect(investedByTokenEvent.args.amount).to.be.equal(
        opportunity_amountIn
      );

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token.toLowerCase()).to.be.equal(
        BNB.toString()
      );
      expect(feeDeductedEvent.args.amount).to.be.equal(opportunity_amountIn);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const swappedEvents = receipt.events.filter(
        (event) => event.event === "Swapped"
      );
      expect(swappedEvents[0]).to.not.be.undefined;
      expect(swappedEvents[0].args.user).to.be.equal(owner.address);
      expect(swappedEvents[0].args.fromToken.toLowerCase()).to.be.equal(
        BNB.toString()
      );
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
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending CAKE", async () => {
      const { cakeWbnbOpportunity, crowdswapV1, pancake, WBNB, CAKE } =
        await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100.4");
      let amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("200.4"); // 200 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenA.mint(owner.address, opportunity_amountIn);
      await tokenA.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountADesired)
        .sub(totalFee);
      const swap1_amountOut = amountBDesired;
      await tokenB.mint(pancake.address, swap1_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap1_amountOut);
      amountBDesired = swap1_amountOut.sub(getSwapFee(swap1_amountOut));

      const swap1 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenA,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      const transaction = await cakeWbnbOpportunity.investByTokenAOrTokenB(
        owner.address,
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
      expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(
        owner.address
      );
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
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending WBNB", async () => {
      const { cakeWbnbOpportunity, crowdswapV1, pancake, WBNB, CAKE } =
        await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      let amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("3.006"); // 3 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenB.mint(owner.address, opportunity_amountIn);
      await tokenB.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountBDesired)
        .sub(totalFee);
      const swap1_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap1_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap1_amountOut);
      amountADesired = amountADesired.sub(getSwapFee(amountADesired));

      const swap1 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      const transaction = await cakeWbnbOpportunity.investByTokenAOrTokenB(
        owner.address,
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
      expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(
        owner.address
      );
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
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("User should be able to invest sending LP", async () => {
      const { cakeWbnbOpportunity, pancake, WBNB, CAKE, cakeWbnbPair } =
        await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(pancake.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(pancake.address, amountBDesired);

      const addLiquidityTx = await pancake.addLiquidity(
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

      const liquidity = await cakeWbnbPair.balanceOf(owner.address);
      await cakeWbnbPair.approve(cakeWbnbOpportunity.address, liquidity);

      const totalFee = getStakeFee(liquidity);

      const transaction = await cakeWbnbOpportunity.investByLP(
        owner.address,
        liquidity
      );
      const receipt = await transaction.wait();

      const investedByLPEvent = receipt.events.find(
        (event) => event.event === "InvestedByLP"
      );
      expect(investedByLPEvent).to.not.be.undefined;
      expect(investedByLPEvent.args.user).to.be.equal(owner.address);
      expect(investedByLPEvent.args.amount).to.be.equal(liquidity);

      const feeDeductedEvent = receipt.events.find(
        (event) => event.event === "FeeDeducted"
      );
      expect(feeDeductedEvent).to.not.be.undefined;
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(cakeWbnbPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(liquidity);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const stakedEvent = receipt.events.find(
        (event) => event.event === "Staked"
      );
      expect(stakedEvent).to.not.be.undefined;
      expect(stakedEvent.args.user).to.be.equal(owner.address);
      expect(stakedEvent.args.amount).to.not.be.undefined;
    });

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending CAKE", async () => {
      const { cakeWbnbOpportunity, crowdswapV1, pancake, CAKE, WBNB } =
        await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("200.4"); // 200 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenA.mint(owner.address, opportunity_amountIn);
      await tokenA.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountADesired)
        .sub(totalFee);
      const swap1_ExpectedAmountOut = amountBDesired;
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseEther("0.45")
      );
      await tokenB.mint(pancake.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(
        swap1_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenA,
        tokenB,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByTokenAOrTokenB(
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

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending WBNB", async () => {
      const { cakeWbnbOpportunity, crowdswapV1, pancake, CAKE, WBNB } =
        await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("3.006"); // 3 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await tokenB.mint(owner.address, opportunity_amountIn);
      await tokenB.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn
        .sub(amountBDesired)
        .sub(totalFee);
      const swap1_ExpectedAmountOut = amountADesired;
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseEther("1")
      );
      await tokenA.mint(pancake.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(
        swap1_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByTokenAOrTokenB(
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
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        DAI,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("901.8"); // 900 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await DAI.mint(owner.address, opportunity_amountIn);
      await DAI.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_ExpectedAmountOut = ethers.utils.parseEther("3");
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseEther("0.5")
      );
      await tokenB.mint(sushiswap.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(
        swap1_actualAmountOut
      );
      const swap2_amountIn = swap1_ExpectedAmountOut
        .sub(getSwapFee(swap1_ExpectedAmountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap2_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransaction(
        sushiswap,
        "Sushiswap",
        DAI,
        tokenB,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByToken(
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

    it("Should fail when the amountOut of the first swap is not equal or greater than the expected amountOut, sending BNB", async () => {
      const {
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        BNB,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("3.006"); // 3 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_ExpectedAmountOut = ethers.utils.parseEther("3");
      const swap1_actualAmountOut = swap1_ExpectedAmountOut.sub(
        ethers.utils.parseEther("0.5")
      );
      await tokenB.mint(sushiswap.address, swap1_actualAmountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(
        swap1_actualAmountOut
      );
      const swap2_amountIn = swap1_ExpectedAmountOut
        .sub(getSwapFee(swap1_ExpectedAmountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap2_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransactionByBNB(
        sushiswap,
        "Sushiswap",
        BNB,
        tokenB,
        swap1_amountIn,
        swap1_ExpectedAmountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByToken(
          owner.address,
          BNB.toString(),
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
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        DAI,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("901.8"); // 900 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      await DAI.mint(owner.address, opportunity_amountIn);
      await DAI.approve(cakeWbnbOpportunity.address, opportunity_amountIn);
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseEther("3");
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_ExpectedAmountOut = amountADesired;
      const swap2_actualAmountOut = swap2_ExpectedAmountOut.sub(
        ethers.utils.parseEther("0.5")
      );
      await tokenA.mint(pancake.address, swap2_actualAmountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(
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
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_ExpectedAmountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByToken(
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

    it("Should fail when the amountOut of the second swap is not equal or greater than the expected amountOut, sending BNB", async () => {
      const {
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        BNB,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("3.006"); // 3 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseEther("3");
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_ExpectedAmountOut = amountADesired;
      const swap2_actualAmountOut = swap2_ExpectedAmountOut.sub(
        ethers.utils.parseEther("0.5")
      );
      await tokenA.mint(pancake.address, swap2_actualAmountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(
        swap2_actualAmountOut
      );

      const swap1 = await getCrowdSwapAggregatorTransactionByBNB(
        sushiswap,
        "Sushiswap",
        BNB,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_ExpectedAmountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByToken(
          owner.address,
          BNB.toString(),
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
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        WBNB,
        BNB,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;
      const tokenB = WBNB;

      const amountADesired = ethers.utils.parseEther("100");
      const amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("3.006"); // 3 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseEther("3");
      await tokenB.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap2_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap2_amountOut);

      const swap1 = await getCrowdSwapAggregatorTransactionByBNB(
        sushiswap,
        "Sushiswap",
        BNB,
        tokenB,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        tokenB,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByToken(
          owner.address,
          BNB.toString(),
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
          { value: opportunity_amountIn.sub(ethers.utils.parseEther("1")) }
        )
      ).to.revertedWith("oe03");
    });

    it("Should fail when unknown token is sent to investByTokenATokenB function", async () => {
      const { cakeWbnbOpportunity, DAI } = await loadFixture(
        pancakeOpportunitiesFixture
      );

      await expect(
        cakeWbnbOpportunity.investByTokenATokenB(owner.address, DAI.address, {
          amountADesired: ethers.utils.parseEther("100.4"),
          amountBDesired: ethers.utils.parseEther("1.5"),
          amountAMin: ethers.utils.parseEther("98"),
          amountBMin: ethers.utils.parseEther("1.47"),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        })
      ).to.revertedWith("oe04");
    });

    it("Should fail when unknown token is sent to investByTokenAOrTokenB function", async () => {
      const { cakeWbnbOpportunity, DAI } = await loadFixture(
        pancakeOpportunitiesFixture
      );

      await expect(
        cakeWbnbOpportunity.investByTokenAOrTokenB(
          owner.address,
          DAI.address,
          ethers.utils.parseEther("259"),
          ethers.utils.parseEther("59"),
          {
            amountADesired: ethers.utils.parseEther("100.4"),
            amountBDesired: ethers.utils.parseEther("1.5"),
            amountAMin: ethers.utils.parseEther("98"),
            amountBMin: ethers.utils.parseEther("1.47"),
            deadline:
              (await ethers.provider.getBlock("latest")).timestamp + 1000,
          },
          "0x"
        )
      ).to.revertedWith("oe04");
    });

    it("Should fail when wrong swap data is sent to investByToken function", async () => {
      const {
        cakeWbnbOpportunity,
        crowdswapV1,
        sushiswap,
        pancake,
        CAKE,
        DAI,
        BNB,
      } = await loadFixture(pancakeOpportunitiesFixture);
      const tokenA = CAKE;

      let amountADesired = ethers.utils.parseEther("100.4");
      let amountBDesired = ethers.utils.parseEther("1.5");
      const amountAMin = ethers.utils.parseEther("98");
      const amountBMin = ethers.utils.parseEther("1.47");

      const opportunity_amountIn = ethers.utils.parseEther("801.6"); // 400 + %0.2 fee
      const totalFee = getAddLiqFee(opportunity_amountIn).add(
        getStakeFee(opportunity_amountIn)
      );
      const swap1_amountIn = opportunity_amountIn.sub(totalFee);
      const swap1_amountOut = ethers.utils.parseEther("3");
      await DAI.mint(sushiswap.address, swap1_amountOut);
      await (<UniswapV2Router02Test>sushiswap).setAmountOut(swap1_amountOut);
      const swap2_amountIn = swap1_amountOut
        .sub(getSwapFee(swap1_amountOut))
        .sub(amountBDesired);
      const swap2_amountOut = amountADesired;
      await tokenA.mint(pancake.address, swap2_amountOut);
      await (<UniswapV2Router02Test>pancake).setAmountOut(swap2_amountOut);

      //intended swap from BNB to DAI (not WBNB) to simulate the error oe05
      const swap1 = await getCrowdSwapAggregatorTransactionByBNB(
        sushiswap,
        "Sushiswap",
        BNB,
        DAI,
        swap1_amountIn,
        swap1_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );
      const swap2 = await getCrowdSwapAggregatorTransaction(
        pancake,
        "Pancake",
        DAI,
        tokenA,
        swap2_amountIn,
        swap2_amountOut,
        crowdswapV1,
        cakeWbnbOpportunity
      );

      await expect(
        cakeWbnbOpportunity.investByToken(
          owner.address,
          BNB.toString(),
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
    let cakeWbnbOpportunity, tokenA, tokenB, cakeWbnbPair, masterChefV2;
    let amountLP;

    const amountADesired = ethers.utils.parseEther("100.4"); // 100 + %0.4 fee
    const amountBDesired = ethers.utils.parseEther("1.5");
    let amountAMin = ethers.utils.parseEther("98");
    let amountBMin = ethers.utils.parseEther("1.47");

    beforeEach(async () => {
      const fixture = await loadFixture(pancakeOpportunitiesFixture);
      cakeWbnbOpportunity = fixture.cakeWbnbOpportunity;
      tokenA = fixture.CAKE;
      tokenB = fixture.WBNB;
      cakeWbnbPair = fixture.cakeWbnbPair;
      masterChefV2 = fixture.pancakeMasterChefV2Test;

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(cakeWbnbOpportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(cakeWbnbOpportunity.address, amountBDesired);

      await cakeWbnbOpportunity.investByTokenATokenB(
        owner.address,
        tokenA.address,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        }
      );

      [amountLP] = await cakeWbnbOpportunity.getUserInfo(owner.address);
    });

    it("User should be able to leave, unstaking all LP", async () => {
      await moveTimeForward(10);
      const [, rewards] = await cakeWbnbOpportunity.getUserInfo(owner.address); // rewards so far
      expect(rewards).to.be.gt(0);

      const balanceBeforeTokenA = await tokenA.balanceOf(account1.address);
      const balanceBeforeTokenB = await tokenB.balanceOf(account1.address);

      const totalFee = getUnstakeFee(amountLP).add(getRemoveLiqFee(amountLP));

      const transaction = await cakeWbnbOpportunity.leave({
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
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(cakeWbnbPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountLP);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const leftEvent = receipt.events.find((event) => event.event === "Left");
      expect(leftEvent).to.not.be.undefined;
      expect(leftEvent.args.user).to.be.equal(owner.address);

      const balanceAfterTokenA = await tokenA.balanceOf(account1.address);
      const balanceAfterTokenB = await tokenB.balanceOf(account1.address);

      expect(balanceAfterTokenA.sub(balanceBeforeTokenA)).to.be.at.least(
        amountAMin.add(rewards)
      );
      expect(balanceAfterTokenB.sub(balanceBeforeTokenB)).to.be.at.least(
        amountBMin
      );
    });

    it("User should be able to leave, unstaking some LP", async () => {
      await moveTimeForward(10);
      const [, rewards] = await cakeWbnbOpportunity.getUserInfo(owner.address); // rewards so far
      expect(rewards).to.be.gt(0);

      amountAMin = ethers.utils.parseEther("49");
      amountBMin = ethers.utils.parseEther("0.735");

      const balanceBeforeTokeA = await tokenA.balanceOf(account1.address);
      const balanceBeforeTokenB = await tokenB.balanceOf(account1.address);

      amountLP = amountLP.div(BigNumber.from(2));
      const totalFee = getUnstakeFee(amountLP).add(getRemoveLiqFee(amountLP));

      const transaction = await cakeWbnbOpportunity.leave({
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
      expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
      expect(feeDeductedEvent.args.token).to.be.equal(cakeWbnbPair.address);
      expect(feeDeductedEvent.args.amount).to.be.equal(amountLP);
      expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

      const leftEvent = receipt.events.find((event) => event.event === "Left");
      expect(leftEvent).to.not.be.undefined;
      expect(leftEvent.args.user).to.be.equal(owner.address);

      const balanceAfterTokenA = await tokenA.balanceOf(account1.address);
      const balanceAfterTokenB = await tokenB.balanceOf(account1.address);

      expect(balanceAfterTokenA.sub(balanceBeforeTokeA)).to.be.at.least(
        amountAMin
      );
      expect(balanceAfterTokenA.sub(balanceBeforeTokeA)).to.be.lt(
        amountAMin.add(rewards)
      );
      expect(balanceAfterTokenB.sub(balanceBeforeTokenB)).to.be.at.least(
        amountBMin
      );
    });
  });

  describe("withdrawRewards", async () => {
    let cakeWbnbOpportunity, tokenA, tokenB, cakeWbnbPair, masterChefV2;

    const amountADesired = ethers.utils.parseEther("100.4"); // 100 + %0.4 fee
    const amountBDesired = ethers.utils.parseEther("1.5");
    let amountAMin = ethers.utils.parseEther("98");
    let amountBMin = ethers.utils.parseEther("1.47");

    beforeEach(async () => {
      const fixture = await loadFixture(pancakeOpportunitiesFixture);
      cakeWbnbOpportunity = fixture.cakeWbnbOpportunity;
      tokenA = fixture.CAKE;
      tokenB = fixture.WBNB;
      cakeWbnbPair = fixture.cakeWbnbPair;
      masterChefV2 = fixture.pancakeMasterChefV2Test;

      await tokenA.mint(owner.address, amountADesired);
      await tokenA.approve(cakeWbnbOpportunity.address, amountADesired);
      await tokenB.mint(owner.address, amountBDesired);
      await tokenB.approve(cakeWbnbOpportunity.address, amountBDesired);

      await cakeWbnbOpportunity.investByTokenATokenB(
        owner.address,
        tokenA.address,
        {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        }
      );
    });

    it("User should be able to withdraw his/her rewards", async () => {
      await moveTimeForward(10);
      const [, rewards] = await cakeWbnbOpportunity.getUserInfo(owner.address);
      expect(rewards).to.be.gt(0);

      const balanceBeforeTokenA = await tokenA.balanceOf(owner.address);
      await cakeWbnbOpportunity.withdrawRewards(rewards);
      const balanceAfterTokenA = await tokenA.balanceOf(owner.address);
      expect(balanceAfterTokenA.sub(balanceBeforeTokenA)).to.be.equal(rewards);
    });

    it("Users should be able to withdraw their rewards", async () => {
      await moveTimeForward(10);
      const [, ownerRewards_1] = await cakeWbnbOpportunity.getUserInfo(
        owner.address
      );
      expect(ownerRewards_1).to.be.gt(0);

      //second user investing starts
      await tokenA.mint(account1.address, amountADesired);
      await tokenA
        .connect(account1)
        .approve(cakeWbnbOpportunity.address, amountADesired);
      await tokenB.mint(account1.address, amountBDesired);
      await tokenB
        .connect(account1)
        .approve(cakeWbnbOpportunity.address, amountBDesired);

      await cakeWbnbOpportunity
        .connect(account1)
        .investByTokenATokenB(account1.address, tokenA.address, {
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        });
      //second user investing finishes

      await moveTimeForward(10);
      const [, ownerRewards_2] = await cakeWbnbOpportunity.getUserInfo(
        owner.address
      );
      expect(ownerRewards_2).to.be.gt(ownerRewards_1);
      const [, account1Rewards] = await cakeWbnbOpportunity.getUserInfo(
        account1.address
      );
      expect(account1Rewards).to.be.gt(0);
      expect(ownerRewards_2).to.be.gt(account1Rewards);

      let balanceBeforeTokenA = await tokenA.balanceOf(owner.address);
      await cakeWbnbOpportunity.withdrawRewards(ownerRewards_2);
      let balanceAfterTokenA = await tokenA.balanceOf(owner.address);
      expect(balanceAfterTokenA.sub(balanceBeforeTokenA)).to.be.equal(
        ownerRewards_2
      );

      balanceBeforeTokenA = await tokenA.balanceOf(account1.address);
      await cakeWbnbOpportunity
        .connect(account1)
        .withdrawRewards(account1Rewards);
      balanceAfterTokenA = await tokenA.balanceOf(account1.address);
      expect(balanceAfterTokenA.sub(balanceBeforeTokenA)).to.be.equal(
        account1Rewards
      );
    });

    it("cannot withdraw 0", async () => {
      await expect(cakeWbnbOpportunity.withdrawRewards(0)).to.revertedWith(
        "oe18"
      );
    });

    it("should fail when the user does not exist", async () => {
      await expect(
        cakeWbnbOpportunity.getUserInfo(account1.address)
      ).to.revertedWith("oe16");

      await expect(
        cakeWbnbOpportunity
          .connect(account1)
          .withdrawRewards(ethers.utils.parseEther("1"))
      ).to.revertedWith("oe16");
    });

    it("should fail when trying to withdraw more rewards", async () => {
      await moveTimeForward(10);
      const [, rewards] = await cakeWbnbOpportunity.getUserInfo(owner.address);
      expect(rewards).to.be.gt(0);

      await expect(
        cakeWbnbOpportunity.withdrawRewards(rewards.mul(rewards))
      ).to.revertedWith("oe19");
    });
  });

  describe("splitting the rewards", async () => {
    let cakeWbnbOpportunity, tokenA, tokenB, cakeWbnbPair, masterChefV2;

    beforeEach(async () => {
      const fixture = await loadFixture(pancakeOpportunitiesFixture);
      cakeWbnbOpportunity = fixture.cakeWbnbOpportunity;
      tokenA = fixture.CAKE;
      tokenB = fixture.WBNB;
      cakeWbnbPair = fixture.cakeWbnbPair;
      masterChefV2 = fixture.pancakeMasterChefV2Test;

      //user1: owner
      const amountADesired_owner = ethers.utils.parseEther("200.8"); // 200 + %0.4 fee
      const amountBDesired_owner = ethers.utils.parseEther("3");
      const amountAMin_owner = ethers.utils.parseEther("96");
      const amountBMin_owner = ethers.utils.parseEther("2.94");

      await tokenA.mint(owner.address, amountADesired_owner);
      await tokenA.approve(cakeWbnbOpportunity.address, amountADesired_owner);
      await tokenB.mint(owner.address, amountBDesired_owner);
      await tokenB.approve(cakeWbnbOpportunity.address, amountBDesired_owner);

      await cakeWbnbOpportunity.investByTokenATokenB(
        owner.address,
        tokenA.address,
        {
          amountADesired: amountADesired_owner,
          amountBDesired: amountBDesired_owner,
          amountAMin: amountAMin_owner,
          amountBMin: amountBMin_owner,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        }
      );

      //user2: account1
      const amountADesired_account1 = ethers.utils.parseEther("100.4"); // 100 + %0.4 fee
      const amountBDesired_account1 = ethers.utils.parseEther("1.5");
      const amountAMin_account1 = ethers.utils.parseEther("98");
      const amountBMin_account1 = ethers.utils.parseEther("1.47");

      await tokenA.mint(account1.address, amountADesired_account1);
      await tokenA
        .connect(account1)
        .approve(cakeWbnbOpportunity.address, amountADesired_account1);
      await tokenB.mint(account1.address, amountBDesired_account1);
      await tokenB
        .connect(account1)
        .approve(cakeWbnbOpportunity.address, amountBDesired_account1);

      await cakeWbnbOpportunity
        .connect(account1)
        .investByTokenATokenB(account1.address, tokenA.address, {
          amountADesired: amountADesired_account1,
          amountBDesired: amountBDesired_account1,
          amountAMin: amountAMin_account1,
          amountBMin: amountBMin_account1,
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        });
    });

    it("the sum of users' balance in the opportunity contract must be equal to the amount of the opportunity contract in the masterChef", async () => {
      const [balanceLP_owner, ,] = await cakeWbnbOpportunity.userInfo(
        owner.address
      );
      expect(balanceLP_owner).to.be.gt(0);

      const [balanceLP_account1, ,] = await cakeWbnbOpportunity.userInfo(
        account1.address
      );
      expect(balanceLP_account1).to.be.gt(0);

      const [amount, ,] = await masterChefV2.userInfo(
        2,
        cakeWbnbOpportunity.address
      );
      expect(amount).to.be.equal(balanceLP_owner.add(balanceLP_account1));
    });

    it("should correctly split rewards according to users' shares", async () => {
      await moveTimeForward(10);

      const [lpBalance_owner_before, distributedReward_owner_before] =
        await cakeWbnbOpportunity.userInfo(owner.address);
      expect(lpBalance_owner_before).to.be.gt(0);
      expect(distributedReward_owner_before).to.be.gt(0); //during the invest of account1, it has been updated

      const [lpBalance_account1_before, distributedReward_account1_before] =
        await cakeWbnbOpportunity.userInfo(account1.address);
      expect(lpBalance_account1_before).to.be.gt(0);
      expect(distributedReward_account1_before).to.be.equal(0);

      const [, pendingRewards_owner] = await cakeWbnbOpportunity.getUserInfo(
        owner.address
      );
      expect(pendingRewards_owner).to.be.gt(0);
      const [, pendingRewards_account1] = await cakeWbnbOpportunity.getUserInfo(
        account1.address
      );
      expect(pendingRewards_account1).to.be.gt(0);

      const [amount, rewardDebt] = await masterChefV2.userInfo(
        2,
        cakeWbnbOpportunity.address
      );
      expect(amount).to.be.equal(
        lpBalance_owner_before.add(lpBalance_account1_before)
      );

      const totalRewards = await masterChefV2.pendingCake(
        2,
        cakeWbnbOpportunity.address
      );
      expect(totalRewards).to.be.gt(0);
      expect(totalRewards.add(rewardDebt)).to.be.gte(
        pendingRewards_owner.add(pendingRewards_account1)
      );

      await cakeWbnbOpportunity.withdrawRewards(pendingRewards_owner);

      const [lpBalance_owner_after, distributedReward_owner_after] =
        await cakeWbnbOpportunity.userInfo(owner.address);
      expect(lpBalance_owner_after).to.be.equal(lpBalance_owner_before);
      expect(distributedReward_owner_after).to.be.lt(pendingRewards_owner); //It doesn't get zero as the rewards are calculated per block

      const [lpBalance_account1_after, distributedReward_account1_after] =
        await cakeWbnbOpportunity.userInfo(account1.address);
      expect(lpBalance_account1_after).to.be.equal(lpBalance_account1_before);
      expect(distributedReward_account1_after).to.be.gte(
        distributedReward_account1_before.add(
          totalRewards.mul(lpBalance_account1_after).div(amount)
        )
      );
    });
  });

  describe("admin operations", async () => {
    it("should change the fee recipient", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setFeeTo(newAddress);
      await expect(await cakeWbnbOpportunity.feeTo()).to.eq(newAddress);
    });

    it("should change the add liquidity fee", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await cakeWbnbOpportunity.setAddLiquidityFee(newFee);
      await expect(await cakeWbnbOpportunity.addLiquidityFee()).to.eq(newFee);
    });

    it("should change the remove liquidity fee", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await cakeWbnbOpportunity.setRemoveLiquidityFee(newFee);
      await expect(await cakeWbnbOpportunity.removeLiquidityFee()).to.eq(
        newFee
      );
    });

    it("should change the stake fee", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await cakeWbnbOpportunity.setStakeFee(newFee);
      await expect(await cakeWbnbOpportunity.stakeFee()).to.eq(newFee);
    });

    it("should change the unstake fee", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newFee = ethers.utils.parseEther("0.2");
      await cakeWbnbOpportunity.setUnstakeFee(newFee);
      await expect(await cakeWbnbOpportunity.unstakeFee()).to.eq(newFee);
    });

    it("should change the tokenA", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setTokenA(newAddress);
      await expect(await cakeWbnbOpportunity.tokenA()).to.eq(newAddress);
    });

    it("should change the tokenB", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setTokenB(newAddress);
      await expect(await cakeWbnbOpportunity.tokenB()).to.eq(newAddress);
    });

    it("should change the pair contract", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setPair(newAddress);
      await expect(await cakeWbnbOpportunity.pair()).to.eq(newAddress);
    });

    it("should change the swap contract", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setSwapContract(newAddress);
      await expect(await cakeWbnbOpportunity.swapContract()).to.eq(newAddress);
    });

    it("should change the router contract", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setRouter(newAddress);
      await expect(await cakeWbnbOpportunity.router()).to.eq(newAddress);
    });

    it("should change the pancakeMasterChefV2 contract", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await cakeWbnbOpportunity.setMasterChefV2(newAddress);
      await expect(await cakeWbnbOpportunity.pancakeMasterChefV2()).to.eq(
        newAddress
      );
    });

    it("should fail using none owner address", async () => {
      const { cakeWbnbOpportunity, WBNB } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      const newFee = ethers.utils.parseEther("0.2");
      const withdrawAmount = ethers.utils.parseEther("1");

      await expect(
        cakeWbnbOpportunity.connect(account1).setFeeTo(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setAddLiquidityFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setRemoveLiquidityFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setStakeFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setUnstakeFee(newFee)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setTokenA(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setTokenB(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setPair(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setSwapContract(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setRouter(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).setMasterChefV2(newAddress)
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity
          .connect(account1)
          .withdrawFunds(WBNB.address, withdrawAmount, owner.address)
      ).to.revertedWith("ce30");
    });

    it("should fail to set addresses to zero", async () => {
      const { cakeWbnbOpportunity } = await loadFixture(
        pancakeOpportunitiesFixture
      );
      await expect(cakeWbnbOpportunity.setFeeTo(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(cakeWbnbOpportunity.setTokenA(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(cakeWbnbOpportunity.setTokenB(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(cakeWbnbOpportunity.setPair(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(
        cakeWbnbOpportunity.setSwapContract(AddressZero)
      ).to.revertedWith("oe12");
      await expect(cakeWbnbOpportunity.setRouter(AddressZero)).to.revertedWith(
        "oe12"
      );
      await expect(
        cakeWbnbOpportunity.setMasterChefV2(AddressZero)
      ).to.revertedWith("oe12");
      await expect(
        cakeWbnbOpportunity.setRewardToken(AddressZero)
      ).to.revertedWith("oe12");
    });
  });

  describe("Pausable", async () => {
    let cakeWbnbOpportunity, CAKE;

    before(async () => {
      const fixture = await loadFixture(pancakeOpportunitiesFixture);
      cakeWbnbOpportunity = fixture.cakeWbnbOpportunity;
      CAKE = fixture.CAKE;
    });

    it("should pause the contract", async () => {
      await expect(cakeWbnbOpportunity.pause())
        .to.emit(cakeWbnbOpportunity, "Paused")
        .withArgs(owner.address);
    });

    it("should fail to invest while the contract is paused", async () => {
      await expect(
        cakeWbnbOpportunity.investByTokenATokenB(owner.address, CAKE.address, {
          amountADesired: ethers.utils.parseEther("100.4"),
          amountBDesired: ethers.utils.parseEther("1.5"),
          amountAMin: ethers.utils.parseEther("98"),
          amountBMin: ethers.utils.parseEther("1.47"),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
        })
      ).to.revertedWith("Pausable: paused");
    });

    it("should fail to leave while the contract is paused", async () => {
      await expect(
        cakeWbnbOpportunity.leave({
          amount: ethers.utils.parseEther("10"),
          amountAMin: ethers.utils.parseEther("99"),
          amountBMin: ethers.utils.parseEther("4.257"),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
          receiverAccount: account1.address,
        })
      ).to.revertedWith("Pausable: paused");
    });

    it("should unpause the contract", async () => {
      await expect(cakeWbnbOpportunity.unpause())
        .to.emit(cakeWbnbOpportunity, "Unpaused")
        .withArgs(owner.address);
    });

    it("should fail using none owner address", async () => {
      await expect(
        cakeWbnbOpportunity.connect(account1).pause()
      ).to.revertedWith("ce30");

      await expect(
        cakeWbnbOpportunity.connect(account1).unpause()
      ).to.revertedWith("ce30");
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

  async function getCrowdSwapAggregatorTransactionByBNB(
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
    } else if (dexName == "Pancake") {
      return 0x07;
    }
  }
});
