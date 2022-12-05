// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Gifts is ERC721Holder {
  struct Gift {
    uint256 giftID;
    // Address of the ERC721 contract
    address tokenAddress;
    // Array of NFT token IDs that are part of this gift
    uint256[] tokenIDs;
    // Encrypted secret code used for claiming this gift
    bytes32 encryptedCodeHash;
    // Flag to track if the gift has been claimed
    bool claimed;
    // Address of the gift creator
    address creator;
  }

  mapping(uint256 => Gift) private _gifts;

  uint256 private _giftIDCounter;

  event GiftCreated(
    uint256 giftID,
    address _createdBy,
    address _tokenAddress,
    uint256[] _tokenIDs
  );
  event GiftClaimed(uint256 giftID, address _claimedBy);
  event GiftCancelled(uint256 giftID);

  function getGift(
    uint256 _giftID
  ) public view returns (Gift memory unclaimedGifts) {
    require(_gifts[_giftID].giftID > 0, "Gift does not exist");
    unclaimedGifts = _gifts[_giftID];
    return unclaimedGifts;
  }

  function createGift(
    address _tokenAddress,
    uint256[] calldata _tokenIDs,
    bytes32 _secretHash
  ) public {
    // Ensure that the given NFT contract address is valid
    require(_tokenAddress != address(0), "Invalid NFT contract address");

    // Ensure that the given passcode is not empty
    require(_secretHash.length > 0, "Invalid passcode");

    // Transfer NFTs to smart contract
    for (uint256 _i = 0; _i < _tokenIDs.length; _i++) {
      ERC721(_tokenAddress).safeTransferFrom(
        msg.sender,
        address(this),
        _tokenIDs[_i]
      );
    }
    // Generate a unique gift ID
    _giftIDCounter++;
    uint256 giftID = _giftIDCounter;

    // Save the gift information
    _gifts[giftID] = Gift({
      giftID: giftID,
      tokenAddress: _tokenAddress,
      tokenIDs: _tokenIDs,
      encryptedCodeHash: _secretHash,
      claimed: false,
      creator: msg.sender
    });

    emit GiftCreated(giftID, msg.sender, _tokenAddress, _tokenIDs);
  }

  function claimGift(uint256 _giftID, bytes memory signature) public {
    require(_gifts[_giftID].giftID > 0, "Gift does not exist");
    require(_gifts[_giftID].claimed == false, "Gift has already been claimed");

    address _receiverFromSig = getSigner(_giftID, signature);
    require(
      _gifts[_giftID].creator != _receiverFromSig,
      "Cannot claim your own gift"
    );

    // Transfer NFTs to recipient
    for (uint256 i = 0; i < _gifts[_giftID].tokenIDs.length; i++) {
      ERC721(_gifts[_giftID].tokenAddress).safeTransferFrom(
        address(this),
        _receiverFromSig,
        _gifts[_giftID].tokenIDs[i]
      );
    }

    // Mark gift as claimed for tracking
    _gifts[_giftID].claimed = true;

    emit GiftClaimed(_giftID, _receiverFromSig);
  }

  function getUnclaimedGifts()
    public
    view
    returns (Gift[] memory unclaimedGifts)
  {
    Gift[] memory giftsTemp = new Gift[](_giftIDCounter);
    uint256 count;
    for (uint256 _i = 1; _i <= _giftIDCounter; _i++) {
      if (_gifts[_i].creator == msg.sender && !_gifts[_i].claimed) {
        giftsTemp[count] = _gifts[_i];
        count += 1;
      }
    }

    unclaimedGifts = new Gift[](count);
    for (uint256 _i = 0; _i < count; _i++) {
      unclaimedGifts[_i] = giftsTemp[_i];
    }
  }

  function cancelGift(uint256 giftID) public {
    // Check if gift exists and has not been claimed
    require(
      _gifts[giftID].giftID > 0,
      "Gift does not exist and cannot be cancelled"
    );
    require(
      _gifts[giftID].creator == msg.sender,
      "Only gift creator can cancel the gift"
    );
    require(
      _gifts[giftID].claimed == false,
      "Gift has already been claimed or does not exist and cannot be cancelled"
    );

    // Transfer NFTs back to gift creator
    for (uint256 _i = 0; _i < _gifts[giftID].tokenIDs.length; _i++) {
      ERC721(_gifts[giftID].tokenAddress).safeTransferFrom(
        address(this),
        _gifts[giftID].creator,
        _gifts[giftID].tokenIDs[_i]
      );
    }

    // Delete gift from mapping (or should we use .deleted like .claimed?)
    delete _gifts[giftID];
    emit GiftCancelled(giftID);
  }

  function hash(string memory _string) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_string));
  }

  function getGiftSignature(
    uint256 _giftID,
    string calldata _plainSecret
  ) public view returns (bytes32) {
    require(_gifts[_giftID].giftID > 0, "Gift does not exist");
    require(_gifts[_giftID].claimed == false, "Gift has already been claimed");
    require(
      _gifts[_giftID].creator != msg.sender,
      "Cannot claim your own gift"
    );
    bytes32 hashedSecret = hash(_plainSecret);
    require(
      hashedSecret == _gifts[_giftID].encryptedCodeHash,
      "Incorrect secret code"
    );
    return getGiftSignatureInternal(_giftID, hashedSecret);
    //return keccak256(abi.encodePacked(_giftID, hashedSecret));
  }

  function getGiftSignatureInternal(
    uint256 _giftID,
    bytes32 _hashedSecret
  ) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(_giftID, _hashedSecret));
  }

  function getSigner(
    uint256 _giftID,
    bytes memory signature
  ) public view returns (address) {
    require(_gifts[_giftID].giftID > 0, "Gift does not exist");
    require(_gifts[_giftID].claimed == false, "Gift has already been claimed");
    require(
      _gifts[_giftID].creator != msg.sender,
      "OBSOLETE Cannot claim your own gift"
    );

    //bytes32 messageHash = keccak256(abi.encodePacked(_giftID, _gifts[_giftID].encryptedCodeHash));
    bytes32 messageHash = getGiftSignatureInternal(_giftID, _gifts[_giftID].encryptedCodeHash);
    bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
    address claimer = ECDSA.recover(ethSignedMessageHash, signature);
    require(_gifts[_giftID].creator != claimer, "Cannot claim your own gift");
    return claimer;
  }

// no need for following, got it from ECDSA.sol

  // function getEthSignedMessageHash(
  //   bytes32 _messageHash
  // ) private pure returns (bytes32) {
  //   return
  //     keccak256(
  //       abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
  //     );
  // }

  // function recoverSigner(
  //   bytes32 _ethSignedMessageHash,
  //   bytes memory _signature
  // ) public pure returns (address) {
  //   (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
  //   return ecrecover(_ethSignedMessageHash, v, r, s);
  // }

  // function splitSignature(
  //   bytes memory sig
  // ) private pure returns (bytes32 r, bytes32 s, uint8 v) {
  //   require(sig.length == 65, "invalid signature length");
  //   assembly {
  //     r := mload(add(sig, 32))
  //     s := mload(add(sig, 64))
  //     v := byte(0, mload(add(sig, 96)))
  //   }
  // }
}
