import { IEsploraApi } from './esplora-api.interface';

export interface AbstractBitcoinApi {
  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]>;
  $getRawTransaction(txId: string, skipConversion?: boolean, addPrevout?: boolean): Promise<IEsploraApi.Transaction>;
  $getBlockHeightTip(): Promise<number>;
  $getTxIdsForBlock(hash: string): Promise<string[]>;
  $getBlockHash(height: number): Promise<string>;
  $getBlock(hash: string): Promise<IEsploraApi.Block>;
  $getAddress(address: string): Promise<IEsploraApi.Address>;
  $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]>;
  $getAddressPrefix(prefix: string): string[];
}
