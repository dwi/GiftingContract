// Right click on the script name and hit "Run" to execute
const { expect } = require('chai');
const { ethers } = require('hardhat');

let MockAxie, NFTGifts, owner, addr1, addr2, operator, mockAxie, giftContract;
function code(str) {
  return ethers.utils.solidityKeccak256(['string'], [str])
}

describe('NFTGifts v1 - Use hashed code everywhere', function () {
  const goodCode = 'validCode';
  const badCode = 'invalidCode';
  const goodCodeHash = ethers.utils.solidityKeccak256(['string'], [goodCode]);

  async function deployTokenFixture() {
    MockAxie = await ethers.getContractFactory('MockAxie');
    NFTGifts = await ethers.getContractFactory('NFTGifts_v1');
    owner = (await ethers.getSigners())[0];
    addr1 = (await ethers.getSigners())[1];
    addr2 = (await ethers.getSigners())[2];
    operator = (await ethers.getSigners())[3];
    mockAxie = await MockAxie.deploy();
    giftContract = await NFTGifts.deploy();

    await mockAxie.deployed();
    await giftContract.deployed();
  }

  describe('Deployment', function () {
    it('Should initialize correctly', async function () {
      expect(await deployTokenFixture());
      expect(await mockAxie.name()).to.equal('MockAxie');
      expect(await mockAxie.symbol()).to.equal('MAXIE');

      expect(await giftContract.getUnclaimedGifts()).to.deep.equal([]);
    });
    it('Should mint Mock Axies', async () => {
      await mockAxie.connect(owner).mint(1);
      await mockAxie.connect(owner).mint(2);
      await mockAxie.connect(owner).mint(3);
      await mockAxie.connect(owner).mint(4);
      await mockAxie.connect(owner).mint(5);
      await mockAxie.connect(owner).mint(6);
      await mockAxie.connect(owner).mint(7);
      await mockAxie.connect(owner).mint(8);
      await mockAxie.connect(owner).mint(9);
      await mockAxie.connect(owner).mint(10);
      await mockAxie.connect(addr1).mint(11);
      await mockAxie.connect(addr1).mint(12);
      await mockAxie.connect(addr1).mint(13);
      await mockAxie.connect(addr1).mint(14);
      await mockAxie.connect(addr2).mint(15);
      expect(await mockAxie.balanceOf(owner.address)).to.equal(10);
      expect(await mockAxie.balanceOf(addr1.address)).to.equal(4);
      expect(await mockAxie.balanceOf(addr2.address)).to.equal(1);
    });
  });

  describe('Create a gift', function () {
    it('Approve MockAxie', async function () {
      await mockAxie.connect(owner).setApprovalForAll(giftContract.address, true);
      await mockAxie.connect(addr1).setApprovalForAll(giftContract.address, true);
      expect(await mockAxie.isApprovedForAll(owner.address, giftContract.address)).to.equal(true);
      expect(await mockAxie.isApprovedForAll(addr1.address, giftContract.address)).to.equal(true);
      expect(await mockAxie.isApprovedForAll(addr2.address, giftContract.address)).to.equal(false);
    });

    it('Should make gifts #1, #2 and #3 ', async function () {
      await giftContract.connect(owner).createGift(mockAxie.address, [1], code('1'));
      await giftContract.connect(owner).createGift(mockAxie.address, [2], code('2'));
      expect(await mockAxie.balanceOf(owner.address)).to.equal(8);
      expect(await mockAxie.balanceOf(giftContract.address)).to.equal(2);
      expect((await giftContract.getGift(code('2'))).claimed).to.equal(false);
    });
    describe('Events', function () {
      it('Should emit matching GiftCreated', async function () {
        const axies = [11, 12];
        await expect(await giftContract.connect(addr1).createGift(mockAxie.address, axies, code('3')))
          .to.emit(giftContract, 'GiftCreated')
          .withArgs(code('3'), addr1.address, mockAxie.address, axies);
      });
    });
    describe('Reading data', function () {
      it('Should return correct data from getUnclaimedGifts', async function () {
        expect((await giftContract.connect(owner).getUnclaimedGifts()).length).to.equal(2);
        expect((await giftContract.connect(addr1).getUnclaimedGifts()).length).to.equal(1);
      });
      it('Should return correct data from getGift', async function () {
        expect((await giftContract.getGift(code('1'))).creator).to.equal(owner.address);
        expect((await giftContract.getGift(code('3'))).creator).to.equal(addr1.address);
      });
    });
    describe('Test reverts', function () {
      it('Should revert when using existing code', async function () {
        await expect(giftContract.connect(owner).createGift(mockAxie.address, [3], code('1')))
        .to.be.revertedWith('NFTGifts: Secret code already used')
      });
      it('Should revert when using standard address instead of smart contract address', async function () {
        await expect(giftContract.connect(owner).createGift(addr2.address, [3], goodCodeHash))
          .to.be.revertedWith('function call to a non-contract account')
          .revertedWithoutReason();
      });
      it('Should revert when gifting owned token ID but gift contract is not approved', async function () {
        await expect(giftContract.connect(addr2).createGift(mockAxie.address, [15], goodCodeHash)).to.be.revertedWith(
          'ERC721: caller is not token owner or approved'
        );
      });
      it('Should revert when gifting not owned token ID', async function () {
        await expect(giftContract.createGift(mockAxie.address, [15], goodCodeHash)).to.be.revertedWith(
          'ERC721: caller is not token owner or approved'
        );
      });
      it('Should revert when gifting not owned token ID placed on unapproved smart contract', async function () {
        await expect(giftContract.createGift(mockAxie.address, [1], goodCodeHash)).to.be.revertedWith(
          'ERC721: transfer from Invalid owner'
        ).to.be.revertedWith(
          'ERC721: transfer from incorrect owner'
        );
      });
      it('Should revert when gifting invalid token ID', async function () {
        await expect(giftContract.createGift(mockAxie.address, [999999], goodCodeHash)).to.be.revertedWith(
          'ERC721: invalid token ID'
        );
      });
    });
  });

  describe('Claim a gift', function () {
    describe('giftID(1)', function () {
      const giftID = 1;
      let hash, sig, tx;
      it('Should generate correct claiming signature for #1', async function () {
        hash = await giftContract.connect(addr2).getGiftHash('1');
        sig = await addr2.signMessage(ethers.utils.arrayify(hash));
        expect(
          ethers.utils.recoverAddress(ethers.utils.arrayify(ethers.utils.hashMessage(ethers.utils.arrayify(hash))), sig)
        ).to.equal(addr2.address);
      });
      it('Should successfully claim gift #1', async function () {
        let bal = Number(await mockAxie.balanceOf(addr2.address));
        tx = await giftContract.connect(addr2).claimGift(code('1'), sig);
        expect(await mockAxie.balanceOf(addr2.address)).to.equal(bal + 1);
        expect((await giftContract.getGift(code('1'))).claimed).to.equal(true);
      });
      describe('Events', function () {
        it('Should emit matching GiftClaimed event', async function () {
          await expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(code('1'), addr2.address);
        });
      });
    });
    describe('giftID(2)', function () {
      let hash, sig, bal;
      const giftID = 2;
      it('Should generate correct claiming signature for #2', async function () {
        hash = await giftContract.connect(addr2).getGiftHash('2');
        sig = await addr2.signMessage(ethers.utils.arrayify(hash));
        expect(
          ethers.utils.recoverAddress(ethers.utils.arrayify(ethers.utils.hashMessage(ethers.utils.arrayify(hash))), sig)
        ).to.equal(addr2.address);
      });
      it('Should successfully claim gift #2 by operator using signature', async function () {
        bal = Number(await mockAxie.balanceOf(addr2.address));
        // OPERATOR is executing the transactions
        await giftContract.connect(operator).claimGift(code('2'), sig);
        expect((await giftContract.getGift(code('2'))).claimed).to.equal(true);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockAxie.balanceOf(addr2.address)).to.equal(bal + 1);
      });
      it('Operator should not have any new tokens', async function () {
        expect(await mockAxie.balanceOf(operator.address)).to.equal(0);
      });
    });
    describe('Test reverts', function () {
      let sig;
      const giftID = 3;
      it('Should revert when trying to generate signature for your own gift', async function () {
        await expect(giftContract.connect(addr1).getGiftHash('3')).to.be.revertedWith(
          'NFTGifts: Cannot claim your own gift'
        );
      });
      it('Should revert when trying to use wrong code', async function () {
        await expect(giftContract.connect(addr2).getGiftHash(code('3'))).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
        await expect(giftContract.connect(addr2).getGiftHash('x')).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
      });
      it('Should revert when trying to generate signature for already claimed gift', async function () {
        sig = giftContract.connect(addr1).getGiftHash('1');
        await expect(sig).to.be.revertedWith('NFTGifts: Gift has already been claimed');
      });
      it('Should revert when trying to claim claimed gift with already used signature', async function () {
        await expect(giftContract.connect(operator).claimGift(code('1'), sig)).to.be.revertedWith(
          'NFTGifts: Gift has already been claimed'
        );
      });
      it('Should revert when trying to generate signature for non existing or deleted gift', async function () {
        await expect(giftContract.connect(addr1).getGiftHash('unknown')).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
      });
    });
  });
  describe('Cancel a gift', function () {
    let hash, sig, tx, bal;
    it(`Should create a gift`, async function () {
      const bal = Number(await mockAxie.balanceOf(owner.address));
      await giftContract.createGift(mockAxie.address, [7], code('4'));
      expect(await mockAxie.balanceOf(owner.address)).to.equal(bal - 1);
    });
    it('Should generate correct claiming signature for #4', async function () {
      hash = await giftContract.connect(addr2).getGiftHash('4');
      sig = await addr2.signMessage(ethers.utils.arrayify(hash));
      expect(
        ethers.utils.recoverAddress(ethers.utils.arrayify(ethers.utils.hashMessage(ethers.utils.arrayify(hash))), sig)
      ).to.equal(addr2.address);
    });
    it('Should cancel unclaimed gift', async function () {
      bal = Number(await mockAxie.balanceOf(owner.address));
      tx = await giftContract.cancelGift(code('4'));
      await expect(giftContract.getGift(code('4'))).to.be.revertedWith('NFTGifts: Invalid secret code');
    });
    it('Token IDs are returned back to gift creator', async function () {
      expect(await mockAxie.balanceOf(owner.address)).to.equal(bal + 1);
    });
    it('Should not be able to generate signature for cancelled gift', async function () {
      await expect(giftContract.connect(addr2).getGiftHash('4')).to.be.revertedWith(
        'NFTGifts: Invalid secret code'
      );
    });
    it('Should not be able to claim cancelled gift', async function () {
      let bal = Number(await mockAxie.balanceOf(addr2.address));
      await expect(giftContract.connect(addr2).claimGift(code('4'), sig)).to.be.revertedWith(
        'NFTGifts: Invalid secret code'
      );
      expect(await mockAxie.balanceOf(addr2.address)).to.equal(bal);
    });
    describe('Events', function () {
      it('Should emit matching GiftCancelled event', async function () {
        await expect(tx).to.emit(giftContract, 'GiftCancelled').withArgs(code('4'));
      });
    });

    describe('Test reverts', function () {
      it('Should create a gift #5', async function () {
        const bal = Number(await mockAxie.balanceOf(owner.address));
        await giftContract.createGift(mockAxie.address, [8], code('test5'));
        expect(await mockAxie.balanceOf(owner.address)).to.equal(bal - 1);
      });
      it('Should revert because of invalid gift ID', async function () {
        await expect(giftContract.cancelGift(code('99999'))).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
      });
      it('Should revert because not owner of that gift', async function () {
        await expect(giftContract.connect(addr1).cancelGift(code('test5'))).to.be.revertedWith(
          'NFTGifts: Only gift creator can cancel the gift'
        );
      });
      it('Should not be able to generate signature for cancelled gift', async function () {
        await expect(giftContract.connect(addr2).getGiftHash('4')).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
      });
      it('Should not be able to claim cancelled gift', async function () {
        let bal = Number(await mockAxie.balanceOf(addr2.address));
        await expect(giftContract.connect(addr2).claimGift(code('4'), sig)).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
        expect(await mockAxie.balanceOf(addr2.address)).to.equal(bal);
      });
      it('Should revert because already claimed', async function () {
        await expect(giftContract.cancelGift(code('1'))).to.be.revertedWith(
          'NFTGifts: The gift has already been claimed'
        );
      });
      it('Should revert because gift already cancelled', async function () {
        await expect(giftContract.cancelGift(code('4'))).to.be.revertedWith(
          'NFTGifts: The gift has been already cancelled'
        );
      });
    });
  });

  describe('Create a multiple gifts in one tx', function () {
    let unclaimed;
    it('Mint Axies', async function () {
      await mockAxie.connect(owner).mint(21);
      await mockAxie.connect(owner).mint(22);
      await mockAxie.connect(owner).mint(23);
      await mockAxie.connect(owner).mint(24);
      await mockAxie.connect(owner).mint(25);
      await mockAxie.connect(owner).mint(26);
      await mockAxie.connect(owner).mint(27);
    });
    it('Should make 3 gifts at once', async function () {
      unclaimed = Number((await giftContract.connect(owner).getUnclaimedGifts()).length);
      const bal = Number(await mockAxie.balanceOf(owner.address));
      const gifts1 = [mockAxie.address, mockAxie.address, mockAxie.address];
      const gifts2 = [[21, 22, 23, 24], [25], [26, 27]];
      const gifts3 = [
        ethers.utils.solidityKeccak256(['string'], ['pass1']),
        ethers.utils.solidityKeccak256(['string'], ['pass2']),
        ethers.utils.solidityKeccak256(['string'], ['pass3']),
      ];

      await giftContract.connect(owner).createGifts(gifts1, gifts2, gifts3);

      expect(await mockAxie.balanceOf(owner.address)).to.equal(bal - 7);
      expect((await giftContract.getGift(code('pass3'))).claimed).to.equal(false);
    });
    describe('Reading data', function () {
      it('Should return correct data from getUnclaimedGifts', async function () {
        expect((await giftContract.connect(owner).getUnclaimedGifts()).length).to.equal(unclaimed + 3);
      });
      it('Should return correct data from getGift', async function () {
        expect((await giftContract.getGift(code('pass2'))).creator).to.equal(owner.address);
        expect((await giftContract.getGift(code('pass3'))).claimed).to.equal(false);
      });
    });
    describe('Claim gifts created by createGifts()', function () {
      it('[1/3] Should generate correct claiming signature', async function () {
        hash = await giftContract.connect(addr1).getGiftHash('pass1');
        sig = await addr1.signMessage(ethers.utils.arrayify(hash));
        expect(
          ethers.utils.recoverAddress(ethers.utils.arrayify(ethers.utils.hashMessage(ethers.utils.arrayify(hash))), sig)
        ).to.equal(addr1.address);
      });
      it('[1/3] Should successfully claim gift', async function () {
        bal = Number(await mockAxie.balanceOf(addr1.address));
        await giftContract.connect(addr1).claimGift(code('pass1'), sig);
        expect((await giftContract.getGift(code('pass1'))).claimed).to.equal(true);
        expect(await mockAxie.balanceOf(addr1.address)).to.equal(bal + 4);
      });

      it('[2/3] Should generate correct claiming signature', async function () {
        hash = await giftContract.connect(addr1).getGiftHash('pass2');
        sig = await addr1.signMessage(ethers.utils.arrayify(hash));
        expect(
          ethers.utils.recoverAddress(ethers.utils.arrayify(ethers.utils.hashMessage(ethers.utils.arrayify(hash))), sig)
        ).to.equal(addr1.address);
      });
      it('[2/3] Should successfully claim gift', async function () {
        bal = Number(await mockAxie.balanceOf(addr1.address));
        await giftContract.connect(addr1).claimGift(code('pass2'), sig);
        expect((await giftContract.getGift(code('pass2'))).claimed).to.equal(true);
        expect(await mockAxie.balanceOf(addr1.address)).to.equal(bal + 1);
      });

      it('[3/3] Should revert because of wrong pass', async function () {
        await expect(giftContract.connect(addr2).getGiftHash('wrongpass')).to.be.revertedWith(
          'NFTGifts: Invalid secret code'
        );
      });
      it('[3/3] Should generate correct claiming signature', async function () {
        hash = await giftContract.connect(addr2).getGiftHash('pass3');
        sig = await addr2.signMessage(ethers.utils.arrayify(hash));
        expect(
          ethers.utils.recoverAddress(ethers.utils.arrayify(ethers.utils.hashMessage(ethers.utils.arrayify(hash))), sig)
        ).to.equal(addr2.address);
      });
      it('[3/3] Should successfully claim gift', async function () {
        bal = Number(await mockAxie.balanceOf(addr2.address));
        await giftContract.connect(addr2).claimGift(code('pass3'), sig);
        expect((await giftContract.getGift(code('pass3'))).claimed).to.equal(true);
        expect(await mockAxie.balanceOf(addr2.address)).to.equal(bal + 2);
      });
    });
  });

});
