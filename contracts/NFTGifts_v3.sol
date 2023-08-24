// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./InterfaceChecker.sol";
import "hardhat/console.sol";

/**
 * @title NFT Gifts Smart Contract
 * @author dw
 *
 * @dev Allows trustlessly give ERC721 gifts to not yet known recepients.
 *
 */
contract NFTGifts_v3 is ERC721Holder {
  using InterfaceChecker for address;

  struct Gift {
    uint256 giftID;
    address[] tokenAddresses; // Address of the ERC721 contract
    uint256[] tokenIDsOrAmounts; // Array of NFT token IDs that are part of this Gift
    bool claimed; // Flag to track if the Gift has been claimed
    bool cancelled; // Flag to track if the Gift has been cancelled
    address creator; // Address of the Gift creator
    uint createdAt; // Timestamp of when the Gift was created
  }
  struct Verifier {
    bool empty;
  }

  mapping(uint256 => Gift) private allGifts; // Mapping from giftID to gift information

  mapping(address => uint256) private allVerifiers; // Mapping from verifier address to giftID

  uint256 private giftCounter;

  receive() external payable {}

  /**
   * @dev Event emitted when a new gift is created
   */
  event GiftCreated(
    uint256 indexed _giftID,
    address indexed _createdBy,
    address[] _tokenAddresses,
    uint256[] _tokenIDsOrAmounts,
    uint _createdAt
  );

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
   * - ERC721/ERC20 Token addresses are valid
   * - This contract is approved on token contract
   * - valid and unique _verifier
   *
   * @param _tokenAddresses Addresses of ERC721/ERC20 Tokens
   * @param _tokenIDsOrAmounts An array of token IDs or ERC20 amounts
   * @param _verifier Address of a verifier
   *
   */
  function createGift(
    address[] calldata _tokenAddresses,
    uint256[] calldata _tokenIDsOrAmounts,
    address _verifier
  ) public {
    require(_verifier != address(0), "NFTGifts: Invalid verifier address");
    require(allVerifiers[_verifier] == 0, "NFTGifts: Sharing code already used");
    uint _tokenAddressesLength = _tokenAddresses.length;
    uint _tokenIDsOrAmountsLength = _tokenIDsOrAmounts.length;
    require(_tokenAddressesLength == _tokenIDsOrAmountsLength, "NFTGifts: Arrays must be of the same length");

    // Transfer NFTs/ERC20 tokens to smart contract
    for (uint256 _i = 0; _i < _tokenAddressesLength; _i++) {
      address tokenAddress = _tokenAddresses[_i];
      uint256 tokenIDsOrAmounts = _tokenIDsOrAmounts[_i];
      if (tokenAddress.isERC721()) {
        ERC721(tokenAddress).safeTransferFrom(msg.sender, address(this), tokenIDsOrAmounts);
      } else if (tokenAddress.isERC20()) {
        require(tokenIDsOrAmounts > 0, "ERC20 amount is 0");
        ERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenIDsOrAmounts);
      }
    }

    // Generate a unique gift ID
    giftCounter++;
    uint256 giftID = giftCounter;

    // Save the gift information
    allGifts[giftID].creator = msg.sender;
    allGifts[giftID].tokenAddresses = _tokenAddresses;
    allGifts[giftID].tokenIDsOrAmounts = _tokenIDsOrAmounts;
    allGifts[giftID].createdAt = block.timestamp;
    allGifts[giftID].giftID = giftID;
    allVerifiers[_verifier] = giftID;

    emit GiftCreated(giftID, msg.sender, _tokenAddresses, _tokenIDsOrAmounts, block.timestamp);
  }

  /**
   * @dev Create multiple new gifts in one transaction

   * Requirements:
   * - Array sizes has to match
   *
   * @param _tokenAddresses Array of ERC721 Token addresses
   * @param _tokenIDsOrAmounts Array of arrays of token IDs
   * @param _verifier Address of a verifier
   *
   */
  function createGifts(
    address[][] calldata _tokenAddresses,
    uint256[][] calldata _tokenIDsOrAmounts,
    address[] calldata _verifier
  ) external {
    uint arrayLength = _tokenAddresses.length;
    require(
      _tokenIDsOrAmounts.length == arrayLength && _verifier.length == arrayLength,
      "NFTGifts: Arrays must be of the same length"
    );
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      createGift(_tokenAddresses[_i], _tokenIDsOrAmounts[_i], _verifier[_i]);
    }
  }

  /**
   * @dev Retrieves the information of a gift.
   *
   * @param _giftID ID of a gift
   * @return currentGift The information of the gift
   *
   */
  // NOT NEEDED
  // function getGiftByID(uint256 _giftID) external view returns (Gift memory currentGift) {
  //   // Retrieve the current gift from the mapping.
  //   currentGift = allGifts[_giftID];

  //   // Check if the gift exists and has not been cancelled.
  //   require(currentGift.creator != address(0), "NFTGifts: Invalid gift");
  // }

  /**
   * @dev Retrieves the gift ID by using verifier address
   *
   * @param _verifier Verifier address
   * @return giftID
   *
   */
  // NOT NEEDED
  // function getGift(address _verifier) external view returns (uint256 giftID) {
  //   // Retrieve the current gift from the mapping.
  //   giftID = allVerifiers[_verifier];

  //   // Check if the gift exists and has not been cancelled.
  //   require(
  //     allGifts[giftID].creator != address(0) &&
  //       allGifts[giftID].cancelled == false &&
  //       allGifts[giftID].claimed == false,
  //     "NFTGifts: Invalid gift"
  //   );
  // }

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
    require(allGifts[giftID].creator != address(0) && allGifts[giftID].cancelled == false, "NFTGifts: Invalid gift");
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
    uint256 arrayLength = currentGift.tokenIDsOrAmounts.length;
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      if (currentGift.tokenAddresses[_i].isERC721()) {
        ERC721(currentGift.tokenAddresses[_i]).safeTransferFrom(
          address(this),
          _receiver,
          currentGift.tokenIDsOrAmounts[_i]
        );
      } else if (currentGift.tokenAddresses[_i].isERC20()) {
        ERC20(currentGift.tokenAddresses[_i]).transfer(_receiver, currentGift.tokenIDsOrAmounts[_i]);
      }
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
        //GiftsTemp[count].giftID = _i;
        count += 1;
      }
    }

    assembly {
      mstore(GiftsTemp, count)
    }
  }

  /**
   * @dev Get all unclaimed gifts created by a given address
   *
   * @return ids Array of all unclaimed gifts
   *
   */
  // NOT NEEDED
  // function getUnclaimedGiftIDs() external view returns (uint256[] memory ids) {
  //   //uint256 activeGiftCounter = getActiveGiftCount();
  //   ids = new uint256[](giftCounter);

  //   uint256 count;
  //   for (uint256 _i = 1; _i <= giftCounter; _i++) {
  //     if (allGifts[_i].creator == msg.sender && !allGifts[_i].claimed && !allGifts[_i].cancelled) {
  //       ids[count] = _i;
  //       count++;
  //     }
  //   }
  //   assembly {
  //     mstore(ids, count)
  //   }
  // }

  // function getActiveGiftCount() internal view returns (uint) {
  //   uint count;
  //   for (uint _i = 1; _i <= giftCounter; _i++) {
  //     if (allGifts[_i].creator == msg.sender && !allGifts[_i].claimed && !allGifts[_i].cancelled) {
  //       count++;
  //     }
  //   }
  //   return count;
  // }

  /**
   * @dev Cancel a gift created by a caller
   *
   * Requirements:
   * - Valid _giftID of unclaimed active gift
   *
   * @param _giftID ID of a gift
   *
   */
  function cancelGift(uint256 _giftID) public {
    // Retrieve the current gift from the mapping.
    Gift memory currentGift = allGifts[_giftID];

    // Ensure that the gift can be cancelled
    // TODO: Maybe move things around to save gas and not expose the cancelled/claimed status before checking the owner?
    require(!currentGift.cancelled, "NFTGifts: The gift has been already cancelled");
    require(!currentGift.claimed, "NFTGifts: The gift has already been claimed");
    require(currentGift.creator != address(0), "NFTGifts: Invalid gift");
    require(currentGift.creator == msg.sender, "NFTGifts: Only gift creator can cancel the gift");

    // Transfer the NFTs back to the gift creator
    uint256 arrayLength = currentGift.tokenIDsOrAmounts.length;
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      if (currentGift.tokenAddresses[_i].isERC721()) {
        ERC721(currentGift.tokenAddresses[_i]).safeTransferFrom(
          address(this),
          currentGift.creator,
          currentGift.tokenIDsOrAmounts[_i]
        );
      } else if (currentGift.tokenAddresses[_i].isERC20()) {
        ERC20(currentGift.tokenAddresses[_i]).transfer(currentGift.creator, currentGift.tokenIDsOrAmounts[_i]);
      }
    }

    // Mark the gift as cancelled
    allGifts[_giftID].cancelled = true;

    emit GiftCancelled(_giftID);
  }

  /**
   * @dev Cancel a set of gifts
   *
   * @param _giftIDs[] array of gifts to be cancelled
   *
   */
  function cancelGifts(uint256[] calldata _giftIDs) external {
    uint256 arrayLength = _giftIDs.length;
    require(arrayLength > 0, "NFTGifts: No gifts to cancel");
    require(arrayLength <= 50, "NFTGifts: Too many gifts to cancel");
    for (uint256 _i = 0; _i < arrayLength; _i++) {
      cancelGift(_giftIDs[_i]);
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

  function version() public pure returns (uint256) {
    return 2;
  }
}
