// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

// https://github.com/thirdweb-dev/contracts/blob/main/contracts/lib/CurrencyTransferLib.sol
/// @author thirdweb

// Helper interfaces
import {IWRON} from "../Interfaces/IWRON.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library CurrencyTransferLib {
  using SafeERC20 for IERC20;

  /// @dev The address interpreted as native token of the chain.
  address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  error InsufficientBalance(uint256 available, uint256 required);
  error NativeTokenTransferFailed();

  /// @dev Transfers a given amount of currency.
  function transferCurrency(address _currency, address _from, address _to, uint256 _amount) internal {
    if (_amount == 0) {
      return;
    }

    if (_currency == NATIVE_TOKEN) {
      safeTransferNativeToken(_to, _amount);
    } else {
      safeTransferERC20(_currency, _from, _to, _amount);
    }
  }

  /// @dev Transfers a given amount of currency. (With native token wrapping)
  function transferCurrencyWithWrapper(
    address _currency,
    address _from,
    address _to,
    uint256 _amount,
    address _nativeTokenWrapper
  ) internal {
    if (_amount == 0) {
      return;
    }

    if (_currency == NATIVE_TOKEN) {
      if (_from == address(this)) {
        // withdraw from wron then transfer withdrawn native token to recipient
        IWRON(_nativeTokenWrapper).withdraw(_amount);
        safeTransferNativeTokenWithWrapper(_to, _amount, _nativeTokenWrapper);
      } else if (_to == address(this)) {
        // store native currency in wron
        if (_amount > msg.value) revert InsufficientBalance({available: msg.value, required: _amount});
        IWRON(_nativeTokenWrapper).deposit{value: _amount}();
      } else {
        safeTransferNativeTokenWithWrapper(_to, _amount, _nativeTokenWrapper);
      }
    } else {
      safeTransferERC20(_currency, _from, _to, _amount);
    }
  }

  /// @dev Transfer `amount` of ERC20 token from `from` to `to`.
  function safeTransferERC20(address _currency, address _from, address _to, uint256 _amount) internal {
    if (_from == _to) {
      return;
    }

    if (_from == address(this)) {
      IERC20(_currency).safeTransfer(_to, _amount);
    } else {
      IERC20(_currency).safeTransferFrom(_from, _to, _amount);
    }
  }

  /// @dev Transfers `amount` of native token to `to`.
  function safeTransferNativeToken(address to, uint256 value) internal {
    // solhint-disable avoid-low-level-calls
    // slither-disable-next-line low-level-calls
    (bool success, ) = to.call{value: value}("");
    if (!success) revert NativeTokenTransferFailed();
  }

  /// @dev Transfers `amount` of native token to `to`. (With native token wrapping)
  function safeTransferNativeTokenWithWrapper(address to, uint256 value, address _nativeTokenWrapper) internal {
    // solhint-disable avoid-low-level-calls
    // slither-disable-next-line low-level-calls
    (bool success, ) = to.call{value: value}("");
    if (!success) {
      IWRON(_nativeTokenWrapper).deposit{value: value}();
      IERC20(_nativeTokenWrapper).safeTransfer(to, value);
    }
  }
}
