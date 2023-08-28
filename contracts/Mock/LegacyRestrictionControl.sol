// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

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

    conditions["hasBlessingStreak"] = Condition(hasBlessingStreak, true);
  }

  function checkRestriction(address user, string memory id, bytes memory args) public view returns (bool) {
    return conditions[id].conditionFunction(user, args);
  }

  function isValidRestriction(string memory id) public view returns (bool) {
    return conditions[id].exists;
  }

  function hasBlessingStreak(address user, bytes memory args) public view returns (bool) {
    uint256 minAmount = abi.decode(args, (uint256));
    (uint streakAmount, ) = atiaShrineContract.getStreak(user);
    return streakAmount > minAmount;
  }
}
