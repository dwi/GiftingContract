// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

contract MockAtiaShrine {
  mapping(address => bool) internal active;

  function activateStreak() external {
    active[msg.sender] = true;
  }

  function getStreak(address) external view returns (uint256 _streakAmount, uint256 _lastActivated) {
    return (42, block.timestamp);
  }

  function hasCurrentlyActivated(address _user) external view returns (bool) {
    return active[_user];
  }
}
