import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address, encodePacked } from 'viem';
import { getVerifierAndCode, signData } from './utils/cryptography';
import { deployContracts } from './utils/deployTokenFixture';
import { NATIVE_TOKEN_ADDRESS } from './utils/helpers';

let owner: HardhatEthersSigner,
  addr1: HardhatEthersSigner,
  addr2: HardhatEthersSigner,
  operator: HardhatEthersSigner,
  giftContract: any,
  mockAxie: any,
  mockLand: any,
  mockWETH: any,
  mockUSDC: any,
  mockAXS: any,
  mockAtia: any,
  restrictionControl: any,
  newRestrictionControll: any;

const createRandomSingleERC721Gift = async (owner: any, code: string, args?: { id: string; args: string }[]) => {
  const randomId = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
  const { verifier } = getVerifierAndCode(code);
  await mockAxie.connect(owner).mint(randomId);
  const tokens = [
    {
      assetContract: mockAxie.address,
      tokenId: randomId,
      amount: 0,
    },
  ];
  const gift = [
    {
      tokens: tokens,
      restrictions: args,
      verifier: verifier.address,
    },
  ];
  const tx = giftContract.createGift(gift[0]);
  return tx;
};

const claimGiftTx = async (claimer: any, claimCode: string) => {
  const { verifier, code } = getVerifierAndCode(claimCode);
  const giftID = (await giftContract.getGift(verifier.address)).giftID;
  const signature = await signData(code, giftID, claimer.address as Address);
  return giftContract.connect(claimer).claimGift(giftID, claimer.address, signature);
};

