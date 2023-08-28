const { ethers } = require('hardhat');

export async function deployContracts() {
  // Mock Atia
  const mockAtia = await (await ethers.getContractFactory('MockAtiaShrine')).deploy();
  await mockAtia.waitForDeployment();
  mockAtia.address = await mockAtia.getAddress();

  // Mock WRON
  const mockWRON = await (await ethers.getContractFactory('MockWRON')).deploy();
  await mockWRON.waitForDeployment();
  mockWRON.address = await mockWRON.getAddress();
  // Restriction Control
  const restrictionControl = await (
    await ethers.getContractFactory('RestrictionControl')
  ).deploy(await mockAtia.getAddress());
  await restrictionControl.waitForDeployment();
  restrictionControl.address = await restrictionControl.getAddress();

  // Gift Contract
  const giftContract = await (
    await ethers.getContractFactory('Gifts')
  ).deploy(mockWRON.address, restrictionControl.address);
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

  // ERC1155
  const mock1155 = await (await ethers.getContractFactory('MockERC1155')).deploy('MOCK1155');
  await mock1155.waitForDeployment();
  mock1155.address = await mock1155.getAddress();

  return {
    mockAtia,
    mockWRON,
    mockAxie,
    mockLand,
    mockWETH,
    mockUSDC,
    mockAXS,
    giftContract,
    restrictionControl,
    mock1155,
  };
}
