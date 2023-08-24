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

export const getVerifierAndCode = (customCode?: string) => {
  const secret = customCode === '' || !customCode ? generateId(16) : customCode;
  const index = 1;

  // if Saigon, prefix the code with 's'
  const encodedCode = `${Number(index).toString(16)}_${secret}`;

  return {
    verifier: getWalletFromCode(encodedCode).verifier,
    code: encodedCode,
  };
};

export const getWalletFromCode = (code: string) => {
  const [idHex, secret] = code.split('_');
  const id = parseInt(idHex, 16);

  const rawBytes = new TextEncoder().encode(secret);

  const encodedSecret = toHex(rawBytes).slice(2);
  const randomPath = "m/44'/60'/0'/" + id;

  const decodedSecretBytes = toBytes('0x' + encodedSecret);
  let padding: number[] = [];
  if (decodedSecretBytes.length < 64) {
    padding = [...Array.from(Array(64 - decodedSecretBytes.length).keys()).map(() => 0)];
  }
  const seed = [...padding, ...decodedSecretBytes];
  const verifier = hdKeyToAccount(HDKey.fromMasterSeed(Uint8Array.from(seed)), {
    path: randomPath as `m/44'/60'/${string}`,
  });
  return { verifier };
};

export const signData = async (code: string, giftID: number, claimer: Address) => {
  const verifier = getWalletFromCode(code)?.verifier;
  if (!verifier) throw Error('Invalid claim code');
  const messageHash = keccak256(encodePacked(['uint256', 'address'], [BigInt(giftID), claimer]));
  const flatSig = await verifier.signMessage({ message: { raw: toBytes(messageHash) } });
  return flatSig;
};
