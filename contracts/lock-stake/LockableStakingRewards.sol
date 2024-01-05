// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../helpers/OwnableUpgradeable.sol";

/**
 * @title LockableStakingRewards for the CrowdToken
 * @notice Staking with lockable mechanism and rewards calculation
 */
contract LockableStakingRewards is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev a struct containing the plan details
     * @member id , is uniq for each plan
     * @member duration of each staking plan
     * @member apy of each staking plan
     * @member defaultApy of each staking plan, after of duration , rewards will calculate based on defaultApy
     * @member exists A boolean to check existence of a plan
     */
    struct Plan {
        uint256 id;
        uint256 duration;
        uint256 apy;
        uint256 defaultApy;
        bool exists;
    }

    /**
     * @dev a struct containing the stake specific details
     * @member id , is uniq for each stake
     * @member planId , 
     * @member amount of stake
     * @member reward of stake
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

    mapping(address => Stake[]) public userStakes; // user => stakes
    mapping(uint256 => Plan) public plans;

    // Mapping to track if an address has staked before
    mapping(address => bool) public hasStaked;

    mapping(uint256 => uint256) public totalInvestAmountPerPlan; // plan => investAmount
    mapping(uint256 => uint256) public totalInvestCountPerPlan; // plan => investNumber
    // Array to store addresses that have staked
    address[] public addresses;

    IERC20Upgradeable public stakingToken;
    address payable public feeTo;

    uint128 public planCounter;
    uint128 public stakeCounter;

    uint128 public unstakeFee;
    uint128 public stakeFee;

    /* ========== EVENTS ========== */
    event Staked(
        address indexed user,
        uint256 indexed planId,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );
    event Withdrawn(
        address indexed user,
        uint256 indexed planId,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );
    event ReStaked(
        address indexed user,
        uint256 indexed planId,
        uint256 amount,
        uint256 startTime,
        uint256 endTime
    );
    event FeeDeducted(
        address indexed user,
        address token,
        uint256 amount,
        uint256 totalFee
    );
    event SetFeeTo(address indexed user, address feeTo);
    event SetFee(address indexed user, uint256 feePercentage);
    event PlanCreated(
        address indexed user,
        uint256 duration,
        uint256 apy,
        uint256 defaultApy
    );
    event PlanUpdated(
        address indexed user,
        uint256 indexed planId,
        uint256 newDuration,
        uint256 newApy,
        uint256 newDefaultApy
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev The contract constructor
     * @param _stakingToken The address of the staking token
     */
    function initialize(
        address _stakingToken,
        address _feeTo,
        uint128 _stakeFee,
        uint128 _unstakeFee
    ) public initializer {
        OwnableUpgradeable.initialize();
        PausableUpgradeable.__Pausable_init();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        stakingToken = IERC20Upgradeable(_stakingToken);
        feeTo = payable(_feeTo);
        stakeFee = _stakeFee;
        unstakeFee = _unstakeFee;
    }

    /**
     * @notice When a new plan is created, the planCounter parameter increments
     * @param _duration The duration of the staking plan (between startTime and endTime)
     * @param _apy The apy of the staking plan
     * @param _defaultApy The default apy of the staking plan. After the plan's duration, rewards will be calculated based on the default apy
     */
    function createPlan(
        uint256 _duration,
        uint256 _apy,
        uint256 _defaultApy
    ) external onlyOwner {
        require(_duration > 0, "LockableStakingRewards: Invalid duration.");
        require(_apy > 0, "LockableStakingRewards: Invalid apy.");

        uint256 _planId = planCounter++; // Using planCounter as the new planId
        require(
            !planExists(_duration, _apy, _defaultApy),
            "LockableStakingRewards: Similar plan already exists."
        );

        plans[_planId] = Plan(_planId, _duration, _apy, _defaultApy, true);

        emit PlanCreated(msg.sender, _duration, _apy, _defaultApy);
    }

    /**
     * @notice To update an existing plan
     * @param _planId The id of specific plan
     * @param _newDuration,of each staking plan (between startTime and endTime)
     * @param _newApy of each staking plan
     * @param _newDefaultApy of each staking plan, after of duration , rewards will calculate based on defaultApy
     */
    function updatePlan(
        uint256 _planId,
        uint256 _newDuration,
        uint256 _newApy,
        uint256 _newDefaultApy
    ) external onlyOwner {
        require(
            plans[_planId].exists,
            "LockableStakingRewards: Plan does not exist."
        );
        require(_newDuration > 0, "LockableStakingRewards: Invalid duration.");
        require(_newApy > 0, "LockableStakingRewards: Invalid apy.");

        // Update the plan attributes
        plans[_planId].duration = _newDuration;
        plans[_planId].apy = _newApy;
        plans[_planId].defaultApy = _newDefaultApy;

        emit PlanUpdated(
            msg.sender,
            _planId,
            _newDuration,
            _newApy,
            _newDefaultApy
        );
    }

    /**
     * @param _planId The id of a specific plan
     * @param _amount The amount to stake
     */
    function stake(uint256 _planId, uint256 _amount) external nonReentrant {
        Plan memory _plan = plans[_planId]; //gas saving
        require(_plan.exists, "LockableStakingRewards: Plan does not exist.");
        require(
            _amount > 0,
            "LockableStakingRewards: Staked _amount must be greater than 0."
        );

        // Check if the address has staked before, using the mapping
        if (!hasStaked[msg.sender]) {
            hasStaked[msg.sender] = true;
            addresses.push(msg.sender); // Add the address to the array
        }

        // Transfer tokens to the contract
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        Stake memory _newStake = Stake({
            id: stakeCounter++,
            planId: _planId,
            amount: _amount,
            reward: 0,
            paidAmount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + _plan.duration,
            lastWithdrawalTime: 0,
            archived: false
        });
        userStakes[msg.sender].push(_newStake);
        totalInvestAmountPerPlan[_planId] += _amount;
        totalInvestCountPerPlan[_planId]++;

        emit Staked(
            msg.sender,
            _planId,
            _amount,
            block.timestamp,
            block.timestamp + _plan.duration
        );
    }

    /**
     * @notice if the amount be equal to origin staked amount , reward and origin staked amount will withdraw
     * @param _stakeId , an uniq id for each stake
     * @param _amount to withdraw
     */
    function withdraw(
        uint256 _stakeId,
        uint256 _amount,
        bool _max
    ) external nonReentrant whenNotPaused {
        Stake[] storage _userStakeArray = userStakes[msg.sender];
        require(
            _stakeId < stakeCounter,
            "LockableStakingRewards: Invalid stake ID"
        );

        uint256 _stakeIndex = _findStakeIndex(_userStakeArray, _stakeId);

        Stake storage _stakeToWithdraw = _userStakeArray[_stakeIndex];
        require(
            !_stakeToWithdraw.archived,
            "LockableStakingRewards: The stake has been archived"
        );
        require(
            block.timestamp >= _stakeToWithdraw.endTime,
            "LockableStakingRewards: Staking period has not ended yet"
        );

        uint256 _reward = calculateReward(_stakeToWithdraw);

        if(_max){
            _amount = _stakeToWithdraw.amount + _stakeToWithdraw.reward + _reward - _stakeToWithdraw.paidAmount;
        }
        require(
            _amount <= _stakeToWithdraw.amount + _stakeToWithdraw.reward + _reward - _stakeToWithdraw.paidAmount,
            "LockableStakingRewards: Amount is greater that stakedAmount+rewards"
        );
        
        if (_amount == _stakeToWithdraw.amount + _stakeToWithdraw.reward + _reward - _stakeToWithdraw.paidAmount) {
            _stakeToWithdraw.archived = true;
            totalInvestCountPerPlan[_stakeToWithdraw.planId]--;
        } 

        _stakeToWithdraw.lastWithdrawalTime = block.timestamp;
        _stakeToWithdraw.reward += _reward;
        _stakeToWithdraw.paidAmount += _amount;
        totalInvestAmountPerPlan[_stakeToWithdraw.planId] -= _stakeToWithdraw.amount > _stakeToWithdraw.paidAmount + _amount ? 
                                            _stakeToWithdraw.amount - (_stakeToWithdraw.paidAmount + _amount) : 0;

        uint256 _totalFee = _deductFee(unstakeFee, stakingToken, _amount);
        stakingToken.safeTransfer(msg.sender, _amount - _totalFee);

        emit Withdrawn(
            msg.sender,
            _stakeToWithdraw.planId,
            _amount,
            _stakeToWithdraw.startTime,
            _stakeToWithdraw.endTime
        );
    }

    /**
     * @notice if the user wants to extend in specific plan
     * @param _stakeId The id of a specific stake
     */
    function extend(uint256 _stakeId) external nonReentrant {
        require(hasStaked[msg.sender],"LockableStakingRewards: Invalid user");

        Stake[] storage _userStakeArray = userStakes[msg.sender];

        require(
            _stakeId < stakeCounter,
            "LockableStakingRewards: Invalid stake ID"
        );
        Stake storage _stakeToRestake = _userStakeArray[_stakeId];
        require(
            block.timestamp >= _stakeToRestake.endTime,
            "LockableStakingRewards: Staking period has not ended yet"
        );

        uint256 _reward = calculateReward(_stakeToRestake);
        _stakeToRestake.archived = true;

        totalInvestAmountPerPlan[_stakeToRestake.planId] -= _stakeToRestake.amount;

        uint256 _totalAmount = _stakeToRestake.amount + _stakeToRestake.reward + _reward - _stakeToRestake.paidAmount;
        uint256 _totalFee = _deductFee(unstakeFee, stakingToken, _totalAmount);
        _totalAmount -= _totalFee;
        Plan memory _plan = plans[_stakeToRestake.planId];

        Stake memory _newStake = Stake({
            id: stakeCounter++,
            planId: _plan.id,
            amount: _totalAmount,
            reward: 0,
            paidAmount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + _plan.duration,
            lastWithdrawalTime: 0,
            archived: false
        });
        userStakes[msg.sender].push(_newStake);

        totalInvestAmountPerPlan[_plan.id] += _stakeToRestake.amount;

        emit ReStaked(
            msg.sender,
            _plan.id,
            _totalAmount,
            block.timestamp,
            block.timestamp + _plan.duration
        );
    }

    function setFeeTo(address payable _feeTo) external onlyOwner {
        require(
            _feeTo != address(0),
            "LockableStakingRewards: address is not valid"
        );
        feeTo = _feeTo;
        emit SetFeeTo(msg.sender, _feeTo);
    }

    function setUnstakeFee(uint128 _feePercentage) external onlyOwner {
        unstakeFee = _feePercentage;
        emit SetFee(msg.sender, _feePercentage);
    }

    function setStakeFee(uint128 _feePercentage) external onlyOwner {
        stakeFee = _feePercentage;
        emit SetFee(msg.sender, _feePercentage);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
 * @param _userAddress The address of the user
 * @return all staking records of the user
 */
function getUserStakingRecords(
    address _userAddress
) external view returns (Stake[] memory) {
    Stake[] memory _stakeList = userStakes[_userAddress];

    for(uint256 i = 0 ; i < _stakeList.length; i++ ){
        _stakeList[i].reward += calculateReward(_stakeList[i]);
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

        for (uint256 i = 0; i < _stakes.length; i++) {
            if(!_stakes[i].archived){
                _totalStakedAmount += _stakes[i].amount;
            }
        }
        
        return _totalStakedAmount;
    }

    /**
     * @return Returns all plans
     */
    function getAllPlans() external view returns (Plan[] memory) {
        Plan[] memory _allPlansArray = new Plan[](planCounter);

        for (uint256 i = 0; i < planCounter; i++) {
            _allPlansArray[i] = plans[i];
        }

        return _allPlansArray;
    }

    /**
     * @notice Check if an address has staked before
     * @param _userAddress The address of the user
     */
    function hasUserStaked(address _userAddress) external view returns (bool) {
        return hasStaked[_userAddress];
    }

    /**
     * @notice Returns the number of addresses that have staked
     * @return uint256 The number of addresses that have staked
     */
    function getStakedAddressCount() external view returns (uint256) {
        return addresses.length;
    }

     function getUserReward(address _userAddress, uint256 _stakeId) external view returns (uint256) {
        Stake[] memory _userStakeArray = userStakes[_userAddress];
        uint256 _stakeIndex = _findStakeIndex(_userStakeArray, _stakeId);
        Stake memory _stake = _userStakeArray[_stakeIndex];
        uint256 calculatedReward = calculateReward(_stake);
        return calculatedReward + _stake.reward;
    }

    function planExists(
        uint256 _duration,
        uint256 _apy,
        uint256 _defaultApy
    ) internal view returns (bool) {
        for (uint256 i = 0; i < planCounter; i++) {
            if (
                plans[i].exists &&
                plans[i].duration == _duration &&
                plans[i].apy == _apy &&
                plans[i].defaultApy == _defaultApy
            ) {
                return true; // A plan with these attributes already exists
            }
        }
        return false; // No matching plan found
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @notice After the plan's duration, rewards will be calculated based on the default apy
     * @param _stake The specific stake
     */
    function calculateReward(
        Stake memory _stake
    ) private view returns (uint256) {
        require(
            plans[_stake.planId].exists,
            "LockableStakingRewards: Plan does not exist."
        );
        Plan memory _plan = plans[_stake.planId];

        // If rewards have already been paid for this stake, return 0
        if (_stake.lastWithdrawalTime >= _stake.endTime && _plan.defaultApy == 0) {
            return 0;
        }

        uint256 _userReward = 0;
        if (_stake.lastWithdrawalTime < _stake.endTime) {
            _userReward = getReward(
                _stake.amount,
                _plan.apy,
                _plan.duration > block.timestamp - _stake.startTime ? block.timestamp - _stake.startTime : _plan.duration
            );
        }

        // If there's a default APY and the stake duration has expired
        if (_plan.defaultApy > 0 && block.timestamp > _stake.endTime) {
            uint256 _duration = block.timestamp - (_stake.endTime > _stake.lastWithdrawalTime ? _stake.endTime : _stake.lastWithdrawalTime);
            uint256 _amount = _stake.amount >= _stake.paidAmount ? _stake.amount - _stake.paidAmount : 0;
            _userReward += getReward(
                _amount,
                _plan.defaultApy,
                _duration
            );
        }
        return _userReward;
    }

    function getReward(
        uint256 _amount,
        uint256 _apy,
        uint256 _duration
    ) private pure returns (uint256 reward) {
        reward = (_amount * _apy * _duration) / (365 days * 100);
    }
  
    function _findStakeIndex(Stake[] memory _stakeList, uint256 _stakeId) private pure returns (uint256) {
        for(uint256 i = 0; i < _stakeList.length; i++){
            if(_stakeList[i].id == _stakeId){
                return i;
            }
        }

        revert("LockableStakingRewards: stakeId is not exists!");
    }

    function _deductFee(
        uint256 _percentage,
        IERC20Upgradeable _token,
        uint256 _amount
    ) private returns (uint256 _totalFee) {
        _totalFee = _calculateFee(_amount, _percentage);
        _token.safeTransfer(feeTo, _totalFee);
        emit FeeDeducted(msg.sender, address(_token), _amount, _totalFee);
    }

    function _calculateFee(
        uint256 _amount,
        uint256 _percentage
    ) private pure returns (uint256) {
        return (_percentage * _amount) / 1 ether / 100;
    }
}
