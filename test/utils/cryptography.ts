import { HDKey, hdKeyToAccount } from 'viem/accounts';
import { Address, encodePacked, keccak256, toBytes, toHex } from 'viem';

export const dec2hex = (dec: number) => {
  return dec.toString(16).padStart(2, '0');
};

export const generateId = (len: number) => {
  const arr = new Uint8Array((len || 40) / 2);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
};

// Simplified version
export const getVerifierAndCode = (customCode?: string) => {
  const secret = customCode === '' || !customCode ? generateId(16) : customCode;

  return {
    verifier: getWalletFromCode(secret).verifier,
    code: secret,
  };
};

export const getWalletFromCode = (code: string) => {
  const rawBytes = new TextEncoder().encode(code);
  const encodedSecret = toHex(rawBytes).slice(2);
  const decodedSecretBytes = toBytes('0x' + encodedSecret);
  let padding: number[] = [];
  if (decodedSecretBytes.length < 64) {
    padding = [...Array.from(Array(64 - decodedSecretBytes.length).keys()).map(() => 0)];
  }
  const seed = [...padding, ...decodedSecretBytes];
  const verifier = hdKeyToAccount(HDKey.fromMasterSeed(Uint8Array.from(seed)));
  return { verifier };
};

export const signData = async (code: string, giftID: number, claimer: Address) => {
  const verifier = getWalletFromCode(code)?.verifier;
  if (!verifier) throw Error('Invalid claim code');
  const messageHash = keccak256(encodePacked(['uint256', 'address'], [BigInt(giftID), claimer]));
  const flatSig = await verifier.signMessage({ message: { raw: toBytes(messageHash) } });
  return flatSig;
};
