// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IAtiaShrine} from "../Interfaces/IAtiaShrine.sol";
import {IToken} from "../Interfaces/IToken.sol";
import {IRestrictionControl} from "../Interfaces/IRestrictionControl.sol";

/**
 * @title RestrictionControl
 * @dev Contract for managing restrictions for creating and claiming gifts
 */
contract RestrictionControl is Initializable, IRestrictionControl, ERC165 {
  IAtiaShrine private atiaShrineContract;

  struct Restriction {
    function(address, bytes memory) view returns (bool) conditionFunction;
    bool exists;
  }

  mapping(string => Restriction) internal conditions;

  constructor(address _atiaShrine) {
    atiaShrineContract = IAtiaShrine(_atiaShrine);

    conditions["hasBlessingStatus"] = Restriction(hasBlessingStatus, true);
    conditions["isBlessingActive"] = Restriction(isBlessingActive, true);
    conditions["isBlessingInactive"] = Restriction(isBlessingInactive, true);
    conditions["hasBlessingStreak"] = Restriction(hasBlessingStreak, true);
    conditions["hasRonBalance"] = Restriction(hasRonBalance, true);
    conditions["hasTokenBalance"] = Restriction(hasTokenBalance, true);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IRestrictionControl).interfaceId || super.supportsInterface(interfaceId);
  }

  /**
   * @dev Checks if a user satisfies a specific restriction.
   * @param user The address of the user.
   * @param id The ID of the restriction.
   * @param args Additional arguments for the restriction.
   * @return A boolean indicating if the user satisfies the restriction.
   */
  function checkRestriction(address user, string memory id, bytes memory args) public view returns (bool) {
    return conditions[id].conditionFunction(user, args);
  }

  /**
   * @dev Checks if a restriction with the given ID exists.
   * @param id The ID of the restriction.
   * @return A boolean indicating if the restriction exists.
   */
  function isValidRestriction(string memory id) public view returns (bool) {
    return conditions[id].exists;
  }

  /**
   * @dev Checks if a user has a specific Atia's blessing status.
   * @param user The address of the user.
   * @param args Additional arguments for the restriction.
   * @return A boolean indicating if the user has the requested blessing status.
   */
  function hasBlessingStatus(address user, bytes memory args) public view returns (bool) {
    bool requestedStatus = abi.decode(args, (bool));
    bool blessingStatus = atiaShrineContract.hasCurrentlyActivated(user);
    return blessingStatus == requestedStatus;
  }

  /**
   * @dev Checks if a user's blessing is currently active.
   * @param user The address of the user.
   * @return A boolean indicating if the user's blessing is active.
   */
  function isBlessingActive(address user, bytes memory) public view returns (bool) {
    bool blessingStatus = atiaShrineContract.hasCurrentlyActivated(user);
    return blessingStatus;
  }

  /**
   * @dev Checks if a user's blessing is currently inactive.
   * @param user The address of the user.
   * @return A boolean indicating if the user's blessing is inactive.
   */
  function isBlessingInactive(address user, bytes memory) public view returns (bool) {
    bool blessingStatus = atiaShrineContract.hasCurrentlyActivated(user);
    return !blessingStatus;
  }

  /**
   * @dev Checks if a user has a blessing streak greater than a minimum amount.
   * @param user The address of the user.
   * @param args Additional arguments for the restriction.
   * @return A boolean indicating if the user has a blessing streak greater than the minimum amount.
   */
  function hasBlessingStreak(address user, bytes memory args) public view returns (bool) {
    uint256 minAmount = abi.decode(args, (uint256));
    (uint256 streakAmount, ) = atiaShrineContract.getStreak(user);
    return streakAmount > minAmount;
  }

  /**
   * @dev Checks if a user's balance of RON tokens is greater than a minimum amount.
   * @param user The address of the user.
   * @param args Additional arguments for the restriction.
   * @return A boolean indicating if the user's RON token balance is greater than the minimum amount.
   */
  function hasRonBalance(address user, bytes memory args) public view returns (bool) {
    uint256 minAmount = abi.decode(args, (uint256));
    return user.balance > minAmount;
  }

  /**
   * @dev Checks if a user's balance of a specific token is greater than a minimum amount.
   * @param user The address of the user.
   * @param args Additional arguments for the restriction.
   * @return A boolean indicating if the user's token balance is greater than the minimum amount.
   */
  function hasTokenBalance(address user, bytes memory args) public view returns (bool) {
    (address token, uint256 minAmount) = abi.decode(args, (address, uint256));
    return IToken(token).balanceOf(user) > minAmount;
  }
}
