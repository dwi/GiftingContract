import { expect } from 'chai';
import { ethers } from 'hardhat';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { Address } from 'viem';
import { getVerifierAndCode, signData } from './utils/cryptography';
import { deployContracts } from './utils/deployTokenFixture';
import { NATIVE_TOKEN_ADDRESS, getGiftIDfromTx } from './utils/helpers';
import { signMetaTxRequest } from './utils/signer';
import { relay } from './utils/relay';

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
  mockWRON: any,
  minimalForwarder: any;

describe('Gifts: Meta Transactions ERC2771', async function () {
  beforeEach(async () => {
    [owner, addr1, addr2, operator] = await ethers.getSigners();
  });
  it('Should deploy contracts', async function () {
    const x = await loadFixture(deployContracts);
    mockAxie = x.mockAxie;
    mockWETH = x.mockWETH;
    giftContract = x.giftContract;
    mockWRON = x.mockWRON;
    minimalForwarder = x.minimalForwarder;
  });

  describe('Generate a gift', function () {
    const { verifier, code } = getVerifierAndCode('single-ron');
    var giftID: any;
    var tx: any;
    it('Should generate a gift', async function () {
      await mockAxie.setApprovalForAll(giftContract.address, true);
      const tokens = [
        {
          assetContract: NATIVE_TOKEN_ADDRESS,
          tokenId: 0,
          amount: BigInt(1 * 10e17),
        },
        {
          assetContract: mockAxie.address,
          tokenId: 1,
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
      const tx = await giftContract.createGift(gift[0], {
        value: gift[0].tokens[0].amount,
      });
      const res = await tx.wait();
      giftID = getGiftIDfromTx(giftContract, res);
      expect(await mockWRON.balanceOf(giftContract.address)).to.equal(tx.value);
      expect(await mockAxie.ownerOf(1)).to.equal(giftContract.address);
    });
    it('Should claim a gift using GSN meta transaction', async function () {
      const sig = await signData(code, giftID, addr1.address as Address);
      const { request, signature } = await signMetaTxRequest(addr1, minimalForwarder, {
        from: addr1.address,
        to: giftContract.address,
        data: giftContract.interface.encodeFunctionData('claimGift', [giftID, addr1.address, sig]), // Black hole
      });

      expect(await minimalForwarder.connect(operator).verify(request, signature)).to.equal(true);

      // Send meta-tx through relayer to the forwarder contract
      const gasLimit = parseInt(request.gas) + 50000;
      tx = await minimalForwarder.connect(operator).execute(request, signature, { gasLimit });

      const res = await tx.wait();
      expect(res.status).to.equal(1);
      expect(await mockAxie.ownerOf(1)).to.equal(addr1.address);
      expect(await mockAxie.balanceOf(minimalForwarder.address)).to.equal(0);
      expect(await mockWRON.balanceOf(addr1.address)).to.equal(0);
      expect(await ethers.provider.getBalance(minimalForwarder.address)).to.equal(0);
    });
    describe('Events', function () {
      it('Should emit matching GiftClaimed event', async function () {
        expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
      });
    });
  });
});
