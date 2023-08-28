// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IToken {
  function balanceOf(address account) external view returns (uint256);
}
