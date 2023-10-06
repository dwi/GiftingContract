// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

interface IToken {
  function balanceOf(address account) external view returns (uint256);
}
