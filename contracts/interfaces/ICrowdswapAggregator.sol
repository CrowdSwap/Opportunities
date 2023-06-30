// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICrowdswapAggregator {
    function swap(
        IERC20 _fromToken,
        IERC20 _destToken,
        address payable _receiver,
        uint256 _amountIn,
        uint8 _dexFlag,
        bytes calldata _data
    ) external payable returns (uint256 returnAmount);
}
