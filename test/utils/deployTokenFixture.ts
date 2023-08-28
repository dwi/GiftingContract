const { ethers } = require('hardhat');

export async function deployContracts() {
  // Mock Atia
  const mockAtia = await (await ethers.getContractFactory('MockAtiaShrine')).deploy();
  await mockAtia.waitForDeployment();
  mockAtia.address = await mockAtia.getAddress();

  // Restriction Control
  const restrictionControl = await (
    await ethers.getContractFactory('RestrictionControl')
  ).deploy(await mockAtia.getAddress());
  await restrictionControl.waitForDeployment();
  restrictionControl.address = await restrictionControl.getAddress();

  // Gift Contract
  const giftContract = await (await ethers.getContractFactory('Gifts')).deploy(restrictionControl.address);
  await giftContract.waitForDeployment();
  giftContract.address = await giftContract.getAddress();

  // ERC721
  const mockAxie = await (await ethers.getContractFactory('MockERC721')).deploy('Axie', 'AXIE', 98);
  const mockLand = await (await ethers.getContractFactory('MockERC721')).deploy('Land', 'LAND', 98);
  await mockAxie.waitForDeployment();
  await mockLand.waitForDeployment();
  mockAxie.address = await mockAxie.getAddress();
  mockLand.address = await mockLand.getAddress();

  //ERC20
  const mockWETH = await (await ethers.getContractFactory('MockERC20')).deploy('Wrapped ETH', 'WETH');
  const mockUSDC = await (await ethers.getContractFactory('MockERC20')).deploy('USDC', 'USDC');
  const mockAXS = await (await ethers.getContractFactory('MockERC20')).deploy('AXS', 'AXS');
  await mockWETH.waitForDeployment();
  await mockUSDC.waitForDeployment();
  await mockAXS.waitForDeployment();
  mockWETH.address = await mockWETH.getAddress();
  mockUSDC.address = await mockUSDC.getAddress();
  mockAXS.address = await mockAXS.getAddress();
  return { mockAtia, mockAxie, mockLand, mockWETH, mockUSDC, mockAXS, giftContract, restrictionControl };
}