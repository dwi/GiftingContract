// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract NFTGifts_v1 is ERC721Holder {
  struct Gift {
    // Address of the ERC721 contract
    address tokenAddress;
    // Array of NFT token IDs that are part of this Gift
    uint256[] tokenIDs;
    // Flag to track if the Gift has been claimed
    bool claimed;
    // Flag to track if the Gift has been cancelled
    bool cancelled;
    // Flag to track if the Gift egists at all
    bool exists;
    // Address of the Gift creator
    address creator;
  }
  mapping(bytes32 => Gift) private allGifts;

  // need this to keep index of all gifts so I can easily find unclaimed gifts made by certain address (getUnclaimedGifts)
  bytes32[] public allGiftsIndex;

  event GiftCreated(
    bytes32 _hash,
    address _createdBy,
    address _tokenAddress,
    uint256[] _tokenIDs
  );
  event GiftClaimed(bytes32 _hash, address _claimedBy);
  event GiftCancelled(bytes32 _hash);

  function getGift(
    bytes32 _hashedSecret
  ) public view returns (Gift memory currentGift) {
    currentGift = allGifts[_hashedSecret];
    require(
      currentGift.exists == true && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );
    // TODO: Return only certain items from Gift struct, not everything
    return currentGift;
  }

  function createGift(
    address _tokenAddress,
    uint256[] calldata _tokenIDs,
    bytes32 _secretHash
  ) public {
    // Ensure that the given NFT contract address is valid
    require(
      _tokenAddress != address(0),
      "NFTGifts: Invalid NFT contract address"
    );

    // Ensure that the given passcode is not empty
    require(_secretHash.length > 0, "NFTGifts: Invalid secret code");
    require(
      allGifts[_secretHash].exists == false,
      "NFTGifts: Secret code already used"
    );

    // Transfer NFTs to smart contract
    for (uint256 _i = 0; _i < _tokenIDs.length; _i++) {
      ERC721(_tokenAddress).safeTransferFrom(
        msg.sender,
        address(this),
        _tokenIDs[_i]
      );
    }

    allGiftsIndex.push(_secretHash);

    // Save the gift information

    // this uses more gas than the other thing
    // allGifts[_secretHash] = Gift({
    //   tokenAddress: _tokenAddress,
    //   tokenIDs: _tokenIDs,
    //   claimed: false,
    //   cancelled: false,
    //   exists: true,
    //   creator: msg.sender
    // });

    allGifts[_secretHash].creator = msg.sender;
    allGifts[_secretHash].tokenAddress = _tokenAddress;
    allGifts[_secretHash].tokenIDs = _tokenIDs;
    allGifts[_secretHash].claimed = false;
    allGifts[_secretHash].cancelled = false;
    allGifts[_secretHash].exists = true;

    emit GiftCreated(_secretHash, msg.sender, _tokenAddress, _tokenIDs);
  }

  function createGifts(
    address[] calldata _tokenAddress,
    uint256[][] calldata _tokenIDs,
    bytes32[] calldata _secretHash
  ) public {
    require(
      _secretHash.length == _tokenIDs.length &&
        _secretHash.length == _tokenAddress.length,
      "NFTGifts: Arrays must be of the same length"
    );
    for (uint256 _i = 0; _i < _secretHash.length; _i++) {
      createGift(_tokenAddress[_i], _tokenIDs[_i], _secretHash[_i]);
    }
  }

  function claimGift(bytes32 _hashedSecret, bytes memory _signature) public {
    Gift memory currentGift = allGifts[_hashedSecret];
    require(
      currentGift.exists == true && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );
    require(
      currentGift.claimed == false,
      "NFTGifts: Gift has already been claimed"
    );

    address _receiverFromSig = getSigner(_hashedSecret, _signature);
    require(
      currentGift.creator != _receiverFromSig,
      "NFTGifts: Cannot claim your own gift"
    );

    // Transfer NFTs to recipient
    for (uint256 i = 0; i < currentGift.tokenIDs.length; i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(
        address(this),
        _receiverFromSig,
        currentGift.tokenIDs[i]
      );
    }

    // Mark Gift as claimed for tracking
    allGifts[_hashedSecret].claimed = true;

    emit GiftClaimed(_hashedSecret, _receiverFromSig);
  }

  function getUnclaimedGifts()
    public
    view
    returns (Gift[] memory unclaimedGifts)
  {
    Gift[] memory GiftsTemp = new Gift[](allGiftsIndex.length);
    uint256 count;
    for (uint _i = 0; _i < allGiftsIndex.length; _i++) {
      if (
        allGifts[allGiftsIndex[_i]].creator == msg.sender &&
        !allGifts[allGiftsIndex[_i]].claimed &&
        !allGifts[allGiftsIndex[_i]].cancelled
      ) {
        GiftsTemp[count] = allGifts[allGiftsIndex[_i]];
        count += 1;
      }
    }

    // TODO: Return only certain items from Gift struct, not everything
    unclaimedGifts = new Gift[](count);
    for (uint256 _i = 0; _i < count; _i++) {
      unclaimedGifts[_i] = GiftsTemp[_i];
    }
  }

  function cancelGift(bytes32 _hashedSecret) public {
    Gift memory currentGift = allGifts[_hashedSecret];
    require(
      currentGift.cancelled == false,
      "NFTGifts: The gift has been already cancelled"
    );
    require(currentGift.exists == true, "NFTGifts: Invalid secret code");
    require(
      currentGift.creator == msg.sender,
      "NFTGifts: Only gift creator can cancel the gift"
    );
    require(
      currentGift.claimed == false,
      "NFTGifts: The gift has already been redeemed"
    );

    // Transfer NFTs back to Gift creator
    for (uint256 _i = 0; _i < currentGift.tokenIDs.length; _i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(
        address(this),
        currentGift.creator,
        currentGift.tokenIDs[_i]
      );
    }

    // Delete Gift from mapping (or should we use .deleted like .claimed?)
    allGifts[_hashedSecret].cancelled = true;
    emit GiftCancelled(_hashedSecret);
  }

  function hash(string memory _string) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_string));
  }

  function getGiftSignature(
    string calldata _plainSecret
  ) public view returns (bytes32) {
    bytes32 hashedSecret = hash(_plainSecret);
    Gift memory currentGift = allGifts[hashedSecret];
    require(
      currentGift.exists == true && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );

    require(
      currentGift.claimed == false,
      "NFTGifts: Gift has already been claimed"
    );
    require(
      currentGift.creator != msg.sender,
      "NFTGifts: Cannot claim your own gift"
    );

    return getGiftSignatureInternal(hashedSecret);
    //return keccak256(abi.encodePacked(_GiftID, hashedSecret));
  }

  function getGiftSignatureInternal(
    bytes32 _hashedSecret
  ) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(_hashedSecret));
  }

  function getSigner(
    bytes32 _hashedSecret,
    bytes memory _signature
  ) public view returns (address) {
    //bytes32 messageHash = keccak256(abi.encodePacked(_GiftID, allGifts[_GiftID].encryptedCodeHash));
    bytes32 messageHash = getGiftSignatureInternal(_hashedSecret);
    bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
    address claimer = ECDSA.recover(ethSignedMessageHash, _signature);
    require(
      allGifts[_hashedSecret].creator != claimer,
      "NFTGifts: Cannot claim your own gift"
    );
    return claimer;
  }
}
