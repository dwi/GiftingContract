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
  mockAtia: any,
  mock1155: any,
  mockWRON: any;

describe('Gifts: EmergencyExit support', async function () {
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
    mockWRON = x.mockWRON;

    expect(await mockAtia.hasCurrentlyActivated(owner.address)).to.equal(false);
    expect(await mockAxie.name()).to.equal('Axie');
    expect(await mockLand.name()).to.equal('Land');
  });

  it('Should mint Mock Tokens', async () => {
    await mock1155.mintBatch(owner.address, [1, 2], [100, 200]);
    expect(await mock1155.balanceOf(owner.address, 1)).to.equal(100);
    expect(await mock1155.balanceOf(owner.address, 2)).to.equal(200);
  });

  describe('Generate Random Gifts', function () {
    var giftID: any;
    var tx: any;
    it('Approve contracts', async () => {
      await mock1155.setApprovalForAll(giftContract.address, true);
      await mockAxie.setApprovalForAll(giftContract.address, true);
      await mockLand.setApprovalForAll(giftContract.address, true);
      expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      expect(await mockLand.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      expect(await mock1155.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
    });
    it('Should generate RON gift', async function () {
      const { verifier } = getVerifierAndCode('1');

      const tokens = [
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
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: verifier.address,
        },
      ];
      const tx = await giftContract.createGift(gift[0], {
        value: gift[0].tokens[0].amount + gift[0].tokens[1].amount,
      });
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(tx.value);
    });

    it('Should generate ERC20 gift', async function () {
      const { verifier } = getVerifierAndCode('2');
      await mockWETH.approve(giftContract.address, 123123);
      await mockUSDC.approve(giftContract.address, 90045);
      await mockAXS.approve(giftContract.address, 123123);
      const tokens = [
        {
          assetContract: mockWETH.address,
          tokenId: 0,
          amount: 123123,
        },
        {
          assetContract: mockUSDC.address,
          tokenId: 0,
          amount: 90045,
        },
        {
          assetContract: mockAXS.address,
          tokenId: 0,
          amount: 123123,
        },
      ];
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: verifier.address,
        },
      ];
      const tx = await giftContract.createGift(gift[0]);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(123123);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(90045);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(123123);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should generate ERC1155 gift', async function () {
      const { verifier } = getVerifierAndCode('3');
      const tokens = [
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
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: verifier.address,
        },
      ];
      const tx = await giftContract.createGift(gift[0]);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(10);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(20);
      expect(await mock1155.balanceOf(owner.address, 1)).to.equal(90);
      expect(await mock1155.balanceOf(owner.address, 2)).to.equal(180);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should generate ERC721 gift', async function () {
      const { verifier } = getVerifierAndCode('4');
      const tokens = [
        {
          assetContract: mockAxie.address,
          tokenId: 1,
          amount: 0,
        },
        {
          assetContract: mockLand.address,
          tokenId: 1,
          amount: 0,
        },
        {
          assetContract: mockAxie.address,
          tokenId: 2,
          amount: 0,
        },
        {
          assetContract: mockLand.address,
          tokenId: 2,
          amount: 0,
        },
      ];
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: verifier.address,
        },
      ];
      const tx = await giftContract.createGift(gift[0]);
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockAxie.ownerOf(1)).to.equal(giftContract.address);
      expect(await mockLand.ownerOf(2)).to.equal(giftContract.address);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
  });
  describe('EmergencyExit', function () {
    it('Should revert EmergencyExit', async function () {
      await expect(giftContract.connect(addr1).emergencyExit()).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Should EmergencyExit', async function () {
      expect(await giftContract.emergencyExit());

      expect(await mockLand.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAxie.balanceOf(giftContract.address)).to.equal(0);
      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(0);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(0);
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
    });
  });
});
