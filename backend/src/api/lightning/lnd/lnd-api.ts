import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import * as fs from 'fs';
import { authenticatedLndGrpc, getWalletInfo, getNetworkGraph, getNetworkInfo } from 'lightning';
import config from '../../../config';
import logger from '../../../logger';

class LndApi implements AbstractLightningApi {
  private lnd: any;
  constructor() {
    if (!config.LIGHTNING.ENABLED) {
      return;
    }
    try {
      const tls = fs.readFileSync(config.LND.TLS_CERT_PATH).toString('base64');
      const macaroon = fs.readFileSync(config.LND.MACAROON_PATH).toString('base64');

      const { lnd } = authenticatedLndGrpc({
        cert: tls,
        macaroon: macaroon,
        socket: config.LND.SOCKET,
      });

      this.lnd = lnd;
    } catch (e) {
      logger.err('Could not initiate the LND service handler: ' + (e instanceof Error ? e.message : e));
      process.exit(1);
    }
  }

  async $getNetworkInfo(): Promise<ILightningApi.NetworkInfo> {
    return await getNetworkInfo({ lnd: this.lnd });
  }

  async $getInfo(): Promise<ILightningApi.Info> {
    // @ts-ignore
    return await getWalletInfo({ lnd: this.lnd });
  }

  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    return await getNetworkGraph({ lnd: this.lnd });
  }
}

export default LndApi;
