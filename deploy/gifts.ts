import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Address } from 'viem';

const deploy = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploymentConfig: any = {
    ['saigon']: {
      WRON: '0xA959726154953bAe111746E265E6d754F48570E6',
    },
    ['ronin']: {
      WRON: '0xe514d9DEB7966c8BE0ca922de8a064264eA6bcd4',
    },
  };

  const restrictionController = await deployments.get('RestrictionControl');
  const WRON =
    network.name === 'hardhat' ? (await deployments.get('MockWRON')).address : deploymentConfig[network.name].WRON;

  await deploy('Gifts', {
    from: deployer,
    args: [WRON, restrictionController.address],
    log: true,
  });
};

deploy.dependencies = ['RestrictionControl'];
deploy.tags = ['Gifts'];

export default deploy;
