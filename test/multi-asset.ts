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

describe('Gifts: Multi-asset gifts (ERC20 & ERC721 & ERC1155 & RON)', async function () {
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
    expect(await giftContract.version()).to.equal(3);
  });

  it('Should mint Mock Tokens', async () => {
    await mockAxie.safeTransferFrom(owner.address, addr1.address, 6);

    await mock1155.mintBatch(owner.address, [1, 2], [100, 200]);
    //await mock1155.mintBatch(addr1.address, [3], [1]);
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
      const tokens = [
        {
          assetContract: mockWETH.address,
          tokenId: 0,
          amount: 500000,
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
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(500000);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
    });
    it('Should claim an ERC20 gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWithCustomError(giftContract, 'InvalidGift');
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
    });
    it('Should revert when ERC20 has low/no allowance', async () => {
      await mockWETH.approve(giftContract.address, 0);
      const tokens = [
        {
          assetContract: mockWETH.address,
          tokenId: 0,
          amount: 1,
        },
      ];
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: ethers.Wallet.createRandom().address,
        },
      ];
      await expect(giftContract.createGift(gift[0])).to.be.revertedWith('ERC20: insufficient allowance');
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
    it('Should claim an ERC20 gift', async function () {
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWithCustomError(giftContract, 'InvalidGift');
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
    });
    it('Should revert when ERC20 has low/no allowance', async () => {
      await mockWETH.approve(giftContract.address, 0);
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
          verifier: ethers.Wallet.createRandom().address,
        },
      ];
      await expect(giftContract.createGift(gift[0])).to.be.revertedWith('ERC20: insufficient allowance');
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
  describe('Create a Combined ERC20/ERC721/ERC1155 and RON Gift', async function () {
    const { verifier, code } = getVerifierAndCode('combined erc 20/721/1155 gifts');
    var giftID: any;
    var tx: any;
    it('Should generate a combined gift', async function () {
      await mockWETH.approve(giftContract.address, 123123);
      await mockUSDC.approve(giftContract.address, 90045);
      await mockAXS.approve(giftContract.address, 123123);
      await mockLand.setApprovalForAll(giftContract.address, true);
      await mockAxie.setApprovalForAll(giftContract.address, true);
      await mock1155.setApprovalForAll(giftContract.address, true);
      const tokens = [
        {
          assetContract: mockWETH.address,
          tokenId: 0,
          amount: 123123,
        },
        {
          assetContract: mock1155.address,
          tokenId: 1,
          amount: 10,
        },
        {
          assetContract: mockAxie.address,
          tokenId: 91,
          amount: 0,
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
        {
          assetContract: mockLand.address,
          tokenId: 92,
          amount: 0,
        },
        {
          assetContract: mock1155.address,
          tokenId: 2,
          amount: 20,
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
      const tx = await giftContract.createGifts(gift, {
        value: BigInt(2 * 10e17),
      });
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(123123);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(90045);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(123123);
      expect(await mockAxie.ownerOf(91)).to.equal(giftContract.address);
      expect(await mockLand.ownerOf(92)).to.equal(giftContract.address);
      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(10);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(20);
      expect(await mock1155.balanceOf(owner.address, 1)).to.equal(90);
      expect(await mock1155.balanceOf(owner.address, 2)).to.equal(180);
      expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(tx.value);
    });
    it('Should claim an ERC20 gift', async function () {
      const startRon = await ethers.provider.getBalance(addr1.address);
      const signature = await signData(code, giftID, addr1.address as Address);
      tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
      expect(giftContract.getGift(verifier.address)).to.be.revertedWithCustomError(giftContract, 'InvalidGift');
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAxie.ownerOf(91)).to.equal(addr1.address);
      expect(await mockLand.ownerOf(92)).to.equal(addr1.address);
      expect(await mock1155.balanceOf(addr1.address, 1)).to.equal(10);
      expect(await mock1155.balanceOf(addr1.address, 2)).to.equal(20);
      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(0);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(0);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(0);
      expect(await ethers.provider.getBalance(addr1.address)).above(startRon);
    });
    it('Should revert when ERC20 has low/no allowance', async () => {
      await mockWETH.approve(giftContract.address, 0);
      const tokens = [
        {
          assetContract: mockWETH.address,
          tokenId: 0,
          amount: 1,
        },
        {
          assetContract: mockAxie.address,
          tokenId: 93,
          amount: 0,
        },
      ];
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: ethers.Wallet.createRandom().address,
        },
      ];
      await expect(giftContract.createGift(gift[0])).to.be.revertedWith('ERC20: insufficient allowance');
    });
    it('Should revert when ERC721 not allowed', async () => {
      await mockWETH.approve(giftContract.address, 1);
      await mockAxie.setApprovalForAll(giftContract.address, false);
      const tokens = [
        {
          assetContract: mockWETH.address,
          tokenId: 0,
          amount: 1,
        },
        {
          assetContract: mockAxie.address,
          tokenId: 93,
          amount: 0,
        },
      ];
      const gift = [
        {
          tokens: tokens,
          restrictions: [],
          verifier: ethers.Wallet.createRandom().address,
        },
      ];
      await expect(giftContract.createGift(gift[0])).to.be.revertedWith(
        'ERC721: caller is not token owner or approved',
      );
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
  describe('Mass Create ERC721 & ERC20 & ERC1155 Gifts', async function () {
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

      const verifiers = [
        getVerifierAndCode('multigift 1').verifier.address,
        getVerifierAndCode('multigift 2').verifier.address,
        getVerifierAndCode('multigift 3').verifier.address,
        getVerifierAndCode('multigift 4').verifier.address,
        getVerifierAndCode('multigift 5').verifier.address,
      ];
      const gift = [
        {
          tokens: [
            {
              assetContract: mockAxie.address,
              tokenId: 10000,
              amount: 0,
            },
            {
              assetContract: mockWETH.address,
              tokenId: 0,
              amount: 10,
            },
            {
              assetContract: NATIVE_TOKEN_ADDRESS,
              tokenId: 0,
              amount: BigInt(5 * 10e17),
            },
          ],
          restrictions: [],
          verifier: verifiers[0],
        },
        {
          tokens: [
            {
              assetContract: mockAxie.address,
              tokenId: 10001,
              amount: 0,
            },
            {
              assetContract: mockLand.address,
              tokenId: 20000,
              amount: 0,
            },
            {
              assetContract: mockWETH.address,
              tokenId: 0,
              amount: 50,
            },
            {
              assetContract: mock1155.address,
              tokenId: 1,
              amount: 1,
            },
          ],
          restrictions: [],
          verifier: verifiers[1],
        },
        {
          tokens: [
            {
              assetContract: mockAxie.address,
              tokenId: 10002,
              amount: 0,
            },
            {
              assetContract: mockLand.address,
              tokenId: 20001,
              amount: 0,
            },
            {
              assetContract: mockWETH.address,
              tokenId: 0,
              amount: 30,
            },
            {
              assetContract: mockWETH.address,
              tokenId: 0,
              amount: 31,
            },
          ],
          restrictions: [],
          verifier: verifiers[2],
        },
        {
          tokens: [
            {
              assetContract: mockLand.address,
              tokenId: 20002,
              amount: 0,
            },
            {
              assetContract: mockWETH.address,
              tokenId: 0,
              amount: 100,
            },
            {
              assetContract: mockUSDC.address,
              tokenId: 0,
              amount: 200,
            },
            {
              assetContract: mockAXS.address,
              tokenId: 0,
              amount: 300,
            },
            {
              assetContract: mock1155.address,
              tokenId: 1,
              amount: 1,
            },
            {
              assetContract: mock1155.address,
              tokenId: 2,
              amount: 1,
            },
          ],
          restrictions: [],
          verifier: verifiers[3],
        },
        {
          tokens: [
            {
              assetContract: mockAxie.address,
              tokenId: 10003,
              amount: 0,
            },
            {
              assetContract: mockLand.address,
              tokenId: 20003,
              amount: 0,
            },
            {
              assetContract: mockWETH.address,
              tokenId: 0,
              amount: 42,
            },
            {
              assetContract: mockUSDC.address,
              tokenId: 0,
              amount: 10,
            },
            {
              assetContract: mockUSDC.address,
              tokenId: 0,
              amount: 10,
            },
            {
              assetContract: mockLand.address,
              tokenId: 20004,
              amount: 0,
            },
            {
              assetContract: mockAXS.address,
              tokenId: 0,
              amount: 100,
            },
            {
              assetContract: NATIVE_TOKEN_ADDRESS,
              tokenId: 0,
              amount: BigInt(2 * 10e17),
            },
            {
              assetContract: mock1155.address,
              tokenId: 1,
              amount: 20,
            },
            {
              assetContract: mock1155.address,
              tokenId: 2,
              amount: 30,
            },
          ],
          restrictions: [],
          verifier: verifiers[4],
        },
      ];
      expect(await giftContract.createGifts(gift, { value: BigInt(20 * 10e17) })).to.emit(giftContract, 'GiftCreated');

      expect((await giftContract.getGift(verifiers[0])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[1])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[2])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[3])).claimed).to.equal(false);
      expect((await giftContract.getGift(verifiers[4])).claimed).to.equal(false);
      expect(await mockAxie.ownerOf(10000)).to.equal(giftContract.address);
      expect(await mockLand.ownerOf(20003)).to.equal(giftContract.address);
      expect(await ethers.provider.getBalance(giftContract.address)).to.equal(0);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(BigInt(7 * 10e17));
    });

    it('Should claim an multi gift', async function () {
      const claimer = (await ethers.getSigners())[10];

      const startRon = await ethers.provider.getBalance(claimer.address);
      const verifier = getVerifierAndCode('multigift 5').verifier.address;
      const giftID = (await giftContract.getGift(verifier)).giftID;
      const signature = await signData(getVerifierAndCode('multigift 5').code, giftID, claimer.address as Address);

      expect(await mockWETH.balanceOf(claimer.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(claimer.address)).to.equal(0);
      expect(await mockAXS.balanceOf(claimer.address)).to.equal(0);

      expect(await mock1155.balanceOf(giftContract.address, 1)).to.equal(22);
      expect(await mock1155.balanceOf(giftContract.address, 2)).to.equal(31);
      await expect(giftContract.connect(claimer).claimGift(giftID, claimer.address, signature))
        .to.emit(giftContract, 'GiftClaimed')
        .withArgs(giftID, claimer.address);

      expect(giftContract.getGift(verifier)).to.be.revertedWithCustomError(giftContract, 'InvalidGift');
      expect(await mockWETH.balanceOf(claimer.address)).to.equal(42);
      expect(await mockUSDC.balanceOf(claimer.address)).to.equal(20);
      expect(await mockAXS.balanceOf(claimer.address)).to.equal(100);
      expect(await mockAxie.ownerOf(10003)).to.equal(claimer.address);
      expect(await mockLand.ownerOf(20003)).to.equal(claimer.address);
      expect(await mock1155.balanceOf(claimer.address, 1)).to.equal(20);
      expect(await mock1155.balanceOf(claimer.address, 2)).to.equal(30);
      expect(await ethers.provider.getBalance(claimer.address)).above(startRon);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(BigInt(5 * 10e17)); // 5 ron remaining in unclaimed gift
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
      //await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith('Only gift creator can cancel the gift')
      await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWithCustomError(
        giftContract,
        'GiftAlreadyCancelled',
      );
    });
    it('Nothing to cancel, revert', async function () {
      const gifts = await giftContract.connect(addr1).getUnclaimedGifts();
      const giftIDs: bigint[] = [];
      gifts.map((gift: any) => giftIDs.push(gift.giftID));
      await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWithCustomError(
        giftContract,
        'InvalidGift',
      );
    });
    it('Gifting contract balance should be 0', async function () {
      expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockAxie.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockLand.balanceOf(giftContract.address)).to.equal(0);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(0);
      expect(await ethers.provider.getBalance(giftContract.address)).to.equal(0);
    });
  });
});
