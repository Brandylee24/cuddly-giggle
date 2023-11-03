import memPool from './mempool';
import { DB } from '../database';
import logger from '../logger';

import { Statistic, TransactionExtended, OptimizedStatistic } from '../mempool.interfaces';
import config from '../config';

class Statistics {
  protected intervalTimer: NodeJS.Timer | undefined;
  protected newStatisticsEntryCallback: ((stats: OptimizedStatistic) => void) | undefined;
  protected queryTimeout = 120000;
  protected cache: { [date: string]: OptimizedStatistic[] } = {
    '24h': [], '1w': [], '1m': [], '3m': [], '6m': [], '1y': [], '2y': [], '3y': []
  };

  public setNewStatisticsEntryCallback(fn: (stats: OptimizedStatistic) => void) {
    this.newStatisticsEntryCallback = fn;
  }

  constructor() { }

  public startStatistics(): void {
    logger.info('Starting statistics service');

    const now = new Date();
    const nextInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(),
      Math.floor(now.getMinutes() / 1) * 1 + 1, 0, 0);
    const difference = nextInterval.getTime() - now.getTime();

    setTimeout(() => {
      this.runStatistics();
      this.intervalTimer = setInterval(() => {
        this.runStatistics();
      }, 1 * 60 * 1000);
    }, difference);

