import { Dexchanges, Networks } from "@crowdswap/constant";
import { AddressZero } from "@ethersproject/constants";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import {
  ADD_LIQUIDITY_FEE_PERCENTAGE,
  REMOVE_LIQUIDITY_FEE_PERCENTAGE,
  STAKE_FEE_PERCENTAGE,
  UNSTAKE_FEE_PERCENTAGE,
  crowdUsdtLpStakeOpportunityFixtureV2,
} from "../../shared/opportunity/v2/crowdUsdtLpStakeOpportunityV2.fixture";

describe("CrowdUsdtLpStakeOpportunity", async () => {
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let owner, revenue, account1, user, liquidityProvider1, liquidityProvider2;

  before(async () => {
    [owner, revenue, account1, user, liquidityProvider1, liquidityProvider2] =
      await ethers.getSigners();
    loadFixture = waffle.createFixtureLoader(
      [owner, revenue, liquidityProvider1, liquidityProvider2],
      <any>ethers.provider
    );
  });

  describe("invest", async () => {
    describe("token/token pair", async () => {
      it("User should be able to invest sending token A", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);
        const amountIn = ethers.utils.parseUnits(
          "4000",
          await tokenA.decimals()
        );

        await tokenA.mint(owner.address, amountIn);
        await tokenA.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swapAmountIn = ethers.utils.parseUnits(
          "0",
          await tokenA.decimals()
        );
        const swapMinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );

        const swapTx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swapAmountIn,
            swapMinAmountOut,
            [tokenA.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor = dexDescriptorFromTransaction(swapTx, "UniswapV2");
        const oppTx = await opportunity.investByTokenA(
          user.address,
          amountIn,
          dexDescriptor,
          (await ethers.provider.getBlock("latest")).timestamp + 100000
        );

        const receipt = await oppTx.wait();
        const investedByTokenAOrTokenBEvent = receipt.events.find(
          (event) => event.event === "InvestedByTokenAOrTokenB"
        );
        expect(investedByTokenAOrTokenBEvent).to.not.be.undefined;
        expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(
          user.address
        );
        expect(investedByTokenAOrTokenBEvent.args.token).to.be.equal(
          tokenA.address
        );
        expect(investedByTokenAOrTokenBEvent.args.amount).to.be.equal(amountIn);

        const swappedEvent = receipt.events.find(
          (event) => event.event === "Swapped"
        );
        expect(swappedEvent).to.not.be.undefined;
        expect(swappedEvent.args.user).to.be.equal(owner.address);
        expect(swappedEvent.args.fromToken).to.be.equal(tokenA.address);
        expect(swappedEvent.args.toToken).to.be.equal(tokenB.address);
        expect(swappedEvent.args.amountIn).to.not.be.undefined;
        expect(swappedEvent.args.amountOut).to.not.be.undefined;

        const totalFee = getFee(
          swappedEvent.args.amountOut,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(
          swappedEvent.args.amountOut
        );
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = investedByTokenAOrTokenBEvent.args.amount
          .sub(swappedEvent.args.amountIn)
          .sub(addedLiquidityEvent.args.amountA);

        const remainedAmountB = swappedEvent.args.amountOut
          .sub(feeDeductedEvent.args.totalFee)
          .sub(addedLiquidityEvent.args.amountB);

        // //The remained tokens should be transferred to the user

        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });
      it("User should be able to invest sending token B", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "100",
          await tokenB.decimals()
        );
        const totalFee = getFee(
          amountIn,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        await tokenB.mint(owner.address, amountIn);
        await tokenB.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swapAmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swapMinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );

        const swapTx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swapAmountIn,
            swapMinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor = dexDescriptorFromTransaction(swapTx, "UniswapV2");
        const oppTx = await opportunity.investByTokenB(
          user.address,
          amountIn,
          dexDescriptor,
          (await ethers.provider.getBlock("latest")).timestamp + 100000
        );

        const receipt = await oppTx.wait();
        const investedByTokenAOrTokenBEvent = receipt.events.find(
          (event) => event.event === "InvestedByTokenAOrTokenB"
        );
        expect(investedByTokenAOrTokenBEvent).to.not.be.undefined;
        expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(
          user.address
        );
        expect(investedByTokenAOrTokenBEvent.args.token).to.be.equal(
          tokenB.address
        );
        expect(investedByTokenAOrTokenBEvent.args.amount).to.be.equal(amountIn);

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(amountIn);
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        const swappedEvent = receipt.events.find(
          (event) => event.event === "Swapped"
        );
        expect(swappedEvent).to.not.be.undefined;
        expect(swappedEvent.args.user).to.be.equal(owner.address);
        expect(swappedEvent.args.fromToken).to.be.equal(tokenB.address);
        expect(swappedEvent.args.toToken).to.be.equal(tokenA.address);
        expect(swappedEvent.args.amountIn).to.not.be.undefined;
        expect(swappedEvent.args.amountOut).to.not.be.undefined;

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = swappedEvent.args.amountOut.sub(
          addedLiquidityEvent.args.amountA
        );
        const remainedAmountB = investedByTokenAOrTokenBEvent.args.amount
          .sub(feeDeductedEvent.args.totalFee)
          .sub(swappedEvent.args.amountIn)
          .sub(addedLiquidityEvent.args.amountB);

        //The remained tokens should be transferred to the user

        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });

      it("User should be able to invest sending token A and token B", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountA = ethers.utils.parseUnits(
          "2000",
          await tokenA.decimals()
        );
        const amountB = ethers.utils.parseUnits(
          "100.401606", //(100*(1000/996) tokens B should be available after deducting fee
          await tokenB.decimals()
        );

        await tokenA.mint(owner.address, amountA);
        await tokenA.approve(opportunity.address, amountA);

        await tokenB.mint(owner.address, amountB);
        await tokenB.approve(opportunity.address, amountB);

        const oppTx = await opportunity.investByTokenATokenB(
          user.address,
          amountA,
          amountB,
          (await ethers.provider.getBlock("latest")).timestamp + 100000
        );

        const receipt = await oppTx.wait();
        const InvestedByTokenATokenBEvent = receipt.events.find(
          (event) => event.event === "InvestedByTokenATokenB"
        );
        expect(InvestedByTokenATokenBEvent).to.not.be.undefined;
        expect(InvestedByTokenATokenBEvent.args.user).to.be.equal(user.address);
        expect(InvestedByTokenATokenBEvent.args.token).to.be.equal(
          tokenB.address
        );
        expect(InvestedByTokenATokenBEvent.args.amountA).to.be.equal(amountA);
        expect(InvestedByTokenATokenBEvent.args.amountB).to.be.equal(amountB);

        const totalFee = getFee(
          amountB,
          (ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE) * 2
        );
        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(amountB);
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = InvestedByTokenATokenBEvent.args.amountA.sub(
          addedLiquidityEvent.args.amountA
        );
        const remainedAmountB = InvestedByTokenATokenBEvent.args.amountB
          .sub(feeDeductedEvent.args.totalFee)
          .sub(addedLiquidityEvent.args.amountB);

        //The remained tokens should be transferred to the user
        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });

      it("User should be able to invest sending token C (Tokens other than token A and Token B)", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
          DAI: tokenC,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "100",
          await tokenC.decimals()
        );

        await tokenC.mint(owner.address, amountIn);
        await tokenC.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swap1AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenC.decimals()
        );
        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );
        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap1AmountIn,
            swap1MinAmountOut,
            [tokenC.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );

        //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );

        const oppTx = await opportunity.investByToken(
          user.address,
          tokenC.address,
          amountIn,
          dexDescriptor1,
          dexDescriptor2,
          (await ethers.provider.getBlock("latest")).timestamp + 100000
        );

        const receipt = await oppTx.wait();

        const InvestedByTokenEvent = receipt.events.find(
          (event) => event.event === "InvestedByToken"
        );
        expect(InvestedByTokenEvent).to.not.be.undefined;
        expect(InvestedByTokenEvent.args.user).to.be.equal(user.address);
        expect(InvestedByTokenEvent.args.token).to.be.equal(tokenC.address);
        expect(InvestedByTokenEvent.args.amount).to.be.equal(amountIn);

        const swappedEventsList = receipt.events.filter(
          (event) => event.event === "Swapped"
        );
        expect(swappedEventsList[0]).to.not.be.undefined;
        expect(swappedEventsList[0].args.user).to.be.equal(owner.address);
        expect(swappedEventsList[0].args.fromToken).to.be.equal(tokenC.address);
        expect(swappedEventsList[0].args.toToken).to.be.equal(tokenB.address);
        expect(swappedEventsList[0].args.amountIn).to.be.equal(amountIn);
        expect(swappedEventsList[0].args.amountOut).to.not.be.undefined;

        const totalFee = getFee(
          swappedEventsList[0].args.amountOut,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(
          swappedEventsList[0].args.amountOut
        );
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        expect(swappedEventsList[1]).to.not.be.undefined;
        expect(swappedEventsList[1].args.user).to.be.equal(owner.address);
        expect(swappedEventsList[1].args.fromToken).to.be.equal(tokenB.address);
        expect(swappedEventsList[1].args.toToken).to.be.equal(tokenA.address);
        expect(swappedEventsList[1].args.amountIn).to.not.be.undefined;
        expect(swappedEventsList[1].args.amountOut).to.not.be.undefined;

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = swappedEventsList[1].args.amountOut.sub(
          addedLiquidityEvent.args.amountA
        );
        const remainedAmountB = swappedEventsList[0].args.amountOut
          .sub(feeDeductedEvent.args.totalFee)
          .sub(swappedEventsList[1].args.amountIn)
          .sub(addedLiquidityEvent.args.amountB);

        //The remained tokens should be transferred to the user
        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });

      it("User should be able to invest sending network coin", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
          MATIC: tokenC,
          WMATIC: WETH,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits("100", 18);

        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );

        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactETHForTokens(
            swap1MinAmountOut,
            [WETH.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );
        dexDescriptor1.isReplace = false;

        // //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );

        const oppTx = await opportunity.investByToken(
          user.address,
          tokenC.toString(),
          amountIn,
          dexDescriptor1,
          dexDescriptor2,
          (await ethers.provider.getBlock("latest")).timestamp + 100000,
          { value: amountIn }
        );

        const receipt = await oppTx.wait();

        const InvestedByTokenEvent = receipt.events.find(
          (event) => event.event === "InvestedByToken"
        );
        expect(InvestedByTokenEvent).to.not.be.undefined;
        expect(InvestedByTokenEvent.args.user).to.be.equal(user.address);
        expect(InvestedByTokenEvent.args.token).to.be.equal(tokenC.toString());
        expect(InvestedByTokenEvent.args.amount).to.be.equal(amountIn);

        const swappedEventsList = receipt.events.filter(
          (event) => event.event === "Swapped"
        );
        expect(swappedEventsList[0]).to.not.be.undefined;
        expect(swappedEventsList[0].args.user).to.be.equal(owner.address);
        expect(swappedEventsList[0].args.fromToken).to.be.equal(
          tokenC.toString()
        );
        expect(swappedEventsList[0].args.toToken).to.be.equal(tokenB.address);
        expect(swappedEventsList[0].args.amountIn).to.be.equal(amountIn);
        expect(swappedEventsList[0].args.amountOut).to.not.be.undefined;

        const totalFee = getFee(
          swappedEventsList[0].args.amountOut,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(
          swappedEventsList[0].args.amountOut
        );
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        expect(swappedEventsList[1]).to.not.be.undefined;
        expect(swappedEventsList[1].args.user).to.be.equal(owner.address);
        expect(swappedEventsList[1].args.fromToken).to.be.equal(tokenB.address);
        expect(swappedEventsList[1].args.toToken).to.be.equal(tokenA.address);
        expect(swappedEventsList[1].args.amountIn).to.not.be.undefined;
        expect(swappedEventsList[1].args.amountOut).to.not.be.undefined;

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = swappedEventsList[1].args.amountOut.sub(
          addedLiquidityEvent.args.amountA
        );
        const remainedAmountB = swappedEventsList[0].args.amountOut
          .sub(feeDeductedEvent.args.totalFee)
          .sub(swappedEventsList[1].args.amountIn)
          .sub(addedLiquidityEvent.args.amountB);

        //The remained tokens should be transferred to the user
        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });

      it("Should fail when token A is sent to investByToken function", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
          CROWD: tokenC,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "100",
          await tokenC.decimals()
        );

        await tokenC.mint(owner.address, amountIn);
        await tokenC.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swap1AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenC.decimals()
        );
        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );
        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap1AmountIn,
            swap1MinAmountOut,
            [tokenC.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );

        //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );
        expect(
          opportunity.investByToken(
            user.address,
            tokenC.address,
            amountIn,
            dexDescriptor1,
            dexDescriptor2,
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          )
        ).to.revertedWith("oexxx1 IDENTICAL_ADDRESSES");
      });
      it("Should fail when token B is sent to investByToken function", async () => {
        const {
          crowdUsdtOpportunity: opportunity,
          CROWD: tokenA,
          USDT: tokenB,
          USDT: tokenC,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "100",
          await tokenC.decimals()
        );

        await tokenC.mint(owner.address, amountIn);
        await tokenC.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swap1AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenC.decimals()
        );
        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );
        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap1AmountIn,
            swap1MinAmountOut,
            [tokenC.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );

        //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );

        expect(
          opportunity.investByToken(
            user.address,
            tokenC.address,
            amountIn,
            dexDescriptor1,
            dexDescriptor2,
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          )
        ).to.revertedWith("oexxx1 IDENTICAL_ADDRESSES");
      });
    });

    describe("token/coin pair", async () => {
      it("User should be able to invest sending token A", async () => {
        const {
          crowdWmaticOpportunity: opportunity,
          CROWD: tokenA,
          WMATIC: tokenB,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "4000",
          await tokenA.decimals()
        );

        await tokenA.mint(owner.address, amountIn);
        await tokenA.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swapAmountIn = amountIn;
        const swapMinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );

        const swapTx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swapAmountIn,
            swapMinAmountOut,
            [tokenA.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor = dexDescriptorFromTransaction(swapTx, "UniswapV2");
        const oppTx = await opportunity.investByTokenA(
          user.address,
          amountIn,
          dexDescriptor,
          (await ethers.provider.getBlock("latest")).timestamp + 100000
        );

        const receipt = await oppTx.wait();
        const investedByTokenAOrTokenBEvent = receipt.events.find(
          (event) => event.event === "InvestedByTokenAOrTokenB"
        );
        expect(investedByTokenAOrTokenBEvent).to.not.be.undefined;
        expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(
          user.address
        );
        expect(investedByTokenAOrTokenBEvent.args.token).to.be.equal(
          tokenA.address
        );
        expect(investedByTokenAOrTokenBEvent.args.amount).to.be.equal(amountIn);

        const swappedEvent = receipt.events.find(
          (event) => event.event === "Swapped"
        );
        expect(swappedEvent).to.not.be.undefined;
        expect(swappedEvent.args.user).to.be.equal(owner.address);
        expect(swappedEvent.args.fromToken).to.be.equal(tokenA.address);
        expect(swappedEvent.args.toToken).to.be.equal(tokenB.address);
        expect(swappedEvent.args.amountIn).to.not.be.undefined;
        expect(swappedEvent.args.amountOut).to.not.be.undefined;

        const totalFee = getFee(
          swappedEvent.args.amountOut,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(
          swappedEvent.args.amountOut
        );
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = investedByTokenAOrTokenBEvent.args.amount
          .sub(swappedEvent.args.amountIn)
          .sub(addedLiquidityEvent.args.amountA);

        const remainedAmountB = swappedEvent.args.amountOut
          .sub(feeDeductedEvent.args.totalFee)
          .sub(addedLiquidityEvent.args.amountB);

        // //The remained tokens should be transferred to the user

        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });
      it("User should be able to invest sending token B", async () => {
        const {
          crowdWmaticOpportunity: opportunity,
          CROWD: tokenA,
          WMATIC: tokenB,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "100",
          await tokenB.decimals()
        );
        const totalFee = getFee(
          amountIn,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        //It would be replaced in the contract
        const swapAmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swapMinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );

        const swapTx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swapAmountIn,
            swapMinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor = dexDescriptorFromTransaction(swapTx, "UniswapV2");
        const oppTx = await opportunity.investByTokenB(
          user.address,
          amountIn,
          dexDescriptor,
          (await ethers.provider.getBlock("latest")).timestamp + 100000,
          { value: amountIn }
        );

        const receipt = await oppTx.wait();
        const investedByTokenAOrTokenBEvent = receipt.events.find(
          (event) => event.event === "InvestedByTokenAOrTokenB"
        );
        expect(investedByTokenAOrTokenBEvent).to.not.be.undefined;
        expect(investedByTokenAOrTokenBEvent.args.user).to.be.equal(
          user.address
        );
        expect(investedByTokenAOrTokenBEvent.args.token).to.be.equal(
          tokenB.address
        );
        expect(investedByTokenAOrTokenBEvent.args.amount).to.be.equal(amountIn);

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(amountIn);
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        const swappedEvent = receipt.events.find(
          (event) => event.event === "Swapped"
        );
        expect(swappedEvent).to.not.be.undefined;
        expect(swappedEvent.args.user).to.be.equal(owner.address);
        expect(swappedEvent.args.fromToken).to.be.equal(tokenB.address);
        expect(swappedEvent.args.toToken).to.be.equal(tokenA.address);
        expect(swappedEvent.args.amountIn).to.not.be.undefined;
        expect(swappedEvent.args.amountOut).to.not.be.undefined;

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = swappedEvent.args.amountOut.sub(
          addedLiquidityEvent.args.amountA
        );
        const remainedAmountB = investedByTokenAOrTokenBEvent.args.amount
          .sub(feeDeductedEvent.args.totalFee)
          .sub(swappedEvent.args.amountIn)
          .sub(addedLiquidityEvent.args.amountB);

        //The remained tokens should be transferred to the user

        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });

      it("User should be able to invest sending token C (Tokens other than token A and Token B)", async () => {
        const {
          crowdWmaticOpportunity: opportunity,
          CROWD: tokenA,
          WMATIC: tokenB,
          DAI: tokenC,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits(
          "100",
          await tokenC.decimals()
        );

        await tokenC.mint(owner.address, amountIn);
        await tokenC.approve(opportunity.address, amountIn);

        //It would be replaced in the contract
        const swap1AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenC.decimals()
        );
        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );
        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap1AmountIn,
            swap1MinAmountOut,
            [tokenC.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );

        //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );

        const oppTx = await opportunity.investByToken(
          user.address,
          tokenC.address,
          amountIn,
          dexDescriptor1,
          dexDescriptor2,
          (await ethers.provider.getBlock("latest")).timestamp + 100000
        );

        const receipt = await oppTx.wait();

        const InvestedByTokenEvent = receipt.events.find(
          (event) => event.event === "InvestedByToken"
        );
        expect(InvestedByTokenEvent).to.not.be.undefined;
        expect(InvestedByTokenEvent.args.user).to.be.equal(user.address);
        expect(InvestedByTokenEvent.args.token).to.be.equal(tokenC.address);
        expect(InvestedByTokenEvent.args.amount).to.be.equal(amountIn);

        const swappedEventsList = receipt.events.filter(
          (event) => event.event === "Swapped"
        );
        expect(swappedEventsList[0]).to.not.be.undefined;
        expect(swappedEventsList[0].args.user).to.be.equal(owner.address);
        expect(swappedEventsList[0].args.fromToken).to.be.equal(tokenC.address);
        expect(swappedEventsList[0].args.toToken).to.be.equal(tokenB.address);
        expect(swappedEventsList[0].args.amountIn).to.be.equal(amountIn);
        expect(swappedEventsList[0].args.amountOut).to.not.be.undefined;

        const totalFee = getFee(
          swappedEventsList[0].args.amountOut,
          ADD_LIQUIDITY_FEE_PERCENTAGE + STAKE_FEE_PERCENTAGE
        );

        const feeDeductedEvent = receipt.events.find(
          (event) => event.event === "FeeDeducted"
        );
        expect(feeDeductedEvent).to.not.be.undefined;
        expect(feeDeductedEvent.args.user).to.be.equal(owner.address);
        expect(feeDeductedEvent.args.token).to.be.equal(tokenB.address);
        expect(feeDeductedEvent.args.amount).to.be.equal(
          swappedEventsList[0].args.amountOut
        );
        expect(feeDeductedEvent.args.totalFee).to.be.equal(totalFee);

        expect(swappedEventsList[1]).to.not.be.undefined;
        expect(swappedEventsList[1].args.user).to.be.equal(owner.address);
        expect(swappedEventsList[1].args.fromToken).to.be.equal(tokenB.address);
        expect(swappedEventsList[1].args.toToken).to.be.equal(tokenA.address);
        expect(swappedEventsList[1].args.amountIn).to.not.be.undefined;
        expect(swappedEventsList[1].args.amountOut).to.not.be.undefined;

        const addedLiquidityEvent = receipt.events.find(
          (event) => event.event === "AddedLiquidity"
        );
        expect(addedLiquidityEvent).to.not.be.undefined;
        expect(addedLiquidityEvent.args.user).to.be.equal(owner.address);
        expect(addedLiquidityEvent.args.liquidity).to.not.be.undefined;

        const stakedEvent = receipt.events.find(
          (event) => event.event === "Staked"
        );
        expect(stakedEvent).to.not.be.undefined;
        expect(stakedEvent.args.user).to.be.equal(user.address);
        expect(stakedEvent.args.amount).to.be.equal(
          addedLiquidityEvent.args.liquidity
        );

        const remainedAmountA = swappedEventsList[1].args.amountOut.sub(
          addedLiquidityEvent.args.amountA
        );
        const remainedAmountB = swappedEventsList[0].args.amountOut
          .sub(feeDeductedEvent.args.totalFee)
          .sub(swappedEventsList[1].args.amountIn)
          .sub(addedLiquidityEvent.args.amountB);

        //The remained tokens should be transferred to the user
        const refundEventsList = receipt.events.filter(
          (event) => event.event === "Refund"
        );
        for (let refundEvent of refundEventsList) {
          expect(refundEvent.args.token).to.be.oneOf([
            tokenA.address,
            tokenB.address,
          ]);
          expect(refundEvent.args.user).to.be.equal(user.address);
          switch (refundEvent.args.token) {
            case tokenA.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountA);
              break;
            case tokenB.address:
              expect(refundEvent.args.amount).to.be.equal(remainedAmountB);
              break;
          }
        }
      });
      it("Should fail when token A is sent to investByToken function", async () => {
        const {
          crowdWmaticOpportunity: opportunity,
          CROWD: tokenA,
          WMATIC: tokenB,
          CROWD: tokenC,
          WMATIC: WETH,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits("100", 18);

        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );

        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            "0",
            swap1MinAmountOut,
            [tokenC.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );
        dexDescriptor1.isReplace = false;

        // //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );
        expect(
          opportunity.investByToken(
            user.address,
            tokenC.toString(),
            amountIn,
            dexDescriptor1,
            dexDescriptor2,
            (await ethers.provider.getBlock("latest")).timestamp + 100000,
            { value: amountIn }
          )
        ).to.revertedWith("oexxx1 IDENTICAL_ADDRESSES"); //todo BLOC-1401 similar to contract
      });
      it("Should fail when token B is sent to investByToken function", async () => {
        const {
          crowdWmaticOpportunity: opportunity,
          CROWD: tokenA,
          WMATIC: tokenB,
          WMATIC: tokenC,
          WMATIC: WETH,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits("100", 18);

        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );

        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactETHForTokens(
            swap1MinAmountOut,
            [WETH.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );
        dexDescriptor1.isReplace = false;

        // //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );
        expect(
          opportunity.investByToken(
            user.address,
            tokenC.toString(),
            amountIn,
            dexDescriptor1,
            dexDescriptor2,
            (await ethers.provider.getBlock("latest")).timestamp + 100000,
            { value: amountIn }
          )
        ).to.revertedWith("oexxx1 IDENTICAL_ADDRESSES"); //todo BLOC-1401 similar to contract
      });
      it("Should fail when network coin is sent to investByToken function", async () => {
        const {
          crowdWmaticOpportunity: opportunity,
          CROWD: tokenA,
          WMATIC: tokenB,
          MATIC: tokenC,
          WMATIC: WETH,
          uniswapV2,
        } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

        const amountIn = ethers.utils.parseUnits("100", 18);

        const swap1MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenB.decimals()
        );

        const swap1Tx =
          await uniswapV2.populateTransaction.swapExactETHForTokens(
            swap1MinAmountOut,
            [WETH.address, tokenB.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor1 = dexDescriptorFromTransaction(
          swap1Tx,
          "UniswapV2"
        );
        dexDescriptor1.isReplace = false;

        // //It would be replaced in the contract
        const swap2AmountIn = ethers.utils.parseUnits(
          "0",
          await tokenB.decimals()
        );
        const swap2MinAmountOut = ethers.utils.parseUnits(
          "40",
          await tokenA.decimals()
        );
        const swap2Tx =
          await uniswapV2.populateTransaction.swapExactTokensForTokens(
            swap2AmountIn,
            swap2MinAmountOut,
            [tokenB.address, tokenA.address],
            await opportunity.swapContract(),
            (await ethers.provider.getBlock("latest")).timestamp + 100000
          );
        const dexDescriptor2 = dexDescriptorFromTransaction(
          swap2Tx,
          "UniswapV2"
        );
        expect(
          opportunity.investByToken(
            user.address,
            tokenC.toString(),
            amountIn,
            dexDescriptor1,
            dexDescriptor2,
            (await ethers.provider.getBlock("latest")).timestamp + 100000,
            { value: amountIn }
          )
        ).to.revertedWith("oexxx1 IDENTICAL_ADDRESSES"); //todo BLOC-1401 similar to contract
      });
    });
  });

  describe("leave", async () => {
    let opportunity, tokenA, tokenB, crowdUsdtPair, stakingCrowdUsdtLP;
    let amountLP;
    let amountA;
    let amountB;
    let amountAMin;
    let amountBMin;
    let totalRewards;

    beforeEach(async () => {
      const fixture = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);
      opportunity = fixture.crowdUsdtOpportunity;
      tokenA = fixture.CROWD;
      tokenB = fixture.USDT;
      crowdUsdtPair = fixture.crowdUsdtPair;
      stakingCrowdUsdtLP = fixture.stakingCrowdUsdtLP;

      amountA = ethers.utils.parseUnits("2000", await tokenA.decimals());
      amountB = ethers.utils.parseUnits(
        "100.401606", //(100*(1000/996) tokens B should be available after deducting fee
        await tokenB.decimals()
      );

      amountAMin = ethers.utils.parseUnits("1900", await tokenA.decimals());
      amountBMin = ethers.utils.parseUnits("90", await tokenB.decimals());
      totalRewards = ethers.utils.parseUnits("10", await tokenA.decimals());

      await tokenA.mint(owner.address, amountA);
      await tokenA.approve(opportunity.address, amountA);

      await tokenB.mint(owner.address, amountB);
      await tokenB.approve(opportunity.address, amountB);

      await tokenA.mint(stakingCrowdUsdtLP.address, totalRewards);
      await stakingCrowdUsdtLP.notifyRewardAmount(totalRewards);

      await opportunity.investByTokenATokenB(
        user.address,
        amountA,
        amountB,
        (await ethers.provider.getBlock("latest")).timestamp + 1000
      );

      amountLP = await stakingCrowdUsdtLP.balanceOf(user.address);
    });

    it("User should be able to leave, unstaking all LP", async () => {
      await moveTimeForward(10);
      const rewards = await stakingCrowdUsdtLP.earned(user.address); // rewards so far
      expect(rewards).to.be.gt(0);

      const balanceBeforeCROWD = await tokenA.balanceOf(account1.address);
      const balanceBeforeUSDT = await tokenB.balanceOf(account1.address);

      const totalFee = getFee(
        amountLP,
        UNSTAKE_FEE_PERCENTAGE + REMOVE_LIQUIDITY_FEE_PERCENTAGE
      );

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
      const rewards = await stakingCrowdUsdtLP.earned(user.address); // rewards so far
      expect(rewards).to.be.gt(0);

      amountAMin = ethers.utils.parseUnits("950", await tokenA.decimals());
      amountBMin = ethers.utils.parseUnits("45", await tokenB.decimals());

      const balanceBeforeCROWD = await tokenA.balanceOf(account1.address);
      const balanceBeforeUSDT = await tokenB.balanceOf(account1.address);

      amountLP = amountLP.div(BigNumber.from(2));
      const totalFee = getFee(
        amountLP,
        UNSTAKE_FEE_PERCENTAGE + REMOVE_LIQUIDITY_FEE_PERCENTAGE
      );

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
      expect(balanceAfterCROWD.sub(balanceBeforeCROWD)).to.be.at.least(
        amountAMin
      );
      expect(balanceAfterUSDT.sub(balanceBeforeUSDT)).to.be.at.least(
        amountBMin
      );
    });
  });

  describe("admin operations", async () => {
    it("should change the fee recipient", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setFeeTo(newAddress);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.feeTo).to.eq(newAddress);
    });

    it("should change the add liquidity fee", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setAddLiquidityFee(newFee);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.addLiquidityFee).to.eq(newFee);
    });

    it("should change the remove liquidity fee", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setRemoveLiquidityFee(newFee);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.removeLiquidityFee).to.eq(newFee);
    });

    it("should change the stake fee", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setStakeFee(newFee);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.stakeFee).to.eq(newFee);
    });

    it("should change the unstake fee", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setUnstakeFee(newFee);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.unstakeFee).to.eq(newFee);
    });

    it("should change the dex fee", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setDexFee(newFee);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.dexFee).to.eq(newFee);
    });

    it("should change the aggregatorFee fee", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newFee = ethers.utils.parseEther("0.2");
      await opportunity.setAggregatorFee(newFee);
      const feeStruct = await opportunity.feeStruct();
      await expect(feeStruct.aggregatorFee).to.eq(newFee);
    });

    it("should change the tokenA", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setTokenA(newAddress);
      await expect(await opportunity.tokenA()).to.eq(newAddress);
    });

    it("should change the tokenB", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setTokenB(newAddress);
      await expect(await opportunity.tokenB()).to.eq(newAddress);
    });

    it("should change the pair contract", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setPair(newAddress);
      await expect(await opportunity.pair()).to.eq(newAddress);
    });

    it("should change the swap contract", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setSwapContract(newAddress);
      await expect(await opportunity.swapContract()).to.eq(newAddress);
    });

    it("should change the router contract", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setRouter(newAddress);
      await expect(await opportunity.router()).to.eq(newAddress);
    });

    it("should change the stakingCrowdUsdtLP contract", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      const newAddress = "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b";
      await opportunity.setStakingLP(newAddress);
      await expect(await opportunity.stakingLP()).to.eq(newAddress);
    });

    it("should fail using none owner address", async () => {
      const { crowdUsdtOpportunity: opportunity, CROWD: tokenA } =
        await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);
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
          .withdrawFunds(tokenA.address, withdrawAmount, owner.address)
      ).to.revertedWith("ce30");
    });

    it("should fail to set addresses to zero", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
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
    it("should pause the contract", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      await expect(opportunity.pause())
        .to.emit(opportunity, "Paused")
        .withArgs(owner.address);
    });

    it("should fail to invest while the contract is paused", async () => {
      const {
        crowdUsdtOpportunity: opportunity,
        CROWD: tokenA,
        USDT: tokenB,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);
      const amountA = ethers.utils.parseUnits("2000", await tokenA.decimals());
      const amountB = ethers.utils.parseUnits(
        "100.401606", //(100*(1000/996) tokens B should be available after deducting fee
        await tokenB.decimals()
      );
      await opportunity.pause();
      await expect(
        opportunity.investByTokenATokenB(
          user.address,
          amountA,
          amountB,
          (await ethers.provider.getBlock("latest")).timestamp + 1000
        )
      ).to.revertedWith("Pausable: paused");
    });

    it("should fail to leave while the contract is paused", async () => {
      const {
        crowdUsdtOpportunity: opportunity,
        CROWD: tokenA,
        USDT: tokenB,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);
      await opportunity.pause();
      await expect(
        opportunity.leave({
          amount: ethers.utils.parseEther("10"),
          amountAMin: ethers.utils.parseUnits("99", await tokenA.decimals()),
          amountBMin: ethers.utils.parseUnits("4.257", await tokenB.decimals()),
          deadline: (await ethers.provider.getBlock("latest")).timestamp + 1000,
          receiverAccount: account1.address,
        })
      ).to.revertedWith("Pausable: paused");
    });

    it("should unpause the contract", async () => {
      const { crowdUsdtOpportunity: opportunity } = await loadFixture(
        crowdUsdtLpStakeOpportunityFixtureV2
      );
      await opportunity.pause();
      await expect(opportunity.unpause())
        .to.emit(opportunity, "Unpaused")
        .withArgs(owner.address);
    });

    it("should fail using none owner address", async () => {
      const {
        crowdUsdtOpportunity: opportunity,
        CROWD: tokenA,
        USDT: tokenB,
      } = await loadFixture(crowdUsdtLpStakeOpportunityFixtureV2);

      await expect(opportunity.connect(account1).pause()).to.revertedWith(
        "ce30"
      );

      await expect(opportunity.connect(account1).unpause()).to.revertedWith(
        "ce30"
      );
    });
  });

  function getFee(amount: BigNumber, percentage: number): BigNumber {
    return amount.mul(percentage * 10).div(1000);
  }

  async function moveTimeForward(seconds) {
    let currentTimestamp = await ethers.provider.getBlock("latest");
    await ethers.provider.send("evm_mine", [
      currentTimestamp.timestamp + seconds,
    ]);
  }

  function dexDescriptorFromTransaction(tx, dexName: string) {
    const selector = ethers.utils.arrayify(tx.data.substring(0, 10));
    let params: Uint8Array[] = [];
    for (let i = 10; i < tx.data.length; i += 64) {
      params.push(ethers.utils.arrayify("0x" + tx.data.substring(i, i + 64)));
    }
    const d =
      Dexchanges[dexName].networks[Networks.MAINNET] ??
      Dexchanges[dexName].networks[Networks.POLYGON_MAINNET];
    const flag = d[0].code;

    return {
      selector: selector,
      params: params,
      isReplace: true,
      index: 0,
      flag: flag,
    };
  }
});
