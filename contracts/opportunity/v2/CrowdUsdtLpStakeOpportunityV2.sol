// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./OpportunityV2.sol";
import "../../libraries/UniERC20Upgradeable.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IStakingLP.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

/**
 * @title crowd/usdt Opportunity
 * @notice The contract is used to add/remove liquidity in crowd/usdt pool and
 * stake/unstake the corresponding LP token
 */
contract CrowdUsdtLpStakeOpportunityV2 is OpportunityV2 {
    using UniERC20Upgradeable for IERC20Upgradeable;

    address public swapContract;
    IUniswapV2Router02 public router;
    IStakingLP public stakingLP;

    event SetStakingLP(address indexed user, address stakeContract);

    /**
     * @dev The contract constructor
     * @param _tokenCrowd The address of the CROWD token
     * @param _tokenUsdt The address of the USDT token
     * @param _pairFactoryContract The address of the dex's factory
     * @param _feeStruct Parameters needed for fee
     * @param _swapContract The address of the CrowdSwap Swap Contract
     * @param _router The address of the QuickSwap Router Contract
     * @param _stakingLP The address of the Stake LP Contract
     */
    function initialize(
        address _tokenCrowd,
        address _tokenUsdt,
        address _pairFactoryContract,
        FeeStruct memory _feeStruct,
        address _swapContract,
        address _router,
        address _stakingLP,
        address _coinWrapper
    ) public initializer {
        OpportunityV2._initializeContracts(
            _tokenCrowd,
            _tokenUsdt,
            _pairFactoryContract,
            _coinWrapper
        );
        OpportunityV2._initializeFees(_feeStruct);
        swapContract = _swapContract;
        router = IUniswapV2Router02(_router);
        stakingLP = IStakingLP(_stakingLP);
    }

    function setSwapContract(address _address) external onlyOwner {
        require(_address != address(0), "oe12");
        swapContract = _address;
        emit SetSwapContact(msg.sender, _address);
    }

    function setRouter(address _address) external onlyOwner {
        require(_address != address(0), "oe12");
        router = IUniswapV2Router02(_address);
        emit SetRouter(msg.sender, _address);
    }

    function setStakingLP(address _address) external onlyOwner {
        require(_address != address(0), "oe12");
        stakingLP = IStakingLP(_address);
        emit SetStakingLP(msg.sender, _address);
    }

    function swap(
        IERC20Upgradeable _fromToken,
        uint256 _amount,
        bytes memory _data
    ) internal override returns (uint256) {
        address _swapContract = swapContract; // gas savings
        if (!_fromToken.isETH()) {
            _fromToken.uniApprove(_swapContract, _amount);
        }
        bytes memory returnData = AddressUpgradeable.functionCallWithValue(
            _swapContract,
            _data,
            _fromToken.isETH() ? _amount : 0
        );
        return abi.decode(returnData, (uint256));
    }

    function addLiquidity(
        AddLiqDescriptor memory _addLiqDescriptor
    ) internal override returns (uint256, uint256, uint256) {
        IUniswapV2Router02 _router = router; // gas savings
        tokenA.uniApprove(address(_router), _addLiqDescriptor.amountADesired);
        tokenB.uniApprove(address(_router), _addLiqDescriptor.amountBDesired);
        return
            _router.addLiquidity(
                address(tokenA),
                address(tokenB),
                _addLiqDescriptor.amountADesired,
                _addLiqDescriptor.amountBDesired,
                _addLiqDescriptor.amountAMin,
                _addLiqDescriptor.amountBMin,
                address(this),
                _addLiqDescriptor.deadline
            );
    }

    function removeLiquidity(
        RemoveLiqDescriptor memory _removeLiqDescriptor
    ) internal override returns (uint256, uint256) {
        IUniswapV2Router02 _router = router; // gas savings
        pair.uniApprove(address(_router), _removeLiqDescriptor.amount);
        return
            address(tokenA) == address(coinWrapper) ||
                address(tokenB) == address(coinWrapper)
                ? _router.removeLiquidityETH(
                    address(tokenA) == address(coinWrapper)
                        ? address(tokenB)
                        : address(tokenA),
                    _removeLiqDescriptor.amount,
                    address(tokenA) == address(coinWrapper)
                        ? _removeLiqDescriptor.amountBMin
                        : _removeLiqDescriptor.amountAMin,
                    address(tokenA) == address(coinWrapper)
                        ? _removeLiqDescriptor.amountAMin
                        : _removeLiqDescriptor.amountBMin,
                    _removeLiqDescriptor.receiverAccount,
                    _removeLiqDescriptor.deadline
                )
                : _router.removeLiquidity(
                    address(tokenA),
                    address(tokenB),
                    _removeLiqDescriptor.amount,
                    _removeLiqDescriptor.amountAMin,
                    _removeLiqDescriptor.amountBMin,
                    _removeLiqDescriptor.receiverAccount,
                    _removeLiqDescriptor.deadline
                );
    }

    function stake(address _userAddress, uint256 _amount) internal override {
        IStakingLP _stakingLP = stakingLP; // gas savings
        pair.uniApprove(address(_stakingLP), _amount);
        _stakingLP.stakeLP(_amount, _userAddress);
    }

    function unstake(
        uint256 _amount
    ) internal override returns (uint256, uint256) {
        IERC20Upgradeable _tokenA = tokenA; // gas savings
        uint256 _beforeBalanceReward = _tokenA.uniBalanceOf(address(this));
        (uint256 _amountLP, uint256 _rewards) = stakingLP.withdraw(
            _amount,
            msg.sender
        );
        require(_amountLP == _amount, "oe15");
        uint256 _afterBalanceReward = _tokenA.uniBalanceOf(address(this));
        require(_afterBalanceReward - _beforeBalanceReward == _rewards, "oe09");
        return (_amountLP, _rewards);
    }
}
