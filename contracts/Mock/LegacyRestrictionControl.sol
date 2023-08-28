// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

import "../Interfaces/IAtiaShrine.sol";
import "../Interfaces/IToken.sol";

contract LegacyRestrictionControl is Initializable {
  IAtiaShrine private atiaShrineContract;

  struct Condition {
    function(address, bytes memory) view returns (bool) conditionFunction;
    bool exists;
  }

  mapping(string => Condition) internal conditions;

  constructor(address _atiaShrine) {
    atiaShrineContract = IAtiaShrine(_atiaShrine);

    conditions["isBlessingActive"] = Condition(isBlessingActive, true);
    conditions["isBlessingInactive"] = Condition(isBlessingInactive, true);
    conditions["hasBlessingStreak"] = Condition(hasBlessingStreak, true);
    conditions["hasTxCount"] = Condition(hasRonBalance, true);
    conditions["hasTokenBalance"] = Condition(hasTokenBalance, true);
  }

  function checkRestriction(address user, string memory id, bytes memory args) public view returns (bool) {
    return conditions[id].conditionFunction(user, args);
  }

  function isValidRestriction(string memory id) public view returns (bool) {
    return conditions[id].exists;
  }

  function isBlessingActive(address user, bytes memory) public view returns (bool) {
    bool isActive = atiaShrineContract.hasCurrentlyActivated(user);
    return isActive;
  }

  function isBlessingInactive(address user, bytes memory) public view returns (bool) {
    bool isActive = atiaShrineContract.hasCurrentlyActivated(user);
    return !isActive;
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
