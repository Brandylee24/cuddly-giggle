import { Component, OnInit, ChangeDetectionStrategy, EventEmitter, Output, ViewChild, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetsService } from 'src/app/services/assets.service';
import { StateService } from 'src/app/services/state.service';
import { Observable, of, Subject, zip, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
import { ElectrsApiService } from 'src/app/services/electrs-api.service';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { ApiService } from 'src/app/services/api.service';
import { SearchResultsComponent } from './search-results/search-results.component';
import { findOtherNetworks, getRegex } from '../../shared/regex.utils';

@Component({
  selector: 'app-search-form',
  templateUrl: './search-form.component.html',
  styleUrls: ['./search-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFormComponent implements OnInit {
  network = '';
  assets: object = {};
  isSearching = false;
  isTypeaheading$ = new BehaviorSubject<boolean>(false);
  typeAhead$: Observable<any>;
  searchForm: FormGroup;

  regexAddress = getRegex('address', 'mainnet'); // Default to mainnet
  regexBlockhash = getRegex('blockhash');
  regexTransaction = getRegex('transaction');
  regexBlockheight = getRegex('blockheight');
  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  @Output() searchTriggered = new EventEmitter();
  @ViewChild('searchResults') searchResults: SearchResultsComponent;
  @HostListener('keydown', ['$event']) keydown($event) {
    this.handleKeyDown($event);
  }

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private assetsService: AssetsService,
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private apiService: ApiService,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      // TODO: Eventually change network type here from string to enum of consts
      this.regexAddress = getRegex('address', network as any || 'mainnet');
    });

    this.searchForm = this.formBuilder.group({
      searchText: ['', Validators.required],
    });

    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      this.assetsService.getAssetsMinimalJson$
        .subscribe((assets) => {
          this.assets = assets;
        });
    }

    this.typeAhead$ = this.searchForm.get('searchText').valueChanges
      .pipe(
        map((text) => {
          if (this.network === 'bisq' && text.match(/^(b)[^c]/i)) {
            return text.substr(1);
          }
          return text.trim();
        }),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((text) => {
          if (!text.length) {
            return of([
              [],
              {
                nodes: [],
                channels: [],
              }
            ]);
          }
          this.isTypeaheading$.next(true);
          // TODO: Decide whether to run getAddressesByPrefix for every network,
          // or to only display the options if it is a complete address.
          if (!this.stateService.env.LIGHTNING) {
            return zip(
              this.electrsApiService.getAddressesByPrefix$(text).pipe(catchError(() => of([]))),
              [{ nodes: [], channels: [] }]
            );
          }
          return zip(
            this.electrsApiService.getAddressesByPrefix$(text).pipe(catchError(() => of([]))),
            this.apiService.lightningSearch$(text).pipe(catchError(() => of({
              nodes: [],
              channels: [],
            }))),
          );
        }),
        map((result: any[]) => {
          this.isTypeaheading$.next(false);
          if (this.network === 'bisq') {
            return result[0].map((address: string) => 'B' + address);
          }
          return {
            addresses: result[0],
            nodes: result[1].nodes,
            channels: result[1].channels,
            totalResults: result[0].length + result[1].nodes.length + result[1].channels.length,
          };
        })
      );
  }
  handleKeyDown($event) {
    this.searchResults.handleKeyDown($event);
  }

  itemSelected() {
    setTimeout(() => this.search());
  }

  selectedResult(result: any) {
    if (typeof result === 'string') {
      this.search(result);
    } else if (result.alias) {
      this.navigate('/lightning/node/', result.public_key);
    } else if (result.short_id) {
      this.navigate('/lightning/channel/', result.id);
    }
  }

  search(result?: string) {
    const searchText = result || this.searchForm.value.searchText.trim();
    if (searchText) {
      this.isSearching = true;
      const otherNetworks = findOtherNetworks(searchText, this.network as any);
      if (this.regexAddress.test(searchText)) {
        this.navigate('/address/', searchText);
      } else if (otherNetworks.length > 0) {
        // Change the network to the first match
        this.navigate('/address/', searchText, undefined, otherNetworks[0]);
      } else if (this.regexBlockhash.test(searchText) || this.regexBlockheight.test(searchText)) {
        this.navigate('/block/', searchText);
      } else if (this.regexTransaction.test(searchText)) {
        const matches = this.regexTransaction.exec(searchText);
        if (this.network === 'liquid' || this.network === 'liquidtestnet') {
          if (this.assets[matches[1]]) {
            this.navigate('/assets/asset/', matches[1]);
          }
          this.electrsApiService.getAsset$(matches[1])
            .subscribe(
              () => { this.navigate('/assets/asset/', matches[1]); },
              () => {
                this.electrsApiService.getBlock$(matches[1])
                  .subscribe(
                    (block) => { this.navigate('/block/', matches[1], { state: { data: { block } } }); },
                    () => { this.navigate('/tx/', matches[0]); });
              }
            );
        } else {
          this.navigate('/tx/', matches[0]);
        }
      } else {
        this.searchResults.searchButtonClick();
        this.isSearching = false;
      }
    }
  }

  navigate(url: string, searchText: string, extras?: any, swapNetwork?: string) {
    this.router.navigate([this.relativeUrlPipe.transform(url, swapNetwork), searchText], extras);
    this.searchTriggered.emit();
    this.searchForm.setValue({
      searchText: '',
    });
    this.isSearching = false;
  }
}
