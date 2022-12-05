// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockAxie is ERC721 {
  constructor() ERC721("MockAxie", "MAXIE") {}

  function mint(uint256 tokenId) external {
    _mint(msg.sender, tokenId);
  }
}
