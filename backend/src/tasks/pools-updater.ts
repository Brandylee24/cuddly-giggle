const https = require('https');
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import logger from '../logger';

/**
 * Maintain the most recent version of pools.json
 */
class PoolsUpdater {
  lastRun: number = 0;

  constructor() {
  }

  public async updatePoolsJson() {
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
      const dbSha = await this.getShaFromDb();
      const githubSha = await this.fetchPoolsSha(); // Fetch pools.json sha from github
      if (githubSha === undefined) {
        return;
      }

      logger.debug(`Pools.json sha | Current: ${dbSha} | Github: ${githubSha}`);
      if (dbSha !== undefined && dbSha === githubSha) {
        return;
      }

      logger.warn('Pools.json is outdated, fetch latest from github');
      const poolsJson = await this.fetchPools();
      await poolsParser.migratePoolsJson(poolsJson);
      await this.updateDBSha(githubSha);
      logger.notice('PoolsUpdater completed');

    } catch (e) {
      this.lastRun = now - (oneWeek - oneDay); // Try again in 24h instead of waiting next week
      logger.err('PoolsUpdater failed. Will try again in 24h. Reason: '  + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Fetch pools.json from github repo
   */
  private async fetchPools(): Promise<object> {
    const response = await this.query('/repos/mempool/mining-pools/contents/pools.json');
    return JSON.parse(Buffer.from(response['content'], 'base64').toString('utf8'));
  }

  /**
   * Fetch our latest pools.json sha from the db
   */
  private async updateDBSha(githubSha: string) {
    try {
      await DB.query('DELETE FROM state where name="pools_json_sha"');
      await DB.query(`INSERT INTO state VALUES('pools_json_sha', NULL, '${githubSha}')`);
    } catch (e) {
      logger.err('Cannot save github pools.json sha into the db. Reason: '  + (e instanceof Error ? e.message : e));
      return undefined;
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
      logger.err('Cannot fetch pools.json sha from db. Reason: '  + (e instanceof Error ? e.message : e));
      return undefined;
    }
  }

  /**
   * Fetch our latest pools.json sha from github
   */
  private async fetchPoolsSha(): Promise<string | undefined> {
    const response = await this.query('/repos/mempool/mining-pools/git/trees/master');

    for (const file of response['tree']) {
      if (file['path'] === 'pools.json') {
        return file['sha'];
      }
    }

    logger.err('Cannot to find latest pools.json sha from github api response');
    return undefined;
  }

  /**
   * Http request wrapper
   */
  private query(path): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        host: 'api.github.com',
        path: path,
        method: 'GET',
        headers: { 'user-agent': 'node.js' }
      };

      logger.debug('Querying: api.github.com' + path);

      const request = https.get(options, (response) => {
        const chunks_of_data: any[] = [];
        response.on('data', (fragments) => {
          chunks_of_data.push(fragments);
        });
        response.on('end', () => {
          resolve(JSON.parse(Buffer.concat(chunks_of_data).toString()));
        });
        response.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        logger.err('Github API query failed. Reason: '  + error);
        reject(error);
      });
    });
  }
}

export default new PoolsUpdater();
