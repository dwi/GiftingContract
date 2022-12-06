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
    // Address of the Gift creator
    address creator;
  }

  struct GiftPublic {
    address tokenAddress;
    uint256[] tokenIDs;
    bool claimed;
    address creator;
  }

  mapping(bytes32 => Gift) private allGifts;

  // need this to keep index of all gifts so I can easily find unclaimed gifts made by certain address (getUnclaimedGifts)
  bytes32[] public allGiftsIndex;

  event GiftCreated(
    bytes32 indexed _hash,
    address indexed _createdBy,
    address _tokenAddress,
    uint256[] _tokenIDs
  );
  event GiftClaimed(bytes32 indexed _hash, address _claimedBy);
  event GiftCancelled(bytes32 indexed _hash);

  function getGift(
    bytes32 _hashedSecret
  ) external view returns (GiftPublic memory) {
    Gift memory currentGift = allGifts[_hashedSecret];
    require(
      currentGift.creator != address(0) && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );

    return stripGift(currentGift);
  }

  function stripGift(
    Gift memory _gift
  ) private pure returns (GiftPublic memory) {
    return
      GiftPublic(
        _gift.tokenAddress,
        _gift.tokenIDs,
        _gift.claimed,
        _gift.creator
      );
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

    // make sure creator is 0x
    require(
      allGifts[_secretHash].creator == address(0),
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
    //   creator: msg.sender
    // });

    allGifts[_secretHash].creator = msg.sender;
    allGifts[_secretHash].tokenAddress = _tokenAddress;
    allGifts[_secretHash].tokenIDs = _tokenIDs;
    allGifts[_secretHash].claimed = false;
    allGifts[_secretHash].cancelled = false;

    emit GiftCreated(_secretHash, msg.sender, _tokenAddress, _tokenIDs);
  }

  function createGifts(
    address[] calldata _tokenAddress,
    uint256[][] calldata _tokenIDs,
    bytes32[] calldata _secretHash
  ) external {
    require(
      _secretHash.length == _tokenIDs.length &&
        _secretHash.length == _tokenAddress.length,
      "NFTGifts: Arrays must be of the same length"
    );
    for (uint256 _i = 0; _i < _secretHash.length; _i++) {
      createGift(_tokenAddress[_i], _tokenIDs[_i], _secretHash[_i]);
    }
  }

  function claimGift(bytes32 _hashedSecret, bytes calldata _signature) external {
    Gift memory currentGift = allGifts[_hashedSecret];
    require(
      currentGift.creator != address(0) && currentGift.cancelled == false,
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
    for (uint256 _i = 0; _i < currentGift.tokenIDs.length; _i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(
        address(this),
        _receiverFromSig,
        currentGift.tokenIDs[_i]
      );
    }

    // Mark Gift as claimed for tracking
    allGifts[_hashedSecret].claimed = true;

    emit GiftClaimed(_hashedSecret, _receiverFromSig);
  }

  // TODO: Is there a better way to handle this?
  function getUnclaimedGifts()
    external
    view
    returns (GiftPublic[] memory unclaimedGifts)
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

    unclaimedGifts = new GiftPublic[](count);
    for (uint256 _i = 0; _i < count; _i++) {
      unclaimedGifts[_i] = stripGift(GiftsTemp[_i]);
    }
  }

  function cancelGift(bytes32 _hashedSecret) external {
    Gift memory currentGift = allGifts[_hashedSecret];
    require(
      currentGift.cancelled == false,
      "NFTGifts: The gift has been already cancelled"
    );
    require(currentGift.creator != address(0), "NFTGifts: Invalid secret code");
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

    // Mark gift as cancelled
    allGifts[_hashedSecret].cancelled = true;
    emit GiftCancelled(_hashedSecret);
  }

  function getGiftSignature(
    string calldata _plainSecret
  ) external view returns (bytes32) {
    bytes32 hashedSecret = keccak256(abi.encodePacked(_plainSecret));
    Gift memory currentGift = allGifts[hashedSecret];
    require(
      currentGift.creator != address(0) && currentGift.cancelled == false,
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

    return keccak256(abi.encodePacked(hashedSecret));
  }

  function getSigner(
    bytes32 _hashedSecret,
    bytes calldata _signature
  ) private view returns (address) {
    bytes32 messageHash = keccak256(abi.encodePacked(_hashedSecret));
    bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
    address claimer = ECDSA.recover(ethSignedMessageHash, _signature);
    require(
      allGifts[_hashedSecret].creator != claimer,
      "NFTGifts: Cannot claim your own gift"
    );
    return claimer;
  }
}
