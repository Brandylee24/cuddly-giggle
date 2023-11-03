import logger from '../logger';
import axios, { AxiosResponse } from 'axios';
import { IConversionRates } from '../mempool.interfaces';
import config from '../config';
import backendInfo from './backend-info';
import { SocksProxyAgent } from 'socks-proxy-agent';

class FiatConversion {
  private conversionRates: IConversionRates = {
    'USD': 0
  };
  private ratesChangedCallback: ((rates: IConversionRates) => void) | undefined;

  constructor() { }

  public setProgressChangedCallback(fn: (rates: IConversionRates) => void) {
    this.ratesChangedCallback = fn;
  }

  public startService() {
    logger.info('Starting currency rates service');
    if (config.SOCKS5PROXY.ENABLED) {
      logger.info(`Currency rates service will be queried over the Tor network using ${config.PRICE_DATA_SERVER.TOR_URL}`);
    } else {
      logger.info(`Currency rates service will be queried over clearnet using ${config.PRICE_DATA_SERVER.CLEARNET_URL}`);
    }
    setInterval(this.updateCurrency.bind(this), 1000 * config.MEMPOOL.PRICE_FEED_UPDATE_INTERVAL);
    this.updateCurrency();
  }

  public getConversionRates() {
    return this.conversionRates;
  }

  private async updateCurrency(): Promise<void> {
    const headers = { 'User-Agent': `mempool/v${backendInfo.getBackendInfo().version}` };
    let fiatConversionUrl: string;
    let response: AxiosResponse;

    try {
      if (config.SOCKS5PROXY.ENABLED) {
        let socksOptions: any = {
          agentOptions: {
            keepAlive: true,
          },
          host: config.SOCKS5PROXY.HOST,
          port: config.SOCKS5PROXY.PORT
        };

        if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
          socksOptions.username = config.SOCKS5PROXY.USERNAME;
          socksOptions.password = config.SOCKS5PROXY.PASSWORD;
        }

        const agent = new SocksProxyAgent(socksOptions);
        fiatConversionUrl = config.PRICE_DATA_SERVER.TOR_URL;
        logger.debug('Querying currency rates service...');
        response = await axios.get(fiatConversionUrl, { httpAgent: agent, headers: headers, timeout: 30000 });
      } else {
        fiatConversionUrl = config.PRICE_DATA_SERVER.CLEARNET_URL;
        logger.debug('Querying currency rates service...');
        response = await axios.get(fiatConversionUrl, { headers: headers, timeout: 10000 });
      }

      const usd = response.data.data.find((item: any) => item.currencyCode === 'USD');

      this.conversionRates = {
        'USD': usd.price,
      };

      logger.debug(`USD Conversion Rate: ${usd.price}`);

      if (this.ratesChangedCallback) {
        this.ratesChangedCallback(this.conversionRates);
      }
    } catch (e) {
      logger.err('Error updating fiat conversion rates: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new FiatConversion();
