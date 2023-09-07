// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IRestrictionControl {
  function checkRestriction(
    address user,
    string calldata restriction,
    bytes calldata args
  ) external view returns (bool);

  function isValidRestriction(string memory conditionName) external view returns (bool);
}