    this.createCache();
    setInterval(this.createCache.bind(this), 600000);
  }

  public getCache() {
    return this.cache;
  }

  private async createCache() {
    this.cache['24h'] = await this.$list24H();
    this.cache['1w'] = await this.$list1W();
    this.cache['1m'] = await this.$list1M();
    this.cache['3m'] = await this.$list3M();
    this.cache['6m'] = await this.$list6M();
    this.cache['1y'] = await this.$list1Y();
    this.cache['2y'] = await this.$list2Y();
    this.cache['3y'] = await this.$list3Y();
    logger.debug('Statistics cache created');
  }

  private async runStatistics(): Promise<void> {
    if (!memPool.isInSync()) {
      return;
    }
    const currentMempool = memPool.getMempool();
    const txPerSecond = memPool.getTxPerSecond();
    const vBytesPerSecond = memPool.getVBytesPerSecond();

    logger.debug('Running statistics');

    let memPoolArray: TransactionExtended[] = [];
    for (const i in currentMempool) {
      if (currentMempool.hasOwnProperty(i)) {
        memPoolArray.push(currentMempool[i]);
      }
    }
    // Remove 0 and undefined
    memPoolArray = memPoolArray.filter((tx) => tx.effectiveFeePerVsize);

    if (!memPoolArray.length) {
      return;
    }

    memPoolArray.sort((a, b) => a.effectiveFeePerVsize - b.effectiveFeePerVsize);
    const totalWeight = memPoolArray.map((tx) => tx.vsize).reduce((acc, curr) => acc + curr) * 4;
    const totalFee = memPoolArray.map((tx) => tx.fee).reduce((acc, curr) => acc + curr);

    const logFees = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200,
      250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000];

    const weightVsizeFees: { [feePerWU: number]: number } = {};
    const lastItem = logFees.length - 1;

    memPoolArray.forEach((transaction) => {
      for (let i = 0; i < logFees.length; i++) {
        if (
          (config.MEMPOOL.NETWORK === 'liquid' && (i === lastItem || transaction.effectiveFeePerVsize * 10 < logFees[i + 1]))
          ||
          (config.MEMPOOL.NETWORK !== 'liquid' && (i === lastItem || transaction.effectiveFeePerVsize < logFees[i + 1]))
        ) {
          if (weightVsizeFees[logFees[i]]) {
            weightVsizeFees[logFees[i]] += transaction.vsize;
          } else {
            weightVsizeFees[logFees[i]] = transaction.vsize;
          }
          break;
        }
      }
    });

    const insertId = await this.$create({
      added: 'NOW()',
      unconfirmed_transactions: memPoolArray.length,
      tx_per_second: txPerSecond,
      vbytes_per_second: Math.round(vBytesPerSecond),
      mempool_byte_weight: totalWeight,
      total_fee: totalFee,
      fee_data: '',
      vsize_1: weightVsizeFees['1'] || 0,
      vsize_2: weightVsizeFees['2'] || 0,
      vsize_3: weightVsizeFees['3'] || 0,
      vsize_4: weightVsizeFees['4'] || 0,
      vsize_5: weightVsizeFees['5'] || 0,
      vsize_6: weightVsizeFees['6'] || 0,
      vsize_8: weightVsizeFees['8'] || 0,
      vsize_10: weightVsizeFees['10'] || 0,
      vsize_12: weightVsizeFees['12'] || 0,
      vsize_15: weightVsizeFees['15'] || 0,
      vsize_20: weightVsizeFees['20'] || 0,
      vsize_30: weightVsizeFees['30'] || 0,
      vsize_40: weightVsizeFees['40'] || 0,
      vsize_50: weightVsizeFees['50'] || 0,
      vsize_60: weightVsizeFees['60'] || 0,
      vsize_70: weightVsizeFees['70'] || 0,
      vsize_80: weightVsizeFees['80'] || 0,
      vsize_90: weightVsizeFees['90'] || 0,
      vsize_100: weightVsizeFees['100'] || 0,
      vsize_125: weightVsizeFees['125'] || 0,
      vsize_150: weightVsizeFees['150'] || 0,
      vsize_175: weightVsizeFees['175'] || 0,
      vsize_200: weightVsizeFees['200'] || 0,
      vsize_250: weightVsizeFees['250'] || 0,
      vsize_300: weightVsizeFees['300'] || 0,
      vsize_350: weightVsizeFees['350'] || 0,
      vsize_400: weightVsizeFees['400'] || 0,
      vsize_500: weightVsizeFees['500'] || 0,
      vsize_600: weightVsizeFees['600'] || 0,
      vsize_700: weightVsizeFees['700'] || 0,
      vsize_800: weightVsizeFees['800'] || 0,
      vsize_900: weightVsizeFees['900'] || 0,
      vsize_1000: weightVsizeFees['1000'] || 0,
      vsize_1200: weightVsizeFees['1200'] || 0,
      vsize_1400: weightVsizeFees['1400'] || 0,
      vsize_1600: weightVsizeFees['1600'] || 0,
      vsize_1800: weightVsizeFees['1800'] || 0,
      vsize_2000: weightVsizeFees['2000'] || 0,
    });

    if (this.newStatisticsEntryCallback && insertId) {
      const newStats = await this.$get(insertId);
      if (newStats) {
        this.newStatisticsEntryCallback(newStats);
      }
    }
  }

  private async $create(statistics: Statistic): Promise<number | undefined> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `INSERT INTO statistics(
              added,
              unconfirmed_transactions,
              tx_per_second,
              vbytes_per_second,
              mempool_byte_weight,
              fee_data,
              total_fee,
              vsize_1,
              vsize_2,
              vsize_3,
              vsize_4,
              vsize_5,
              vsize_6,
              vsize_8,
              vsize_10,
              vsize_12,
              vsize_15,
              vsize_20,
              vsize_30,
              vsize_40,
              vsize_50,
              vsize_60,
              vsize_70,
              vsize_80,
              vsize_90,
              vsize_100,
              vsize_125,
              vsize_150,
              vsize_175,
              vsize_200,
              vsize_250,
              vsize_300,
              vsize_350,
              vsize_400,
              vsize_500,
              vsize_600,
              vsize_700,
              vsize_800,
              vsize_900,
              vsize_1000,
              vsize_1200,
              vsize_1400,
              vsize_1600,
              vsize_1800,
              vsize_2000
            )
            VALUES (${statistics.added}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const params: (string | number)[] = [
        statistics.unconfirmed_transactions,
        statistics.tx_per_second,
        statistics.vbytes_per_second,
        statistics.mempool_byte_weight,
        statistics.fee_data,
        statistics.total_fee,
        statistics.vsize_1,
        statistics.vsize_2,
        statistics.vsize_3,
        statistics.vsize_4,
        statistics.vsize_5,
        statistics.vsize_6,
        statistics.vsize_8,
        statistics.vsize_10,
        statistics.vsize_12,
        statistics.vsize_15,
        statistics.vsize_20,
        statistics.vsize_30,
        statistics.vsize_40,
        statistics.vsize_50,
        statistics.vsize_60,
        statistics.vsize_70,
        statistics.vsize_80,
        statistics.vsize_90,
        statistics.vsize_100,
        statistics.vsize_125,
        statistics.vsize_150,
        statistics.vsize_175,
        statistics.vsize_200,
        statistics.vsize_250,
        statistics.vsize_300,
        statistics.vsize_350,
        statistics.vsize_400,
        statistics.vsize_500,
        statistics.vsize_600,
        statistics.vsize_700,
        statistics.vsize_800,
        statistics.vsize_900,
        statistics.vsize_1000,
        statistics.vsize_1200,
        statistics.vsize_1400,
        statistics.vsize_1600,
        statistics.vsize_1800,
        statistics.vsize_2000,
      ];
      const [result]: any = await connection.query(query, params);
      connection.release();
      return result.insertId;
    } catch (e) {
      logger.err('$create() error' + (e instanceof Error ? e.message : e));
    }
  }

  private getQueryForDaysAvg(div: number, interval: string) {
    return `SELECT id, UNIX_TIMESTAMP(added) as added,
      CAST(avg(unconfirmed_transactions) as FLOAT) as unconfirmed_transactions,
      CAST(avg(tx_per_second) as FLOAT) as tx_per_second,
      CAST(avg(vbytes_per_second) as FLOAT) as vbytes_per_second,
      CAST(avg(vsize_1) as FLOAT) as vsize_1,
      CAST(avg(vsize_2) as FLOAT) as vsize_2,
      CAST(avg(vsize_3) as FLOAT) as vsize_3,
      CAST(avg(vsize_4) as FLOAT) as vsize_4,
      CAST(avg(vsize_5) as FLOAT) as vsize_5,
      CAST(avg(vsize_6) as FLOAT) as vsize_6,
      CAST(avg(vsize_8) as FLOAT) as vsize_8,
      CAST(avg(vsize_10) as FLOAT) as vsize_10,
      CAST(avg(vsize_12) as FLOAT) as vsize_12,
      CAST(avg(vsize_15) as FLOAT) as vsize_15,
      CAST(avg(vsize_20) as FLOAT) as vsize_20,
      CAST(avg(vsize_30) as FLOAT) as vsize_30,
      CAST(avg(vsize_40) as FLOAT) as vsize_40,
      CAST(avg(vsize_50) as FLOAT) as vsize_50,
      CAST(avg(vsize_60) as FLOAT) as vsize_60,
      CAST(avg(vsize_70) as FLOAT) as vsize_70,
      CAST(avg(vsize_80) as FLOAT) as vsize_80,
      CAST(avg(vsize_90) as FLOAT) as vsize_90,
      CAST(avg(vsize_100) as FLOAT) as vsize_100,
      CAST(avg(vsize_125) as FLOAT) as vsize_125,
      CAST(avg(vsize_150) as FLOAT) as vsize_150,
      CAST(avg(vsize_175) as FLOAT) as vsize_175,
      CAST(avg(vsize_200) as FLOAT) as vsize_200,
      CAST(avg(vsize_250) as FLOAT) as vsize_250,
      CAST(avg(vsize_300) as FLOAT) as vsize_300,
      CAST(avg(vsize_350) as FLOAT) as vsize_350,
      CAST(avg(vsize_400) as FLOAT) as vsize_400,
      CAST(avg(vsize_500) as FLOAT) as vsize_500,
      CAST(avg(vsize_600) as FLOAT) as vsize_600,
      CAST(avg(vsize_700) as FLOAT) as vsize_700,
      CAST(avg(vsize_800) as FLOAT) as vsize_800,
      CAST(avg(vsize_900) as FLOAT) as vsize_900,
      CAST(avg(vsize_1000) as FLOAT) as vsize_1000,
      CAST(avg(vsize_1200) as FLOAT) as vsize_1200,
      CAST(avg(vsize_1400) as FLOAT) as vsize_1400,
      CAST(avg(vsize_1600) as FLOAT) as vsize_1600,
      CAST(avg(vsize_1800) as FLOAT) as vsize_1800,
      CAST(avg(vsize_2000) as FLOAT) as vsize_2000 \
      FROM statistics \
      WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW() \
      GROUP BY UNIX_TIMESTAMP(added) DIV ${div} \
      ORDER BY id DESC;`;
  }

  private getQueryForDays(div: number, interval: string) {
    return `SELECT id, UNIX_TIMESTAMP(added) as added, unconfirmed_transactions,
      tx_per_second,
      vbytes_per_second,
      vsize_1,
      vsize_2,
      vsize_3,
      vsize_4,
      vsize_5,
      vsize_6,
      vsize_8,
      vsize_10,
      vsize_12,
      vsize_15,
      vsize_20,
      vsize_30,
      vsize_40,
      vsize_50,
      vsize_60,
      vsize_70,
      vsize_80,
      vsize_90,
      vsize_100,
      vsize_125,
      vsize_150,
      vsize_175,
      vsize_200,
      vsize_250,
      vsize_300,
      vsize_350,
      vsize_400,
      vsize_500,
      vsize_600,
      vsize_700,
      vsize_800,
      vsize_900,
      vsize_1000,
      vsize_1200,
      vsize_1400,
      vsize_1600,
      vsize_1800,
      vsize_2000 \
      FROM statistics \
      WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW() \
      GROUP BY UNIX_TIMESTAMP(added) DIV ${div} \
      ORDER BY id DESC;`;
  }

  public async $get(id: number): Promise<OptimizedStatistic | undefined> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT *, UNIX_TIMESTAMP(added) as added FROM statistics WHERE id = ?`;
      const [rows] = await connection.query<any>(query, [id]);
      connection.release();
      if (rows[0]) {
        return this.mapStatisticToOptimizedStatistic([rows[0]])[0];
      }
    } catch (e) {
      logger.err('$list2H() error' + (e instanceof Error ? e.message : e));
    }
  }

  public async $list2H(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT *, UNIX_TIMESTAMP(added) as added FROM statistics ORDER BY id DESC LIMIT 120`;
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list2H() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list24H(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT *, UNIX_TIMESTAMP(added) as added FROM statistics ORDER BY id DESC LIMIT 1440`;
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list24h() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list1W(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDaysAvg(600, '1 WEEK'); // 10m interval
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list1W() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list1M(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDaysAvg(3600, '1 MONTH'); // 1h interval
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list1M() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list3M(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDaysAvg(14400, '3 MONTH'); // 4h interval
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list3M() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list6M(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDaysAvg(21600, '6 MONTH'); // 6h interval 
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list6M() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list1Y(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDays(43200, '1 YEAR'); // 12h interval
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list1Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list2Y(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDays(86400, "2 YEAR"); // 1d interval
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list2Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $list3Y(): Promise<OptimizedStatistic[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = this.getQueryForDays(86400, "3 YEAR"); // 1d interval
      const [rows] = await connection.query<any>({ sql: query, timeout: this.queryTimeout });
      connection.release();
      return this.mapStatisticToOptimizedStatistic(rows);
    } catch (e) {
      logger.err('$list3Y() error' + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  private mapStatisticToOptimizedStatistic(statistic: Statistic[]): OptimizedStatistic[] {
    return statistic.map((s) => {
      return {
        id: s.id || 0,
        added: s.added,
        unconfirmed_transactions: s.unconfirmed_transactions,
        tx_per_second: s.tx_per_second,
        vbytes_per_second: s.vbytes_per_second,
        mempool_byte_weight: s.mempool_byte_weight,
        total_fee: s.total_fee,
        vsizes: [
          s.vsize_1,
          s.vsize_2,
          s.vsize_3,
          s.vsize_4,
          s.vsize_5,
          s.vsize_6,
          s.vsize_8,
          s.vsize_10,
          s.vsize_12,
          s.vsize_15,
          s.vsize_20,
          s.vsize_30,
          s.vsize_40,
          s.vsize_50,
          s.vsize_60,
          s.vsize_70,
          s.vsize_80,
          s.vsize_90,
          s.vsize_100,
          s.vsize_125,
          s.vsize_150,
          s.vsize_175,
          s.vsize_200,
          s.vsize_250,
          s.vsize_300,
          s.vsize_350,
          s.vsize_400,
          s.vsize_500,
          s.vsize_600,
          s.vsize_700,
          s.vsize_800,
          s.vsize_900,
          s.vsize_1000,
          s.vsize_1200,
          s.vsize_1400,
          s.vsize_1600,
          s.vsize_1800,
          s.vsize_2000,
        ]
      };
    });
  }

}

export default new Statistics();
