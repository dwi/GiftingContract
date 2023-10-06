// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

interface IGifts {
  /**
   * @dev Struct to represent a restriction on a gift.
   */
  struct Restriction {
    string id;
    bytes args;
  }

  /**
   * @dev Struct to represent a token in a gift.
   */
  struct Token {
    address assetContract;
    uint256 tokenId;
    uint256 amount;
  }

  /**
   * @dev Struct to represent a new gift payload.
   */
  struct NewGiftPayload {
    Token[] tokens;
    Restriction[] restrictions;
    address verifier;
  }

  /**
   * @dev Struct to represent a gift.
   */
  struct Gift {
    uint256 giftID;
    uint256 createdAt; // Timestamp of when the Gift was created
    address creator; // Address of the Gift creator
    bool claimed; // Flag to track if the Gift has been claimed
    bool cancelled; // Flag to track if the Gift has been cancelled
    Restriction[] restrictions;
    Token[] tokens;
  }

  // Custom error messages
  error GiftAlreadyCancelled();
  error GiftAlreadyClaimed();
  error InvalidGift();
  error Unauthorized();
  error InvalidVerifier();
  error InvalidControllerAddress();
  error InvalidRestriction();
  error TooManyRestrictions();
  error TooManyGiftsToCancel();
  error TooManyGifts();
  error TooManyTokens();
  error FailedtoRefundNativeToken();
  error UnmetRestriction(string restriction);
  error InvalidPayload(string message);

  event GiftCreated(uint256 indexed _giftID, address _createdBy);
  event GiftClaimed(uint256 indexed _giftID, address _claimedBy);
  event GiftCancelled(uint256 indexed _giftID);
  event ControllerUpdated(address _restrictionController);
}
