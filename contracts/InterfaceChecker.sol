// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC1155} from "@openzeppelin/contracts/interfaces/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/interfaces/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./Interfaces/IRestrictionControl.sol";

/**
 * @title InterfaceChecker
 * @dev Library for checking interface support
 */
library InterfaceChecker {
  /**
   * @dev Checks if the given address supports the IRestrictionControl interface.
   * @param check The address to check.
   * @return A boolean indicating if the address supports the IRestrictionControl interface.
   */
  function isRestrictionControl(address check) internal view returns (bool) {
    try IERC165(check).supportsInterface(type(IRestrictionControl).interfaceId) returns (bool isController) {
      return isController;
    } catch {
      return false;
    }
  }

  /**
   * @dev Checks if the given address supports the IERC1155 interface.
   * @param check The address to check.
   * @return A boolean indicating if the address supports the IERC1155 interface.
   */
  function isERC1155(address check) internal view returns (bool) {
    try IERC165(check).supportsInterface(type(IERC1155).interfaceId) returns (bool is1155) {
      return is1155;
    } catch {
      return false;
    }
  }

  /**
   * @dev Checks if the given address supports the IERC721 interface.
   * @param check The address to check.
   * @return A boolean indicating if the address supports the IERC721 interface.
   */
  function isERC721(address check) internal view returns (bool) {
    try IERC165(check).supportsInterface(type(IERC721).interfaceId) returns (bool is721) {
      return is721;
    } catch {
      return false;
    }
  }

  /**
   * @dev Checks if the given address supports the IERC20 interface.
   * @param check The address to check.
   * @return A boolean indicating if the address supports the IERC20 interface.
   */
  function isERC20(address check) internal view returns (bool) {
    if (isERC721(check)) {
      return false;
    }

    try IERC20(check).balanceOf(address(0)) returns (uint256) {
      return true;
    } catch {
      return false;
    }
  }
}
