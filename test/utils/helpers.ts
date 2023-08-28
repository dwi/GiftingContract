export const getGiftIDfromTx = (constract: any, tx: any) => {
  let log = tx?.logs.find((log: any) => constract.interface.parseLog(log as any)?.name === 'GiftCreated');
  return Number(log.args[0]);
};
