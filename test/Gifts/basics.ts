import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address } from 'viem';
import { getVerifierAndCode, signData } from '../utils/cryptography';
import { deployContracts } from '../utils/deployTokenFixture';
import { getGiftIDfromTx } from '../utils/helpers';

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
  restrictionControl: any;

const { verifier: mockVerifier, code: mockEncodedSecret } = getVerifierAndCode('mockCode');

describe('Gifts: Basics', async function () {
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
    await mockAxie.safeTransferFrom(owner.address, addr1.address, 6);
    await mockLand.batchMint(100, 5);
    await mockLand.connect(addr1).mint(1000);
    await mockLand.connect(addr1).mint(1001);
    await mockAxie.connect(addr2).mint(2000);
    await mockAxie.connect(addr2).mint(2001);
    await mockWETH.connect(addr1).mint(100000000000000);
    expect(await mockAxie.balanceOf(owner.address)).to.equal(97);
    expect(await mockLand.balanceOf(owner.address)).to.equal(104);
    expect(await mockLand.balanceOf(addr1.address)).to.equal(2);
    expect(await mockWETH.balanceOf(addr1.address)).to.equal(100000000000000);
  });

  describe('Create a gift', function () {
    const verifier1 = getVerifierAndCode('gift 1').verifier.address;
    const verifier2 = ethers.Wallet.createRandom().address;
    it('Approve NFT Collections', async function () {
      await mockAxie.setApprovalForAll(giftContract.address, true);
      await mockLand.connect(addr1).setApprovalForAll(giftContract.address, true);
      expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      expect(await mockLand.isApprovedForAll(addr1.address, giftContract.address)).to.equal(true);
      expect(await mockAxie.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
    });
    it('Should create gifts', async function () {
      await giftContract.createGift([mockAxie.address], [1], verifier1);
      await giftContract.createGift([mockAxie.address], [2], verifier2);
      expect(await mockAxie.balanceOf(owner.address)).to.equal(95);
      expect(await mockAxie.balanceOf(giftContract.address)).to.equal(2);
      expect((await giftContract.getGift(verifier1)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier1)).claimed).to.equal(false);
    });
    describe('Events', function () {
      it('Should emit matching GiftCreated', async function () {
        const addr = [mockLand.address, mockLand.address];
        const axies = [1000, 1001];
        const tx = await giftContract.connect(addr1).createGift(addr, axies, mockVerifier.address);
        const blockBefore = await ethers.provider.getBlock(tx.blockNumber);
        const timestampBefore = blockBefore?.timestamp;
        await expect(tx).to.emit(giftContract, 'GiftCreated').withArgs(3, addr1.address, addr, axies, timestampBefore);
      });
    });
    describe('Reading data', function () {
      it('Should return correct data from getUnclaimedGifts', async function () {
        expect((await giftContract.connect(owner).getUnclaimedGifts()).length).to.equal(2);
        expect((await giftContract.connect(addr1).getUnclaimedGifts()).length).to.equal(1);
      });
      it('Should return correct data from getGift', async function () {
        expect((await giftContract.getGift(verifier1)).creator).to.equal(owner.address);
        expect((await giftContract.getGift(mockVerifier.address)).creator).to.equal(addr1.address);
      });
    });

    describe('Test reverts', function () {
      it('Should revert createGift when re-using used verifier', async function () {
        await expect(
          giftContract.connect(owner).createGift([mockAxie.address], [3], mockVerifier.address),
        ).to.be.revertedWith('NFTGifts: Sharing code already used');
      });
      it('Should revert createGift when using invalid ERC721/ERC20 address', async function () {
        await expect(giftContract.connect(owner).createGift([addr2.address], [3], ethers.Wallet.createRandom().address))
          .to.be.reverted;
      });
      it('Should revert when gifting owned token ID but gift contract is not approved', async function () {
        await expect(
          giftContract.connect(addr2).createGift([mockAxie.address], [2000], ethers.Wallet.createRandom().address),
        ).to.be.revertedWith('ERC721: caller is not token owner or approved');
      });
      it('Should revert when gifting not owned token ID', async function () {
        await expect(
          giftContract.createGift([mockAxie.address], [6], ethers.Wallet.createRandom().address),
        ).to.be.revertedWith('ERC721: caller is not token owner or approved');
      });
      it('Should revert when gifting not owned token ID placed on unapproved smart contract', async function () {
        await expect(
          giftContract.createGift([mockAxie.address], [1], ethers.Wallet.createRandom().address),
        ).to.be.revertedWith('ERC721: transfer from incorrect owner');
      });
      it('Should revert when gifting invalid token ID', async function () {
        await expect(
          giftContract.createGift([mockAxie.address], [999999], ethers.Wallet.createRandom().address),
        ).to.be.revertedWith('ERC721: invalid token ID');
      });
    });
  });

  describe('Gift Claiming', function () {
    describe('Claim a gift properly', function () {
      const { verifier, code } = getVerifierAndCode('share code 123');
      let giftID: any;
      let tx: any;
      it('Should generate a gift', async function () {
        const tx = await giftContract.connect(owner).createGift([mockAxie.address], [5], verifier.address);
        const res = await tx.wait();
        giftID = getGiftIDfromTx(giftContract, res);

        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
        expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
        expect(await mockAxie.ownerOf(5)).to.equal(giftContract.address);
      });
      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr1.address as Address);
        tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(true);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockAxie.ownerOf(5)).to.equal(addr1.address);
      });
      describe('Events', function () {
        it('Should emit matching GiftClaimed event', async function () {
          expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
        });
      });
    });
    describe('Claim a gift by operator', function () {
      const { verifier, code } = getVerifierAndCode('share code 999');
      var giftID: any;
      var tx: any;
      var axies = [100, 101, 102, 103];
      it('Should approve collection 2', async function () {
        await mockLand.setApprovalForAll(giftContract.address, true);
        expect(await mockLand.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      });
      it('Should generate a gift', async function () {
        const tx = await giftContract.createGift(
          [mockLand.address, mockLand.address, mockLand.address, mockLand.address],
          axies,
          verifier.address,
        );
        const res = await tx.wait();
        giftID = getGiftIDfromTx(giftContract, res);

        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
        expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
        expect(await mockLand.ownerOf(axies[0])).to.equal(giftContract.address);
      });
      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr2.address as Address);
        tx = await giftContract.connect(operator).claimGift(giftID, addr2.address, signature);
        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(true);
        expect(await mockLand.ownerOf(axies[0])).to.equal(addr2.address);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockLand.ownerOf(axies[0])).to.equal(addr2.address);
      });
      it('Operator should not have any new tokens', async function () {
        expect(await mockLand.balanceOf(operator.address)).to.equal(0);
      });
      describe('Events', function () {
        it('Should emit matching GiftClaimed event for original claimer', async function () {
          await expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr2.address);
        });
      });
    });
    describe('Test reverts', function () {
      it('Should revert when claiming your own gift', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(3, addr1.address, signature)).to.be.revertedWith(
          'NFTGifts: Cannot claim your own gift',
        );
      });
      it('Should revert when claiming gift with wrong claimer', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(3, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier',
        );
      });
      it('Should revert when claiming gift with different giftID', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(4, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier',
        );
      });
      it('Should revert when claiming already claimed gift', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(4, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier',
        );
      });
    });
  });
  describe('Cancel a gift', function () {
    var bal: any;
    var tx: any;
    it('Should cancel unclaimed gift', async function () {
      bal = Number(await mockAxie.balanceOf(owner.address));
      tx = await giftContract.cancelGifts([1]);
      expect(giftContract.getGift(getVerifierAndCode('gift 1').verifier.address)).to.be.revertedWith(
        'NFTGifts: Invalid gift',
      );
    });

    it('Token IDs are returned back to gift creator', async function () {
      expect(await mockAxie.balanceOf(owner.address)).to.equal(bal + 1);
    });
    describe('Events', function () {
      it('Should emit matching GiftCancelled event', async function () {
        await expect(tx).to.emit(giftContract, 'GiftCancelled').withArgs(1);
      });
    });

    describe('Test reverts', function () {
      it('Should revert because of invalid gift ID', async function () {
        await expect(giftContract.cancelGifts([99999])).to.be.revertedWith('NFTGifts: Invalid gift');
      });
      it('Should revert because not owner of that gift', async function () {
        await expect(giftContract.connect(addr1).cancelGifts([2])).to.be.revertedWith(
          'NFTGifts: Only gift creator can cancel the gift',
        );
      });

      it('Should revert because already claimed', async function () {
        await expect(giftContract.connect(addr1).cancelGifts([4])).to.be.revertedWith(
          'NFTGifts: The gift has already been claimed',
        );
      });
      it('Should revert because gift already cancelled', async function () {
        await expect(giftContract.cancelGifts([1])).to.be.revertedWith('NFTGifts: The gift has been already cancelled');
      });
    });
  });
});
