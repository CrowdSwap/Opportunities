// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "../../helpers/OwnableUpgradeable.sol";
import "../../libraries/UniERC20Upgradeable.sol";
import "../../libraries/Math.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/ICrowdswapAggregator.sol";
import "../../interfaces/IUniswapV2Pair.sol";
import "../../interfaces/IUniswapV2Factory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

abstract contract OpportunityV2 is
    Initializable,
    UUPSUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using UniERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev A struct containing parameters needed to add liquidity
     * @member amountADesired The amount of tokenA to add as liquidity
     * @member amountBDesired The amount of tokenB to add as liquidity
     * @member amountAMin The minimum amount of tokenA to add as liquidity
     * @member amountBMin The minimum amount of tokenB to add as liquidity
     * @member deadline Unix timestamp after which the transaction will revert
     */
    struct AddLiqDescriptor {
        uint256 amountADesired;
        uint256 amountBDesired;
        uint256 amountAMin;
        uint256 amountBMin;
        uint256 deadline;
    }

    /**
     * @dev A struct containing parameters needed to remove liquidity
     * @member amount The amount of LP or its equivalent to be unstaked and removed
     * @member amountAMin The minimum amount of tokenA that must be received
     * @member amountBMin The minimum amount of tokenB that must be received
     * @member deadline Unix timestamp after which the transaction will revert
     * @member receiverAccount The address of the recipient
     */
    struct RemoveLiqDescriptor {
        uint256 amount;
        uint256 amountAMin;
        uint256 amountBMin;
        uint256 deadline;
        address payable receiverAccount;
    }

    struct DexDescriptor {
        bytes4 selector;
        bytes[] params;
        bool isReplace;
        uint8 index;
        uint16 flag;
    }

    /**
     * @dev A struct containing parameters needed to calculate fees
     * @member feeTo The address of recipient of the fees
     * @member addLiquidityFee The initial fee of Add Liquidity step
     * @member removeLiquidityFee The initial fee of Remove Liquidity step
     * @member stakeFee The initial fee of Stake step
     * @member unstakeFee The initial fee of Unstake step
     * @member dexFee The initial fee of dexes
     * @member aggregatorFee The initial fee of the aggregator
     */
    struct FeeStruct {
        address payable feeTo;
        uint256 addLiquidityFee;
        uint256 removeLiquidityFee;
        uint256 stakeFee;
        uint256 unstakeFee;
        uint256 dexFee;
        uint256 aggregatorFee;
    }

    struct Balances {
        uint256 rewardToken;
        uint256 tokenA;
        uint256 tokenB;
    }

    FeeStruct public feeStruct;

    IERC20Upgradeable public tokenA;
    IERC20Upgradeable public tokenB;
    IWETH public coinWrapper;
    IERC20Upgradeable public pair;
    address public pairFactoryContract;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;

    event Swapped(
        address indexed user,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOut
    );
    event AddedLiquidity(
        address indexed user,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    event Staked(address indexed user, uint256 amount);
    event InvestedByTokenATokenB(
        address indexed user,
        address token,
        uint256 amountA,
        uint256 amountB
    );
    event InvestedByTokenAOrTokenB(
        address indexed user,
        address token,
        uint256 amount
    );
    event InvestedByToken(address indexed user, address token, uint256 amount);
    event InvestedByLP(address indexed user, uint256 amount);
    event Refund(address indexed user, address token, uint256 amount);

    event RemovedLiquidity(
        address indexed user,
        uint256 liquidity,
        uint256 amountA,
        uint256 amountB
    );
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event Left(address indexed user);

    event FeeDeducted(
        address indexed user,
        address token,
        uint256 amount,
        uint256 totalFee
    );
    event WithdrawnFunds(address token, uint256 amount, address receiver);

    event SetSwapContact(address indexed user, address swapContract);
    event SetRouter(address indexed user, address router);
    event SetFee(address indexed user, uint256 feePercentage);
    event SetFeeTo(address indexed user, address feeTo);
    event SetPairFactory(address indexed user, address pair);
    event SetTokens(address indexed user, address tokenA, address tokenB);

    modifier refund(address _userAddress) {
        address _rewardToken = getRewardToken();
        Balances memory beforeBalances;
        if (_rewardToken != address(0)) {
            beforeBalances.rewardToken = IERC20Upgradeable(_rewardToken)
                .balanceOf(address(this));
        }
        beforeBalances.tokenA = tokenA.balanceOf(address(this));
        beforeBalances.tokenB = tokenB.balanceOf(address(this));

        _;

        if (_rewardToken != address(0)) {
            _returnRemainedTokens(
                IERC20Upgradeable(_rewardToken),
                IERC20Upgradeable(_rewardToken).balanceOf(address(this)) -
                    beforeBalances.rewardToken -
                    getNewRewards(),
                _userAddress
            );
        }
        if (address(tokenA) != address(_rewardToken)) {
            _returnRemainedTokens(
                tokenA,
                tokenA.balanceOf(address(this)) - beforeBalances.tokenA,
                _userAddress
            );
        }
        _returnRemainedTokens(
            tokenB,
            tokenB.balanceOf(address(this)) - beforeBalances.tokenB,
            _userAddress
        );
    }

    /**
     * @dev tokenA and tokenB are received
     * @param _userAddress The address of the user
     * @param _amountA The received amount of token A
     * @param _amountB  The received amount of token B
     * @param _addLiquidityDeadline Unix timestamp after which the addLiquidity will revert
     */
    function investByTokenATokenB(
        address _userAddress,
        uint256 _amountA,
        uint256 _amountB,
        uint256 _addLiquidityDeadline
    ) external payable whenNotPaused nonReentrant refund(_userAddress) {
        IERC20Upgradeable _tokenA = tokenA; // gas savings
        IERC20Upgradeable _tokenB = tokenB; // gas savings
        FeeStruct memory _feeStruct = feeStruct; // gas savings

        // Allow investment by coin
        if (msg.value > 0 && address(coinWrapper) != address(0)) {
            coinWrapper.deposit{value: msg.value}();
            address(_tokenA) == address(coinWrapper)
                ? _transferFrom(_tokenB, _amountB)
                : address(_tokenB) == address(coinWrapper)
                ? _transferFrom(_tokenA, _amountA)
                : revert("The opportunity does not include wrapper token");
        } else {
            _transferFrom(_tokenA, _amountA);
            _transferFrom(_tokenB, _amountB);
        }

        emit InvestedByTokenATokenB(
            _userAddress,
            address(_tokenB),
            _amountA,
            _amountB
        );

        uint256 _totalFee = _deductFee(
            2 * (_feeStruct.addLiquidityFee + _feeStruct.stakeFee),
            _tokenB,
            _amountB
        );

        _amountB -= _totalFee;
        AddLiqDescriptor memory _addLiqDescriptor = _getAddLiquidityParameters(
            _amountA,
            _amountB,
            _addLiquidityDeadline
        );
        uint256 _liquidity = _addLiquidity(_addLiqDescriptor);
        _stake(_userAddress, _liquidity);
    }

    /**
     * @dev Only token A is received
     * @param _userAddress The address of the user
     * @param _amount The received amount of token A
     * @param _dexDescriptor The description of dex that swap tokenA-->tokenB should be done through that
     * @param _addLiquidityDeadline Unix timestamp after which the addLiquidity will revert
     */
    function investByTokenA(
        address _userAddress,
        uint256 _amount,
        DexDescriptor memory _dexDescriptor,
        uint256 _addLiquidityDeadline
    ) external payable whenNotPaused nonReentrant refund(_userAddress) {
        IERC20Upgradeable _tokenA = tokenA; // gas savings
        IERC20Upgradeable _tokenB = tokenB; // gas savings
        FeeStruct memory _feeStruct = feeStruct; // gas savings
        uint256 _amountA;
        uint256 _amountB;

        // Allow investment by coin
        if (msg.value > 0 && address(coinWrapper) != address(0)) {
            address(_tokenA) == address(coinWrapper)
                ? coinWrapper.deposit{value: msg.value}()
                : revert(
                    "msg.value is sent but the given token is not a wrapper token"
                );
        } else {
            require(msg.value == 0, "oe03");
            _transferFrom(_tokenA, _amount);
        }

        emit InvestedByTokenAOrTokenB(_userAddress, address(_tokenA), _amount);

        {
            uint256 _amountA2B = _calculateDesiredAmountIn(
                _tokenA,
                _amount,
                _feeStruct.dexFee,
                _feeStruct.aggregatorFee +
                    _feeStruct.addLiquidityFee +
                    _feeStruct.stakeFee
            );
            _amountB = _swap(
                _tokenA,
                _tokenB,
                _amountA2B,
                address(this),
                _dexDescriptor
            );
            _amountA = _amount - _amountA2B;
        }

        {
            uint256 _totalFee = _deductFee(
                _feeStruct.addLiquidityFee + _feeStruct.stakeFee,
                _tokenB,
                _amountB
            );

            _amountB -= _totalFee;
        }

        uint256 _liquidity = _addLiquidity(
            _getAddLiquidityParameters(
                _amountA,
                _amountB,
                _addLiquidityDeadline
            )
        );
        _stake(_userAddress, _liquidity);
    }

    /**
     * @dev Only token B is received
     * @param _userAddress The address of the user
     * @param _amount The received amount of token B
     * @param _dexDescriptor The description of dex that swap tokenB-->tokenA should be done through that
     * @param _addLiquidityDeadline Unix timestamp after which the addLiquidity will revert
     */
    function investByTokenB(
        address _userAddress,
        uint256 _amount,
        DexDescriptor memory _dexDescriptor,
        uint256 _addLiquidityDeadline
    ) external payable whenNotPaused nonReentrant refund(_userAddress) {
        IERC20Upgradeable _tokenA = tokenA; // gas savings
        IERC20Upgradeable _tokenB = tokenB; // gas savings
        FeeStruct memory _feeStruct = feeStruct; // gas savings
        uint256 _amountA;
        uint256 _amountB;

        // Allow investment by coin
        if (msg.value > 0 && address(coinWrapper) != address(0)) {
            address(_tokenB) == address(coinWrapper)
                ? coinWrapper.deposit{value: msg.value}()
                : revert(
                    "msg.value is sent but the given token is not a wrapper token"
                );
        } else {
            require(msg.value == 0, "oe03");
            _transferFrom(_tokenB, _amount);
        }

        emit InvestedByTokenAOrTokenB(_userAddress, address(_tokenB), _amount);

        {
            uint256 _totalFee = _deductFee(
                _feeStruct.addLiquidityFee + _feeStruct.stakeFee,
                _tokenB,
                _amount
            );
            _amountB = _amount - _totalFee;
        }

        {
            uint256 _amountB2A = _calculateDesiredAmountIn(
                _tokenB,
                _amountB,
                _feeStruct.dexFee,
                _feeStruct.aggregatorFee
            );

            _amountA = _swap(
                _tokenB,
                _tokenA,
                _amountB2A,
                address(this),
                _dexDescriptor
            );
            _amountB -= _amountB2A;
        }

        uint256 _liquidity = _addLiquidity(
            _getAddLiquidityParameters(
                _amountA,
                _amountB,
                _addLiquidityDeadline
            )
        );
        _stake(_userAddress, _liquidity);
    }

    /**
     * @dev Any token other than tokenA or tokenB is received
     * @param _userAddress The address of the user
     * @param _token The address of the token to be invested
     * @param _amount The amount of _token to be swapped
     * @param _dexDescriptorB The description of dex that swap token-->tokenB should be done through that
     * @param _dexDescriptorA The description of dex that swap tokenB-->tokenA should be done through that
     */
    function investByToken(
        address _userAddress,
        IERC20Upgradeable _token,
        uint256 _amount,
        DexDescriptor memory _dexDescriptorB,
        DexDescriptor memory _dexDescriptorA,
        uint256 _deadline
    ) external payable whenNotPaused nonReentrant refund(_userAddress) {
        IERC20Upgradeable _tokenA = tokenA; // gas savings
        IERC20Upgradeable _tokenB = tokenB; // gas savings
        FeeStruct memory _feeStruct = feeStruct; // gas savings
        uint256 _amountA;
        uint256 _amountB;
        require(
            _token != _tokenA &&
                _token != _tokenB &&
                (address(coinWrapper) == address(0) || !_token.isETH()),
            "oexxx1 IDENTICAL_ADDRESSES"
        );

        if (_token.isETH()) {
            require(msg.value >= _amount, "oe03");
        } else {
            require(msg.value == 0, "oe03");
            _transferFrom(_token, _amount);
        }

        emit InvestedByToken(_userAddress, address(_token), _amount);

        _amountB = _swap(
            _token,
            _tokenB,
            _amount,
            address(this),
            _dexDescriptorB
        );

        {
            uint256 _totalFee = _deductFee(
                _feeStruct.addLiquidityFee + _feeStruct.stakeFee,
                _tokenB,
                _amountB
            );
            _amountB -= _totalFee;
        }

        {
            uint256 _amountInSwap2 = _calculateDesiredAmountIn(
                _tokenB,
                _amountB,
                _feeStruct.dexFee,
                _feeStruct.aggregatorFee
            );
            _amountA = _swap(
                _tokenB,
                _tokenA,
                _amountInSwap2,
                address(this),
                _dexDescriptorA
            );
            _amountB -= _amountInSwap2;
        }
        {
            AddLiqDescriptor
                memory _addLiqDescriptor = _getAddLiquidityParameters(
                    _amountA,
                    _amountB,
                    _deadline
                );

            _stake(_userAddress, _addLiquidity(_addLiqDescriptor));
        }
    }

    /**
     * @dev LP token is received
     * @param _userAddress The address of the user
     * @param _amountLP The amount of LP token
     */
    function investByLP(
        address _userAddress,
        uint256 _amountLP
    ) external whenNotPaused {
        _transferFrom(pair, _amountLP);

        emit InvestedByLP(_userAddress, _amountLP);

        uint256 _totalFee = _deductFee(feeStruct.stakeFee, pair, _amountLP);
        _amountLP = _amountLP - _totalFee;

        _stake(_userAddress, _amountLP);
    }

    /**
     * @param _removeLiqDescriptor Parameters needed to remove liquidity
     */
    function leave(
        RemoveLiqDescriptor memory _removeLiqDescriptor
    ) external whenNotPaused nonReentrant{
        FeeStruct memory _feeStruct = feeStruct; // gas savings
        (uint256 _amountLP, uint256 _rewards) = _unstake(
            _removeLiqDescriptor.amount
        );
        _removeLiqDescriptor.amount = _amountLP;
        if (_rewards > 0) {
            tokenA.uniTransfer(_removeLiqDescriptor.receiverAccount, _rewards);
        }

        uint256 _totalFee = _deductFee(
            _feeStruct.unstakeFee + _feeStruct.removeLiquidityFee,
            pair,
            _removeLiqDescriptor.amount
        );
        _removeLiqDescriptor.amount -= _totalFee;

        _removeLiquidity(_removeLiqDescriptor);
        emit Left(msg.sender);
    }

    function setFeeTo(address payable _feeTo) external onlyOwner {
        require(_feeTo != address(0), "oe12");
        feeStruct.feeTo = _feeTo;
        emit SetFeeTo(msg.sender, _feeTo);
    }

    function setAddLiquidityFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1e20, "fee percentage is not valid");
        feeStruct.addLiquidityFee = _feePercentage;
        emit SetFee(msg.sender, _feePercentage);
    }

    function setRemoveLiquidityFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1e20, "fee percentage is not valid");
        feeStruct.removeLiquidityFee = _feePercentage;
        emit SetFee(msg.sender, _feePercentage);
    }

    function setStakeFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1e20, "fee percentage is not valid");
        feeStruct.stakeFee = _feePercentage;
        emit SetFee(msg.sender, _feePercentage);
    }

    function setUnstakeFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1e20, "fee percentage is not valid");
        feeStruct.unstakeFee = _feePercentage;
        emit SetFee(msg.sender, _feePercentage);
    }

    function setDexFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1e20, "fee percentage is not valid");
        feeStruct.dexFee = _feePercentage;
    }

    function setAggregatorFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1e20, "fee percentage is not valid");
        feeStruct.aggregatorFee = _feePercentage;
    }

    function setTokenAandTokenB(
        address _tokenA,
        address _tokenB
    ) public onlyOwner {
        require(_tokenA != address(0), "oe12");
        require(_tokenB != address(0), "oe12");
        _tokenA = IERC20Upgradeable(_tokenA).isETH()
            ? address(coinWrapper)
            : _tokenA;
        _tokenB = IERC20Upgradeable(_tokenB).isETH()
            ? address(coinWrapper)
            : _tokenB;

        address _pair = IUniswapV2Factory(pairFactoryContract).getPair(
            _tokenA,
            _tokenB
        );
        require(_pair != address(0), "pair is not valid");
        pair = IERC20Upgradeable(_pair);
        tokenA = IERC20Upgradeable(_tokenA);
        tokenB = IERC20Upgradeable(_tokenB);
        emit SetTokens(msg.sender, _tokenA, _tokenB);
    }

    function setPairFactoryContract(
        address _pairFactoryContract
    ) external onlyOwner {
        require(_pairFactoryContract != address(0), "oe12");
        pairFactoryContract = _pairFactoryContract;
        emit SetPairFactory(msg.sender, _pairFactoryContract);
    }

    function setCoinWrapper(address _coinWrapper) external onlyOwner {
        require(_coinWrapper != address(0), "oe12");
        coinWrapper = IWETH(_coinWrapper);
    }

    function withdrawFunds(
        address _token,
        uint256 _amount,
        address payable _receiver
    ) external nonReentrant onlyOwner {
        IERC20Upgradeable(_token).uniTransfer(_receiver, _amount);
        emit WithdrawnFunds(_token, _amount, _receiver);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}

    /**
     * @dev The method for swapping
     * Each implementation should implement it according to its opportunity
     * @param _fromToken The address of the token to be swapped
     * @param _amount The amount of _fromToken to be swapped
     * @param _data The transaction for the swap
     */
    function swap(
        IERC20Upgradeable _fromToken,
        uint256 _amount,
        bytes memory _data
    ) internal virtual returns (uint256) {
        return 0;
    }

    /**
     * @dev The method for adding liquidity
     * Each implementation should implement it according to its opportunity
     * @param _addLiqDescriptor Parameters needed to add liquidity
     */
    function addLiquidity(
        AddLiqDescriptor memory _addLiqDescriptor
    ) internal virtual returns (uint256, uint256, uint256) {
        return (0, 0, 0);
    }

    /**
     * @dev The method for removing liquidity
     * Each implementation should implement it according to its opportunity
     * @param _removeLiqDescriptor Parameters needed to remove liquidity
     */
    function removeLiquidity(
        RemoveLiqDescriptor memory _removeLiqDescriptor
    ) internal virtual returns (uint256, uint256) {
        return (0, 0);
    }

    /**
     * @dev The method for staking LP tokens
     * Each implementation should implement it according to its opportunity
     * @param _userAddress The address of the user
     * @param _amount The amount of LP tokens
     */
    function stake(address _userAddress, uint256 _amount) internal virtual {}

    /**
     * @dev The method for unstaking/withdrawing LP tokens
     * Each implementation should implement it according to its opportunity
     * @param _amount The amount of LP tokens
     */
    function unstake(
        uint256 _amount
    ) internal virtual returns (uint256, uint256) {
        return (0, 0);
    }

    function _initializeContracts(
        address _tokenA,
        address _tokenB,
        address _pairFactoryContract,
        address _coinWrapper
    ) internal onlyInitializing {
        require(
            _tokenA != address(0) &&
                _tokenB != address(0) &&
                _pairFactoryContract != address(0),
            "oe12"
        );
        OwnableUpgradeable.initialize();
        PausableUpgradeable.__Pausable_init();
        pairFactoryContract = _pairFactoryContract;
        coinWrapper = IWETH(_coinWrapper);
        setTokenAandTokenB(_tokenA, _tokenB);
    }

    function _initializeFees(
        FeeStruct memory _feeStruct
    ) internal onlyInitializing {
        require(
            _feeStruct.addLiquidityFee <= 1e20 &&
                _feeStruct.removeLiquidityFee <= 1e20 &&
                _feeStruct.stakeFee <= 1e20 &&
                _feeStruct.unstakeFee <= 1e20 &&
                _feeStruct.dexFee <= 1e20 &&
                _feeStruct.aggregatorFee <= 1e20,
            "fee percentage is not valid"
        );
        feeStruct = _feeStruct;
    }

    function getRewardToken() internal virtual returns (address) {
        return address(0);
    }

    function getNewRewards() internal virtual returns (uint256) {
        return 0;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _swap(
        IERC20Upgradeable _fromToken,
        IERC20Upgradeable _toToken,
        uint256 _amount,
        address _recieverAddress,
        DexDescriptor memory _dexDescriptor
    ) private returns (uint256 _amountOut) {
        if (_dexDescriptor.isReplace) {
            _dexDescriptor.params[_dexDescriptor.index] = abi.encode(_amount);
        }
        bytes memory _dexData = abi.encodePacked(_dexDescriptor.selector);
        for (uint8 i = 0; i < _dexDescriptor.params.length; ++i) {
            _dexData = abi.encodePacked(_dexData, _dexDescriptor.params[i]);
        }

        bytes memory _aggregatorData = abi.encodeWithSelector(
            ICrowdswapAggregator.swap.selector,
            address(_fromToken),
            address(_toToken),
            _recieverAddress,
            _amount,
            _dexDescriptor.flag,
            _dexData
        );

        uint256 _beforeBalance = _toToken.uniBalanceOf(address(this));
        _amountOut = swap(_fromToken, _amount, _aggregatorData);
        uint256 _afterBalance = _toToken.uniBalanceOf(address(this));
        require(_afterBalance - _beforeBalance == _amountOut, "oe05");
        emit Swapped(
            msg.sender,
            address(_fromToken),
            address(_toToken),
            _amount,
            _amountOut
        );
        return _amountOut;
    }

    function _addLiquidity(
        AddLiqDescriptor memory _addLiqDescriptor
    ) private returns (uint256) {
        uint256 balanceTokenA = tokenA.uniBalanceOf(address(this));
        require(balanceTokenA >= _addLiqDescriptor.amountADesired, "oe13");
        uint256 balanceTokenB = tokenB.uniBalanceOf(address(this));
        require(balanceTokenB >= _addLiqDescriptor.amountBDesired, "oe14");

        uint256 _beforeBalance = pair.uniBalanceOf(address(this));
        (uint256 amountA, uint256 amountB, uint256 liquidity) = addLiquidity(
            _addLiqDescriptor
        );
        require(liquidity > 0, "oe10");
        uint256 _afterBalance = pair.uniBalanceOf(address(this));
        require(_afterBalance - _beforeBalance == liquidity, "oe06");
        emit AddedLiquidity(msg.sender, amountA, amountB, liquidity);
        return liquidity;
    }

    function _removeLiquidity(
        RemoveLiqDescriptor memory _removeLiqDescriptor
    ) private {
        (uint256 amountA, uint256 amountB) = removeLiquidity(
            _removeLiqDescriptor
        );
        emit RemovedLiquidity(
            msg.sender,
            _removeLiqDescriptor.amount,
            amountA,
            amountB
        );
    }

    function _stake(address _userAddress, uint256 _amount) private {
        stake(_userAddress, _amount);
        emit Staked(_userAddress, _amount);
    }

    function _unstake(
        uint256 _amount
    ) private returns (uint256 _amountLP, uint256 _rewards) {
        IERC20Upgradeable _pair = pair; // gas savings
        uint256 _beforeBalance = _pair.uniBalanceOf(address(this));
        (_amountLP, _rewards) = unstake(_amount);
        uint256 _afterBalance = _pair.uniBalanceOf(address(this));
        if (_amountLP > 0) {
            require(_afterBalance - _beforeBalance == _amountLP, "oe08");
        } else {
            _amountLP = _afterBalance - _beforeBalance;
        }
        emit Unstaked(msg.sender, _amountLP, _rewards);
    }

    function _deductFee(
        uint256 _percentage,
        IERC20Upgradeable _token,
        uint256 _amount
    ) private returns (uint256 _totalFee) {
        _totalFee = _calculateFee(_amount, _percentage);
        _token.uniTransfer(feeStruct.feeTo, _totalFee);
        emit FeeDeducted(msg.sender, address(_token), _amount, _totalFee);
    }

    function _calculateFee(
        uint256 _amount,
        uint256 _percentage
    ) private pure returns (uint256) {
        return (_percentage * _amount) / 1 ether / 100;
    }

    function _transferFrom(IERC20Upgradeable _token, uint256 _amount) private {
        uint256 _beforeBalance = _token.uniBalanceOf(address(this));
        _token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _afterBalance = _token.uniBalanceOf(address(this));
        require(_afterBalance - _beforeBalance == _amount, "oe07");
    }

    function _returnRemainedTokens(
        IERC20Upgradeable _token,
        uint256 _amount,
        address _userAddress
    ) private {
        if (_amount <= 0) return;
        if (address(_token) == address(coinWrapper)) {
            coinWrapper.withdraw(_amount);
            (bool success, ) = payable(_userAddress).call{value: _amount}(
                new bytes(0)
            );
            require(success, "ce11");
        } else {
            _token.uniTransfer(payable(_userAddress), _amount);
        }
        emit Refund(_userAddress, address(_token), _amount);
    }

    function _getReserves()
        private
        view
        returns (uint256 _reserveA, uint256 _reserveB)
    {
        IUniswapV2Pair _pair = IUniswapV2Pair(address(pair));
        address token0 = _pair.token0();
        if (token0 == address(tokenA)) {
            (_reserveA, _reserveB, ) = _pair.getReserves();
        } else {
            (_reserveB, _reserveA, ) = _pair.getReserves();
        }
    }

    function _calculateDesiredAmountIn(
        IERC20Upgradeable _token,
        uint256 _amount,
        uint256 _feeIn,
        uint256 _feeOut
    ) private view returns (uint256 _amountDesired) {
        uint256 _j = 1000 - (_feeIn * 10) / 1 ether;
        uint256 _z = 1000 - (_feeOut * 10) / 1 ether;
        (uint256 _reserveTokenA, uint256 _reserveTokenB) = _getReserves();
        uint256 _reserveToken = address(_token) == address(tokenA)
            ? _reserveTokenA
            : _reserveTokenB;

        uint256 _a = _z * _j;
        uint256 _b = (((_z * _j) + 10 ** 6) * _reserveToken) / 10 ** 3;
        uint256 _c = _amount * _reserveToken;

        _amountDesired = ((Math.sqrt(_b ** 2 + 4 * _a * _c) - _b) * 500) / _a;
    }

    function _getAddLiquidityParameters(
        uint _amountA,
        uint _amountB,
        uint256 _deadline
    ) private view returns (AddLiqDescriptor memory _addLiqDescriptor) {
        (uint256 _reserveTokenA, uint256 _reserveTokenB) = _getReserves();
        uint256 _amountTokenADesired = _amountA;
        uint256 _amountTokenBDesired = (_amountTokenADesired * _reserveTokenB) /
            _reserveTokenA;

        if (_amountTokenBDesired > _amountB) {
            //calaculate based on amount B
            _amountTokenBDesired = _amountB;
            _amountTokenADesired =
                (_amountTokenBDesired * _reserveTokenA) /
                _reserveTokenB;
            if (_amountTokenADesired > _amountA) {
                revert("XXXXXXX");
            }
        }

        uint256 _amountTokenBMin = (_amountTokenBDesired * 98) / 100;
        uint256 _amountTokenAMin = (_amountTokenADesired * 98) / 100;

        _addLiqDescriptor.amountADesired = _amountTokenADesired;
        _addLiqDescriptor.amountBDesired = _amountTokenBDesired;
        _addLiqDescriptor.amountAMin = _amountTokenAMin;
        _addLiqDescriptor.amountBMin = _amountTokenBMin;
        _addLiqDescriptor.deadline = _deadline;
    }
}
