import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address, encodePacked } from 'viem';
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
  restrictionControl: any,
  newRestrictionControll: any;

const { verifier: mockVerifier, code: mockEncodedSecret } = getVerifierAndCode('mockCode');
const { verifier: dummyVerifier, code: dummyEncodedSecret } = getVerifierAndCode('random');

const createRandomSingleERC721Gift = async (owner: any, code: string, args?: { id: string; args: string }[]) => {
  const randomId = Math.floor(Math.random() * (1000000 - 100000)) + 100000;
  const { verifier } = getVerifierAndCode(code);
  await mockAxie.connect(owner).mint(randomId);
  const tx = args
    ? giftContract['createGift(address[],uint256[],(string,bytes)[],address)'](
        [mockAxie.address],
        [randomId],
        args,
        verifier.address,
      )
    : giftContract.createGift([mockAxie.address], [randomId], verifier.address);
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

    // Restriction Control
    restrictionControl = await (
      await ethers.getContractFactory('LegacyRestrictionControl')
    ).deploy(await mockAtia.getAddress());
    await restrictionControl.waitForDeployment();
    restrictionControl.address = await restrictionControl.getAddress();

    // Gift Contract
    giftContract = await (await ethers.getContractFactory('Gifts')).deploy(restrictionControl.address);
    await giftContract.waitForDeployment();
    giftContract.address = await giftContract.getAddress();

    expect(await mockAtia.hasCurrentlyActivated(owner.address)).to.equal(false);
    expect(await mockAxie.name()).to.equal('Axie');
    expect(await mockLand.name()).to.equal('Land');
    expect(await giftContract.version()).to.equal(3);
  });

  it('Approve both contracts', async () => {
    await mockAxie.setApprovalForAll(giftContract.address, true);
    expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
  });

  describe('Deploy New Restriction Control version', function () {
    it('Should Create a #8 gift: Invalid Restriction', async function () {
      const restrictions = [
        {
          id: 'hasBlessingStatus',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['bool'], [true]) as Address]),
        },
      ];
      const tx = createRandomSingleERC721Gift(owner, '8', restrictions);
      await expect(tx).to.be.revertedWith('Invalid Restriction');
    });
    it('Should deploy new version', async function () {
      const RestrictionControl = await ethers.getContractFactory('RestrictionControl');
      newRestrictionControll = await RestrictionControl.deploy(await mockAtia.getAddress());
      await newRestrictionControll.waitForDeployment();
    });
    it('Should revert - onlyOwner', async function () {
      await expect(
        giftContract.connect(addr1).updateController(await newRestrictionControll.getAddress()),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Update revert - wrong address', async function () {
      await expect(giftContract.updateController(ethers.Wallet.createRandom().address)).to.be.revertedWith(
        'Invalid contract address',
      );
    });
    it('Update revert - wrong contract', async function () {
      await expect(giftContract.updateController(await giftContract.getAddress())).to.be.revertedWith(
        'Invalid interface',
      );
    });
    it('Should change restriction control address', async function () {
      const newController = await newRestrictionControll.getAddress();
      await expect(giftContract.updateController(newController))
        .to.emit(giftContract, 'ControllerUpdated')
        .withArgs(newController);
    });
    it('Should Create a #11 gift: Newly added restriction', async function () {
      const restrictions = [
        {
          id: 'hasBlessingStatus',
          args: encodePacked(['bytes'], [new ethers.AbiCoder().encode(['bool'], [true]) as Address]),
        },
      ];
      const tx = createRandomSingleERC721Gift(owner, '11', restrictions);
      await expect(await tx);
    });

    it('Should Revert claiming a #11 - blessing: false', async function () {
      const tx = claimGiftTx(addr1, '11');
      await expect(tx).to.be.revertedWith('Restriction check hasBlessingStatus failed');
    });

    it('Should Activate Atia Shrine', async function () {
      await mockAtia.connect(addr1).activateStreak();
      expect(await mockAtia.hasCurrentlyActivated(addr1.address)).to.equal(true);
    });
    it('Should Claim #11', async function () {
      const tx = claimGiftTx(addr1, '11');
      expect(await tx);
    });
  });
});
