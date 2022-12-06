// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title NFT Gifts Smart Contract
 * @author dw
 *
 * @dev Allows trustlessly give ERC721 gifts to not yet known recepients.
 *
 */
contract NFTGifts_v1 is ERC721Holder {
  struct Gift {
    address tokenAddress; // Address of the ERC721 contract
    uint256[] tokenIDs; // Array of NFT token IDs that are part of this Gift
    bool claimed; // Flag to track if the Gift has been claimed
    bool cancelled; // Flag to track if the Gift has been cancelled
    address creator; // Address of the Gift creator
  }

  struct GiftPublic {
    address tokenAddress; // Address of the ERC721 contract
    uint256[] tokenIDs; // Array of NFT token IDs that are part of this Gift
    bool claimed; // Flag to track if the Gift has been claimed
    address creator; // Address of the Gift creator
  }

  mapping(bytes32 => Gift) private allGifts; // Mapping from secret hash to gift information

  // need this to keep index of all gifts so I can easily find unclaimed gifts made by certain address (getUnclaimedGifts)
  bytes32[] public allGiftsIndex;

  /**
   * @dev Event emitted when a new gift is created
   */
  event GiftCreated(
    bytes32 indexed _hash,
    address indexed _createdBy,
    address _tokenAddress,
    uint256[] _tokenIDs
  );

  /**
   * @dev Event emitted when a gift is claimed
   */
  event GiftClaimed(bytes32 indexed _hash, address _claimedBy);

  /**
   * @dev Event emitted when a gift is cancelled
   */
  event GiftCancelled(bytes32 indexed _hash);

  /**
   * @dev Create a new gift
   *
   * Requirements:
   * - ERC721 Token address is valid
   * - This contract is approved on token contract
   * - valid and unused _hashedSecret
   *
   * @param _tokenAddress ERC721 Token address
   * @param _tokenIDs An array of token IDs
   * @param _hashedSecret Sharing "code" hashed by keccak256
   *
   */
  function createGift(
    address _tokenAddress,
    uint256[] calldata _tokenIDs,
    bytes32 _hashedSecret
  ) public {
    // Ensure that the given NFT contract address is valid
    require(
      _tokenAddress != address(0),
      "NFTGifts: Invalid NFT contract address"
    );

    // Ensure that the given passcode is not empty
    require(_hashedSecret.length > 0, "NFTGifts: Invalid secret code");

    // make sure creator is 0x
    require(
      allGifts[_hashedSecret].creator == address(0),
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

    allGiftsIndex.push(_hashedSecret);

    // Save the gift information

    // this uses more gas than the other thing

    // allGifts[_hashedSecret] = Gift({
    //   tokenAddress: _tokenAddress,
    //   tokenIDs: _tokenIDs,
    //   claimed: false,
    //   cancelled: false,
    //   creator: msg.sender
    // });

    allGifts[_hashedSecret].creator = msg.sender;
    allGifts[_hashedSecret].tokenAddress = _tokenAddress;
    allGifts[_hashedSecret].tokenIDs = _tokenIDs;
    allGifts[_hashedSecret].claimed = false;
    allGifts[_hashedSecret].cancelled = false;

    emit GiftCreated(_hashedSecret, msg.sender, _tokenAddress, _tokenIDs);
  }

  /**
   * @dev Create multiple new gifts in one transaction
   
   * Requirements:
   * - Array sizes has to match
   * 
   * @param _tokenAddress Array of ERC721 Token addresses
   * @param _tokenIDs Array of arrays of token IDs
   * @param _hashedSecret Array of sharing "codes" hashed by keccak256
   *
   */
  function createGifts(
    address[] calldata _tokenAddress,
    uint256[][] calldata _tokenIDs,
    bytes32[] calldata _hashedSecret
  ) external {
    require(
      _hashedSecret.length == _tokenIDs.length &&
        _hashedSecret.length == _tokenAddress.length,
      "NFTGifts: Arrays must be of the same length"
    );
    for (uint256 _i = 0; _i < _hashedSecret.length; _i++) {
      createGift(_tokenAddress[_i], _tokenIDs[_i], _hashedSecret[_i]);
    }
  }

  /**
   * @dev Retrieves the public information of a gift by hashed secret code.
   *
   * @param _hashedSecret Sharing "code" hashed by keccak256
   * @return The public information of the gift ([tokenAddress, tokenIDs, claimed, creator])
   *
   */
  function getGift(
    bytes32 _hashedSecret
  ) external view returns (GiftPublic memory) {
    // Retrieve the current gift from the mapping.
    Gift memory currentGift = allGifts[_hashedSecret];

    // Check if the gift exists and has not been cancelled.
    require(
      currentGift.creator != address(0) && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );

    // Return a stripped version of the gift that only contains public information.
    return stripGift(currentGift);
  }

  /**
   * @dev Strips a gift of any sensitive/useless information
   *
   * @param _gift The gift to be stripped.
   * @return GiftPublic structure
   */
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

  /**
   * @dev Claims a gift using its secret and a signed message from the recipient.
   *    
   * Requirements:
   * - Valid _hashedSecret and user _signature of unclaimed gift
   * 
   * @param _hashedSecret Sharing "code" hashed by keccak256
   * @param _signature The signed message from the recipient of the gift.
   */
  function claimGift(
    bytes32 _hashedSecret,
    bytes calldata _signature
  ) external {
    // Retrieve the current gift from the mapping.
    Gift memory currentGift = allGifts[_hashedSecret];

    // Check if the gift exists, has not been cancelled, and has not been claimed.
    require(
      currentGift.creator != address(0) && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );
    require(
      currentGift.claimed == false,
      "NFTGifts: Gift has already been claimed"
    );

    // Verify that the recipient of the gift is the same as the signer of the message.
    address _receiverFromSig = getSigner(_hashedSecret, _signature);
    require(
      currentGift.creator != _receiverFromSig,
      "NFTGifts: Cannot claim your own gift"
    );

    // Transfer NFTs to the recipient of the gift.
    for (uint256 _i = 0; _i < currentGift.tokenIDs.length; _i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(
        address(this),
        _receiverFromSig,
        currentGift.tokenIDs[_i]
      );
    }

    // Mark the gift as claimed
    allGifts[_hashedSecret].claimed = true;

    emit GiftClaimed(_hashedSecret, _receiverFromSig);
  }

  /**
   * @dev Get all unclaimed gifts created by a given address
   *
   * @return The list of all unclaimed gifts for caller's address in its public form
   *
   */
  function getUnclaimedGifts() external view returns (GiftPublic[] memory) {
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

    GiftPublic[] memory unclaimedGifts = new GiftPublic[](count);
    for (uint256 _i = 0; _i < count; _i++) {
      unclaimedGifts[_i] = stripGift(GiftsTemp[_i]);
    }
    return unclaimedGifts;
  }

  /**
   * @dev Cancel a gift created by a caller
   * 
   * Requirements:
   * - Valid _hashedSecret of unclaimed active gift
   * 
   * @param _hashedSecret Sharing "code" hashed by keccak256
   *
   */
  function cancelGift(bytes32 _hashedSecret) external {
    // Retrieve the current gift from the mapping.
    Gift memory currentGift = allGifts[_hashedSecret];
    // Ensure that the gift exists and has not been claimed or cancelled
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
      "NFTGifts: The gift has already been claimed"
    );

    // Transfer the NFTs back to the gift creator
    for (uint256 _i = 0; _i < currentGift.tokenIDs.length; _i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(
        address(this),
        currentGift.creator,
        currentGift.tokenIDs[_i]
      );
    }

    // Mark the gift as cancelled
    allGifts[_hashedSecret].cancelled = true;

    emit GiftCancelled(_hashedSecret);
  }

  /**
   * @dev Generate the verification hash that claimer has to sign and use
   * in claimGift to claim the gift.
   * 
   * @param _plainSecret The secret code of the gift in plain format
   * @return Gift hash
   */
  function getGiftHash(
    string calldata _plainSecret
  ) external view returns (bytes32) {
    // Hash the secret code.
    bytes32 hashedSecret = keccak256(abi.encodePacked(_plainSecret));

    // Retrieve the gift with the given hashed secret code.
    Gift memory currentGift = allGifts[hashedSecret];

    // Ensure that the gift exists and has not been cancelled.
    require(
      currentGift.creator != address(0) && currentGift.cancelled == false,
      "NFTGifts: Invalid secret code"
    );

    // Ensure that the gift has not been claimed yet.
    require(
      currentGift.claimed == false,
      "NFTGifts: Gift has already been claimed"
    );

    // Ensure that the gift was not created by the caller.
    require(
      currentGift.creator != msg.sender,
      "NFTGifts: Cannot claim your own gift"
    );

    // Return the hashed back to the claimer.
    return keccak256(abi.encodePacked(hashedSecret));
  }

  /**
   * @dev Returns the address of the signer of the given _hashedSecret and _signature.
   * 
   * @param _hashedSecret Sharing "code" hashed by keccak256
   * @param _signature The signature.
   * @return The address of the signer.
   */
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
