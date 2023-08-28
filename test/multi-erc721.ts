import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address } from 'viem';
import { getVerifierAndCode, signData } from './utils/cryptography';
import { deployContracts } from './utils/deployTokenFixture';
import { getGiftIDfromTx } from './utils/helpers';

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
  mockAtia: any;

describe('Gifts: Multiple ERC721 in a gift', async function () {
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

  describe('Generate multi-asset gift', function () {
    const { verifier, code } = getVerifierAndCode('multi-asset');
    var giftID: any;
    var tx: any;
    it('Should mint multi tokens', async () => {
      await mockAxie.mint(5001);
      await mockAxie.mint(5002);
      await mockLand.mint(5101);
      await mockLand.mint(5102);
      await mockAxie.mint(5003);
      await mockLand.mint(5103);
      expect(await mockAxie.ownerOf(5001)).to.equal(owner.address);
      expect(await mockAxie.ownerOf(5002)).to.equal(owner.address);
      expect(await mockLand.ownerOf(5101)).to.equal(owner.address);
      expect(await mockLand.ownerOf(5102)).to.equal(owner.address);
    });
    it('Approve both contracts', async () => {
      await mockAxie.setApprovalForAll(giftContract.address, true);
      await mockLand.setApprovalForAll(giftContract.address, true);
      expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      expect(await mockLand.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
    });
    it('Should generate a multi-gift', async function () {
      const gift = [
        {
          assetContract: mockAxie.address,
          tokenId: 5001,
          amount: 0,
        },
        {
          assetContract: mockLand.address,
          tokenId: 5101,
          amount: 0,
        },
        {
          assetContract: mockAxie.address,
          tokenId: 5002,
          amount: 0,
        },
        {
          assetContract: mockLand.address,
          tokenId: 5102,
          amount: 0,
        },
      ];
      const tx = await giftContract.createGift(gift, verifier.address);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockAxie.ownerOf(5001)).to.equal(giftContract.address);
      expect(await mockLand.ownerOf(5101)).to.equal(giftContract.address);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should claim a gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWith('NFTGifts: Invalid gift');
      expect(await mockAxie.ownerOf(5001)).to.equal(addr1.address);
      expect(await mockLand.ownerOf(5101)).to.equal(addr1.address);
    });
    it('Should revert when one or all collections are not approved', async () => {
      const { verifier, code } = getVerifierAndCode('multi-asset2');
      await mockAxie.connect(addr1).setApprovalForAll(giftContract.address, false);
      expect(await mockAxie.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
      const gift = [
        {
          assetContract: mockAxie.address,
          tokenId: 5001,
          amount: 0,
        },
        {
          assetContract: mockLand.address,
          tokenId: 5101,
          amount: 0,
        },
        {
          assetContract: mockAxie.address,
          tokenId: 5002,
          amount: 0,
        },
        {
          assetContract: mockLand.address,
          tokenId: 5102,
          amount: 0,
        },
      ];
      expect(giftContract.connect(addr1).createGift(gift, verifier.address)).to.be.reverted;
      await mockLand.connect(addr1).setApprovalForAll(giftContract.address, false);
      expect(await mockLand.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
      expect(giftContract.connect(addr1).createGift(gift, verifier.address)).to.be.revertedWith(
        'ERC721: caller is not token owner or approved',
      );
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
});
