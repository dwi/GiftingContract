import { HardhatRuntimeEnvironment } from 'hardhat/types';

const deploy = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploymentConfig: any = {
    ['saigon']: {
      atiaShrine: '0xd5c5afefad9ea288acbaaebeacec5225dd3d6d2b',
    },
    ['ronin']: {
      atiaShrine: '0x9d3936dbd9a794ee31ef9f13814233d435bd806c',
    },
  };

  const atiaShrine =
    network.name === 'hardhat'
      ? (await deployments.get('MockAtiaShrine')).address
      : deploymentConfig[network.name].atiaShrine;

  await deploy('RestrictionControl', {
    from: deployer,
    args: [atiaShrine],
    log: true,
  });
};

deploy.dependencies = ['MockContracts'];
deploy.tags = ['RestrictionControl'];

export default deploy;
