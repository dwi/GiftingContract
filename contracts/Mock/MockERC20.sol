// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract MockERC20 is ERC20, Ownable {
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {
    _mint(msg.sender, 10000000 * 10 ** 18);
  }

  function mint(uint256 amount) external {
    _mint(msg.sender, amount);
  }
}
