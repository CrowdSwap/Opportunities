// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract BlockBasedLockUpgradeable is Initializable {
    uint256 private _lockedUntilBlock;

    /* ========== Modifiers ========== */
    modifier lockForBlocksDuration(uint256 blocksDuration) {
        _lockedUntilBlock = block.number + blocksDuration;
        _;
    }

    modifier whenLocked() {
        require(_isLocked(), "BlockBasedLock: not locked");
        _;
    }

    modifier whenNotLocked() {
        require(!_isLocked(), "BlockBasedLock: locked");
        _;
    }

    /* ========== Methods ========== */
    function __BlockBasedLock_init() internal onlyInitializing {
        _lockedUntilBlock = 0;
    }

    function lockedUntilBlock() public view virtual returns (uint256) {
        return _lockedUntilBlock;
    }

    function _isLocked() internal view virtual returns (bool) {
        return block.number < _lockedUntilBlock;
    }

    uint256[49] private __gap;
}
