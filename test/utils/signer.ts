import ethSigUtil from 'eth-sig-util';

declare global {
  interface BigInt {
    toJSON(): string;
  }
}
const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const ForwardRequest = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'data', type: 'bytes' },
];

export function getMetaTxTypeData(chainId: any, verifyingContract: any) {
  return {
    types: {
      EIP712Domain,
      ForwardRequest,
    },
    domain: {
      name: 'MinimalForwarder',
      version: '0.0.1',
      chainId,
      verifyingContract,
    },
    primaryType: 'ForwardRequest',
  };
}

async function signTypedData(signer: any, from: string, data: any): Promise<string> {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
  const [method, argData] = ['eth_signTypedData_v4', JSON.stringify(data)];
  return await signer.provider.send(method, [from, argData]);
}

export async function buildRequest(forwarder: any, input: any) {
  const nonce = await forwarder.getNonce(input.from).then((nonce: any) => nonce.toString());
  return { value: 0, gas: 1e6, nonce, ...input };
}

export async function buildTypedData(forwarder: any, chainId: any, request: any) {
  const typeData = getMetaTxTypeData(chainId, forwarder.address);
  return { ...typeData, message: request };
}

export async function signMetaTxRequest(signer: any, forwarder: any, input: any) {
  const chainId = (await signer.provider.getNetwork()).chainId;
  const request = await buildRequest(forwarder, input);
  const toSign = await buildTypedData(forwarder, chainId, request);
  const signature = await signTypedData(signer, input.from, toSign);
  return { signature, request };
}
