// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./BaseTest.sol";
import "./UniswapV2FactoryTest.sol";
import "../interfaces/IUniswapV2Router02.sol";

contract UniswapV2Router02Test is IUniswapV2Router02, BaseTest {
    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "UniswapV2Router: EXPIRED");
        _;
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable override returns (uint256[] memory amounts) {
        super._safeTransfer(path[path.length - 1], to, amountOut);
        uint256[] memory results = new uint256[](1);
        results[0] = amountOut;
        return results;
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        super._safeTransfer(path[path.length - 1], to, amountOut);
        uint256[] memory results = new uint256[](1);
        results[0] = amountOut;
        return results;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        super._safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        super._safeTransfer(path[path.length - 1], to, amountOut);
        uint256[] memory results = new uint256[](1);
        results[0] = amountOut;
        return results;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        virtual
        override
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        (amountA, amountB) = (amountADesired, amountBDesired);
        address pair = UniswapV2FactoryTest(factory).getPair(tokenA, tokenB);
        super._safeTransferFrom(tokenA, msg.sender, pair, amountA);
        super._safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IUniswapV2PairTest(pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        public
        virtual
        override
        ensure(deadline)
        returns (uint256 amountA, uint256 amountB)
    {
        address pair = UniswapV2FactoryTest(factory).getPair(tokenA, tokenB);
        IUniswapV2PairTest(pair).transferFrom(msg.sender, pair, liquidity);
        (uint256 amount0, uint256 amount1) = IUniswapV2PairTest(pair).burn(to);
        (amountA, amountB) = (amount0, amount1);
        require(
            amountA >= amountAMin,
            "UniswapV2Router: INSUFFICIENT_A_AMOUNT"
        );
        require(
            amountB >= amountBMin,
            "UniswapV2Router: INSUFFICIENT_B_AMOUNT"
        );
    }
}
