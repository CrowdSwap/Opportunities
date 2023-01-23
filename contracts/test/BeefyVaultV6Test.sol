// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BeefyVaultV6Test is ERC20 {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public want; //pair

    constructor(
        string memory _name,
        string memory _symbol,
        address _want
    ) public ERC20(_name, _symbol) {
        want = _want;
    }

    function deposit(uint256 _amount) public {
        uint256 _pool = balance();
        IERC20(want).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount.mul(totalSupply())).div(_pool);
        }
        _mint(msg.sender, shares);
    }

    function withdraw(uint256 _shares) public {
        uint256 r = (balance().mul(_shares)).div(totalSupply());
        _burn(msg.sender, _shares);
        IERC20(want).safeTransfer(msg.sender, r);
    }

    function balance() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }
}
