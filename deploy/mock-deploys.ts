import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deploy = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Needed only for local hardhat tests
  if (network.name !== 'hardhat') return;

  await deploy('MockAtiaShrine', {
    from: deployer,
    args: [],
    log: true,
  });

  await deploy('MockWRON', {
    from: deployer,
    args: [],
    log: true,
  });
};

deploy.tags = ['MockContracts'];

export default deploy;
