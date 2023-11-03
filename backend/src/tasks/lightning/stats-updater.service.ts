
import DB from '../../database';
import logger from '../../logger';
import lightningApi from '../../api/lightning/lightning-api-factory';
import channelsApi from '../../api/explorer/channels.api';
import * as net from 'net';

class LightningStatsUpdater {
  hardCodedStartTime = '2018-01-12';

  public async $startService() {
    logger.info('Starting Lightning Stats service');
    let isInSync = false;
    let error: any;
    try {
      error = null;
      isInSync = await this.$lightningIsSynced();
    } catch (e) {
      error = e;
    }
    if (!isInSync) {
      if (error) {
        logger.warn('Was not able to fetch Lightning Node status: ' + (error instanceof Error ? error.message : error) + '. Retrying in 1 minute...');
      } else {
        logger.notice('The Lightning graph is not yet in sync. Retrying in 1 minute...');
      }
      setTimeout(() => this.$startService(), 60 * 1000);
      return;
    }

    await this.$populateHistoricalStatistics();
    await this.$populateHistoricalNodeStatistics();

    setTimeout(() => {
      this.$runTasks();
    }, this.timeUntilMidnight());
  }

  private timeUntilMidnight(): number {
    const date = new Date();
    this.setDateMidnight(date);
    date.setUTCHours(24);
    return date.getTime() - new Date().getTime();
  }

  private setDateMidnight(date: Date): void {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
  }

  private async $lightningIsSynced(): Promise<boolean> {
    const nodeInfo = await lightningApi.$getInfo();
    return nodeInfo.is_synced_to_chain && nodeInfo.is_synced_to_graph;
  }

  private async $runTasks(): Promise<void> {
    await this.$logLightningStatsDaily();
    await this.$logNodeStatsDaily();

    setTimeout(() => {
      this.$runTasks();
    }, this.timeUntilMidnight());
  }

