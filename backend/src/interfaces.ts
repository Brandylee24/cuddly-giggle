export interface MempoolInfo {
  size: number;
  bytes: number;
  usage?: number;
  maxmempool?: number;
  mempoolminfee?: number;
  minrelaytxfee?: number;
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
}

export interface MempoolBlockWithTransactions extends MempoolBlock {
  transactionIds: string[];
}

export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  fee: number;
  size: number;
  weight: number;
  vin: Vin[];
  vout: Vout[];
  status: Status;
}

export interface TransactionMinerInfo {
  vin: VinStrippedToScriptsig[];
  vout: VoutStrippedToScriptPubkey[];
}

interface VinStrippedToScriptsig {
  scriptsig: string;
}

interface VoutStrippedToScriptPubkey {
  scriptpubkey_address: string | undefined;
  value: number;
}

export interface TransactionExtended extends Transaction {
  vsize: number;
  feePerVsize: number;
  firstSeen: number;
}

export interface Vin {
  txid: string;
  vout: number;
  is_coinbase: boolean;
  scriptsig: string;
  scriptsig_asm: string;
  inner_redeemscript_asm?: string;
  inner_witnessscript_asm?: string;
  sequence: any;
  witness?: string[];
  prevout: Vout;
  // Elements
  is_pegin?: boolean;
  issuance?: Issuance;
}

interface Issuance {
  asset_id: string;
  is_reissuance: string;
  asset_blinding_nonce: string;
  asset_entropy: string;
  contract_hash: string;
  assetamount?: number;
  assetamountcommitment?: string;
  tokenamount?: number;
  tokenamountcommitment?: string;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
  // Elements
  valuecommitment?: number;
  asset?: string;
  pegout?: Pegout;
}

interface Pegout {
  genesis_hash: string;
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_address: string;
}

export interface Status {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface Block {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  bits: number;
  nounce: number;
  difficulty: number;
  merkle_root: string;
  tx_count: number;
  size: number;
  weight: number;
  previousblockhash: string;

  // Custom properties
  medianFee?: number;
  feeRange?: number[];
  reward?: number;
  coinbaseTx?: TransactionMinerInfo;
  matchRate: number;
  stage: number;
}

export interface Address {
  address: string;
  chain_stats: ChainStats;
  mempool_stats: MempoolStats;
}

export interface ChainStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface MempoolStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface Statistic {
  id?: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  vbytes_per_second: number;
  total_fee: number;
  mempool_byte_weight: number;
  fee_data: string;

  vsize_1: number;
  vsize_2: number;
  vsize_3: number;
  vsize_4: number;
  vsize_5: number;
  vsize_6: number;
  vsize_8: number;
  vsize_10: number;
  vsize_12: number;
  vsize_15: number;
  vsize_20: number;
  vsize_30: number;
  vsize_40: number;
  vsize_50: number;
  vsize_60: number;
  vsize_70: number;
  vsize_80: number;
  vsize_90: number;
  vsize_100: number;
  vsize_125: number;
  vsize_150: number;
  vsize_175: number;
  vsize_200: number;
  vsize_250: number;
  vsize_300: number;
  vsize_350: number;
  vsize_400: number;
  vsize_500: number;
  vsize_600: number;
  vsize_700: number;
  vsize_800: number;
  vsize_900: number;
  vsize_1000: number;
  vsize_1200: number;
  vsize_1400: number;
  vsize_1600: number;
  vsize_1800: number;
  vsize_2000: number;
}

export interface OptimizedStatistic {
  id: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  vbytes_per_second: number;
  total_fee: number;
  mempool_byte_weight: number;
  vsizes: number[];
}

export interface Outspend {
  spent: boolean;
  txid: string;
  vin: number;
  status: Status;
}
export interface WebsocketResponse {
  action: string;
  data: string[];
  'track-tx': string;
  'track-address': string;
  'watch-mempool': boolean;
}

export interface VbytesPerSecond {
  unixTime: number;
  vSize: number;
}

export interface BisqBlocks {
  chainHeight: number;
  blocks: BisqBlock[];
}

export interface BisqBlock {
  height: number;
  time: number;
  hash: string;
  previousBlockHash: string;
  txs: BisqTransaction[];
}

export interface BisqTransaction {
  txVersion: string;
  id: string;
  blockHeight: number;
  blockHash: string;
  time: number;
  inputs: BisqInput[];
  outputs: BisqOutput[];
  txType: string;
  txTypeDisplayString: string;
  burntFee: number;
  invalidatedBsq: number;
  unlockBlockHeight: number;
}

export interface BisqStats {
  minted: number;
  burnt: number;
  addresses: number;
  unspent_txos: number;
  spent_txos: number;
}

interface BisqInput {
  spendingTxOutputIndex: number;
  spendingTxId: string;
  bsqAmount: number;
  isVerified: boolean;
  address: string;
  time: number;
}

interface BisqOutput {
  txVersion: string;
  txId: string;
  index: number;
  bsqAmount: number;
  btcAmount: number;
  height: number;
  isVerified: boolean;
  burntFee: number;
  invalidatedBsq: number;
  address: string;
  scriptPubKey: BisqScriptPubKey;
  time: any;
  txType: string;
  txTypeDisplayString: string;
  txOutputType: string;
  txOutputTypeDisplayString: string;
  lockTime: number;
  isUnspent: boolean;
  spentInfo: SpentInfo;
  opReturn?: string;
}

interface BisqScriptPubKey {
  addresses: string[];
  asm: string;
  hex: string;
  reqSigs: number;
  type: string;
}

interface SpentInfo {
  height: number;
  inputIndex: number;
  txId: string;
}

export interface BisqTrade {
  direction: string;
  price: string;
  amount: string;
  volume: string;
  payment_method: string;
  trade_id: string;
  trade_date: number;
}
