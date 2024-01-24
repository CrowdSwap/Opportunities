// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../helpers/OwnableUpgradeable.sol";
import "../helpers/BlockBasedLockUpgradeable.sol";

/**
 * @title LockableStakingRewards for the CrowdToken
 * @notice Staking with lockable mechanism and rewards calculation
 */
contract LockableStakingRewards is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    BlockBasedLockUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev a struct containing the plan details
     * @member id , is uniq for each plan
     * @member duration of each staking plan
     * @member apr of each staking plan, with 2 decimals, (1=0.01% )
     * @member defaultApr of each staking plan with 2 decimals, (1=0.01% ). After of duration, rewards will be calculate based on defaultApr
     * @member active A boolean to check if the plan is active. It is reserved for future use
     * @member exists A boolean to check existence of a plan
     */
    struct Plan {
        uint256 id;
        uint128 duration;
        uint16 apr;
        uint16 defaultApr;
        bool active;
        bool exists;
    }

    /**
     * @dev a struct containing the stake specific details
     * @member id , is uniq for each stake
     * @member planId ,
     * @member amount of stake
     * @member reward of stake. It will be updated after each withdraw
     * @member paidAmount of stake
     * @member startTime , shows the start time thar user has staked
     * @member endTime , shows the end of duration for this specific stake based on startTime
     * @member lastWithdrawalTime ,
     * @member archived ,
     */
    struct Stake {
        uint256 id;
        uint256 planId;
        uint256 amount;
        uint256 reward;
        uint256 paidAmount;
        uint256 startTime;
        uint256 endTime;
        uint256 lastWithdrawalTime;
        bool archived;
    }

    /**
     * @dev a struct containing the investmanet details of each plan
     * @member totalInvestAmount , is the total amount of staked in each plan
     * @member totalInvestCount ,  is the number of stakes in each plan
     */
    struct InvestmentInfo {
        uint256 totalInvestAmount;
        uint256 totalInvestCount;
    }

    /**
     * @dev A struct containing parameters needed to calculate fees
     * @member stakeFee The initial fee of Stake step
     * @member unstakeFee The initial fee of Unstake step
     */
    struct FeeInfo {
        address payable feeTo;
        uint256 stakeFee;
        uint256 unstakeFee;
    }

    //Determine how many blocks will be locked to complete critical operations
    uint8 public constant LOCK_FOR_BLOCS_DURATION = 10;

    uint256 public constant MAX_FEE = 1e20; //100%
    uint16 public constant MAX_APR = 1e4; //100%

    IERC20Upgradeable public stakingToken;

    mapping(address => Stake[]) public userStakes; // user => stakes
    mapping(address => mapping(uint256 => uint256)) public userStakeIdToIndex; // user => stakeId => stakeIndex (in array)
    // Mapping to track if an address has staked before
    mapping(address => bool) public hasStaked;
    // Array to store addresses that have staked
    address[] public stakerList;
    uint256 public stakeCounter;

    uint256 public planCounter;
    mapping(uint256 => Plan) public plans;
    mapping(uint256 => InvestmentInfo) public planInvestmentInfo;

    FeeInfo public feeInfo;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[100] private __gap;

    /* ========== EVENTS ========== */
    event Staked(
        address indexed user,
        uint256 indexed planId,
        uint256 indexed stakeId,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );
    event Withdrawn(
        address indexed user,
        uint256 indexed planId,
        uint256 indexed stakeId,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );
    event Extended(
        address indexed user,
        uint256 indexed planId,
        uint256 indexed oldStakeId,
        uint256 newStakeId,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );

    event FeeDeducted(
        address indexed user,
        address indexed token,
        // address token,
        uint256 amount,
        uint256 totalFee
    );

    event SetFee(
        address indexed user,
        address feeTo,
        uint256 stakeFee,
        uint256 unstakeFee
    );

    event PlanCreated(
        address indexed operator,
        uint256 indexed planId,
        uint256 duration,
        uint256 apr,
        uint256 defaultApr
    );
    event PlanUpdated(
        address indexed operator,
        uint256 indexed planId,
        uint256 newDuration,
        uint256 newApr,
        uint256 newDefaultApr
    );

    /* ========== Modifiers ========== */
    modifier validStakeId(uint256 _stakeId) {
        require(
            0 <= _stakeId && _stakeId < stakeCounter,
            "LockableStakingRewards: Invalid stake ID"
        );
        _;
    }

    modifier validUser(address _user) {
        require(hasStaked[_user], "LockableStakingRewards: Invalid user");
        _;
    }

    modifier validPlanId(uint256 _planId) {
        require(
            0 <= _planId && _planId < planCounter,
            "LockableStakingRewards: Invalid plan ID"
        );
        _;
    }

    /* ========== Methods ========== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev The contract constructor
     * @param _feeInfo The details of fee
     * @param _stakingToken The address of the staking token
     */
    function initialize(
        address _stakingToken,
        FeeInfo memory _feeInfo
    ) public initializer {
        _requiredValidAddress(_stakingToken);

        OwnableUpgradeable.initialize();
        BlockBasedLockUpgradeable.__BlockBasedLock_init();
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        stakingToken = IERC20Upgradeable(_stakingToken);

        setFee(_feeInfo);
    }

    function setFee(FeeInfo memory _feeInfo) public onlyOwner whenNotLocked {
        _requiredValidAddress(_feeInfo.feeTo);
        _requiredValidFee(_feeInfo.stakeFee);
        _requiredValidFee(_feeInfo.unstakeFee);

        feeInfo = _feeInfo;
        emit SetFee(
            msg.sender,
            _feeInfo.feeTo,
            _feeInfo.stakeFee,
            _feeInfo.unstakeFee
        );
    }

    function getVersion() external pure returns (string memory) {
        return "v1.1.0";
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice When a new plan is created, the planCounter parameter increments
     * @param _duration The duration of the staking plan (between startTime and endTime)
     * @param _apr The apr of the staking plan, with 2 decimals, (1=0.01% )
     * @param _defaultApr The defaukt apr of each staking plan with 2 decimals, (1=0.01% ). After of duration, rewards will be calculate based on defaultApr
     */
    function createPlan(
        uint128 _duration,
        uint16 _apr,
        uint16 _defaultApr
    ) external onlyOwner {
        _requiredValidApr(_apr);
        _requiredValidApr(_defaultApr);

        // Using planCounter as the new planId
        uint256 _planId = planCounter++;

        plans[_planId] = Plan(
            _planId,
            _duration,
            _apr,
            _defaultApr,
            true,
            true
        );

        emit PlanCreated(msg.sender, _planId, _duration, _apr, _defaultApr);
    }

    /**
     * @notice To activate/deactivate an existing plan
     * @param _planId The id of specific plan
     * @param _isActive The apr of the staking plan, with 2 decimals, (1=0.01% )
     */
    function changePlanActiveStatus(
        uint256 _planId,
        bool _isActive
    ) external onlyOwner whenNotLocked validPlanId(_planId) {
        require(
            plans[_planId].exists,
            "LockableStakingRewards: Plan does not exist."
        );

        // Update the plan attributes
        plans[_planId].active = _isActive;

        emit PlanUpdated(
            msg.sender,
            _planId,
            plans[_planId].duration,
            plans[_planId].apr,
            plans[_planId].defaultApr
        );
    }

    /**
     * @param _planId The id of a specific plan
     * @param _stakeFee The fee to stake. It is required to send for double checking
     * @param _amount The amount to stake
     */
    function stake(
        uint256 _planId,
        uint256 _stakeFee,
        uint256 _amount
    )
        external
        nonReentrant
        whenNotPaused
        validPlanId(_planId)
        lockForBlocksDuration(LOCK_FOR_BLOCS_DURATION)
    {
        _requiredMatchingFees(_stakeFee, feeInfo.stakeFee);

        Plan memory _plan = plans[_planId]; // Use storage reference

        _transferTokenFromTo(
            stakingToken,
            msg.sender,
            payable(address(this)),
            _amount
        );

        //Decrease fee
        uint256 _feePercentage = feeInfo.stakeFee;
        uint256 _totalFee;
        (_amount, _totalFee) = _deductFee(
            _feePercentage,
            stakingToken,
            _amount
        );

        require(
            _feePercentage == 0 || _totalFee != 0,
            "LockableStakingRewards: Fee is zero (amount is too low)"
        );

        require(_plan.exists, "LockableStakingRewards: Plan does not exist.");

        require(_plan.active, "LockableStakingRewards: Plan does not active.");

        (uint256 _stakeId, uint256 _stakedAmount) = _createStake(
            _plan,
            msg.sender,
            _amount
        );

        emit Staked(
            msg.sender,
            _planId,
            _stakeId,
            _stakedAmount,
            block.timestamp,
            block.timestamp + _plan.duration
        );
    }

    /**
     * @notice if the amount be equal to origin staked amount, or the _max is true, reward and origin staked amount will withdraw
     * @param _unstakeFee The fee to unstake. It is required to send for double checking
     * @param _stakeId , an uniq id for each stake
     * @param _amount to withdraw
     * @param _max A boolean to withdraw the max amount
     */
    function withdraw(
        uint256 _unstakeFee,
        uint256 _stakeId,
        uint256 _amount,
        bool _max
    )
        external
        nonReentrant
        whenNotPaused
        validStakeId(_stakeId)
        validUser(msg.sender)
        lockForBlocksDuration(LOCK_FOR_BLOCS_DURATION)
    {
        /**
         * When _max is true, the _amount is not important.
         * It will be calculated later and replaced by the calculated max amount
         */
        require(
            _max || _amount > 0,
            "LockableStakingRewards: withdraw amount must be greater than 0."
        );

        Stake storage _stakeToWithdraw = _getUserStakeByStakeId(
            msg.sender,
            _stakeId
        );

        require(
            !_stakeToWithdraw.archived,
            "LockableStakingRewards: The stake has been archived"
        );
        require(
            block.timestamp >= _stakeToWithdraw.endTime,
            "LockableStakingRewards: Staking period has not ended yet"
        );

        Plan memory _plan = plans[_stakeToWithdraw.planId]; // Use storage reference

        _requiredMatchingFees(_unstakeFee, feeInfo.unstakeFee);

        uint256 _maxWithdrawAmount;
        (_amount, _maxWithdrawAmount) = _withdrawStake(
            _stakeToWithdraw,
            _plan,
            _amount,
            _max
        );

        //Decrease fee
        uint256 _totalFee;
        uint256 _feePercentage = feeInfo.unstakeFee;
        (_amount, _totalFee) = _deductFee(
            _feePercentage,
            stakingToken,
            _amount
        );

        require(
            _feePercentage == 0 ||
                _totalFee != 0 ||
                _amount == _maxWithdrawAmount,
            "LockableStakingRewards: Fee is zero (amount is too low)"
        );

        _transferTokenTo(stakingToken, payable(msg.sender), _amount);

        emit Withdrawn(
            msg.sender,
            _stakeToWithdraw.planId,
            _stakeToWithdraw.id,
            _amount,
            _stakeToWithdraw.startTime,
            _stakeToWithdraw.endTime
        );
    }

    /**
     * @notice if the user wants to extend in specific plan
     * @param _stakeFee The fee to stake. It is required to send for double checking
     * @param _unstakeFee The fee to unstake. It is required to send for double checking
     * @param _stakeId The id of a specific stake
     */
    function extend(
        uint256 _stakeFee,
        uint256 _unstakeFee,
        uint256 _stakeId
    )
        external
        nonReentrant
        whenNotPaused
        validStakeId(_stakeId)
        validUser(msg.sender)
        lockForBlocksDuration(LOCK_FOR_BLOCS_DURATION)
    {
        Stake storage _stakeToRestake = _getUserStakeByStakeId(
            msg.sender,
            _stakeId
        );

        Plan memory _plan = plans[_stakeToRestake.planId];

        require(
            !_stakeToRestake.archived,
            "LockableStakingRewards: The stake has been archived"
        );
        require(
            block.timestamp >= _stakeToRestake.endTime,
            "LockableStakingRewards: Staking period has not ended yet"
        );

        require(_plan.active, "LockableStakingRewards: Plan does not active.");

        _requiredMatchingFees(_stakeFee, feeInfo.stakeFee);
        _requiredMatchingFees(_unstakeFee, feeInfo.unstakeFee);

        //Withdraw all value from the previous Stake

        /** When the max field is true, the value of the second field is not importnat,
         * since the max amount is calculated in the function
         */
        (, uint256 _maxWithdrawAmount) = _withdrawStake(
            _stakeToRestake,
            _plan,
            0,
            true
        );

        //Decrease fee
        FeeInfo memory _feeInfo = feeInfo;
        uint256 _feePercentage = _feeInfo.unstakeFee + _feeInfo.stakeFee;
        uint256 _totalFee;
        (_maxWithdrawAmount, _totalFee) = _deductFee(
            _feePercentage,
            stakingToken,
            _maxWithdrawAmount
        );

        require(
            _feePercentage == 0 || _totalFee != 0,
            "LockableStakingRewards: Fee is zero (amount is too low)"
        );

        //create new stake
        (uint256 _newStakeId, uint256 _stakedAmount) = _createStake(
            _plan,
            msg.sender,
            _maxWithdrawAmount
        );

        emit Extended(
            msg.sender,
            _plan.id,
            _stakeToRestake.id,
            _newStakeId,
            _stakedAmount,
            block.timestamp,
            block.timestamp + _plan.duration
        );
    }

    /**
     * @param _userAddress The address of the user
     * @return all staking records of the user
     */
    function getUserStakingRecords(
        address _userAddress
    ) external view returns (Stake[] memory) {
        Stake[] memory _stakeList = userStakes[_userAddress];

        for (uint256 i = 0; i < _stakeList.length; ++i) {
            Plan memory _plan = plans[_stakeList[i].planId];
            _stakeList[i].reward += _calculateRewardIncrement(
                _stakeList[i],
                _plan
            );
        }

        return _stakeList;
    }

    /**
     * @notice Returns the sum of all staked amounts for all plans for a user
     * @param _userAddress The address of the user
     */
    function getUserTotalStakedAmount(
        address _userAddress
    ) external view returns (uint256) {
        uint256 _totalStakedAmount = 0;

        Stake[] memory _stakes = userStakes[_userAddress];

        for (uint256 i = 0; i < _stakes.length; ++i) {
            if (!_stakes[i].archived) {
                _totalStakedAmount += _stakes[i].amount;
            }
        }

        return _totalStakedAmount;
    }

    /**
     * @return Returns all plans
     */
    function getAllPlans() external view returns (Plan[] memory) {
        uint256 _planCounter = planCounter; //gas saving
        Plan[] memory _allPlansArray = new Plan[](_planCounter);

        for (uint256 i = 0; i < _planCounter; ++i) {
            _allPlansArray[i] = plans[i];
        }

        return _allPlansArray;
    }

    /**
     * @notice Returns the number of addresses that have staked
     * @return uint256 The number of addresses that have staked
     */
    function getStakedAddressCount() external view returns (uint256) {
        return stakerList.length;
    }

    function getUserReward(
        address _userAddress,
        uint256 _stakeId
    ) external view returns (uint256) {
        Stake memory _stake = _getUserStakeByStakeId(_userAddress, _stakeId);
        Plan memory _plan = plans[_stake.planId];
        uint256 _rewardIncrement = _calculateRewardIncrement(_stake, _plan);
        return _rewardIncrement + _stake.reward;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _requiredMatchingFees(
        uint256 _providedFee,
        uint256 _contractFee
    ) internal pure {
        require(
            _providedFee == _contractFee,
            "LockableStakingRewards: stake/unstake fee is not expected"
        );
    }

    function _requiredValidFee(uint256 _fee) internal pure {
        // 1e18 is 1%
        require(_fee < MAX_FEE, "LockableStakingRewards: Invalid fee");
    }

    function _requiredValidApr(uint16 _apr) internal pure {
        //1e2 is 1%
        require(
            _apr < MAX_APR,
            "LockableStakingRewards: Invalid apr/default apr"
        );
    }

    function _requiredValidAddress(address _address) internal pure {
        require(
            _address != address(0),
            "LockableStakingRewards: address is not valid"
        );
    }

    /**
     * @dev a helper function for stake
     * @param _plan The plan which is used for staking
     * @param user The address of the staker
     * @param _amount to stake
     */
    function _createStake(
        Plan memory _plan,
        address user,
        uint256 _amount
    ) internal returns (uint256 _stakeId, uint256 _stakedAmount) {
        // Check if the address has staked before
        if (!hasStaked[user]) {
            hasStaked[user] = true;
            stakerList.push(user); // Add the address to the array
        }

        _stakeId = stakeCounter++;
        _stakedAmount = _amount;

        Stake memory _newStake = Stake({
            id: _stakeId,
            planId: _plan.id,
            amount: _stakedAmount,
            reward: 0,
            paidAmount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + _plan.duration,
            lastWithdrawalTime: block.timestamp,
            archived: false
        });
        userStakes[user].push(_newStake);
        userStakeIdToIndex[user][_stakeId] = userStakes[user].length - 1;

        planInvestmentInfo[_plan.id].totalInvestAmount += _stakedAmount;
        ++planInvestmentInfo[_plan.id].totalInvestCount;
    }

    /**
     * @dev a helper function to withdraws a stake
     * @notice if the amount be equal to origin staked amount, or the _max is true, reward and origin staked amount will withdraw
     * @param _stake object to withdraw
     * @param _plan the plan assoictaed to the stake
     * @param _amount to withdraw
     * @param _max A boolean to withdraw the max amount
     */
    function _withdrawStake(
        Stake storage _stake,
        Plan memory _plan,
        uint256 _amount,
        bool _max
    ) internal returns (uint256 _withdrawnAmount, uint256 _maxWithdrawAmount) {
        uint256 _rewardIncrement = _calculateRewardIncrement(_stake, _plan);

        _maxWithdrawAmount =
            _stake.amount +
            _stake.reward +
            _rewardIncrement -
            _stake.paidAmount;

        if (_max) {
            _amount = _maxWithdrawAmount;
        }
        require(
            _amount <= _maxWithdrawAmount,
            "LockableStakingRewards: Amount is greater that stakedAmount + rewards"
        );

        if (_amount == _maxWithdrawAmount) {
            _stake.archived = true;
            --planInvestmentInfo[_stake.planId].totalInvestCount;
        }

        //The original amount which the user staked, minus the reward
        uint256 _mainAmount;
        if (_stake.paidAmount > _stake.amount) {
            _mainAmount = 0;
        } else if ((_stake.paidAmount + _amount <= _stake.amount)) {
            _mainAmount = _amount;
        } else {
            _mainAmount = _stake.amount - _stake.paidAmount;
        }

        planInvestmentInfo[_stake.planId].totalInvestAmount -= _mainAmount;

        _stake.reward += _rewardIncrement;
        _stake.paidAmount += _amount;
        _stake.lastWithdrawalTime = block.timestamp;

        _withdrawnAmount = _amount;
    }

    /**
     * @notice After the plan's duration, rewards will be calculated based on the default apr
     * @param _stake The specific stake
     */
    function _calculateRewardIncrement(
        Stake memory _stake,
        Plan memory _plan
    ) internal view returns (uint256) {
        uint256 _userReward = 0;

        //startTime is ths initial value of lastWithdrawalTime
        if (_stake.lastWithdrawalTime <= _stake.endTime) {
            uint256 _duration = MathUpgradeable.min(
                block.timestamp,
                _stake.endTime
            ) - _stake.lastWithdrawalTime;

            _userReward += _getReward(_stake.amount, _plan.apr, _duration);
        }

        // If the stake duration is expired
        if (_stake.endTime < block.timestamp) {
            uint256 _duration = block.timestamp -
                MathUpgradeable.max(_stake.lastWithdrawalTime, _stake.endTime);
            uint256 _amount = _stake.amount >= _stake.paidAmount
                ? _stake.amount - _stake.paidAmount
                : 0;
            _userReward += _getReward(_amount, _plan.defaultApr, _duration);
        }
        return _userReward;
    }

    function _getReward(
        uint256 _amount,
        uint256 _apr,
        uint256 _duration
    ) internal pure returns (uint256 _reward) {
        _reward = ((_amount * _apr * _duration) * 1e16) / (360 days * 1e20);
    }

    function _getUserStakeByStakeId(
        address _userAddress,
        uint256 _stakeId
    ) internal view returns (Stake storage) {
        uint256 _stakeIndex = userStakeIdToIndex[_userAddress][_stakeId];
        return userStakes[_userAddress][_stakeIndex];
    }

    function _deductFee(
        uint256 _percentage,
        IERC20Upgradeable _token,
        uint256 _amount
    ) internal returns (uint256 _amountAfterFee, uint256 _totalFee) {
        _totalFee = _calculateFee(_amount, _percentage);
        _amountAfterFee = _amount - _totalFee;
        if (_totalFee != 0) {
            _transferTokenTo(_token, feeInfo.feeTo, _totalFee);
            emit FeeDeducted(msg.sender, address(_token), _amount, _totalFee);
        }
    }

    function _calculateFee(
        uint256 _amount,
        uint256 _percentage
    ) internal pure returns (uint256) {
        return (_amount * _percentage) / 1e20;
    }

    function _transferTokenTo(
        IERC20Upgradeable _token,
        address payable _to,
        uint256 _amount
    ) internal {
        // Check balance before and after the transfer
        uint256 _initialBalance = _token.balanceOf(_to);
        _token.safeTransfer(_to, _amount);
        uint256 _finalBalance = _token.balanceOf(_to);
        require(
            _finalBalance - _initialBalance == _amount,
            "Token transfer failed"
        );
    }

    function _transferTokenFromTo(
        IERC20Upgradeable _token,
        address _from,
        address payable _to,
        uint256 _amount
    ) internal {
        // Check balance before and after the transfer
        uint256 _initialBalance = _token.balanceOf(_to);
        _token.safeTransferFrom(_from, _to, _amount);
        uint256 _finalBalance = _token.balanceOf(_to);
        require(
            _finalBalance - _initialBalance == _amount,
            "Token transfer failed"
        );
    }
}
