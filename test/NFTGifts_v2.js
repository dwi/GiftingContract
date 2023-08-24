// Right click on the script name and hit "Run" to execute
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { getVerifierAndCode, getWalletFromCode, signData } = require('./utils/cryptography');

let MockAxie, NFTGifts, owner, addr1, addr2, operator, mockAxie, giftContract, claimedID, cancelledID
const { verifier: mockVerifier, code: mockCode } = getVerifierAndCode('mockCode')
const { verifier: dummyVerifier, code: dummyCode } = getVerifierAndCode('random')

function getGiftIDfromTx(tx) {
  let log = tx?.logs.find(
    (log) => giftContract.interface.parseLog(log)?.name === 'GiftCreated'
  )
  return Number(log.args[0]);
}

describe('NFTGifts v2 - Use verifier', function () {
  async function deployTokenFixture() {

    const mockERC721Factory = await ethers.getContractFactory('MockERC721');
    NFTGifts = await ethers.getContractFactory('NFTGifts_v2');
    owner = (await ethers.getSigners())[0];
    addr1 = (await ethers.getSigners())[1];
    addr2 = (await ethers.getSigners())[2];
    operator = (await ethers.getSigners())[3];
    mockAxie = await mockERC721Factory.deploy('MockAxie', 'MAXIE', 10);
    giftContract = await NFTGifts.deploy();

    await mockAxie.waitForDeployment();
    await giftContract.waitForDeployment();
    mockAxie.address = await mockAxie.getAddress();
    giftContract.address = await giftContract.getAddress();
  }

  describe('Deployment', function () {
    it('Should initialize correctly', async function () {
      expect(await deployTokenFixture());
      expect(await mockAxie.name()).to.equal('MockAxie');
      expect(await mockAxie.symbol()).to.equal('MAXIE');

      expect(await giftContract.getUnclaimedGifts()).to.deep.equal([]);
    });
    it('Should mint Mock Axies', async () => {
      await mockAxie.connect(addr1).batchMint(11, 3);
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
      await giftContract.connect(owner).createGift(mockAxie.address, [1], ethers.Wallet.createRandom().address);
      await giftContract.connect(owner).createGift(mockAxie.address, [2], ethers.Wallet.createRandom().address);
      expect(await mockAxie.balanceOf(owner.address)).to.equal(8);
      expect(await mockAxie.balanceOf(giftContract.address)).to.equal(2);
      expect((await giftContract.getGift(2)).claimed).to.equal(false);
    });
    describe('Events', function () {
      it('Should emit matching GiftCreated', async function () {
        const axies = [11, 12];
        await expect(await giftContract.connect(addr1).createGift(mockAxie.address, axies, mockVerifier.address))
          .to.emit(giftContract, 'GiftCreated')
          .withArgs(3, addr1.address, mockAxie.address, axies);
      });
    });
    describe('Reading data', function () {
      it('Should return correct data from getUnclaimedGifts', async function () {
        expect((await giftContract.connect(owner).getUnclaimedGifts()).length).to.equal(2);
        expect((await giftContract.connect(addr1).getUnclaimedGifts()).length).to.equal(1);
      });
      it('Should return correct data from getGift', async function () {
        expect((await giftContract.getGift(1)).creator).to.equal(owner.address);
        expect((await giftContract.getGift(3)).creator).to.equal(addr1.address);
      });
    });

    describe('Test reverts', function () {
      it('Should revert when using existing code', async function () {
        await expect(giftContract.connect(owner).createGift(mockAxie.address, [3], mockVerifier.address))
          .to.be.revertedWith('NFTGifts: Sharing code already used')
      });
      it('Should revert when using standard address instead of smart contract address', async function () {
        await expect(giftContract.connect(owner).createGift(addr2.address, [3], ethers.Wallet.createRandom().address))
          .to.be.revertedWith('NFTGifts: Invalid NFT contract address')
      });
      it('Should revert when gifting owned token ID but gift contract is not approved', async function () {
        await expect(giftContract.connect(addr2).createGift(mockAxie.address, [15], ethers.Wallet.createRandom().address)).to.be.revertedWith(
          'ERC721: caller is not token owner or approved'
        );
      });
      it('Should revert when gifting not owned token ID', async function () {
        await expect(giftContract.createGift(mockAxie.address, [15], ethers.Wallet.createRandom().address)).to.be.revertedWith(
          'ERC721: caller is not token owner or approved'
        );
      });
      it('Should revert when gifting not owned token ID placed on unapproved smart contract', async function () {
        await expect(giftContract.createGift(mockAxie.address, [1], ethers.Wallet.createRandom().address))
          .to.be.revertedWith(
            'ERC721: transfer from incorrect owner'
          );
      });
      it('Should revert when gifting invalid token ID', async function () {
        await expect(giftContract.createGift(mockAxie.address, [999999], ethers.Wallet.createRandom().address)).to.be.revertedWith(
          'ERC721: invalid token ID'
        );
      });
    });
  })

  describe('Gift Claiming', function () {

    describe('Claim a gift properly', function () {
      const { verifier, code } = getVerifierAndCode('share code 123')
      var giftID, tx
      var axies = [3, 4]
      it('Should generate a gift', async function () {
        const tx = await giftContract.connect(owner).createGift(mockAxie.address, axies, verifier.address);
        const res = await tx.wait()
        giftID = getGiftIDfromTx(res)

        expect((await giftContract.getGift(giftID)).claimed).to.equal(false);
        expect(await mockAxie.ownerOf(axies[0])).to.equal(giftContract.address);
        expect(await giftContract.getGiftID(verifier.address)).to.equal(giftID);
      });


      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr1.address)
        tx = await giftContract.connect(addr1).claimGift(giftID, addr1.address, signature)
        expect((await giftContract.getGift(giftID)).claimed).to.equal(true);
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockAxie.ownerOf(axies[0])).to.equal(addr1.address);
      });
      describe('Events', function () {
        it('Should emit matching GiftClaimed event', async function () {
          await expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr1.address);
        });
      });
    });

    describe('Claim a gift by operator', function () {
      const { verifier, code } = getVerifierAndCode('share code 999')
      var giftID, tx
      var axies = [5, 6, 8, 9]

      it('Should generate a gift', async function () {
        const tx = await giftContract.connect(owner).createGift(mockAxie.address, axies, verifier.address);
        const res = await tx.wait()
        giftID = getGiftIDfromTx(res)

        expect((await giftContract.getGift(giftID)).claimed).to.equal(false);
        expect(await mockAxie.ownerOf(axies[0])).to.equal(giftContract.address);
        expect(await giftContract.getGiftID(verifier.address)).to.equal(giftID);
      });

      it('Should claim a gift', async function () {
        const signature = await signData(code, giftID, addr2.address)
        tx = await giftContract.connect(operator).claimGift(giftID, addr2.address, signature)

        expect((await giftContract.getGift(giftID)).claimed).to.equal(true);
        expect(await mockAxie.ownerOf(axies[0])).to.equal(addr2.address);
        claimedID = giftID
      });
      it("Token ID should be on original signer's address", async function () {
        expect(await mockAxie.ownerOf(axies[0])).to.equal(addr2.address);
      });
      it('Operator should not have any new tokens', async function () {
        expect(await mockAxie.balanceOf(operator.address)).to.equal(0);
      });
      describe('Events', function () {
        it('Should emit matching GiftClaimed event for original claimer', async function () {
          await expect(tx).to.emit(giftContract, 'GiftClaimed').withArgs(giftID, addr2.address);
        });
      });
    });

    describe('Test reverts', function () {
      /*
      giftID = 3
      creator = addr1
      */
      it('Should revert when claiming your own gift', async function () {
        const signature = await signData(mockCode, 3, addr1.address)
        await expect(giftContract.connect(owner).claimGift(3, addr1.address, signature)).to.be.revertedWith(
          'NFTGifts: Cannot claim your own gift'
        )
      });
      it('Should revert when claiming gift with wrong claimer', async function () {
        const signature = await signData(mockCode, 3, addr1.address)
        await expect(giftContract.connect(owner).claimGift(3, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier'
        )
      });
      it('Should revert when claiming gift with different giftID', async function () {
        const signature = await signData(mockCode, 3, addr1.address)
        await expect(giftContract.connect(owner).claimGift(4, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier'
        )
      });
      it('Should revert when claiming already claimed gift', async function () {
        const signature = await signData(mockCode, 3, addr1.address)
        await expect(giftContract.connect(owner).claimGift(4, owner.address, signature)).to.be.revertedWith(
          'NFTGifts: Invalid verifier'
        )
      });
    });
  });


  describe('Cancel a gift', function () {
    const { verifier, code } = getVerifierAndCode('share code for cancel')
    let hash, sig, tx, bal, giftID

    it('Should create a gift', async function () {
      const bal = Number(await mockAxie.balanceOf(owner.address));
      const tx = await giftContract.connect(owner).createGift(mockAxie.address, [7], verifier.address);
      const res = await tx.wait()
      giftID = getGiftIDfromTx(res)
      expect(await mockAxie.balanceOf(owner.address)).to.equal(bal - 1);
    });
    it('Should cancel unclaimed gift', async function () {
      bal = Number(await mockAxie.balanceOf(owner.address));
      tx = await giftContract.cancelGift(giftID);
      cancelledID = giftID
      expect((await giftContract.getGift(giftID)).cancelled).to.equal(true)
    });

    it('Token IDs are returned back to gift creator', async function () {
      expect(await mockAxie.balanceOf(owner.address)).to.equal(bal + 1);
    });
    it('Should not be able to claim cancelled gift', async function () {
      const signature = await signData(code, giftID, addr1.address)
      await expect(giftContract.connect(addr1).claimGift(giftID, addr1.address, signature)).to.be.revertedWith(
        'NFTGifts: Gift has been cancelled'
      )
    });

    describe('Events', function () {
      it('Should emit matching GiftCancelled event', async function () {
        await expect(tx).to.emit(giftContract, 'GiftCancelled').withArgs(giftID);
      });
    });

    describe('Test reverts', function () {
      let giftID
      it('Should create a gift', async function () {
        const bal = Number(await mockAxie.balanceOf(owner.address));
        const tx = await giftContract.connect(owner).createGift(mockAxie.address, [7], dummyVerifier.address);
        const res = await tx.wait()
        giftID = getGiftIDfromTx(res)
        expect(await mockAxie.balanceOf(owner.address)).to.equal(bal - 1);
      });
      it('Should revert because of invalid gift ID', async function () {
        await expect(giftContract.cancelGift(99999)).to.be.revertedWith(
          'NFTGifts: Invalid gift'
        );
      });
      it('Should revert because not owner of that gift', async function () {
        await expect(giftContract.connect(addr1).cancelGift(giftID)).to.be.revertedWith(
          'NFTGifts: Only gift creator can cancel the gift'
        );
      });

      it('Should revert because already claimed', async function () {
        await expect(giftContract.cancelGift(claimedID)).to.be.revertedWith(
          'NFTGifts: The gift has already been claimed'
        );
      });
      it('Should revert because gift already cancelled', async function () {
        await expect(giftContract.cancelGift(cancelledID)).to.be.revertedWith(
          'NFTGifts: The gift has been already cancelled'
        );
      });
    });
  });

  // describe('Create a multiple gifts in one tx', function () {
  //   let unclaimed, giftID

  //   const { verifier: pass1, code: passCode1 } = getVerifierAndCode('pass1')
  //   const { verifier: pass2, code: passCode2 } = getVerifierAndCode('pass2')
  //   const { verifier: pass3, code: passCode3 } = getVerifierAndCode('pass3')
  //   const { verifier: pass4, code: passCode4 } = getVerifierAndCode('pass4')
  //   const { verifier: pass5, code: passCode5 } = getVerifierAndCode('pass5')
  //   const { verifier: pass6, code: passCode6 } = getVerifierAndCode('pass6')
  //   const { verifier: pass7, code: passCode7 } = getVerifierAndCode('pass7')
  //   const { verifier: pass8, code: passCode8 } = getVerifierAndCode('pass8')
  //   const { verifier: pass9, code: passCode9 } = getVerifierAndCode('pass9')
  //   const { verifier: pass10, code: passCode10 } = getVerifierAndCode('pass10')

  //   it('Mint Axies', async function () {
  //     for (let i = 21; i <= 100; i++) {
  //       await mockAxie.connect(owner).mint(i);
  //     }
  //   });
  //   it('Should make many gifts at once', async function () {
  //     unclaimed = Number((await giftContract.connect(owner).getUnclaimedGifts()).length);
  //     const bal = Number(await mockAxie.balanceOf(owner.address));

  //     const gifts1 = [mockAxie.address, mockAxie.address, mockAxie.address, mockAxie.address];
  //     const gifts2 = [[21, 22, 23, 24, 28, 29, 30], [25, 31, 32], [26, 27, 33, 34, 35, 36, 37, 38, 39], [40, 41, 42]];
  //     const gifts3 = [pass1.address, pass2.address, pass3.address, pass4.address];

  //     const gifts1b = [mockAxie.address, mockAxie.address, mockAxie.address, mockAxie.address, mockAxie.address, mockAxie.address];
  //     const gifts2b = [[43, 44, 45], [46], [47], [48], [49], [50]];
  //     const gifts3b = [pass5.address, pass6.address, pass7.address, pass8.address, pass9.address, pass10.address];

  //     await giftContract.connect(owner).createGifts(gifts1, gifts2, gifts3);
  //     const tx = await giftContract.connect(owner).createGifts(gifts1b, gifts2b, gifts3b);
  //     const res = await tx.wait()
  //     giftID = getGiftIDfromTx(res)
  //     expect(await mockAxie.balanceOf(owner.address)).to.equal(bal - 30);
  //   });

  //   describe('Reading data', function () {
  //     it('Should return correct data from getUnclaimedGifts', async function () {
  //       expect((await giftContract.connect(owner).getUnclaimedGifts()).length).to.equal(unclaimed + 10);
  //     });
  //     it('Should return correct data from getGift', async function () {
  //       expect((await giftContract.getGift(giftID)).creator).to.equal(owner.address);
  //       expect((await giftContract.getGift(giftID)).claimed).to.equal(false);
  //     });
  //   });
  //   describe('Claim gifts created by createGifts()', function () {
  //     it('[1/3] Should successfully claim gift', async function () {
  //       bal = Number(await mockAxie.balanceOf(addr1.address));

  //       const signature = await signData(passCode1, giftID - 4, addr1.address)
  //       await giftContract.connect(addr1).claimGift(giftID - 4, addr1.address, signature)
  //       expect((await giftContract.getGift(giftID - 4)).claimed).to.equal(true);
  //       expect(await mockAxie.balanceOf(addr1.address)).to.equal(bal + 7);
  //     });

  //     it('[2/3] Should successfully claim gift', async function () {
  //       bal = Number(await mockAxie.balanceOf(addr1.address));
  //       const signature = await signData(passCode2, giftID - 3, addr1.address)
  //       await giftContract.connect(addr1).claimGift(giftID - 3, addr1.address, signature)
  //       expect((await giftContract.getGift(giftID - 3)).claimed).to.equal(true);
  //       expect(await mockAxie.balanceOf(addr1.address)).to.equal(bal + 3);
  //     });

  //     it('[3/3] Should revert because of wrong pass', async function () {
  //       const signature = await signData(passCode2, giftID - 2, addr1.address)
  //       await expect(giftContract.connect(addr1).claimGift(giftID - 2, addr1.address, signature)).to.be.revertedWith(
  //         'NFTGifts: Invalid verifier'
  //       );
  //     });
  //     it('[3/3] Should successfully claim gift', async function () {
  //       bal = Number(await mockAxie.balanceOf(addr2.address));
  //       const signature = await signData(passCode3, giftID - 2, addr2.address)
  //       await giftContract.connect(addr2).claimGift(giftID - 2, addr2.address, signature)
  //       expect((await giftContract.getGift(giftID - 2)).claimed).to.equal(true);
  //       expect(await mockAxie.balanceOf(addr2.address)).to.equal(bal + 9);
  //     });
  //   })
  // });
  // describe('Stress test', function () {
  //   const { verifier: pass4, code: passCode4 } = getVerifierAndCode('pass4')
  //   const { verifier: pass5, code: passCode5 } = getVerifierAndCode('pass5')
  //   const { verifier: pass6, code: passCode6 } = getVerifierAndCode('pass6')
  //   const { verifier: pass7, code: passCode7 } = getVerifierAndCode('pass7')
  //   const { verifier: pass8, code: passCode8 } = getVerifierAndCode('pass8')
  //   const { verifier: pass9, code: passCode9 } = getVerifierAndCode('pass9')
  //   const { verifier: pass10, code: passCode10 } = getVerifierAndCode('pass10')
  //   const giftID = 11
  //   const gifts = [
  //     passCode4,
  //     passCode5,
  //     passCode6,
  //     passCode7,
  //     passCode8,
  //     passCode9,
  //     passCode10,
  //   ]
  //   it('[x/x] Claim all remaining gifts', async function () {
  //     for (let i = 0; i <= 4; i++) {
  //       const claimer = (await ethers.getSigners())[i + 5]
  //       let id = giftID + i
  //       const signature = await signData(gifts[i], id, addr2.address)
  //       await giftContract.connect(claimer).claimGift(id, addr2.address, signature)
  //       expect((await giftContract.getGift(id)).claimed).to.equal(true);
  //     }
  //   });

  //   it('[x/x] Cancel the rest', async function () {
  //     await expect(giftContract.cancelGift(16)).to.emit(giftContract, 'GiftCancelled').withArgs(16);
  //     await expect(giftContract.cancelGift(17)).to.emit(giftContract, 'GiftCancelled').withArgs(17);
  //   })
  //   it('Mint A lot of Axies', async function () {
  //     for (let i = 18; i <= 300; i++) {
  //       await mockAxie.connect(addr1).mint(i + 150);
  //     }
  //     for (let i = 18; i <= 200; i++) {
  //       const { verifier } = getVerifierAndCode('mass' + i)
  //       await giftContract.connect(addr1).createGift(mockAxie.address, [i + 150], verifier.address);
  //     }
  //     let gift1

  //     for (let i = 68; i <= 200; i++) {
  //       await giftContract.connect(addr1).cancelGift(i);
  //       gift1 = i
  //     }
  //     let gift2 = gift1
  //     for (let i = 201; i <= 295; i += 3) {
  //       gift2++
  //       const { verifier, code } = getVerifierAndCode('mass' + gift2)
  //       await giftContract.connect(addr1).createGift(mockAxie.address, [i + 150, i + 150 + 1, i + 150 + 2], verifier.address);
  //     }
  //     for (let i = gift1 + 1; i <= gift1 + 14; i++) {
  //       await giftContract.connect(addr1).cancelGift(i);
  //     }
  //     const lastGift = gift1 + 14
  //     for (let i = lastGift + 1; i <= lastGift + 17; i++) {
  //       const claimer = (await ethers.getSigners())[i]
  //       const { verifier, code } = getVerifierAndCode('mass' + i)


  //       const signature = await signData(code, i, claimer.address)

  //       await giftContract.connect(claimer).claimGift(i, claimer.address, signature)

  //       expect((await giftContract.getGift(i)).claimed).to.equal(true);
  //     }
  //   })
  // })
});
