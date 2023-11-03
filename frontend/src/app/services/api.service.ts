import { Injectable } from '@angular/core';
import { webSocket } from 'rxjs/webSocket';
import { HttpClient, HttpParams } from '@angular/common/http';
import { IMempoolDefaultResponse, IMempoolStats, IBlockTransaction, IBlock } from '../blockchain/interfaces';
import { Observable } from 'rxjs';
import { MemPoolService } from './mem-pool.service';
import { tap, retryWhen, delay } from 'rxjs/operators';

const WEB_SOCKET_PROTOCOL = (document.location.protocol === 'https:') ? 'wss:' : 'ws:';
const WEB_SOCKET_URL = WEB_SOCKET_PROTOCOL + '//' + document.location.hostname + ':' + document.location.port + '/ws';
const API_BASE_URL = '/api/v1';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private websocketSubject: Observable<IMempoolDefaultResponse> = webSocket<IMempoolDefaultResponse | any>(WEB_SOCKET_URL);
  private lastWant: string[] | null = null;
  private goneOffline = false;
  private lastTrackedTxId = '';

  constructor(
    private httpClient: HttpClient,
    private memPoolService: MemPoolService,
  ) {
    this.startSubscription();
  }

  startSubscription() {
    this.websocketSubject
      .pipe(
        retryWhen((errors: any) => errors
          .pipe(
            tap(() => {
              this.goneOffline = true;
              this.memPoolService.isOffline$.next(true);
            }),
            delay(5000),
          )
        ),
      )
      .subscribe((response: IMempoolDefaultResponse) => {
          this.memPoolService.isOffline$.next(false);

          if (response.blocks && response.blocks.length) {
            const blocks = response.blocks;
            // blocks.reverse();
            blocks.forEach((block: IBlock) => this.memPoolService.blocks$.next(block));
          }
          if (response.block) {
            this.memPoolService.blocks$.next(response.block);
          }

          if (response.projectedBlocks && response.projectedBlocks.length) {
            const mempoolWeight = response.projectedBlocks.map((block: any) => block.blockWeight).reduce((a: any, b: any) => a + b);
            this.memPoolService.mempoolWeight$.next(mempoolWeight);
            this.memPoolService.projectedBlocks$.next(response.projectedBlocks);
          }

          if (response.mempoolInfo && response.txPerSecond !== undefined) {
            this.memPoolService.mempoolStats$.next({
              memPoolInfo: response.mempoolInfo,
              txPerSecond: response.txPerSecond,
              vBytesPerSecond: response.vBytesPerSecond,
            });
          }

          if (response.conversions) {
            this.memPoolService.conversions$.next(response.conversions);
          }

          if (response['track-tx'] && !this.goneOffline) {
            let txTrackingEnabled;
            let txTrackingBlockHeight;
            let txTrackingTx = null;
            let txShowTxNotFound = false;
            if (response['track-tx'].tracking) {
              txTrackingEnabled = true;
              txTrackingBlockHeight = response['track-tx'].blockHeight;
              if (response['track-tx'].tx) {
                txTrackingTx = response['track-tx'].tx;
              }
            } else {
              txTrackingEnabled = false;
              txTrackingTx = null;
              txTrackingBlockHeight = 0;
            }
            if (response['track-tx'].message && response['track-tx'].message === 'not-found') {
              txShowTxNotFound = true;
            }
            this.memPoolService.txTracking$.next({
              enabled: txTrackingEnabled,
              tx: txTrackingTx,
              blockHeight: txTrackingBlockHeight,
              notFound: txShowTxNotFound,
            });
          }

          if (response['live-2h-chart']) {
            this.memPoolService.live2Chart$.next(response['live-2h-chart']);
          }

          if (this.goneOffline === true) {
            this.goneOffline = false;
            if (this.lastWant) {
              this.webSocketWant(this.lastWant);
            }
            if (this.memPoolService.txTracking$.value.enabled) {
              this.webSocketStartTrackTx(this.lastTrackedTxId);
            }
          }
        },
        (err: Error) => {
          console.log(err);
          this.goneOffline = true;
          console.log('Error, retrying in 10 sec');
          setTimeout(() => this.startSubscription(), 10000);
        });
  }

  webSocketStartTrackTx(txId: string) {
    // @ts-ignore
    this.websocketSubject.next({'action': 'track-tx', 'txId': txId});
    this.lastTrackedTxId = txId;
  }

  webSocketWant(data: string[]) {
    // @ts-ignore
    this.websocketSubject.next({'action': 'want', data: data});
    this.lastWant = data;
  }

  listTransactionsForBlock$(height: number): Observable<IBlockTransaction[]> {
    return this.httpClient.get<IBlockTransaction[]>(API_BASE_URL + '/transactions/height/' + height);
  }

  listTransactionsForProjectedBlock$(index: number): Observable<IBlockTransaction[]> {
    return this.httpClient.get<IBlockTransaction[]>(API_BASE_URL + '/transactions/projected/' + index);
  }

  list2HStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/2h');
  }

  list24HStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/24h');
  }

  list1WStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/1w');
  }

  list1MStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/1m');
  }

  list3MStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/3m');
  }

  list6MStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/6m');
  }

  listBlocks$(height?: number): Observable<any[]> {
    return this.httpClient.get<any[]>(API_BASE_URL + '/explorer/blocks/' + (height || ''));
  }

  getTransaction$(txId: string): Observable<any[]> {
    return this.httpClient.get<any[]>(API_BASE_URL + '/explorer/tx/' + txId);
  }

  getBlock$(hash: string): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/explorer/block/' + hash);
  }

  getBlockTransactions$(hash: string, index?: number): Observable<any[]> {
    return this.httpClient.get<any[]>(API_BASE_URL + '/explorer/block/' + hash + '/tx/' + (index || ''));
  }

  getAddress$(address: string): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/explorer/address/' + address);
  }

  getAddressTransactions$(address: string): Observable<any[]> {
    return this.httpClient.get<any[]>(API_BASE_URL + '/explorer/address/' + address+ '/tx/');
  }

  getAddressTransactionsFromHash$(address: string, txid: string): Observable<any[]> {
    return this.httpClient.get<any[]>(API_BASE_URL + '/explorer/address/' + address + '/tx/chain/' + txid);
  }
}
