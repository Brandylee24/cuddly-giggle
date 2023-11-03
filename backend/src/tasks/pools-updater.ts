import axios, { AxiosResponse } from 'axios';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import backendInfo from '../api/backend-info';
import logger from '../logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';

/**
 * Maintain the most recent version of pools.json
 */
class PoolsUpdater {
  lastRun: number = 0;
  currentSha: string | undefined = undefined;
  poolsUrl: string = config.MEMPOOL.POOLS_JSON_URL;
  treeUrl: string = config.MEMPOOL.POOLS_JSON_TREE_URL;

  public async updatePoolsJson(): Promise<void> {
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false) {
      return;
    }

    const oneWeek = 604800;
    const oneDay = 86400;

    const now = new Date().getTime() / 1000;
    if (now - this.lastRun < oneWeek) { // Execute the PoolsUpdate only once a week, or upon restart
      return;
    }

    this.lastRun = now;

    try {
      if (config.DATABASE.ENABLED === true) {
        this.currentSha = await this.getShaFromDb();
      }

      const githubSha = await this.fetchPoolsSha(); // Fetch pools.json sha from github
      if (githubSha === undefined) {
        return;
      }

      logger.debug(`Pools.json sha | Current: ${this.currentSha} | Github: ${githubSha}`);
      if (this.currentSha !== undefined && this.currentSha === githubSha) {
        return;
      }

      // See backend README for more details about the mining pools update process
      if (this.currentSha !== undefined && // If we don't have any mining pool, download it at least once
        config.MEMPOOL.AUTOMATIC_BLOCK_REINDEXING !== true && // Automatic pools update is disabled
        !process.env.npm_config_update_pools // We're not manually updating mining pool
      ) {
        logger.info(`Updated mining pools are available (${githubSha}) but AUTOMATIC_BLOCK_REINDEXING is disabled`);
        return;
      }

      if (this.currentSha === undefined) {
        logger.info(`Downloading pools.json for the first time from ${this.poolsUrl}, using ${config.SOCKS5PROXY.ENABLED ? 'Tor' : 'clearnet'}`, logger.tags.mining);
      } else {
        logger.warn(`Pools.json is outdated, fetch latest from ${this.poolsUrl}, using ${config.SOCKS5PROXY.ENABLED ? 'Tor' : 'clearnet'}`, logger.tags.mining);
      }
      const poolsJson = await this.query(this.poolsUrl);
      if (poolsJson === undefined) {
        return;
      }
      await poolsParser.migratePoolsJson(poolsJson);
      await this.updateDBSha(githubSha);
      logger.notice(`PoolsUpdater completed`, logger.tags.mining);

    } catch (e) {
      this.lastRun = now - (oneWeek - oneDay); // Try again in 24h instead of waiting next week
      logger.err(`PoolsUpdater failed. Will try again in 24h. Reason: ${e instanceof Error ? e.message : e}`, logger.tags.mining);
    }
  }

  /**
   * Fetch our latest pools.json sha from the db
   */
  private async updateDBSha(githubSha: string): Promise<void> {
    this.currentSha = githubSha;
    if (config.DATABASE.ENABLED === true) {
      try {
        await DB.query('DELETE FROM state where name="pools_json_sha"');
        await DB.query(`INSERT INTO state VALUES('pools_json_sha', NULL, '${githubSha}')`);
      } catch (e) {
        logger.err('Cannot save github pools.json sha into the db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      }
    }
  }

  /**
   * Fetch our latest pools.json sha from the db
   */
  private async getShaFromDb(): Promise<string | undefined> {
    try {
      const [rows]: any[] = await DB.query('SELECT string FROM state WHERE name="pools_json_sha"');
      return (rows.length > 0 ? rows[0].string : undefined);
    } catch (e) {
      logger.err('Cannot fetch pools.json sha from db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      return undefined;
    }
  }

  /**
   * Fetch our latest pools.json sha from github
   */
  private async fetchPoolsSha(): Promise<string | undefined> {
    const response = await this.query(this.treeUrl);

    if (response !== undefined) {
      for (const file of response['tree']) {
        if (file['path'] === 'pools.json') {
          return file['sha'];
        }
      }
    }

    logger.err(`Cannot find "pools.json" in git tree (${this.treeUrl})`, logger.tags.mining);
    return undefined;
  }

  /**
   * Http request wrapper
   */
  private async query(path): Promise<object | undefined> {
    type axiosOptions = {
      headers: {
        'User-Agent': string
      };
      timeout: number;
      httpsAgent?: https.Agent;
    };
    const setDelay = (secs: number = 1): Promise<void> => new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
    const axiosOptions: axiosOptions = {
      headers: {
        'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000
    };
    let retry = 0;

    while (retry < config.MEMPOOL.EXTERNAL_MAX_RETRY) {
      try {
        if (config.SOCKS5PROXY.ENABLED) {
          const socksOptions: any = {
            agentOptions: {
              keepAlive: true,
            },
            hostname: config.SOCKS5PROXY.HOST,
            port: config.SOCKS5PROXY.PORT
          };

          if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
            socksOptions.username = config.SOCKS5PROXY.USERNAME;
            socksOptions.password = config.SOCKS5PROXY.PASSWORD;
          } else {
            // Retry with different tor circuits https://stackoverflow.com/a/64960234
            socksOptions.username = `circuit${retry}`;
          }

          axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
        }

        const data: AxiosResponse = await axios.get(path, axiosOptions);
        if (data.statusText === 'error' || !data.data) {
          throw new Error(`Could not fetch data from ${path}, Error: ${data.status}`);
        }
        return data.data;
      } catch (e) {
        logger.err('Could not connect to Github. Reason: ' + (e instanceof Error ? e.message : e));
        retry++;
      }
      await setDelay(config.MEMPOOL.EXTERNAL_RETRY_INTERVAL);
    }
    return undefined;
  }
}

export default new PoolsUpdater();
