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
contract NFTGifts_v2 is ERC721Holder {
  struct Gift {
    address tokenAddress; // Address of the ERC721 contract
    uint256[] tokenIDs; // Array of NFT token IDs that are part of this Gift
    bool claimed; // Flag to track if the Gift has been claimed
    bool cancelled; // Flag to track if the Gift has been cancelled
    address creator; // Address of the Gift creator
  }
  struct Verifier {
    bool empty;
  }

  mapping(uint256 => Gift) private allGifts; // Mapping from giftID to gift information

  mapping(address => uint256) private allVerifiers; // Mapping from verifier address to giftID

  uint256 private giftCounter;

  /**
   * @dev Event emitted when a new gift is created
   */
  event GiftCreated(uint256 indexed _giftID, address indexed _createdBy, address _tokenAddress, uint256[] _tokenIDs);

  /**
   * @dev Event emitted when a gift is claimed
   */
  event GiftClaimed(uint256 indexed _giftID, address _claimedBy);

  /**
   * @dev Event emitted when a gift is cancelled
   */
  event GiftCancelled(uint256 indexed _giftID);

  /**
   * @dev Create a new gift
   *
   * Requirements:
   * - ERC721 Token address is valid
   * - This contract is approved on token contract
   * - valid and unique _verifier
   *
   * @param _tokenAddress ERC721 Token address
   * @param _tokenIDs An array of token IDs
   * @param _verifier Address of a verifier
   *
   */
  function createGift(address _tokenAddress, uint256[] calldata _tokenIDs, address _verifier) public {
    // Ensure that the given NFT contract address is valid
    require(_tokenAddress.code.length > 0, "NFTGifts: Invalid NFT contract address");

    require(_verifier != address(0), "NFTGifts: Invalid verifier address");
    require(allVerifiers[_verifier] == 0, "NFTGifts: Sharing code already used");

    // Transfer NFTs to smart contract
    for (uint256 _i = 0; _i < _tokenIDs.length; _i++) {
      ERC721(_tokenAddress).safeTransferFrom(msg.sender, address(this), _tokenIDs[_i]);
    }

    // Generate a unique gift ID
    giftCounter++;
    uint256 giftID = giftCounter;

    // Save the gift information
    allGifts[giftID].creator = msg.sender;
    allGifts[giftID].tokenAddress = _tokenAddress;
    allGifts[giftID].tokenIDs = _tokenIDs;
    allVerifiers[_verifier] = giftID;

    emit GiftCreated(giftID, msg.sender, _tokenAddress, _tokenIDs);
  }

  /**
   * @dev Create multiple new gifts in one transaction
   
   * Requirements:
   * - Array sizes has to match
   * 
   * @param _tokenAddress Array of ERC721 Token addresses
   * @param _tokenIDs Array of arrays of token IDs
   * @param _verifier Address of a verifier
   *
   */
  function createGifts(
    address[] calldata _tokenAddress,
    uint256[][] calldata _tokenIDs,
    address[] calldata _verifier
  ) external {
    require(
      _verifier.length == _tokenIDs.length && _verifier.length == _tokenAddress.length,
      "NFTGifts: Arrays must be of the same length"
    );
    uint256 arrayLength = _verifier.length;
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      createGift(_tokenAddress[_i], _tokenIDs[_i], _verifier[_i]);
    }
  }

  /**
   * @dev Retrieves the information of a gift.
   *
   * @param _giftID ID of a gift
   * @return currentGift The information of the gift
   *
   */
  function getGift(uint256 _giftID) external view returns (Gift memory currentGift) {
    // Retrieve the current gift from the mapping.
    currentGift = allGifts[_giftID];

    // Check if the gift exists and has not been cancelled.
    require(currentGift.creator != address(0), "NFTGifts: Invalid gift");
  }

  /**
   * @dev Retrieves the gift ID by using verifier address
   *
   * @param _verifier Verifier address
   * @return giftID
   *
   */
  function getGiftID(address _verifier) external view returns (uint256 giftID) {
    // Retrieve the current gift from the mapping.
    giftID = allVerifiers[_verifier];

    // Check if the gift exists and has not been cancelled.
    require(
      allGifts[giftID].creator != address(0) &&
        allGifts[giftID].cancelled == false &&
        allGifts[giftID].claimed == false,
      "NFTGifts: Invalid gift"
    );
  }

  /**
   * @dev Claims a gift using its secret and a signed message from the recipient.
   *
   * Requirements:
   * - Valid _giftID and verified _signature of unclaimed gift
   *
   * @param _giftID ID of a gift
   * @param _receiver Who should receive the gift
   * @param _signature The signed message from the recipient of the gift.
   */
  function claimGift(uint256 _giftID, address _receiver, bytes calldata _signature) external {
    // Verify that the recipient of the gift is the same as the signer of the message.
    address _verifier = getVerifier(_giftID, _receiver, _signature);
    require(allVerifiers[_verifier] == _giftID, "NFTGifts: Invalid verifier");

    // Retrieve the current gift from the mapping.
    Gift memory currentGift = allGifts[_giftID];

    require(!currentGift.cancelled, "NFTGifts: Gift has been cancelled");
    require(!currentGift.claimed, "NFTGifts: Gift has already been claimed");
    require(currentGift.creator != address(0), "NFTGifts: Invalid gift");
    require(currentGift.creator != _receiver, "NFTGifts: Cannot claim your own gift");

    // Transfer NFTs to the recipient of the gift.
    uint256 arrayLength = currentGift.tokenIDs.length;
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(address(this), _receiver, currentGift.tokenIDs[_i]);
    }

    // Mark the gift as claimed
    allGifts[_giftID].claimed = true;

    emit GiftClaimed(_giftID, _receiver);
  }

  /**
   * @dev Get all unclaimed gifts created by a given address
   *
   * @return GiftsTemp The list of all active unclaimedd gifts for caller's address
   *
   */
  function getUnclaimedGifts() external view returns (Gift[] memory GiftsTemp) {
    GiftsTemp = new Gift[](giftCounter);
    uint256 count;
    for (uint _i = 1; _i <= giftCounter; _i++) {
      if (allGifts[_i].creator == msg.sender && !allGifts[_i].claimed && !allGifts[_i].cancelled) {
        GiftsTemp[count] = allGifts[_i];
        count += 1;
      }
    }

    assembly {
      mstore(GiftsTemp, count)
    }
  }

  /**
   * @dev Cancel a gift created by a caller
   *
   * Requirements:
   * - Valid _giftID of unclaimed active gift
   *
   * @param _giftID ID of a gift
   *
   */
  function cancelGift(uint256 _giftID) external {
    // Retrieve the current gift from the mapping.
    Gift memory currentGift = allGifts[_giftID];

    // Ensure that the gift can be cancelled
    require(!currentGift.cancelled, "NFTGifts: The gift has been already cancelled");
    require(!currentGift.claimed, "NFTGifts: The gift has already been claimed");
    require(currentGift.creator != address(0), "NFTGifts: Invalid gift");
    require(currentGift.creator == msg.sender, "NFTGifts: Only gift creator can cancel the gift");

    // Transfer the NFTs back to the gift creator
    uint256 arrayLength = currentGift.tokenIDs.length;
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      ERC721(currentGift.tokenAddress).safeTransferFrom(address(this), currentGift.creator, currentGift.tokenIDs[_i]);
    }

    // Mark the gift as cancelled
    allGifts[_giftID].cancelled = true;

    emit GiftCancelled(_giftID);
  }

  /**
   * @dev Returns the address of the signer of the given _giftID, _receiver and _signature.
   *
   * @param _giftID ID of a gift
   * @param _receiver Who should receive the gift
   * @param _signature The signature.
   * @return signer The address of the signer.
   */
  function getVerifier(
    uint256 _giftID,
    address _receiver,
    bytes calldata _signature
  ) private pure returns (address signer) {
    bytes32 messageHash = keccak256(abi.encodePacked(_giftID, _receiver));
    bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(messageHash);
    signer = ECDSA.recover(ethSignedMessageHash, _signature);
  }
}