  private async $logLightningStatsDaily() {
    try {
      logger.info(`Running lightning daily stats log...`);  

      const networkGraph = await lightningApi.$getNetworkGraph();
      let total_capacity = 0;
      for (const channel of networkGraph.channels) {
        if (channel.capacity) {
          total_capacity += channel.capacity;
        }
      }

      let clearnetNodes = 0;
      let torNodes = 0;
      let unannouncedNodes = 0;
      for (const node of networkGraph.nodes) {
        let isUnnanounced = true;
        for (const socket of node.sockets) {
          const hasOnion = socket.indexOf('.onion') !== -1;
          if (hasOnion) {
            torNodes++;
            isUnnanounced = false;
          }
          const hasClearnet = [4, 6].includes(net.isIP(socket.split(':')[0]));
          if (hasClearnet) {
            clearnetNodes++;
            isUnnanounced = false;
          }
        }
        if (isUnnanounced) {
          unannouncedNodes++;
        }
      }

      const channelStats = await channelsApi.$getChannelsStats();

      const query = `INSERT INTO lightning_stats(
          added,
          channel_count,
          node_count,
          total_capacity,
          tor_nodes,
          clearnet_nodes,
          unannounced_nodes,
          avg_capacity,
          avg_fee_rate,
          avg_base_fee_mtokens,
          med_capacity,
          med_fee_rate,
          med_base_fee_mtokens
        )
        VALUES (NOW() - INTERVAL 1 DAY, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await DB.query(query, [
        networkGraph.channels.length,
        networkGraph.nodes.length,
        total_capacity,
        torNodes,
        clearnetNodes,
        unannouncedNodes,
        channelStats.avgCapacity,
        channelStats.avgFeeRate,
        channelStats.avgBaseFee,
        channelStats.medianCapacity,
        channelStats.medianFeeRate,
        channelStats.medianBaseFee,
      ]);
      logger.info(`Lightning daily stats done.`);
    } catch (e) {
      logger.err('$logLightningStatsDaily() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $logNodeStatsDaily() {
    try {
      logger.info(`Running daily node stats update...`);

      const query = `SELECT nodes.public_key, c1.channels_count_left, c2.channels_count_right, c1.channels_capacity_left, c2.channels_capacity_right FROM nodes LEFT JOIN (SELECT node1_public_key, COUNT(id) AS channels_count_left, SUM(capacity) AS channels_capacity_left FROM channels WHERE channels.status < 2 GROUP BY node1_public_key) c1 ON c1.node1_public_key = nodes.public_key LEFT JOIN (SELECT node2_public_key, COUNT(id) AS channels_count_right, SUM(capacity) AS channels_capacity_right FROM channels WHERE channels.status < 2 GROUP BY node2_public_key) c2 ON c2.node2_public_key = nodes.public_key`;
      const [nodes]: any = await DB.query(query);

      for (const node of nodes) {
        await DB.query(
          `INSERT INTO node_stats(public_key, added, capacity, channels) VALUES (?, NOW() - INTERVAL 1 DAY, ?, ?)`,
          [node.public_key, (parseInt(node.channels_capacity_left || 0, 10)) + (parseInt(node.channels_capacity_right || 0, 10)),
            node.channels_count_left + node.channels_count_right]);
      }
      logger.info('Daily node stats has updated.');
    } catch (e) {
      logger.err('$logNodeStatsDaily() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  // We only run this on first launch
  private async $populateHistoricalStatistics() {
    try {
      const [rows]: any = await DB.query(`SELECT COUNT(*) FROM lightning_stats`);
      // Only run if table is empty
      if (rows[0]['COUNT(*)'] > 0) {
        return;
      }
      logger.info(`Running historical stats population...`);

      const [channels]: any = await DB.query(`SELECT capacity, created, closing_date FROM channels ORDER BY created ASC`);
      const [nodes]: any = await DB.query(`SELECT first_seen, sockets FROM nodes ORDER BY first_seen ASC`);

      const date: Date = new Date(this.hardCodedStartTime);
      const currentDate = new Date();
      this.setDateMidnight(currentDate);

      while (date < currentDate) {
        let totalCapacity = 0;
        let channelsCount = 0;

        for (const channel of channels) {
          if (new Date(channel.created) > date) {
            break;
          }
          if (channel.closing_date === null || new Date(channel.closing_date) > date) {
            totalCapacity += channel.capacity;
            channelsCount++;
          }
        }

        let nodeCount = 0;
        let clearnetNodes = 0;
        let torNodes = 0;
        let unannouncedNodes = 0;

        for (const node of nodes) {
          if (new Date(node.first_seen) > date) {
            break;
          }
          nodeCount++;

          const sockets = node.sockets.split(',');
          let isUnnanounced = true;
          for (const socket of sockets) {
            const hasOnion = socket.indexOf('.onion') !== -1;
            if (hasOnion) {
              torNodes++;
              isUnnanounced = false;
            }
            const hasClearnet = [4, 6].includes(net.isIP(socket.substring(0, socket.lastIndexOf(':'))));
            if (hasClearnet) {
              clearnetNodes++;
              isUnnanounced = false;
            }
          }
          if (isUnnanounced) {
            unannouncedNodes++;
          }
        }

        const query = `INSERT INTO lightning_stats(
          added,
          channel_count,
          node_count,
          total_capacity,
          tor_nodes,
          clearnet_nodes,
          unannounced_nodes
        )
        VALUES (FROM_UNIXTIME(?), ?, ?, ?, ?, ?, ?)`;

        await DB.query(query, [
          date.getTime() / 1000,
          channelsCount,
          nodeCount,
          totalCapacity,
          torNodes,
          clearnetNodes,
          unannouncedNodes,
        ]);

        date.setUTCDate(date.getUTCDate() + 1);
      }

      logger.info('Historical stats populated.');
    } catch (e) {
      logger.err('$populateHistoricalData() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $populateHistoricalNodeStatistics() {
    try {
      const [rows]: any = await DB.query(`SELECT COUNT(*) FROM node_stats`);
      // Only run if table is empty
      if (rows[0]['COUNT(*)'] > 0) {
        return;
      }
      logger.info(`Running historical node stats population...`);

      const [nodes]: any = await DB.query(`SELECT public_key, first_seen, alias FROM nodes ORDER BY first_seen ASC`);

      for (const node of nodes) {
        const [channels]: any = await DB.query(`SELECT capacity, created, closing_date FROM channels WHERE node1_public_key = ? OR node2_public_key = ? ORDER BY created ASC`, [node.public_key, node.public_key]);
        
        const date: Date = new Date(this.hardCodedStartTime);
        const currentDate = new Date();
        this.setDateMidnight(currentDate);

        let lastTotalCapacity = 0;
        let lastChannelsCount = 0;

        while (date < currentDate) {
          let totalCapacity = 0;
          let channelsCount = 0;
          for (const channel of channels) {
            if (new Date(channel.created) > date) {
              break;
            }
            if (channel.closing_date !== null && new Date(channel.closing_date) < date) {
              date.setUTCDate(date.getUTCDate() + 1);
              continue;
            }
            totalCapacity += channel.capacity;
            channelsCount++;
          }

          if (lastTotalCapacity === totalCapacity && lastChannelsCount === channelsCount) {
            date.setUTCDate(date.getUTCDate() + 1);
            continue;
          }

          lastTotalCapacity = totalCapacity;
          lastChannelsCount = channelsCount;
  
          const query = `INSERT INTO node_stats(
            public_key,
            added,
            capacity,
            channels
          )
          VALUES (?, FROM_UNIXTIME(?), ?, ?)`;

          await DB.query(query, [
            node.public_key,
            date.getTime() / 1000,
            totalCapacity,
            channelsCount,
          ]);
          date.setUTCDate(date.getUTCDate() + 1);
        }
        logger.debug('Updated node_stats for: ' + node.alias);
      }
      logger.info('Historical stats populated.');
    } catch (e) {
      logger.err('$populateHistoricalNodeData() error: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new LightningStatsUpdater();
