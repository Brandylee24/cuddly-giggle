const configFile = require('../mempool-config.json');

interface IConfig {
  MEMPOOL: {
    NETWORK: 'mainnet' | 'testnet' | 'signet' | 'liquid' | 'liquidtestnet';
    BACKEND: 'esplora' | 'electrum' | 'none';
    HTTP_PORT: number;
    SPAWN_CLUSTER_PROCS: number;
    API_URL_PREFIX: string;
    POLL_RATE_MS: number;
    CACHE_DIR: string;
    CLEAR_PROTECTION_MINUTES: number;
    RECOMMENDED_FEE_PERCENTILE: number;
    BLOCK_WEIGHT_UNITS: number;
    INITIAL_BLOCKS_AMOUNT: number;
    MEMPOOL_BLOCKS_AMOUNT: number;
    INDEXING_BLOCKS_AMOUNT: number;
    PRICE_FEED_UPDATE_INTERVAL: number;
    USE_SECOND_NODE_FOR_MINFEE: boolean;
    EXTERNAL_ASSETS: string[];
  };
  ESPLORA: {
    REST_API_URL: string;
  };
  ELECTRUM: {
    HOST: string;
    PORT: number;
    TLS_ENABLED: boolean;
  };
  CORE_RPC: {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  SECOND_CORE_RPC: {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  DATABASE: {
    ENABLED: boolean;
    HOST: string,
    PORT: number;
    DATABASE: string;
    USERNAME: string;
    PASSWORD: string;
  };
  SYSLOG: {
    ENABLED: boolean;
    HOST: string;
    PORT: number;
    MIN_PRIORITY: 'emerg' | 'alert' | 'crit' | 'err' |'warn' | 'notice' | 'info' | 'debug';
    FACILITY: string;
  };
  STATISTICS: {
    ENABLED: boolean;
    TX_PER_SECOND_SAMPLE_PERIOD: number;
  };
  BISQ: {
    ENABLED: boolean;
    DATA_PATH: string;
  };
}

const defaults: IConfig = {
  'MEMPOOL': {
    'NETWORK': 'mainnet',
    'BACKEND': 'none',
    'HTTP_PORT': 8999,
    'SPAWN_CLUSTER_PROCS': 0,
    'API_URL_PREFIX': '/api/v1/',
    'POLL_RATE_MS': 2000,
    'CACHE_DIR': './cache',
    'CLEAR_PROTECTION_MINUTES': 20,
    'RECOMMENDED_FEE_PERCENTILE': 50,
    'BLOCK_WEIGHT_UNITS': 4000000,
    'INITIAL_BLOCKS_AMOUNT': 8,
    'MEMPOOL_BLOCKS_AMOUNT': 8,
    'INDEXING_BLOCKS_AMOUNT': 1100, // 0 = disable indexing, -1 = index all blocks
    'PRICE_FEED_UPDATE_INTERVAL': 3600,
    'USE_SECOND_NODE_FOR_MINFEE': false,
    'EXTERNAL_ASSETS': [
      'https://mempool.space/resources/pools.json'
    ]
  },
  'ESPLORA': {
    'REST_API_URL': 'http://127.0.0.1:3000',
  },
  'ELECTRUM': {
    'HOST': '127.0.0.1',
    'PORT': 3306,
    'TLS_ENABLED': true,
  },
  'CORE_RPC': {
    'HOST': '127.0.0.1',
    'PORT': 8332,
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool'
  },
  'SECOND_CORE_RPC': {
    'HOST': '127.0.0.1',
    'PORT': 8332,
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool'
  },
  'DATABASE': {
    'ENABLED': true,
    'HOST': '127.0.0.1',
    'PORT': 3306,
    'DATABASE': 'mempool',
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool'
  },
  'SYSLOG': {
    'ENABLED': true,
    'HOST': '127.0.0.1',
    'PORT': 514,
    'MIN_PRIORITY': 'info',
    'FACILITY': 'local7'
  },
  'STATISTICS': {
    'ENABLED': true,
    'TX_PER_SECOND_SAMPLE_PERIOD': 150
  },
  'BISQ': {
    'ENABLED': false,
    'DATA_PATH': '/bisq/statsnode-data/btc_mainnet/db'
  },
};

class Config implements IConfig {
  MEMPOOL: IConfig['MEMPOOL'];
  ESPLORA: IConfig['ESPLORA'];
  ELECTRUM: IConfig['ELECTRUM'];
  CORE_RPC: IConfig['CORE_RPC'];
  SECOND_CORE_RPC: IConfig['SECOND_CORE_RPC'];
  DATABASE: IConfig['DATABASE'];
  SYSLOG: IConfig['SYSLOG'];
  STATISTICS: IConfig['STATISTICS'];
  BISQ: IConfig['BISQ'];

  constructor() {
    const configs = this.merge(configFile, defaults);
    this.MEMPOOL = configs.MEMPOOL;
    this.ESPLORA = configs.ESPLORA;
    this.ELECTRUM = configs.ELECTRUM;
    this.CORE_RPC = configs.CORE_RPC;
    this.SECOND_CORE_RPC = configs.SECOND_CORE_RPC;
    this.DATABASE = configs.DATABASE;
    this.SYSLOG = configs.SYSLOG;
    this.STATISTICS = configs.STATISTICS;
    this.BISQ = configs.BISQ;
  }

  merge = (...objects: object[]): IConfig => {
    // @ts-ignore
    return objects.reduce((prev, next) => {
      Object.keys(prev).forEach(key => {
        next[key] = { ...next[key], ...prev[key] };
      });
      return next;
    });
  }
}

export default new Config();
