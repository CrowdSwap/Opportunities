// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./lib/UniERC20.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract CrowdswapTest {
    using UniERC20 for IERC20;
    using SafeERC20 for IERC20;

    mapping(uint256 => address) public dexchanges;
    uint256 feePercentage = 10**17; //0.1

    event SwapSucceedEvent(IERC20 _destToken, uint256 amountOut, uint256 fee);

    struct DexAddress {
        uint256 flag;
        address adr;
    }

    receive() external payable {}

    fallback() external {
        revert("ce01");
    }

    function _feeCalculator(uint256 _withdrawalAmount, uint256 _percentage)
        private
        pure
        returns (uint256)
    {
        return (_percentage * _withdrawalAmount) / (10**18) / 100;
    }

    function _prepareSwap(
        IERC20 _fromToken,
        IERC20 _destToken,
        uint256 _amountIn,
        uint8 _dexFlag
    ) internal returns (uint256, address) {
        require(msg.value == (_fromToken.isETH() ? _amountIn : 0), "ce06");

        uint256 _beforeSwappingBalance = _destToken.uniBalanceOf(address(this));

        address _dexAddress = _retrieveDexAddress(_dexFlag);
        require(_dexAddress != address(0), "ce07");
        if (!_fromToken.isETH()) {
            _fromToken.safeTransferFrom(msg.sender, address(this), _amountIn);
            _fromToken.uniApprove(_dexAddress, _amountIn);
        }

        return (_beforeSwappingBalance, _dexAddress);
    }

    function _augmentSwap(
        address _receiver,
        IERC20 _destToken,
        uint256 _beforeSwappingBalance
    ) internal returns (uint256) {
        uint256 _amountOut = _destToken.uniBalanceOf(address(this)) -
            _beforeSwappingBalance;
        require(_amountOut > 0, "ce08");

        uint256 _fee = _feeCalculator(_amountOut, feePercentage);
        _amountOut = _amountOut - _fee;
        _destToken.uniTransfer(payable(_receiver), _amountOut);

        emit SwapSucceedEvent(_destToken, _amountOut, _fee);

        return _amountOut;
    }

    function _retrieveDexAddress(uint8 _dexFlag)
        internal
        view
        virtual
        returns (address);
}
