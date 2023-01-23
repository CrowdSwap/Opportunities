// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./IUniswapV2ERC20.sol";

interface IUniswapV2PairTest is IUniswapV2ERC20 {
    function mint(address to) external returns (uint256 liquidity);

    function burn(address to)
        external
        returns (uint256 amount0, uint256 amount1);

    function initialize(address, address) external;
}
