// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./CrowdswapTest.sol";
import "./lib/UniERC20.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CrowdswapV1Test is CrowdswapTest {
    using UniERC20 for IERC20;
    using SafeERC20 for IERC20;

    constructor(DexAddress[] memory dexAddresses) {
        for (uint256 i = 0; i < dexAddresses.length; i++) {
            DexAddress memory dexAddress = dexAddresses[i];
            if (dexAddress.adr != address(0)) {
                dexchanges[dexAddress.flag] = dexAddress.adr;
            }
        }
    }

    function swap(
        IERC20 _fromToken,
        IERC20 _destToken,
        address payable _receiver,
        uint256 _amountIn,
        uint8 _dexFlag,
        bytes calldata _data
    ) external payable returns (uint256 returnAmount) {
        if (_fromToken == _destToken) {
            return 0;
        }

        (uint256 beforeSwappingBalance, address dexAddress) = super
            ._prepareSwap(_fromToken, _destToken, _amountIn, _dexFlag);

        Address.functionCallWithValue(dexAddress, _data, msg.value);

        uint256 amountOut = super._augmentSwap(
            _receiver,
            _destToken,
            beforeSwappingBalance
        );

        return amountOut;
    }

    function _retrieveDexAddress(uint8 _dexFlag)
        internal
        view
        override
        returns (address)
    {
        address _dexchange = dexchanges[_dexFlag];
        return _dexchange;
    }
}
