import { expect } from 'chai';
import hre, { upgrades } from 'hardhat';
const { deployments, ethers, artifacts } = hre;

import { IERC20 } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract, EventLog } from 'ethers';
import { Deployment } from 'hardhat-deploy/types';
import { getVerifierAndCode, getWalletFromCode, signData } from './utils/cryptography';
import { Address } from 'viem';
let owner: SignerWithAddress,
  addr1: SignerWithAddress,
  addr2: SignerWithAddress,
  operator: SignerWithAddress,
  proxyContract: any,
  giftContract: any,
  giftContractV2: any,
  mockToken1Contract: any,
  mockToken2Contract: any,
  mockWETH: any,
  mockUSDC: any,
  mockAXS: any;

const { verifier: mockVerifier, code: mockEncodedSecret } = getVerifierAndCode('mockCode');
const { verifier: dummyVerifier, code: dummyEncodedSecret } = getVerifierAndCode('random');

function getGiftIDfromTx(tx: any) {
  let log = tx?.logs.find(
    (log: any) => giftContract.interface.parseLog(log as any)?.name === 'GiftCreated'
  ) as EventLog;
  return Number(log.args[0]);
}
describe('Deployment', async function () {
  async function deployTokenFixture() {
    const signers = await ethers.getSigners();
    owner = signers[0];
    addr1 = signers[1];
    addr2 = signers[2];
    operator = signers[3];

    const giftsFactory = await ethers.getContractFactory('NFTGifts_v3');
    giftContract = await giftsFactory.deploy();
    await giftContract.waitForDeployment();
    giftContract.address = await giftContract.getAddress();

    const mockERC721Factory = await ethers.getContractFactory('MockERC721');
    mockToken1Contract = await mockERC721Factory.deploy('Collection 1', 'NFT1', 98);
    mockToken2Contract = await mockERC721Factory.deploy('Collection 2', 'NFT2', 98);
    mockWETH = await (await ethers.getContractFactory('MockERC20')).deploy('Wrapped ETH', 'WETH');
    mockUSDC = await (await ethers.getContractFactory('MockERC20')).deploy('USDC', 'USDC');
    mockAXS = await (await ethers.getContractFactory('MockERC20')).deploy('AXS', 'AXS');
    await mockToken1Contract.waitForDeployment();
    await mockToken2Contract.waitForDeployment();
    await mockWETH.waitForDeployment();
    await mockUSDC.waitForDeployment();
    await mockAXS.waitForDeployment();
    mockToken1Contract.address = await mockToken1Contract.getAddress();
    mockToken2Contract.address = await mockToken2Contract.getAddress();
    mockWETH.address = await mockWETH.getAddress();
    mockUSDC.address = await mockUSDC.getAddress();
    mockAXS.address = await mockAXS.getAddress();
  }

  it('Should initialize correctly', async function () {
    expect(await deployTokenFixture());
    expect(giftContract.deploymentTransaction).to.not.be.undefined;
    expect(await mockToken1Contract.name()).to.equal('Collection 1');
    expect(await mockToken2Contract.symbol()).to.equal('NFT2');
  });
  it('Should get proper version', async function () {
    expect(await giftContract.version()).to.equal(2);
  });
  it('Should mint Mock Tokens', async () => {
    await mockToken1Contract.safeTransferFrom(owner.address, addr1.address, 6);
    await mockToken2Contract.batchMint(100, 5);
    await mockToken2Contract.connect(addr1).mint(1000);
    await mockToken2Contract.connect(addr1).mint(1001);
    await mockToken1Contract.connect(addr2).mint(2000);
    await mockToken1Contract.connect(addr2).mint(2001);
    await mockWETH.connect(addr1).mint(100000000000000);
    expect(await mockToken1Contract.balanceOf(owner.address)).to.equal(97);
    expect(await mockToken2Contract.balanceOf(owner.address)).to.equal(104);
    expect(await mockToken2Contract.balanceOf(addr1.address)).to.equal(2);
    expect(await mockWETH.balanceOf(addr1.address)).to.equal(100000000000000);
  });

  describe('Create a gift', function () {
    const verifier1 = getVerifierAndCode('gift 1').verifier.address;
    const verifier2 = ethers.Wallet.createRandom().address;
    it('Approve NFT Collections', async function () {
      await mockToken1Contract.setApprovalForAll(giftContract.address, true);
      await mockToken2Contract.connect(addr1).setApprovalForAll(giftContract.address, true);
      expect(await mockToken1Contract.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      expect(await mockToken2Contract.isApprovedForAll(addr1.address, giftContract.address)).to.equal(true);
      expect(await mockToken1Contract.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
    });
    it('Should create gifts', async function () {
      await giftContract.createGift([mockToken1Contract.address], [1], verifier1);
      await giftContract.createGift([mockToken1Contract.address], [2], verifier2);
      expect(await mockToken1Contract.balanceOf(owner.address)).to.equal(95);
      expect(await mockToken1Contract.balanceOf(giftContract.address)).to.equal(2);
      expect((await giftContract.getGift(verifier1)).claimed).to.equal(false);
      expect((await giftContract.getGift(verifier1)).claimed).to.equal(false);
    });
    describe('Events', function () {
      it('Should emit matching GiftCreated', async function () {
        const addr = [mockToken2Contract.address, mockToken2Contract.address];
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
          giftContract.connect(owner).createGift([mockToken1Contract.address], [3], mockVerifier.address)
        ).to.be.revertedWith('NFTGifts: Sharing code already used');
      });
      it('Should revert createGift when using invalid ERC721/ERC20 address', async function () {
        await expect(giftContract.connect(owner).createGift([addr2.address], [3], ethers.Wallet.createRandom().address))
          .to.be.reverted;
      });
      it('Should revert when gifting owned token ID but gift contract is not approved', async function () {
        await expect(
          giftContract
            .connect(addr2)
            .createGift([mockToken1Contract.address], [2000], ethers.Wallet.createRandom().address)
        ).to.be.revertedWith('ERC721: caller is not token owner or approved');
      });
      it('Should revert when gifting not owned token ID', async function () {
        await expect(
          giftContract.createGift([mockToken1Contract.address], [6], ethers.Wallet.createRandom().address)
        ).to.be.revertedWith('ERC721: caller is not token owner or approved');
      });
      it('Should revert when gifting not owned token ID placed on unapproved smart contract', async function () {
        await expect(
          giftContract.createGift([mockToken1Contract.address], [1], ethers.Wallet.createRandom().address)
        ).to.be.revertedWith('ERC721: transfer from incorrect owner');
      });
      it('Should revert when gifting invalid token ID', async function () {
        await expect(
          giftContract.createGift([mockToken1Contract.address], [999999], ethers.Wallet.createRandom().address)
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
        const tx = await giftContract.connect(owner).createGift([mockToken1Contract.address], [5], verifier.address);
        const res = await tx.wait();
        giftID = getGiftIDfromTx(res);

        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
        expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
        expect(await mockToken1Contract.ownerOf(5)).to.equal(giftContract.address);
      });
      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr1.address as Address);
        tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(true);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockToken1Contract.ownerOf(5)).to.equal(addr1.address);
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
        await mockToken2Contract.setApprovalForAll(giftContract.address, true);
        expect(await mockToken2Contract.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      });
      it('Should generate a gift', async function () {
        const tx = await giftContract.createGift(
          [
            mockToken2Contract.address,
            mockToken2Contract.address,
            mockToken2Contract.address,
            mockToken2Contract.address,
          ],
          axies,
          verifier.address
        );
        const res = await tx.wait();
        giftID = getGiftIDfromTx(res);

        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
        expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
        expect(await mockToken2Contract.ownerOf(axies[0])).to.equal(giftContract.address);
      });
      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr2.address as Address);
        tx = await giftContract.connect(operator).claimGift(giftID, addr2.address, signature);
        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(true);
        expect(await mockToken2Contract.ownerOf(axies[0])).to.equal(addr2.address);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockToken2Contract.ownerOf(axies[0])).to.equal(addr2.address);
      });
      it('Operator should not have any new tokens', async function () {
        expect(await mockToken2Contract.balanceOf(operator.address)).to.equal(0);
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
          'NFTGifts: Cannot claim your own gift'
        );
      });
      it('Should revert when claiming gift with wrong claimer', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(3, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier'
        );
      });
      it('Should revert when claiming gift with different giftID', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(4, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier'
        );
      });
      it('Should revert when claiming already claimed gift', async function () {
        const signature = await signData(mockEncodedSecret, 3, addr1.address as Address);
        await expect(giftContract.connect(owner).claimGift(4, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier'
        );
      });
    });
  });
  describe('Cancel a gift', function () {
    var bal: any;
    var tx: any;
    it('Should cancel unclaimed gift', async function () {
      bal = Number(await mockToken1Contract.balanceOf(owner.address));
      tx = await giftContract.cancelGifts([1]);
      expect(giftContract.getGift(getVerifierAndCode('gift 1').verifier.address)).to.be.revertedWith(
        'NFTGifts: Invalid gift'
      );
    });

    it('Token IDs are returned back to gift creator', async function () {
      expect(await mockToken1Contract.balanceOf(owner.address)).to.equal(bal + 1);
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
          'NFTGifts: Only gift creator can cancel the gift'
        );
      });

      it('Should revert because already claimed', async function () {
        await expect(giftContract.connect(addr1).cancelGifts([4])).to.be.revertedWith(
          'NFTGifts: The gift has already been claimed'
        );
      });
      it('Should revert because gift already cancelled', async function () {
        await expect(giftContract.cancelGifts([1])).to.be.revertedWith('NFTGifts: The gift has been already cancelled');
      });
    });
  });

  describe('Multi ERC721 gifts', function () {
    describe('Generate multi-asset gift', function () {
      const { verifier, code } = getVerifierAndCode('multi-asset');
      var giftID: any;
      var tx: any;
      it('Should mint multi tokens', async () => {
        await mockToken1Contract.mint(5001);
        await mockToken1Contract.mint(5002);
        await mockToken2Contract.mint(5101);
        await mockToken2Contract.mint(5102);
        await mockToken1Contract.mint(5003);
        await mockToken2Contract.mint(5103);
        expect(await mockToken1Contract.ownerOf(5001)).to.equal(owner.address);
        expect(await mockToken1Contract.ownerOf(5002)).to.equal(owner.address);
        expect(await mockToken2Contract.ownerOf(5101)).to.equal(owner.address);
        expect(await mockToken2Contract.ownerOf(5102)).to.equal(owner.address);
      });
      it('Approve both contracts', async () => {
        await mockToken1Contract.setApprovalForAll(giftContract.address, true);
        await mockToken2Contract.setApprovalForAll(giftContract.address, true);
        expect(await mockToken1Contract.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
        expect(await mockToken2Contract.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      });
      it('Should generate a multi-gift', async function () {
        const addr = [
          mockToken1Contract.address,
          mockToken2Contract.address,
          mockToken1Contract.address,
          mockToken2Contract.address,
        ];
        const ids = [5001, 5101, 5002, 5102];
        const tx = await giftContract.createGift(addr, ids, verifier.address);
        const res = await tx.wait();
        giftID = getGiftIDfromTx(res);
        expect(await mockToken1Contract.ownerOf(5001)).to.equal(giftContract.address);
        expect(await mockToken2Contract.ownerOf(5101)).to.equal(giftContract.address);
        expect((await giftContract.getGift(verifier.address)).claimed).to.equal(false);
        expect((await giftContract.getGift(verifier.address)).giftID).to.equal(giftID);
      });
      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr1.address as Address);
        tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature);
        expect(giftContract.getGift(verifier.address)).to.be.revertedWith('NFTGifts: Invalid gift');
        expect(await mockToken1Contract.ownerOf(5001)).to.equal(addr1.address);
        expect(await mockToken2Contract.ownerOf(5101)).to.equal(addr1.address);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockToken1Contract.ownerOf(5)).to.equal(addr1.address);
      });
      it('Should revert when one or all collections are not approved', async () => {
        const { verifier, code } = getVerifierAndCode('multi-asset2');
        await mockToken1Contract.connect(addr1).setApprovalForAll(giftContract.address, false);
        expect(await mockToken1Contract.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
        const addr = [
          mockToken1Contract.address,
          mockToken2Contract.address,
          mockToken1Contract.address,
          mockToken2Contract.address,
        ];
        const ids = [5001, 5101, 5002, 5102];
        expect(giftContract.connect(addr1).createGift(addr, ids, verifier.address)).to.be.reverted;
        await mockToken2Contract.connect(addr1).setApprovalForAll(giftContract.address, false);
        expect(await mockToken2Contract.isApprovedForAll(addr1.address, giftContract.address)).to.equal(false);
        expect(giftContract.connect(addr1).createGift(addr, ids, verifier.address)).to.be.reverted;
      });
      describe('Events', function () {
        it('Should emit matching GiftClaimed event', async function () {
          expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
        });
      });
    });
  });
  describe('ERC20 Support', function () {
    describe('Create an ERC20 Gift', async function () {
      const { verifier, code } = getVerifierAndCode('a single erc20 gift');
      var giftID: any;
      var tx: any;
      it('Should generate a single ERC20 gift', async function () {
        await mockWETH.approve(giftContract.address, 500000);
        const tx = await giftContract.createGift([mockWETH.address], [500000], verifier.address);
        const res = await tx.wait();
        giftID = getGiftIDfromTx(res);
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
          giftContract.createGift([mockWETH.address], [1], ethers.Wallet.createRandom().address)
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
          verifier.address
        );
        const res = await tx.wait();
        giftID = getGiftIDfromTx(res);
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
            ethers.Wallet.createRandom().address
          )
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
        const addresses = [
          mockWETH.address,
          mockToken1Contract.address,
          mockUSDC.address,
          mockAXS.address,
          mockToken2Contract.address,
        ];
        const ids = [123123, 91, 90045, 123123, 92];
        const tx = await giftContract.createGift(addresses, ids, verifier.address);
        const res = await tx.wait();
        giftID = getGiftIDfromTx(res);
        expect(await mockWETH.balanceOf(giftContract.address)).to.equal(123123);
        expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(90045);
        expect(await mockAXS.balanceOf(giftContract.address)).to.equal(123123);
        expect(await mockToken1Contract.ownerOf(91)).to.equal(giftContract.address);
        expect(await mockToken2Contract.ownerOf(92)).to.equal(giftContract.address);
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
        expect(await mockToken1Contract.ownerOf(91)).to.equal(addr1.address);
        expect(await mockToken2Contract.ownerOf(92)).to.equal(addr1.address);
      });
      it('Should revert when ERC20 has low/no allowance', async () => {
        await mockWETH.approve(giftContract.address, 0);
        await expect(
          giftContract.createGift(
            [mockWETH.address, mockToken1Contract.address],
            [1, 93],
            ethers.Wallet.createRandom().address
          )
        ).to.be.revertedWith('ERC20: insufficient allowance');
      });
      it('Should revert when ERC721 not allowed', async () => {
        await mockWETH.approve(giftContract.address, 1);
        await mockToken1Contract.setApprovalForAll(giftContract.address, false);
        await expect(
          giftContract.createGift(
            [mockWETH.address, mockToken1Contract.address],
            [1, 93],
            ethers.Wallet.createRandom().address
          )
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
        await mockToken1Contract.setApprovalForAll(giftContract.address, true);
        await mockToken2Contract.setApprovalForAll(giftContract.address, true);
        await mockWETH.approve(giftContract.address, 123123);
        await mockUSDC.approve(giftContract.address, 90045);
        await mockAXS.approve(giftContract.address, 123123);
        await mockToken1Contract.batchMint(10000, 10);
        await mockToken2Contract.batchMint(20000, 10);

        const addresses = [
          [mockToken1Contract.address, mockWETH.address],
          [mockToken1Contract.address, mockToken2Contract.address, mockWETH.address],
          [mockToken1Contract.address, mockToken2Contract.address, mockWETH.address, mockWETH.address],
          [mockToken2Contract.address, mockWETH.address, mockUSDC.address, mockAXS.address],
          [
            mockToken1Contract.address,
            mockToken2Contract.address,
            mockWETH.address,
            mockUSDC.address,
            mockUSDC.address,
            mockToken2Contract.address,
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
        expect(await giftContract.createGifts(addresses, ids, verifiers)).to.emit(giftContract, 'GiftCreated');
        expect((await giftContract.getGift(verifiers[0])).claimed).to.equal(false);
        expect((await giftContract.getGift(verifiers[1])).claimed).to.equal(false);
        expect((await giftContract.getGift(verifiers[2])).claimed).to.equal(false);
        expect((await giftContract.getGift(verifiers[3])).claimed).to.equal(false);
        expect((await giftContract.getGift(verifiers[4])).claimed).to.equal(false);
        expect(await mockToken1Contract.ownerOf(10000)).to.equal(giftContract.address);
        expect(await mockToken2Contract.ownerOf(20003)).to.equal(giftContract.address);
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
        expect(await mockToken1Contract.ownerOf(10003)).to.equal(claimer.address);
        expect(await mockToken2Contract.ownerOf(20003)).to.equal(claimer.address);
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
        const giftIDs = [];
        gifts.map((gift: any) => giftIDs.push(gift.giftID));
        giftIDs.push(2);
        //await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith('NFTGifts: Only gift creator can cancel the gift')
        await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith(
          'NFTGifts: The gift has been already cancelled'
        );
      });
      it('Cancel the rest', async function () {
        const gifts = await giftContract.connect(addr1).getUnclaimedGifts();
        const giftIDs: bigint[] = [];
        gifts.map((gift: any) => giftIDs.push(gift.giftID));
        expect(await giftContract.connect(addr1).cancelGifts(giftIDs)).to.emit(giftContract, 'GiftCancelled');
        await expect(giftContract.connect(addr1).cancelGifts(giftIDs)).to.be.revertedWith(
          'NFTGifts: The gift has been already cancelled'
        );
      });
      it('Gifting contract balance should be 0', async function () {
        expect(await mockWETH.balanceOf(giftContract.address)).to.equal(0);
        expect(await mockUSDC.balanceOf(giftContract.address)).to.equal(0);
        expect(await mockAXS.balanceOf(giftContract.address)).to.equal(0);
        expect(await mockToken1Contract.balanceOf(giftContract.address)).to.equal(0);
        expect(await mockToken2Contract.balanceOf(giftContract.address)).to.equal(0);
      });
    });
  });
});
