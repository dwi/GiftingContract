import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Address } from 'viem';

const deploy = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  interface RestrictionControllerConfig {
    [network: string]: {
      atiaShrine: Address;
    };
  }

  const controllerConfig: RestrictionControllerConfig = {
    ['saigon']: {
      atiaShrine: '0xd5c5afefad9ea288acbaaebeacec5225dd3d6d2b',
    },
    ['ronin']: {
      atiaShrine: '0x9d3936dbd9a794ee31ef9f13814233d435bd806c',
    },
    ['hardhat']: {
      atiaShrine: (await deployments.get('MockAtiaShrine')).address as Address,
    },
  };
  await deploy('RestrictionControl', {
    from: deployer,
    args: [controllerConfig[network.name].atiaShrine],
    log: true,
  });
};

deploy.dependencies = ['MockAtiaShrine'];
deploy.tags = ['RestrictionControl'];

export default deploy;
