// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

interface IWRON {
  function deposit() external payable;

  function withdraw(uint256 amount) external;

  function transfer(address to, uint256 value) external returns (bool);
}
