import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Address } from 'viem';

const deploy = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const restrictionController = await deployments.get('RestrictionControl');

  await deploy('Gifts', {
    from: deployer,
    args: [restrictionController.address],
    log: true,
  });
};

deploy.dependencies = ['RestrictionControl'];
deploy.tags = ['Gifts'];

export default deploy;
