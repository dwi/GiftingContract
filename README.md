# Trustless ERC20/ERC721/ERC1155/native token gifting contract for unknown receivers

This smart contract allows trustless gifting of ERC20/ERC721/ERC1115/native tokens (hereafter referred to as `tokens`) to unknown recipients.

Basic Glossary:

- `creator` - the person giving away tokens by sharing a `secret sharing code` with the receiver
- `receiver` - the person who has the secret sharing code and is allowed to claim a gift
- `sharing code` - a set of random/custom strings used as a base "salt" to generate a private key of the `verifier`
- `verifier` - a signer used in the verification process to verify the validity of a gift and the receiver

## Gift+Claim Flow

- The `creator` creates a gift with giftable content and the address of a verifier (the verifier is generated in the UI based on the provided custom `sharing code` or randomly generated `sharing code`)
- The `creator` shares the `sharing code` with the receiver
- The `receiver` opens a Gifting UI where the `sharing code` is decoded to the `verifier` signer. The claiming signature is generated in the background when the `receiver` connects their wallet.
- The signature contains the `receiver` address.
- This signature can be used by the `receiver` or any "operator" (if the `receiver` has no RON for gas fees) to claim the gift using `claimGift(giftID, receiver, signature)`. The gift is transferred to the receiver.

![image](https://user-images.githubusercontent.com/1337260/206867935-b32edc3a-4dcd-4fe6-bc25-5a512c4d03b8.png)

## Restriction Controller

- The `creator` can set additional restrictions during gift creation, such as:
  - Atia's Blessing status
  - Atia's Blessing strike higher than `x`
  - Holding a specific amount of ERC721, ERC20 or native tokens
- Whoever has the `sharing code` must meet the defined criteria to successfully claim the gift.

## Contract Structure

- `Gifts.sol` - Ownable contract logic. The owner can change the logic address of the `Restriction Controller` and introduce new restrictions.
- `RestrictionControl.sol` - Disposable contract that introduces gift restrictions. It can be redeployed and the implementation address can be changed in `Gifts.sol`.

## Concerns

### ~~#1 The size of the `allGifts` mapping~~ ✅ Acceptable

- ~~All active/claimed/cancelled gifts are stored in this mapping. Should we be concerned about the potential size? If so, we can remove claimed/cancelled gifts from the mapping to reduce its size. The downside would be that the `receiver` would not know the reason why they cannot claim their gift (whether the creator cancelled it or someone else claimed it quicker). This could lead to higher gas usage for claiming/cancellations.~~

### ~~#2 The size of `allVerifiers` mapping~~ ✅ Acceptable, verifiers should not be reused

- ~~Over time, it will collect addresses of all used verifiers in the past (for active/claimed/cancelled gifts). The purpose is to block the re-use of already used verifiers. If this is a valid concern, then I could delete verifiers when a gift is being cancelled or claimed. This could lead to higher gas usage for claiming/cancellations.~~

### ~~#3 Giving away too much info could benefit attackers?~~ ✅ No risk exposing wheter invalid gift was claimed or cancelled

- ~~Should `getGift` return cancelled/claimed gifts?~~
- ~~Should `cancelGift` and `claimGift` revert with specific reasons why a gift cannot be cancelled/claimed? (already claimed/cancelled)?~~

### ~~#4 "Cannot claim your own gift"~~ ✅ Accepted, check will stay

- ~~Maybe this is a completely pointless check, and removing it could save some gas.~~

### ~~#5 "Non-upgradable main contract?"~~ ✅ Accepted solution

- ~~The main contract is not upgradable on purpose - it holds gifted tokens, and a malicious upgrade could introduce ways to take them all.~~

### ~~#6 "Restriction Controller" upgradable or standalone?~~ ✅ Acepted solution 1

- ~~There are 2 options for handling the upgradeability of the restriction controller (currently I went with option `#1`):~~

1. ~~`Gifts.sol` is Ownable, and onlyOwner can change the implementation address. If a new version is out, then the owner would just change the address.~~
2. ~~`Gifts.sol` would not need to be Ownable. We would deploy the `Restriction Controller` as an upgradable transparent proxy and use the proxy address in the `Gifts.sol` constructor. If a new version is out, then we would upgrade the proxy, and `Gifts.sol` would remain untouched.~~

### ~~#7 "Exploitable restriction controller"~~ ✅ Security review passed

- ~~The gift creator can pass `bytes` during the gift creation. The Restriction Controller's `checkRestriction` is called with such bytes to verify the restriction exists, and then it is stored in `allGifts[giftID].restrictions.args`.~~
- ~~My concern is if a malicious gift creator can use specifically crafted `bytes` to somehow exploit the restriction controller, allowing them to do harm to the contract or allowing them to use the created gift with malicious `bytes` to claim/retrieve tokens from the contract that they are not supposed to.~~

### #8 Any missing/useless functions?

- Should we add an onlyOwner function to cancel gifts on behalf of someone else?
- Or make contract pausable and add emergencyExit to cancel all existing gifts, return assets to owners and pause contract?
- Should the contract be pausable?

  ✅ Added `emergencyExit`, just in case

## Deploy

```bash
yarn hardhat deploy --network <ronin|saigon>
```