describe('Gifts: Gift claiming restrictions (Blessing Streak, token holdings, etc...) ', async function () {
  beforeEach(async () => {
    [owner, addr1, addr2, operator] = await ethers.getSigners();
  });
  it('Should deploy contracts', async function () {
    const x = await loadFixture(deployContracts);
    mockAtia = x.mockAtia;
    mockAxie = x.mockAxie;
    mockLand = x.mockLand;
    mockWETH = x.mockWETH;
    mockUSDC = x.mockUSDC;
    mockAXS = x.mockAXS;
    restrictionControl = x.restrictionControl;
    giftContract = x.giftContract;

    expect(await mockAtia.hasCurrentlyActivated(owner.address)).to.equal(false);
    expect(await mockAxie.name()).to.equal('Axie');
    expect(await mockLand.name()).to.equal('Land');
    expect(await giftContract.version()).to.equal(3);
  });

  it('Should mint Mock Tokens', async () => {
    await mockLand.batchMint(100, 5);
  });
  it('Approve both contracts', async () => {
    await mockAxie.setApprovalForAll(giftContract.address, true);
    expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
  });
  describe('Create Restrictive Gifts', function () {
    it('Should Activate Atia Shrine: owner', async function () {
      await mockAtia.activateStreak();
      expect(await mockAtia.hasCurrentlyActivated(owner.address)).to.equal(true);
    });
    it('Should Create a #1 gift: no restrictions', async function () {
      const tx = await createRandomSingleERC721Gift(owner, '1', []);
      expect(await tx);
    });
    it('Should Create a #2 gift: Atia Blessing required', async function () {
      const restrictions = [
        {
          id: 'isBlessingActive',
          args: '0x',
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '2', restrictions);
      expect(await tx);
    });
    it('Should Create a #3 gift: Streak >100', async function () {
      const restrictions = [
        {
          id: 'hasBlessingStreak',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['uint256'], [100]) as Address]),
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '3', restrictions);

      expect(await tx);
    });
    it('Should Create a #4 gift: Streak >10', async function () {
      const restrictions = [
        {
          id: 'hasBlessingStreak',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['uint256'], [10]) as Address]),
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '4', restrictions);

      expect(await tx);
    });
    it('Should Create a #5 gift: Streak >10 & Atia Blessing active', async function () {
      const restrictions = [
        {
          id: 'hasBlessingStreak',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['uint256'], [10]) as Address]),
        },
        {
          id: 'isBlessingActive',
          args: '0x',
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '5', restrictions);

      expect(await tx);
    });
    it('Should Create a #6 gift: Atia Blessing Inactive & Streak > 40', async function () {
      const restrictions = [
        {
          id: 'hasBlessingStreak',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['uint256'], [40]) as Address]),
        },
        {
          id: 'isBlessingInactive',
          args: '0x',
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '6', restrictions);
      expect(await tx);
    });
    it('Should Create a #7 gift: AXS > 1000', async function () {
      const addr = await mockAXS.getAddress();
      const restrictions = [
        {
          id: 'hasTokenBalance',
          args: encodePacked(
            ['bytes'],
            [new ethers.AbiCoder().encode(['address', 'uint256'], [addr, 1000]) as Address],
          ),
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '7', restrictions);

      expect(await tx);
    });
    it('Should Create a #8 gift: hasRonBalance', async function () {
      const restrictions = [
        {
          id: 'hasRonBalance',
          args: encodePacked(
            ['bytes'],
            [new ethers.AbiCoder().encode(['uint256'], [BigInt(10000 * 10e17)]) as Address],
          ),
        },
      ];
      const tx = await createRandomSingleERC721Gift(owner, '8', restrictions);
      expect(await tx);
    });
    it('Revert: Invalid Restriction', async function () {
      const restrictions = [
        {
          id: 'gimmeAllTheMoney',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['bool'], [true]) as Address]),
        },
      ];
      const tx = createRandomSingleERC721Gift(owner, '99', restrictions);
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'InvalidRestriction');
    });
    it('Should revert: Atia Blessing & Invalid Restriction', async function () {
      const restrictions = [
        {
          id: 'isBlessingActive',
          args: '0x',
        },
        {
          id: 'dontkillme',
          args: '0x',
        },
      ];
      const tx = createRandomSingleERC721Gift(owner, '999', restrictions);
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'InvalidRestriction');
    });
  });
  describe('Claim Gifts', function () {
    it('Should Claim #1: Unrestricted gift', async function () {
      const tx = claimGiftTx(owner, '1');
      expect(tx);
    });
    it('Should Revert #2: No Blessing ❌', async function () {
      const tx = claimGiftTx(addr1, '2');
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('isBlessingActive');
    });
    it('Should Claim #2: Blessing Active', async function () {
      const tx = claimGiftTx(owner, '2');
      expect(tx);
    });
    it('Should Revert #3: Atia Streak ❌', async function () {
      const tx = claimGiftTx(addr1, '3');
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('hasBlessingStreak');
    });
    it('Should Claim #4: Atia Streak ✅', async function () {
      const tx = claimGiftTx(addr1, '4');
      expect(await tx);
    });
    it('Should Revert #5: Streak ✅ but Blessing ❌', async function () {
      const tx = claimGiftTx(addr1, '5');
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('isBlessingActive');
    });

    it('Should Activate Atia Shrine: addr1', async function () {
      await mockAtia.connect(addr1).activateStreak();
      expect(await mockAtia.hasCurrentlyActivated(addr1.address)).to.equal(true);
    });
    it('Should Claim #5: Streak ✅ & Blessing ✅', async function () {
      const tx = claimGiftTx(addr1, '5');
      expect(await tx);
    });
    it('Should Revert #6: Streak ✅ but NoBlessing ❌ (blessing is active)', async function () {
      const tx = claimGiftTx(addr1, '6');
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('isBlessingInactive');
    });
    it('Should Claim #6: Streak ✅ & NoBlessing ✅ (user has inactive blessing)', async function () {
      const tx = claimGiftTx(addr2, '6');
      expect(await tx);
    });

    it('Should Revert #7: Less than 1000 AXS ❌', async function () {
      const balance = await mockAXS.connect(addr1).balanceOf(addr1.address);
      await mockAXS.connect(addr1).transfer(addr2.address, balance);
      const tx = claimGiftTx(addr1, '7');
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('hasTokenBalance');
    });
    it('Should Claim #7: More than 1000 AXS ✅', async function () {
      await mockAXS.connect(addr2).mint(1001);
      const tx = claimGiftTx(addr2, '7');
      expect(await tx);
    });
    it('Should Revert #8: Not enough RON ❌', async function () {
      const tx = claimGiftTx(addr1, '8');
      await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('hasRonBalance');
    });
    it('Should Claim #8: More than RON amount required ✅', async function () {
      await owner.sendTransaction({
        to: addr1.address,
        value: BigInt(1 * 10e17),
      });
      const tx = claimGiftTx(addr1, '8');
      expect(await tx);
    });
    describe('Claim by Operator', function () {
      const { verifier, code } = getVerifierAndCode('10');
      let giftID: any;
      it('Should Create a #10 gift: Atia Blessing required', async function () {
        const restrictions = [
          {
            id: 'isBlessingActive',
            args: '0x',
          },
        ];
        const tx = await createRandomSingleERC721Gift(owner, '10', restrictions);
        giftID = (await giftContract.getGift(verifier.address)).giftID;
        expect(await tx);
      });
      it('Should Revert #10: Signer does not have Atia Blessing activated', async function () {
        const signature = await signData(code, giftID, addr2.address as Address);
        const tx = giftContract.connect(operator).claimGift(giftID, addr2.address, signature);
        await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('isBlessingActive');
      });
      it('Should Claim #10: Signed does have Atia Blessing activated', async function () {
        const signature = await signData(code, giftID, addr1.address as Address);
        const tx = giftContract.connect(operator).claimGift(giftID, addr1.address, signature);
        expect(await tx);
      });
    });
  });
});
