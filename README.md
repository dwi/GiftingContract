# ERC721 Trustless gifting contract to not yet known receivers

- `creator` - person who is giving away ERC721's by sharing a `secret sharing code` with receiver
- `receiver` - the person who has secret sharing code and is allowed to claim a gift

## Gift+Claim flow
- Creator makes a gift with Axies and hashed `secret sharing code` stored in sc. Plain `secret sharing code` is given to receiver
- Receiver will use `getGiftHash` read only function with plain `secret sharing code` parameter to get the claiming hash
- He signs the claiming hash and now this signature can be use by him or any "operator" (if he is without any RON for gas fees) to claim the gift with `claimGift` - Gift Axies are transfered to receiver

![image](https://user-images.githubusercontent.com/1337260/206153538-2716c9af-469a-4b21-9a0c-9d29a6890c02.png)
