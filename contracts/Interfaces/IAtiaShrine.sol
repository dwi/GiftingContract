// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

interface IAtiaShrine {
  function activateStreak() external;

  function getStreak(address _user) external view returns (uint256 streakAmount, uint256 lastActivated);

  function hasCurrentlyActivated(address _user) external view returns (bool);
}
