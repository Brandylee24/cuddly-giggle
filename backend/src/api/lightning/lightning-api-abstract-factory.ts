import { ILightningApi } from './lightning-api.interface';

export interface AbstractLightningApi {
  $getNetworkInfo(): Promise<ILightningApi.NetworkInfo>;
  $getNetworkGraph(): Promise<ILightningApi.NetworkGraph>;
  $getInfo(): Promise<ILightningApi.Info>;
}
