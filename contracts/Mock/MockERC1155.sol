// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
  constructor(string memory name) ERC1155(name) {}

  function mint(address account, uint256 id, uint256 amount) external {
    _mint(account, id, amount, "");
  }

  function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts) external {
    _mintBatch(to, ids, amounts, "");
  }
}
