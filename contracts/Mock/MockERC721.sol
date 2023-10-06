// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MockERC721 is ERC721, Ownable {
  using Counters for Counters.Counter;

  Counters.Counter private _tokenIdCounter;

  constructor(string memory name, string memory symbol, uint amount) ERC721(name, symbol) {
    for (uint256 _i = 1; _i < amount + 1; _i++) {
      safeMint(msg.sender);
    }
  }

  function safeMint(address to) public {
    uint256 tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _safeMint(to, tokenId);
  }

  function mint(uint256 tokenId) public {
    _safeMint(msg.sender, tokenId);
  }

  function batchMint(uint256 from, uint256 amount) public {
    for (uint256 _i = from; _i <= (from + amount); _i++) {
      _safeMint(msg.sender, _i);
    }
  }
}
