import logger from '../../logger';
import DB from '../../database';

class ChannelsApi {
  public async $getAllChannels(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getAllChannels error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $searchChannelsById(search: string): Promise<any[]> {
    try {
      const searchStripped = search.replace('%', '') + '%';
      const query = `SELECT id, short_id, capacity FROM channels WHERE id LIKE ? OR short_id LIKE ? LIMIT 10`;
      const [rows]: any = await DB.query(query, [searchStripped, searchStripped]);
      return rows;
    } catch (e) {
      logger.err('$searchChannelsById error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsByStatus(status: number): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE status = ?`;
      const [rows]: any = await DB.query(query, [status]);
      return rows;
    } catch (e) {
      logger.err('$getChannelsByStatus error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getClosedChannelsWithoutReason(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE status = 2 AND closing_reason IS NULL AND closing_transaction_id != ''`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getClosedChannelsWithoutReason error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsWithoutCreatedDate(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE created IS NULL`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getChannelsWithoutCreatedDate error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannel(id: string): Promise<any> {
    try {
      const query = `SELECT n1.alias AS alias_left, n2.alias AS alias_right, channels.*, ns1.channels AS channels_left, ns1.capacity AS capacity_left, ns2.channels AS channels_right, ns2.capacity AS capacity_right FROM channels LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key LEFT JOIN node_stats AS ns1 ON ns1.public_key = channels.node1_public_key LEFT JOIN node_stats AS ns2 ON ns2.public_key = channels.node2_public_key WHERE (ns1.id = (SELECT MAX(id) FROM node_stats WHERE public_key = channels.node1_public_key) AND ns2.id = (SELECT MAX(id) FROM node_stats WHERE public_key = channels.node2_public_key)) AND channels.id = ?`;
      const [rows]: any = await DB.query(query, [id]);
      if (rows[0]) {
        return this.convertChannel(rows[0]);
      }
    } catch (e) {
      logger.err('$getChannel error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsStats(): Promise<any> {
    try {
      // Feedback from zerofeerouting:
      // "I would argue > 5000ppm can be ignored. Channels charging more than .5% fee are ignored by CLN for example."
      const ignoredFeeRateThreshold = 5000;
      const ignoredBaseFeeThreshold = 5000;

      // Capacity
      let query = `SELECT AVG(capacity) AS avgCapacity FROM channels WHERE status = 1 ORDER BY capacity`;
      const [avgCapacity]: any = await DB.query(query);

      query = `SELECT capacity FROM channels WHERE status = 1 ORDER BY capacity`;
      let [capacity]: any = await DB.query(query);
      capacity = capacity.map(capacity => capacity.capacity);
      const medianCapacity = capacity[Math.floor(capacity.length / 2)];

      // Fee rates
      query = `SELECT node1_fee_rate FROM channels WHERE node1_fee_rate < ${ignoredFeeRateThreshold} AND status = 1`;
      let [feeRates1]: any = await DB.query(query);
      feeRates1 = feeRates1.map(rate => rate.node1_fee_rate);
      query = `SELECT node2_fee_rate FROM channels WHERE node2_fee_rate < ${ignoredFeeRateThreshold} AND status = 1`;
      let [feeRates2]: any = await DB.query(query);
      feeRates2 = feeRates2.map(rate => rate.node2_fee_rate);

      let feeRates = (feeRates1.concat(feeRates2)).sort((a, b) => a - b);
      let avgFeeRate = 0;
      for (const rate of feeRates) {
        avgFeeRate += rate; 
      }
      avgFeeRate /= feeRates.length;
      const medianFeeRate = feeRates[Math.floor(feeRates.length / 2)];

      // Base fees
      query = `SELECT node1_base_fee_mtokens FROM channels WHERE node1_base_fee_mtokens < ${ignoredBaseFeeThreshold} AND status = 1`;
      let [baseFees1]: any = await DB.query(query);
      baseFees1 = baseFees1.map(rate => rate.node1_base_fee_mtokens);
      query = `SELECT node2_base_fee_mtokens FROM channels WHERE node2_base_fee_mtokens < ${ignoredBaseFeeThreshold} AND status = 1`;
      let [baseFees2]: any = await DB.query(query);
      baseFees2 = baseFees2.map(rate => rate.node2_base_fee_mtokens);

      let baseFees = (baseFees1.concat(baseFees2)).sort((a, b) => a - b);
      let avgBaseFee = 0;
      for (const fee of baseFees) {
        avgBaseFee += fee; 
      }
      avgBaseFee /= baseFees.length;
      const medianBaseFee = feeRates[Math.floor(baseFees.length / 2)];
      
      return {
        avgCapacity: parseInt(avgCapacity[0].avgCapacity, 10),
        avgFeeRate: avgFeeRate,
        avgBaseFee: avgBaseFee,
        medianCapacity: medianCapacity,
        medianFeeRate: medianFeeRate,
        medianBaseFee: medianBaseFee,
      }

    } catch (e) {
      logger.err(`Cannot calculate channels statistics. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $getChannelsByTransactionId(transactionIds: string[]): Promise<any[]> {
    try {
      transactionIds = transactionIds.map((id) => '\'' + id + '\'');
      const query = `SELECT n1.alias AS alias_left, n2.alias AS alias_right, channels.* FROM channels LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key WHERE channels.transaction_id IN (${transactionIds.join(', ')}) OR channels.closing_transaction_id IN (${transactionIds.join(', ')})`;
      const [rows]: any = await DB.query(query);
      const channels = rows.map((row) => this.convertChannel(row));
      return channels;
    } catch (e) {
      logger.err('$getChannelByTransactionId error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsForNode(public_key: string, index: number, length: number, status: string): Promise<any[]> {
    try {
      // Default active and inactive channels
      let statusQuery = '< 2';
      // Closed channels only
      if (status === 'closed') {
        statusQuery = '= 2';
      }
      const query = `SELECT n1.alias AS alias_left, n2.alias AS alias_right, channels.*, ns1.channels AS channels_left, ns1.capacity AS capacity_left, ns2.channels AS channels_right, ns2.capacity AS capacity_right FROM channels LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key LEFT JOIN node_stats AS ns1 ON ns1.public_key = channels.node1_public_key LEFT JOIN node_stats AS ns2 ON ns2.public_key = channels.node2_public_key WHERE (ns1.id = (SELECT MAX(id) FROM node_stats WHERE public_key = channels.node1_public_key) AND ns2.id = (SELECT MAX(id) FROM node_stats WHERE public_key = channels.node2_public_key)) AND (node1_public_key = ? OR node2_public_key = ?) AND status ${statusQuery} ORDER BY channels.capacity DESC LIMIT ?, ?`;
      const [rows]: any = await DB.query(query, [public_key, public_key, index, length]);
      const channels = rows.map((row) => this.convertChannel(row));
      return channels;
    } catch (e) {
      logger.err('$getChannelsForNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsCountForNode(public_key: string, status: string): Promise<any> {
    try {
      // Default active and inactive channels
      let statusQuery = '< 2';
      // Closed channels only
      if (status === 'closed') {
        statusQuery = '= 2';
      }
      const query = `SELECT COUNT(*) AS count FROM channels WHERE (node1_public_key = ? OR node2_public_key = ?) AND status ${statusQuery}`;
      const [rows]: any = await DB.query(query, [public_key, public_key]);
      return rows[0]['count'];
    } catch (e) {
      logger.err('$getChannelsForNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private convertChannel(channel: any): any {
    return {
      'id': channel.id,
      'short_id': channel.short_id,
      'capacity': channel.capacity,
      'transaction_id': channel.transaction_id,
      'transaction_vout': channel.transaction_vout,
      'closing_transaction_id': channel.closing_transaction_id,
      'closing_reason': channel.closing_reason,
      'updated_at': channel.updated_at,
      'created': channel.created,
      'status': channel.status,
      'node_left': {
        'alias': channel.alias_left,
        'public_key': channel.node1_public_key,
        'channels': channel.channels_left,
        'capacity': channel.capacity_left,
        'base_fee_mtokens': channel.node1_base_fee_mtokens,
        'cltv_delta': channel.node1_cltv_delta,
        'fee_rate': channel.node1_fee_rate,
        'is_disabled': channel.node1_is_disabled,
        'max_htlc_mtokens': channel.node1_max_htlc_mtokens,
        'min_htlc_mtokens': channel.node1_min_htlc_mtokens,
        'updated_at': channel.node1_updated_at,
      },
      'node_right': {
        'alias': channel.alias_right,
        'public_key': channel.node2_public_key,
        'channels': channel.channels_right,
        'capacity': channel.capacity_right,
        'base_fee_mtokens': channel.node2_base_fee_mtokens,
        'cltv_delta': channel.node2_cltv_delta,
        'fee_rate': channel.node2_fee_rate,
        'is_disabled': channel.node2_is_disabled,
        'max_htlc_mtokens': channel.node2_max_htlc_mtokens,
        'min_htlc_mtokens': channel.node2_min_htlc_mtokens,
        'updated_at': channel.node2_updated_at,
      },
    };
  }
}

export default new ChannelsApi();
