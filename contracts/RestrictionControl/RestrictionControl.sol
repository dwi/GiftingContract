// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "../Interfaces/IAtiaShrine.sol";
import "../Interfaces/IToken.sol";
import "../Interfaces/IRestrictionControl.sol";

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
    conditions["hasTxCount"] = Restriction(hasRonBalance, true);
    conditions["hasTokenBalance"] = Restriction(hasTokenBalance, true);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IRestrictionControl).interfaceId || super.supportsInterface(interfaceId);
  }

  function checkRestriction(address user, string memory id, bytes memory args) public view returns (bool) {
    return conditions[id].conditionFunction(user, args);
  }

  function isValidRestriction(string memory id) public view returns (bool) {
    return conditions[id].exists;
  }

  function hasBlessingStatus(address user, bytes memory args) public view returns (bool) {
    bool requestedStatus = abi.decode(args, (bool));
    bool blessingStatus = atiaShrineContract.hasCurrentlyActivated(user);
    return blessingStatus == requestedStatus;
  }

  function isBlessingActive(address user, bytes memory) public view returns (bool) {
    bool blessingStatus = atiaShrineContract.hasCurrentlyActivated(user);
    return blessingStatus;
  }

  function isBlessingInactive(address user, bytes memory) public view returns (bool) {
    bool blessingStatus = atiaShrineContract.hasCurrentlyActivated(user);
    return !blessingStatus;
  }

  function hasBlessingStreak(address user, bytes memory args) public view returns (bool) {
    uint256 minAmount = abi.decode(args, (uint256));
    (uint streakAmount, ) = atiaShrineContract.getStreak(user);
    return streakAmount > minAmount;
  }

  function hasRonBalance(address user, bytes memory args) public view returns (bool) {
    uint256 minAmount = abi.decode(args, (uint256));
    return user.balance > minAmount;
  }

  function hasTokenBalance(address user, bytes memory args) public view returns (bool) {
    (address token, uint256 minAmount) = abi.decode(args, (address, uint256));
    return IToken(token).balanceOf(user) > minAmount;
  }
}
