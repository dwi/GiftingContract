import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address } from 'viem';
import { getVerifierAndCode, signData } from './utils/cryptography';
import { deployContracts } from './utils/deployTokenFixture';
import { NATIVE_TOKEN_ADDRESS, getGiftIDfromTx } from './utils/helpers';

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
  mockWRON: any;

describe('Gifts: RON/WRON Support', async function () {
  beforeEach(async () => {
    [owner, addr1, addr2, operator] = await ethers.getSigners();
  });
  it('Should deploy contracts', async function () {
    const x = await loadFixture(deployContracts);
    mockAxie = x.mockAxie;
    mockWETH = x.mockWETH;
    giftContract = x.giftContract;
    mockWRON = x.mockWRON;
  });

  describe('Generate RON gift', function () {
    const { verifier, code } = getVerifierAndCode('single-ron');
    const { verifier: verifier2, code: code2 } = getVerifierAndCode('multi-ron');
    var giftID: any;
    var tx: any;
    it('Should generate a single RON', async function () {
      const gift = [
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: BigInt(1 * 10e17),
        },
      ];
      const tx = await giftContract['createGift((address,uint256,uint256)[],address)'](gift, verifier.address, {
        value: gift[0].amount,
      });
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(tx.value);
    });
    it('Should revert when not enough balance of RON', async function () {
      const gift = [
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: BigInt(9000 ** 18),
        },
      ];
      const tx = giftContract['createGift((address,uint256,uint256)[],address)'](
        gift,
        ethers.Wallet.createRandom().address,
        {
          value: gift[0].amount,
        },
      );
      expect(tx).to.be.reverted;
    });
    it('Should revert when value is not matching amount in gifts', async function () {
      const gift = [
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: 100,
        },
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: 100,
        },
      ];
      const tx = giftContract['createGift((address,uint256,uint256)[],address)'](
        gift,
        ethers.Wallet.createRandom().address,
        {
          value: 201,
        },
      );
      await expect(tx).to.be.revertedWith('msg.value != amount');
    });
    it('Should claim a gift', async function () {
      const startRon = await ethers.provider.getBalance(addr1.address);
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWith('NFTGifts: Invalid gift');
      expect(await ethers.provider.getBalance(addr1.address)).above(startRon);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(0);
    });
    it('Should generate a multi-RON gift', async function () {
      const gift = [
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: BigInt(1 * 10e17),
        },
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: BigInt(2 * 10e17),
        },
      ];
      const tx = await giftContract['createGift((address,uint256,uint256)[],address)'](gift, verifier2.address, {
        value: gift[0].amount + gift[1].amount,
      });
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(tx.value);
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
});
