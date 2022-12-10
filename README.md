# ERC721 Trustless gifting contract to not yet known receivers

- `creator` - person who is giving away ERC721's by sharing a `secret sharing code` with receiver
- `receiver` - the person who has secret sharing code and is allowed to claim a gift
- `sharing code` - a set of random/custom strings used as a base "salt" to generate a private key of a `verifier`
- `verifier` - signer used in a verification process to verify the validity of a gift and receiver

## Gift+Claim flow
- `Creator` makes a gift with Axies and address of a verifier (verifier is generated in UI based on provided custom `sharing code` or randomly generated `sharing code`)
- `Creator` shares `sharing code` with a receiver
- `Receiver` will sign his receiving address and gift ID with the `verifier` private key obtained from `sharing code`
- This signature can be use by him or any "operator" (if he is without any RON for gas fees) to claim the gift with `claimGift(giftID, receiver, signature)` - The gift is transfered to receiver

![image](https://user-images.githubusercontent.com/1337260/206867935-b32edc3a-4dcd-4fe6-bc25-5a512c4d03b8.png)



## Concerns

### #1 The size of `allGifts` mapping
- All active/claimed/cancelled gifts are stored there. Should we worry about the potential size? I could in theory remove claimed/cancelled gifts from the mapping to reduce the size if this is a valid concern. The downside would the that `receiver` will not know the reason why he cannot claim his gift (creator cancelled it or someone else claimed it quicker?)

### #2 The size of `allVerifiers` mapping
- Over time it will collect addresses of all used verifiers in the past (for active/claimed/cancelled gifts). The purpose is to block re-use of already used verifiers. If this is a valid concern then I could delete verifiers when gift is being cancelled or claimed.

### #3 Giving away too much info could benefit attackers?
- Should `getGift` return cancelled/claimed gifts?
- Should `cancelGift` and `claimGift` revert with specific reasons why gift cannot be cancelled/claimed? (already claimed/cancelled)?

### #4 "Cannot claim your own gift"
- Maybe this is completely pointless check and removing it could save some gas.

### #5 Any missing/useless functions?
- New function to cancel all pending unclaimed gifts in one tx?
- Should probably remove `getGiftID` for security reasons (used only in unit tests)