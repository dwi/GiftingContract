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

describe('Gifts: Multi-asset gifts (ERC20&ERC721)', async function () {
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
  describe('Create an ERC20 Gift', async function () {
    const { verifier, code } = getVerifierAndCode('a single erc20 gift');
    var giftID: any;
    var tx: any;
    it('Should generate a single ERC20 gift', async function () {
      await mockWETH.approve(giftContract.address, 500000);
      const tx = await giftContract.createGift([mockWETH.address], [500000], verifier.address);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(500000);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should claim an ERC20 gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWith('NFTGifts: Invalid gift');
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
    });
    it('Should revert when ERC20 has low/no allowance', async () => {
      await mockWETH.approve(giftContract.address, 0);
      await expect(
        giftContract.createGift([mockWETH.address], [1], ethers.Wallet.createRandom().address),
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });

  describe('Create a multiple ERC20 Gift', async function () {
    const { verifier, code } = getVerifierAndCode('multiple erc 20 gifts');
    var giftID: any;
    var tx: any;
    it('Should generate a single ERC20 gift', async function () {
      await mockWETH.approve(giftContract.address, 123123);
      await mockUSDC.approve(giftContract.address, 90045);
      await mockAXS.approve(giftContract.address, 123123);
      const tx = await giftContract.createGift(
        [mockWETH.address, mockUSDC.address, mockAXS.address],
        [123123, 90045, 123123],
        verifier.address,
      );
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(123123);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(90045);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(123123);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should claim an ERC20 gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWith('NFTGifts: Invalid gift');
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
    });
    it('Should revert when ERC20 has low/no allowance', async () => {
      await mockWETH.approve(giftContract.address, 0);
      await expect(
        giftContract.createGift(
          [mockWETH.address, mockUSDC.address, mockAXS.address],
          [123123, 90045, 123123],
          ethers.Wallet.createRandom().address,
        ),
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
  describe('Create a Combined ERC20/ERC721 Gift', async function () {
    const { verifier, code } = getVerifierAndCode('combined erc 20/721 gifts');
    var giftID: any;
    var tx: any;
    it('Should generate a combined gift', async function () {
      await mockWETH.approve(giftContract.address, 123123);
      await mockUSDC.approve(giftContract.address, 90045);
      await mockAXS.approve(giftContract.address, 123123);
      await mockLand.setApprovalForAll(giftContract.address, true);
      await mockAxie.setApprovalForAll(giftContract.address, true);
      const addresses = [mockWETH.address, mockAxie.address, mockUSDC.address, mockAXS.address, mockLand.address];
      const ids = [123123, 91, 90045, 123123, 92];
      const tx = await giftContract.createGift(addresses, ids, verifier.address);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(123123);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(90045);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(123123);
      expect(await mockAxie.ownerOf(91)).to.equal(giftContract.address);
      expect(await mockLand.ownerOf(92)).to.equal(giftContract.address);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should claim an ERC20 gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWith('NFTGifts: Invalid gift');
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAxie.ownerOf(91)).to.equal(addr1.address);
      expect(await mockLand.ownerOf(92)).to.equal(addr1.address);
    });
    it('Should revert when ERC20 has low/no allowance', async () => {
      await mockWETH.approve(giftContract.address, 0);
      await expect(
        giftContract.createGift([mockWETH.address, mockAxie.address], [1, 93], ethers.Wallet.createRandom().address),
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
    it('Should revert when ERC721 not allowed', async () => {
      await mockWETH.approve(giftContract.address, 1);
      await mockAxie.setApprovalForAll(giftContract.address, false);
      await expect(
        giftContract.createGift([mockWETH.address, mockAxie.address], [1, 93], ethers.Wallet.createRandom().address),
      ).to.be.revertedWith('ERC721: caller is not token owner or approved');
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
  describe('Mass Create ERC721&ERC20 Gifts', async function () {
    var giftID: any;
    var tx: any;
    it('Should generate multiple combined gifts in one tx', async function () {
      await mockAxie.setApprovalForAll(giftContract.address, true);
      await mockLand.setApprovalForAll(giftContract.address, true);
      await mockWETH.approve(giftContract.address, 123123);
      await mockUSDC.approve(giftContract.address, 90045);
      await mockAXS.approve(giftContract.address, 123123);
      await mockAxie.batchMint(10000, 10);
      await mockLand.batchMint(20000, 10);

      const addresses = [
        [mockAxie.address, mockWETH.address],
        [mockAxie.address, mockLand.address, mockWETH.address],
        [mockAxie.address, mockLand.address, mockWETH.address, mockWETH.address],
        [mockLand.address, mockWETH.address, mockUSDC.address, mockAXS.address],
        [
          mockAxie.address,
          mockLand.address,
          mockWETH.address,
          mockUSDC.address,
          mockUSDC.address,
          mockLand.address,
          mockAXS.address,
        ],
      ];
      const ids = [
        [10000, 10],
        [10001, 20000, 50],
        [10002, 20001, 30, 31],
        [20002, 100, 200, 300],
        [10003, 20003, 42, 10, 10, 20004, 100],
      ];
      const verifiers = [
        getVerifierAndCode('multigift1').verifier.address,
        getVerifierAndCode('multigift2').verifier.address,
        getVerifierAndCode('multigift3').verifier.address,
        getVerifierAndCode('multigift4').verifier.address,
        getVerifierAndCode('multigift5').verifier.address,
      ];
      expect(await giftContract.createGifts(addresses, ids, Array(ids.length).fill([]), verifiers)).to.emit(
        giftContract,
        'GiftCreated',
      );
      expect((await giftContract.getGift(verifiers[0])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[1])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[2])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[3])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[4])).claimed).to.equal(false);
      expect(await mockAxie.ownerOf(10000)).to.equal(giftContract.address);
      expect(await mockLand.ownerOf(20003)).to.equal(giftContract.address);
    });

    it('Should claim an multi gift', async function () {
      const claimer = (await ethers.getSigners())[10];
      const verifier = getVerifierAndCode('multigift5').verifier.address;
      const giftID = (await giftContract.getGift(verifier)).giftID;
      const signature = await signData(getVerifierAndCode('multigift5').code, giftID, claimer.address as Address);

      expect(await mockWETH.balanceOf(claimer.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(claimer.address)).to.equal(0);
      expect(await mockAXS.balanceOf(claimer.address)).to.equal(0);
      await expect(giftContract.connect(claimer).claimGift(giftID, claimer.address, signature))
        .to.emit(giftContract, 'GiftClaimed')
        .withArgs(giftID, claimer.address);
      expect(giftContract.getGift(verifier)).to.be.revertedWith('NFTGifts: Invalid gift');
      expect(await mockWETH.balanceOf(claimer.address)).to.equal(42);
      expect(await mockUSDC.balanceOf(claimer.address)).to.equal(20);
      expect(await mockAXS.balanceOf(claimer.address)).to.equal(100);
      expect(await mockAxie.ownerOf(10003)).to.equal(claimer.address);
      expect(await mockLand.ownerOf(20003)).to.equal(claimer.address);
    });
  });

  describe('Cancel all the gifts', async function () {
    it('Should cancel all gifts in one tx', async function () {
      const gifts = await giftContract.getUnclaimedGifts();
      const giftIDs: BodyInit[] = [];
      gifts.map((gift: any) => giftIDs.push(gift.giftID));
      const tx = await giftContract.cancelGifts(giftIDs);
      await expect(tx).to.emit(giftContract, 'GiftCancelled');
    });

    it("Should revert when cancelling someone else's or already cancelled gift", async function () {
      const gifts = await giftContract.connect(addr1).getUnclaimedGifts();
      const giftIDs: any = [];
      gifts.map((gift: any) => giftIDs.push(gift.giftID));
      giftIDs.push(4);
      //await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith('NFTGifts: Only gift creator can cancel the gift')
      await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith(
        'NFTGifts: The gift has been already cancelled',
      );
    });
    it('Nothing to cancel, revert', async function () {
      const gifts = await giftContract.connect(addr1).getUnclaimedGifts();
      const giftIDs: bigint[] = [];
      gifts.map((gift: any) => giftIDs.push(gift.giftID));
      await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith('NFTGifts: No gifts to cancel');
    });
    it('Gifting contract balance should be 0', async function () {
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAxie.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockLand.balanceOf(giftContract.address)).to.equal(0);
    });
  });
});
