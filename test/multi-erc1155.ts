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
  mockAtia: any,
  mock1155: any;

describe('Gifts: ERC1155 support', async function () {
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
    mock1155 = x.mock1155;

    expect(await mockAtia.hasCurrentlyActivated(owner.address)).to.equal(false);
    expect(await mockAxie.name()).to.equal('Axie');
    expect(await mockLand.name()).to.equal('Land');
    expect(await giftContract.version()).to.equal(3);
  });

  it('Should mint Mock ERC1155 Tokens', async () => {
    await mock1155.mintBatch(owner.address, [1, 2], [100, 200]);
    expect(await mock1155.balanceOf(owner.address, 1)).to.equal(100);
    expect(await mock1155.balanceOf(owner.address, 2)).to.equal(200);
  });

  describe('Generate multi-asset gift', function () {
    const { verifier, code } = getVerifierAndCode('multi-asset');
    var giftID: any;
    var tx: any;
    it('Approve ERC1155 contract', async () => {
      await mock1155.setApprovalForAll(giftContract.address, true);
      expect(await mock1155.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
    });
    it('Should generate a multi-gift', async function () {
      const gift = [
        {
          assetContract: mock1155.address,
          tokenId: 1,
          amount: 10,
        },
        {
          assetContract: mock1155.address,
          tokenId: 2,
          amount: 20,
        },
      ];
      const tx = await giftContract.createGift(gift, verifier.address);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(10);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(20);
      expect(await mock1155.balanceOf(owner.address, 1)).to.equal(90);
      expect(await mock1155.balanceOf(owner.address, 2)).to.equal(180);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should revert when not enough balance of 1155s', async function () {
      const gift = [
        {
          assetContract: mock1155.address,
          tokenId: 1,
          amount: 100,
        },
        {
          assetContract: mock1155.address,
          tokenId: 2,
          amount: 1,
        },
      ];
      const tx = giftContract.createGift(gift, ethers.Wallet.createRandom().address);
      await expect(tx).to.be.revertedWith('ERC1155: insufficient balance for transfer');
    });
    it('Should claim a gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWith('Invalid gift');

      expect(await mock1155.balanceOf(addr1.address, 1)).to.equal(10);
      expect(await mock1155.balanceOf(addr1.address, 2)).to.equal(20);
      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(0);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(0);
    });
    it('Should revert when collections is not approved', async () => {
      const { verifier, code } = getVerifierAndCode('multi-asset2');
      expect(await mock1155.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
      const gift = [
        {
          assetContract: mock1155.address,
          tokenId: 1,
          amount: 10,
        },
        {
          assetContract: mock1155.address,
          tokenId: 2,
          amount: 20,
        },
      ];
      const tx = giftContract.connect(addr1).createGift(gift, verifier.address);
      await expect(tx).to.be.revertedWith('ERC1155: caller is not token owner or approved');
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
});
