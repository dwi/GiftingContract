# ERC721 Trustless gifting contract to not yet known receivers

- `creator` - person who is giving away ERC721's by sharing a `secret sharing code` with receiver
- `receiver` - the person who has secret sharing code and is allowed to claim a gift

## Gift+Claim flow
- Creator makes a gift with Axies and hashed `secret sharing code` stored in sc. Plain `secret sharing code` is given to receiver
- Receiver will use `getGiftHash` read only function with plain `secret sharing code` parameter to get the claiming hash
- He signs the claiming hash and now this signature can be use by him or any "operator" (if he is without any RON for gas fees) to claim the gift with `claimGift` - Gift Axies are transfered to receiver

![image](https://user-images.githubusercontent.com/1337260/206153538-2716c9af-469a-4b21-9a0c-9d29a6890c02.png)

## Concerns

### Cancelled  gifts
- I probably want to keep `_hashedSecret` of cancelled gifts somewhere so another gift can't be used with the same passcode. For now I am checking for `allGifts[_hashedSecret].cancelled` in multiple parts of the contract but I also keep all hashes in `allGiftsIndex` to be able to look up all unclaimed gifts by its creator (function `getUnclaimedGifts`). Feels a little clunky so maybe the solution would be to delete `allGifts[_hashedSecret]` from mapping when gift is cancelled and check for already used `_hashedSecret` in the `allGiftsIndex` array - but that can be really gas heavy and not worthy at all

- I used two structures `Gift` and `GiftPublic` to hide the `cancelled` value from public facing responses. This is probably not needed and makes the contract a bit more complicated than necessary. Originally I made it for security purposes to not disclose cancelled gifts but I may need to know this status to tell `receiver` exact reason, why he cannot claim a gift (e.g. someone was faster or creator cancelled the gift before he was able to claim it)
