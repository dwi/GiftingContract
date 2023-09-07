// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
//import {ERC2771Recipient} from "@opengsn/contracts/src/ERC2771Recipient.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable, Context} from "@openzeppelin/contracts/access/Ownable.sol";

import {IRestrictionControl} from "./Interfaces/IRestrictionControl.sol";
import {InterfaceChecker, IERC1155, IERC721} from "./lib/InterfaceChecker.sol";
import {CurrencyTransferLib} from "./lib/CurrencyTransferLib.sol";
import "./IGifts.sol";

/**
 * @title Token Gifting Smart Contract
 * @author dw
 *
 * @dev Allows trustlessly give ERC20/ERC721/ERC1115/RON (aka 'Token') gifts to not yet known recepients.
 *
 */
contract Gifts is IGifts, ERC721Holder, ERC1155Holder, ERC2771Context, Ownable {
  using InterfaceChecker for address;
  IRestrictionControl private restrictionController;
  address internal immutable nativeTokenWrapper;
  uint256 public constant MAX_RESTRICTIONS_PER_GIFT = 10;
  uint256 public constant MAX_TOKENS_PER_GIFT = 100;
  uint256 public constant MAX_GIFTS_PER_CREATEGIFTS = 100;
  uint256 public constant MAX_GIFTS_PER_CANCEL_TX = 100;
  uint256 private giftCounter;

  mapping(uint256 => Gift) private allGifts; // Mapping from giftID to gift information
  mapping(address => uint256) private allVerifiers; // Mapping from verifier address to giftID

  /**
   * @dev Constructor function
   * @param _nativeTokenWrapper The address of the native token wrapper contract
   * @param _restrictionController The address of the access control contract
   */
  constructor(address _nativeTokenWrapper, address _restrictionController) ERC2771Context(address(0)) {
    nativeTokenWrapper = _nativeTokenWrapper;
    restrictionController = IRestrictionControl(_restrictionController);
  }

  /**
   * @dev Fallback function to receive payments.
   */
  receive() external payable virtual {
    require(_msgSender() == nativeTokenWrapper, "caller not native token wrapper.");
  }

  /**
   * @dev Modifier to check if a gift is valid.
   * @param _giftID The ID of the gift to check.
   */
  modifier validGift(uint256 _giftID) {
    _checkGiftValidity(_giftID);
    _;
  }

  /**
   * @dev Checks if a gift is valid.
   * @param _giftID The ID of the gift to check.
   */
  function _checkGiftValidity(uint256 _giftID) internal view virtual {
    Gift storage currentGift = allGifts[_giftID];
    // TODO: Maybe move things around to save gas and not expose the cancelled/claimed status before checking the owner?
    if (currentGift.cancelled) revert GiftAlreadyCancelled();
    if (currentGift.claimed) revert GiftAlreadyClaimed();
    if (currentGift.creator == address(0)) revert InvalidGift();
  }

  /**
   * @dev Set the restriction controller contract address
   * @param _restrictionController The address of the valid contract
   * @notice Need to make sure the restriction controller is correct
   */
  function updateController(address _restrictionController) external onlyOwner {
    if (_restrictionController.code.length == 0) revert InvalidControllerAddress();
    if (!_restrictionController.isRestrictionControl()) revert InvalidControllerAddress();
    if (_restrictionController == address(0)) revert InvalidControllerAddress();
    restrictionController = IRestrictionControl(_restrictionController);
    emit ControllerUpdated(_restrictionController);
  }

  /**
   * @dev Creates a single gift in the specified payload
   *
   * @param _newGift The payload containing the gift information
   */

  function createGift(NewGiftPayload calldata _newGift) external payable {
    uint256 _remainingBalance = msg.value;
    (uint256 giftID, uint256 nativeTokenValue) = _processGift(_newGift);
    _remainingBalance -= nativeTokenValue;

    // Refund RON leftover if any
    // TODO: CHECK FOR POSSIBLE VULNERABILITY - CAN GIFT CREATOR MAKE A GIFT WITH RON AND GET THE RON BACK REFUNDED? ALLOWING GIFT CLAIMER TO DRAIN THE RON FROM THE CONTRACT?
    if (_remainingBalance > 0) {
      (bool success, ) = payable(_msgSender()).call{value: _remainingBalance}("");
      if (!success) revert FailedtoRefundNativeToken();
    }

    emit GiftCreated(giftID, _msgSender());
  }

  /**
   * @dev Creates multiple gifts in the specified payload array
   *
   * @param _newGift The payloads containing the gift information
   */
  function createGifts(NewGiftPayload[] calldata _newGift) external payable {
    uint256 _arrayLength = _newGift.length;
    if (_arrayLength > MAX_TOKENS_PER_GIFT) revert TooManyGifts();

    uint256 _remainingBalance = msg.value;
    for (uint256 _i = 0; _i < _arrayLength; ) {
      unchecked {
        (uint256 giftID, uint256 nativeTokenValue) = _processGift(_newGift[_i]);
        _remainingBalance -= nativeTokenValue;
        emit GiftCreated(giftID, _msgSender());
        _i++;
      }
    }

    // Refund RON leftover if any
    // TODO: CHECK FOR POSSIBLE VULNERABILITY - CAN GIFT CREATOR MAKE A GIFT WITH RON AND GET THE RON BACK REFUNDED? ALLOWING GIFT CLAIMER TO DRAIN THE RON FROM THE CONTRACT?
    if (_remainingBalance > 0) {
      (bool success, ) = payable(_msgSender()).call{value: _remainingBalance}("");
      if (!success) revert FailedtoRefundNativeToken();
    }
  }

  /**
   * @dev Processes a gift by creating it and transferring tokens to the contract.
   *
   * @param _newGift The payload containing the gift information
   * @return giftID The ID of the created gift
   * @return nativeTokenValue The value of native tokens transferred to the contract (used for refunds)
   */
  function _processGift(NewGiftPayload calldata _newGift) internal returns (uint256 giftID, uint256 nativeTokenValue) {
    giftID = _createGift(_newGift.tokens, _newGift.restrictions, _newGift.verifier);
    nativeTokenValue = _transferTokenBatch(_msgSender(), address(this), _newGift.tokens);
  }

  /**
   * @dev Internal function to create a gift with the specified tokens, restrictions, and verifier.
   *
   * @param _tokens The tokens to be included in the gift
   * @param _restrictions The restrictions to be applied to the gift
   * @param _verifier The verifier address for the gift
   * @return giftID The ID of the created gift
   */
  function _createGift(
    Token[] calldata _tokens,
    Restriction[] calldata _restrictions,
    address _verifier
  ) internal returns (uint256 giftID) {
    if (_verifier == address(0)) revert InvalidVerifier();
    if (allVerifiers[_verifier] != 0) revert InvalidVerifier();

    uint256 _tokensLength = _tokens.length;
    if (_tokensLength > MAX_TOKENS_PER_GIFT) revert TooManyTokens();

    uint256 _restrictionsLength = _restrictions.length;

    // Get a new unique gift ID
    giftID = ++giftCounter;

    // assign tokens to Gifts struct
    for (uint256 _i = 0; _i < _tokensLength; ) {
      allGifts[giftID].tokens.push(_tokens[_i]);
      unchecked {
        _i++;
      }
    }

    // assign restrictions to Gifts struct (if any)
    if (_restrictionsLength > 0) {
      if (_restrictionsLength > MAX_RESTRICTIONS_PER_GIFT) revert TooManyRestrictions();
      for (uint256 _i = 0; _i < _restrictionsLength; ) {
        if (!restrictionController.isValidRestriction(_restrictions[_i].id)) revert InvalidRestriction();
        allGifts[giftID].restrictions.push(_restrictions[_i]);
        unchecked {
          _i++;
        }
      }
    }

    // Save the gift information
    allGifts[giftID].creator = _msgSender();
    allGifts[giftID].createdAt = block.timestamp;
    allGifts[giftID].giftID = giftID;
    allVerifiers[_verifier] = giftID;
  }

  /**
   * @dev Retrieves the gift by using verifier address
   *
   * @param _verifier Verifier address
   * @return currentGift The information of the gift
   *
   */
  function getGift(address _verifier) external view returns (Gift memory currentGift) {
    // Retrieve the current gift from the mapping.
    uint256 giftID = allVerifiers[_verifier];
    currentGift = allGifts[giftID];

    // Check if the gift exists and has not been cancelled.
    // TODO: Concern #3 - Should return cancelled/claimed gifts or just return "Invalid gift"?
    if (allGifts[giftID].creator == address(0) || allGifts[giftID].cancelled == true) revert InvalidGift();
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
  function claimGift(uint256 _giftID, address _receiver, bytes calldata _signature) external validGift(_giftID) {
    // Verify that the recipient of the gift is the same as the signer of the message.
    address _verifier = getVerifier(_giftID, _receiver, _signature);
    if (allVerifiers[_verifier] != _giftID) revert InvalidVerifier();

    // Retrieve the current gift from the mapping.
    Gift storage currentGift = allGifts[_giftID];

    if (currentGift.creator == _receiver) revert Unauthorized();

    // Check for gift restrictions
    // TODO: CHECK FOR POSSIBLE VULNERABILITY BYPASSING THE RESTRICTION
    uint256 _restrictionsLength = currentGift.restrictions.length;
    for (uint256 _i = 0; _i < _restrictionsLength; ) {
      bool restrictionCheck = restrictionController.checkRestriction(
        _receiver,
        currentGift.restrictions[_i].id,
        currentGift.restrictions[_i].args
      );
      if (!restrictionCheck) revert UnmetRestriction(currentGift.restrictions[_i].id);
      unchecked {
        _i++;
      }
    }

    // Transfer NFTs to the recipient of the gift.
    _transferTokenBatch(address(this), _receiver, currentGift.tokens);

    // Mark the gift as claimed
    allGifts[_giftID].claimed = true;

    emit GiftClaimed(_giftID, _receiver);
  }

  /**
   * @dev Get all unclaimed gifts created by a given address
   *
   * @return giftsTemp The list of all active unclaimedd gifts for caller's address
   *
   */
  function getUnclaimedGifts() external view returns (Gift[] memory giftsTemp) {
    giftsTemp = new Gift[](giftCounter);
    uint256 count;
    for (uint256 _i = 1; _i <= giftCounter; ) {
      unchecked {
        if (allGifts[_i].creator == _msgSender() && !allGifts[_i].claimed && !allGifts[_i].cancelled) {
          giftsTemp[count] = allGifts[_i];
          //giftsTemp[count].giftID = _i;
          count += 1;
        }
        _i++;
      }
    }

    // solhint-disable no-inline-assembly
    assembly {
      mstore(giftsTemp, count)
    }
  }

  /**
   * @dev Cancel a set of gifts
   *
   * Requirements:
   * - Valid _giftID[] list of unclaimed active gift
   *
   * @param _giftIDs[] array of gifts to be cancelled
   *
   */
  function cancelGifts(uint256[] calldata _giftIDs) external {
    uint256 arrayLength = _giftIDs.length;
    if (arrayLength == 0) revert InvalidGift();
    if (arrayLength > MAX_GIFTS_PER_CANCEL_TX) revert TooManyGiftsToCancel();
    for (uint256 _i = 0; _i < arrayLength; ) {
      unchecked {
        _cancelGift(_giftIDs[_i]);
        _i++;
      }
    }
  }

  /**
   * @dev Cancel a gift created by a caller
   *
   * @param _giftID ID of a gift
   *
   */
  function _cancelGift(uint256 _giftID) internal validGift(_giftID) {
    Gift storage currentGift = allGifts[_giftID];

    // Ensure that the gift can be cancelled
    if (currentGift.creator != _msgSender()) revert Unauthorized();

    // Transfer the NFTs back to the gift creator
    _transferTokenBatch(address(this), currentGift.creator, currentGift.tokens);

    // Mark the gift as cancelled
    allGifts[_giftID].cancelled = true;

    emit GiftCancelled(_giftID);
  }

  /**
   * @dev Transfers a token from one address to another.
   *
   * @param _from The address from which the token is transferred
   * @param _to The address to which the token is transferred
   * @param _token The token to be transferred
   */
  function _transferToken(address _from, address _to, Token memory _token) internal {
    if (_token.assetContract == CurrencyTransferLib.NATIVE_TOKEN || _token.assetContract.isERC20()) {
      CurrencyTransferLib.transferCurrencyWithWrapper(
        _token.assetContract,
        _from,
        _to,
        _token.amount,
        nativeTokenWrapper
      );
    } else if (_token.assetContract.isERC721()) {
      IERC721(_token.assetContract).safeTransferFrom(_from, _to, _token.tokenId);
    } else if (_token.assetContract.isERC1155()) {
      IERC1155(_token.assetContract).safeTransferFrom(_from, _to, _token.tokenId, _token.amount, "");
    }
  }

  /**
   * @dev Transfers a batch of tokens from one address to another.
   *
   * @param _from The address from which the tokens are transferred
   * @param _to The address to which the tokens are transferred
   * @param _tokens The array of tokens to be transferred
   * @return nativeTokenValue The total value of native tokens transferred (used for refunds)
   */
  function _transferTokenBatch(
    address _from,
    address _to,
    Token[] memory _tokens
  ) internal returns (uint256 nativeTokenValue) {
    for (uint256 i = 0; i < _tokens.length; ) {
      if (_to == address(this) && _tokens[i].assetContract == CurrencyTransferLib.NATIVE_TOKEN) {
        nativeTokenValue += _tokens[i].amount;
      } else {
        _transferToken(_from, _to, _tokens[i]);
      }
      unchecked {
        i++;
      }
    }
    if (nativeTokenValue != 0) {
      Token memory _nativeToken = Token({
        assetContract: CurrencyTransferLib.NATIVE_TOKEN,
        tokenId: 0,
        amount: nativeTokenValue
      });
      _transferToken(_from, _to, _nativeToken);
    }
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

  /// @dev ERC2771Context overrides
  function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
    sender = ERC2771Context._msgSender();
  }

  /// @dev ERC2771Context overrides
  function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
    return ERC2771Context._msgData();
  }
}
