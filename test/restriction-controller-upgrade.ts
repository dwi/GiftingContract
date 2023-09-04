import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address, encodePacked } from 'viem';
import { getVerifierAndCode, signData } from './utils/cryptography';
import { deployContracts } from './utils/deployTokenFixture';

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
  mockWRON: any,
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

describe('Gifts: Test restriction controller upgrade', async function () {
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
    mockWRON = x.mockWRON;

    // Legacy Restriction Control
    restrictionControl = await (
      await ethers.getContractFactory('LegacyRestrictionControl')
    ).deploy(await mockAtia.getAddress());
    await restrictionControl.waitForDeployment();
    restrictionControl.address = await restrictionControl.getAddress();

    // Gift Contract using legacy controller
    giftContract = await (
      await ethers.getContractFactory('Gifts')
    ).deploy(mockWRON.address, restrictionControl.address);
    await giftContract.waitForDeployment();
    giftContract.address = await giftContract.getAddress();

    expect(await mockAtia.hasCurrentlyActivated(owner.address)).to.equal(false);
    expect(await mockAxie.name()).to.equal('Axie');
    expect(await mockLand.name()).to.equal('Land');
  });

  it('Approve both contracts', async () => {
    await mockAxie.setApprovalForAll(giftContract.address, true);
    expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
  });
  it('Create a random gift with existing hasBlessingStreak restriction', async function () {
    const restrictions = [
      {
        id: 'hasBlessingStreak',
        args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['uint256'], [10]) as Address]),
      },
    ];
    const tx = createRandomSingleERC721Gift(owner, '1', restrictions);
    expect(tx);
  });
  it('Should Claim: Blessing Streak ✅', async function () {
    const tx = claimGiftTx(addr1, '1');
    expect(tx);
  });
  it('Create gift - Should revert: Invalid Restriction', async function () {
    const restrictions = [
      {
        id: 'hasBlessingStatus',
        args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['bool'], [true]) as Address]),
      },
    ];
    const tx = createRandomSingleERC721Gift(owner, '8', restrictions);
    await expect(tx).to.be.revertedWithCustomError(giftContract, 'InvalidRestriction');
  });
  it('Should deploy new controller version', async function () {
    const RestrictionControl = await ethers.getContractFactory('RestrictionControl');
    newRestrictionControll = await RestrictionControl.deploy(await mockAtia.getAddress());
    await newRestrictionControll.waitForDeployment();
  });
  it('Should revert updateController: onlyOwner', async function () {
    await expect(
      giftContract.connect(addr1).updateController(await newRestrictionControll.getAddress()),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
  it('Should revert updateController: wrong address', async function () {
    await expect(giftContract.updateController(ethers.Wallet.createRandom().address)).to.be.revertedWithCustomError(
      giftContract,
      'InvalidControllerAddress',
    );
  });
  it('Should revert updateController: wrong contract', async function () {
    await expect(giftContract.updateController(await giftContract.getAddress())).to.be.revertedWithCustomError(
      giftContract,
      'InvalidControllerAddress',
    );
  });
  it('Should correctly change restriction control address', async function () {
    const newController = await newRestrictionControll.getAddress();
    await expect(giftContract.updateController(newController))
      .to.emit(giftContract, 'ControllerUpdated')
      .withArgs(newController);
  });
  it('Should properly create a new gift with newly added restriction', async function () {
    const restrictions = [
      {
        id: 'hasBlessingStatus',
        args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['bool'], [true]) as Address]),
      },
    ];
    const tx = createRandomSingleERC721Gift(owner, '8', restrictions);
    await expect(await tx);
  });

  it('Should Revert claiming a gift: blessing: false', async function () {
    const tx = claimGiftTx(addr1, '8');
    await expect(tx).to.be.revertedWithCustomError(giftContract, 'UnmetRestriction').withArgs('hasBlessingStatus');
  });

  it('Should Activate Blessing', async function () {
    await mockAtia.connect(addr1).activateStreak();
    expect(await mockAtia.hasCurrentlyActivated(addr1.address)).to.equal(true);
  });
  it('Should Claim a gift', async function () {
    const tx = claimGiftTx(addr1, '8');
    expect(await tx);
  });
});
