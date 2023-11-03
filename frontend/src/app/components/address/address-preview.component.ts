import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap, filter, catchError, map, tap } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';
import { OpenGraphService } from 'src/app/services/opengraph.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';
import { of, merge, Subscription, Observable } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';
import { AddressInformation } from 'src/app/interfaces/node-api.interface';

@Component({
  selector: 'app-address-preview',
  templateUrl: './address-preview.component.html',
  styleUrls: ['./address-preview.component.scss']
})
export class AddressPreviewComponent implements OnInit, OnDestroy {
  network = '';

  address: Address;
  addressString: string;
  isLoadingAddress = true;
  error: any;
  mainSubscription: Subscription;
  addressLoadingStatus$: Observable<number>;
  addressInfo: null | AddressInformation = null;

  totalConfirmedTxCount = 0;
  loadedConfirmedTxCount = 0;
  txCount = 0;
  received = 0;
  sent = 0;
  totalUnspent = 0;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private apiService: ApiService,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
  ) { }

  ngOnInit() {
    this.openGraphService.setPreviewLoading();
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.addressLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['address-' + this.addressString] !== undefined ? indicators['address-' + this.addressString] : 0)
      );

    this.mainSubscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = undefined;
          this.isLoadingAddress = true;
          this.loadedConfirmedTxCount = 0;
          this.address = null;
          this.addressInfo = null;
          this.addressString = params.get('id') || '';
          if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}$/.test(this.addressString)) {
            this.addressString = this.addressString.toLowerCase();
          }
          this.seoService.setTitle($localize`:@@address.component.browser-title:Address: ${this.addressString}:INTERPOLATION:`);

          return this.electrsApiService.getAddress$(this.addressString)
            .pipe(
              catchError((err) => {
                this.isLoadingAddress = false;
                this.error = err;
                console.log(err);
                return of(null);
              })
            );
        })
      )
      .pipe(
        filter((address) => !!address),
        tap((address: Address) => {
          if ((this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') && /^([m-zA-HJ-NP-Z1-9]{26,35}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[a-km-zA-HJ-NP-Z1-9]{80})$/.test(address.address)) {
            this.apiService.validateAddress$(address.address)
              .subscribe((addressInfo) => {
                this.addressInfo = addressInfo;
              });
          }
          this.address = address;
          this.updateChainStats();
          this.isLoadingAddress = false;
          this.openGraphService.setPreviewReady();
        })
      )
      .subscribe(() => {},
        (error) => {
          console.log(error);
          this.error = error;
          this.isLoadingAddress = false;
        }
      );
  }

  updateChainStats() {
    this.received = this.address.chain_stats.funded_txo_sum + this.address.mempool_stats.funded_txo_sum;
    this.sent = this.address.chain_stats.spent_txo_sum + this.address.mempool_stats.spent_txo_sum;
    this.txCount = this.address.chain_stats.tx_count + this.address.mempool_stats.tx_count;
    this.totalConfirmedTxCount = this.address.chain_stats.tx_count;
    this.totalUnspent = this.address.chain_stats.funded_txo_count - this.address.chain_stats.spent_txo_count;
  }

  ngOnDestroy() {
    this.mainSubscription.unsubscribe();
  }
}
