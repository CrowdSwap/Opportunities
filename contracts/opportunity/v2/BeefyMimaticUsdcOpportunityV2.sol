// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./OpportunityV2.sol";
import "../../libraries/UniERC20Upgradeable.sol";
import "../../interfaces/IUniswapV2Router02.sol";
import "../../interfaces/IBeefyVault.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title mimatic/usdc Opportunity
 * @notice The contract is used to add/remove liquidity in mimatic/usdc pool and
 * stake/unstake the corresponding LP token
 */
contract BeefyMimaticUsdcOpportunityV2 is OpportunityV2 {
    using UniERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public swapContract;
    IUniswapV2Router02 public router;
    IBeefyVault public vault;

    event SetVault(address indexed user, address vault);

    /**
     * @dev The contract constructor
     * @param _tokenMimatic The address of the MIM token
     * @param _tokenUsdc The address of the USDC token
     * @param _pairFactoryContract The address of the dex's factory
     * @param _feeStruct Parameters needed for fee
     * @param _swapContract The address of the CrowdSwap Swap Contract
     * @param _router The address of the QuickSwap Router Contract
     * @param _vault The address of the Stake LP Contract
     */
    function initialize(
        address _tokenMimatic,
        address _tokenUsdc,
        address _pairFactoryContract,
        FeeStruct memory _feeStruct,
        address _swapContract,
        address _router,
        address _vault,
        address _coinWrapper
    ) public initializer {
        OpportunityV2._initializeContracts(
            _tokenMimatic,
            _tokenUsdc,
            _pairFactoryContract,
            _coinWrapper
        );
        OpportunityV2._initializeFees(_feeStruct);
        swapContract = _swapContract;
        router = IUniswapV2Router02(_router);
        vault = IBeefyVault(_vault);
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

    function setVault(address _address) external onlyOwner {
        require(_address != address(0), "oe12");
        vault = IBeefyVault(_address);
        emit SetVault(msg.sender, _address);
    }

    function swap(
        IERC20Upgradeable _fromToken,
        uint256 _amount,
        bytes memory _data
    ) internal override returns (uint256) {
        // gas savings
        address _swapContract = swapContract;
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
        // gas savings
        IUniswapV2Router02 _router = router;
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
            _router.removeLiquidity(
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
        IBeefyVault _vault = vault; // gas savings
        pair.uniApprove(address(_vault), _amount);
        _vault.deposit(_amount);
        IERC20Upgradeable(_vault).safeTransfer(
            _userAddress,
            _vault.balanceOf(address(this))
        );
    }

    function unstake(
        uint256 _amount
    ) internal override returns (uint256, uint256) {
        IBeefyVault _vault = vault; // gas savings
        IERC20Upgradeable(_vault).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        _vault.withdraw(_amount);
        return (0, 0);
    }
}
