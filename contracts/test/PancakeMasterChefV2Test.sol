// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PancakeMasterChefV2Test is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 boostMultiplier;
    }

    struct PoolInfo {
        uint256 accCakePerShare;
        uint256 lastRewardBlock;
        uint256 allocPoint;
        uint256 totalBoostedShare;
    }

    IERC20 public immutable CAKE;

    PoolInfo[] public poolInfo;
    IERC20[] public lpToken;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    uint256 public totalRegularAllocPoint;
    uint256 public constant MASTERCHEF_CAKE_PER_BLOCK = 40 * 1e18;
    uint256 public constant ACC_CAKE_PRECISION = 1e18;
    uint256 public constant BOOST_PRECISION = 100 * 1e10;
    uint256 public constant CAKE_RATE_TOTAL_PRECISION = 1e12;
    uint256 public cakeRateToRegularFarm = 50819500000;

    constructor(IERC20 _CAKE) {
        CAKE = _CAKE;
    }

    function add(
        uint256 _allocPoint,
        IERC20 _lpToken,
        bool _withUpdate
    ) external onlyOwner {
        totalRegularAllocPoint = totalRegularAllocPoint.add(_allocPoint);

        lpToken.push(_lpToken);

        poolInfo.push(
            PoolInfo({
                allocPoint: _allocPoint,
                lastRewardBlock: block.number,
                accCakePerShare: 0,
                totalBoostedShare: 0
            })
        );
    }

    function deposit(uint256 _pid, uint256 _amount) external {
        PoolInfo memory pool = updatePool(_pid);
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 multiplier = BOOST_PRECISION;

        if (user.amount > 0) {
            settlePendingCake(msg.sender, _pid, multiplier);
        }

        if (_amount > 0) {
            uint256 before = lpToken[_pid].balanceOf(address(this));
            lpToken[_pid].safeTransferFrom(msg.sender, address(this), _amount);
            _amount = lpToken[_pid].balanceOf(address(this)).sub(before);
            user.amount = user.amount.add(_amount);

            pool.totalBoostedShare = pool.totalBoostedShare.add(
                _amount.mul(multiplier).div(BOOST_PRECISION)
            );
        }

        user.rewardDebt = user
            .amount
            .mul(multiplier)
            .div(BOOST_PRECISION)
            .mul(pool.accCakePerShare)
            .div(ACC_CAKE_PRECISION);
        poolInfo[_pid] = pool;
    }

    function withdraw(uint256 _pid, uint256 _amount) external {
        PoolInfo memory pool = updatePool(_pid);
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "withdraw: Insufficient");

        uint256 multiplier = BOOST_PRECISION;

        settlePendingCake(msg.sender, _pid, multiplier);

        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            lpToken[_pid].safeTransfer(msg.sender, _amount);
        }

        user.rewardDebt = user
            .amount
            .mul(multiplier)
            .div(BOOST_PRECISION)
            .mul(pool.accCakePerShare)
            .div(ACC_CAKE_PRECISION);
        poolInfo[_pid].totalBoostedShare = poolInfo[_pid].totalBoostedShare.sub(
            _amount.mul(multiplier).div(BOOST_PRECISION)
        );
    }

    function updatePool(uint256 _pid) public returns (PoolInfo memory pool) {
        pool = poolInfo[_pid];
        if (block.number > pool.lastRewardBlock) {
            uint256 lpSupply = pool.totalBoostedShare;
            uint256 totalAllocPoint = totalRegularAllocPoint;

            if (lpSupply > 0 && totalAllocPoint > 0) {
                uint256 multiplier = block.number.sub(pool.lastRewardBlock);
                uint256 cakeReward = multiplier
                    .mul(cakePerBlock())
                    .mul(pool.allocPoint)
                    .div(totalAllocPoint);
                pool.accCakePerShare = pool.accCakePerShare.add(
                    (cakeReward.mul(ACC_CAKE_PRECISION).div(lpSupply))
                );
            }
            pool.lastRewardBlock = block.number;
            poolInfo[_pid] = pool;
        }
    }

    function pendingCake(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo memory user = userInfo[_pid][_user];
        uint256 accCakePerShare = pool.accCakePerShare;
        uint256 lpSupply = pool.totalBoostedShare;

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = block.number.sub(pool.lastRewardBlock);
            uint256 cakeReward = multiplier
                .mul(cakePerBlock())
                .mul(pool.allocPoint)
                .div(totalRegularAllocPoint);
            accCakePerShare = accCakePerShare.add(
                cakeReward.mul(ACC_CAKE_PRECISION).div(lpSupply)
            );
        }

        uint256 boostedAmount = user.amount.mul(BOOST_PRECISION).div(
            BOOST_PRECISION
        );
        return
            boostedAmount.mul(accCakePerShare).div(ACC_CAKE_PRECISION).sub(
                user.rewardDebt
            );
    }

    function cakePerBlock() public view returns (uint256 amount) {
        amount = MASTERCHEF_CAKE_PER_BLOCK.mul(cakeRateToRegularFarm).div(
            CAKE_RATE_TOTAL_PRECISION
        );
    }

    function settlePendingCake(
        address _user,
        uint256 _pid,
        uint256 _boostMultiplier
    ) internal {
        UserInfo memory user = userInfo[_pid][_user];

        uint256 boostedAmount = user.amount.mul(_boostMultiplier).div(
            BOOST_PRECISION
        );
        uint256 accCake = boostedAmount.mul(poolInfo[_pid].accCakePerShare).div(
            ACC_CAKE_PRECISION
        );
        uint256 pending = accCake.sub(user.rewardDebt);

        _safeTransfer(_user, pending);
    }

    function _safeTransfer(address _to, uint256 _amount) internal {
        if (_amount > 0) {
            uint256 balance = CAKE.balanceOf(address(this));
            if (balance < _amount) {
                _amount = balance;
            }
            CAKE.safeTransfer(_to, _amount);
        }
    }
}
