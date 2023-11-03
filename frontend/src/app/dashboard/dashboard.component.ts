import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { filter, map, scan, share, switchMap, tap } from 'rxjs/operators';
import { Block } from '../interfaces/electrs.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { MempoolInfo, TransactionStripped } from '../interfaces/websocket.interface';
import { ApiService } from '../services/api.service';
import { StateService } from '../services/state.service';
import * as Chartist from '@mempool/chartist';
import { DOCUMENT, formatDate } from '@angular/common';
import { WebsocketService } from '../services/websocket.service';
import { SeoService } from '../services/seo.service';
import { StorageService } from '../services/storage.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { languages, Language } from '../app.constants';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface EpochProgress {
  base: string;
  green: string;
  red: string;
  change: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressClass: string;
}

interface MempoolStatsData {
  mempool: OptimizedMempoolStats[];
  weightPerSecond: any;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  collapseLevel: string;
  network$: Observable<string>;
  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  difficultyEpoch$: Observable<EpochProgress>;
  mempoolLoadingStatus$: Observable<number>;
  vBytesPerSecondLimit = 1667;
  blocks$: Observable<Block[]>;
  transactions$: Observable<TransactionStripped[]>;
  latestBlockHeight: number;
  mempoolTransactionsWeightPerSecondData: any;
  mempoolStats$: Observable<MempoolStatsData>;
  transactionsWeightPerSecondOptions: any;
  languageForm: FormGroup;
  languages: Language[];

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private stateService: StateService,
    private apiService: ApiService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private storageService: StorageService,
    private formBuilder: FormBuilder,
    @Inject(DOCUMENT) private document: Document
  ) { }

  ngOnInit(): void {
    this.languages = languages;
    this.seoService.resetTitle();
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks', 'live-2h-chart']);
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.collapseLevel = this.storageService.getValue('dashboard-collapsed') || 'one';
    this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$.pipe(
      map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
    );

    this.languageForm = this.formBuilder.group({
      language: ['']
    });
    this.setLanguageFromUrl();

    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ])
    .pipe(
      map(([mempoolInfo, vbytesPerSecond]) => {
        const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);

        let progressClass = 'bg-danger';
        if (percent <= 75) {
          progressClass = 'bg-success';
        } else if (percent <= 99) {
          progressClass = 'bg-warning';
        }

        return {
          memPoolInfo: mempoolInfo,
          vBytesPerSecond: vbytesPerSecond,
          progressWidth: percent + '%',
          progressClass: progressClass,
        };
      })
    );

    this.difficultyEpoch$ = combineLatest([
      this.stateService.blocks$.pipe(map(([block]) => block)),
      this.stateService.lastDifficultyAdjustment$
    ])
    .pipe(
      map(([block, DATime]) => {
        const now = new Date().getTime() / 1000;
        const diff = now - DATime;
        const blocksInEpoch = block.height % 2016;
        const estimatedBlocks = Math.round(diff / 60 / 10);
        const difficultyChange = (blocksInEpoch - (diff / 60 / 10)) / blocksInEpoch * 100;

        let base = 0;
        let green = 0;
        let red = 0;

        if (blocksInEpoch >= estimatedBlocks) {
          base = estimatedBlocks / 2016 * 100;
          green = (blocksInEpoch - estimatedBlocks) / 2016 * 100;
        } else {
          base = blocksInEpoch / 2016 * 100;
          red = Math.min((estimatedBlocks - blocksInEpoch) / 2016 * 100, 100 - base);
        }

        return {
          base: base + '%',
          green: green + '%',
          red: red + '%',
          change: difficultyChange,
        };
      })
    );

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / 1000000)
          };
        })
      );

    this.blocks$ = this.stateService.blocks$
      .pipe(
        tap(([block]) => {
          this.latestBlockHeight = block.height;
        }),
        scan((acc, [block]) => {
          acc.unshift(block);
          acc = acc.slice(0, 6);
          return acc;
        }, []),
      );

    this.transactions$ = this.stateService.transactions$
      .pipe(
        scan((acc, tx) => {
          acc.unshift(tx);
          acc = acc.slice(0, 6);
          return acc;
        }, []),
      );

    this.mempoolStats$ = this.stateService.connectionState$.pipe(
      filter((state) => state === 2),
      switchMap(() => this.apiService.list2HStatistics$()),
      switchMap((mempoolStats) => {
        return merge(
          this.stateService.live2Chart$
            .pipe(
              scan((acc, stats) => {
                acc.unshift(stats);
                acc = acc.slice(0, 120);
                return acc;
              }, mempoolStats)
            ),
          of(mempoolStats)
        );
      }),
      map((mempoolStats) => {
        return {
          mempool: mempoolStats,
          weightPerSecond: this.handleNewMempoolData(mempoolStats.concat([])),
        };
      }),
      share(),
    );

    this.transactionsWeightPerSecondOptions = {
        showArea: false,
        showLine: true,
        fullWidth: true,
        showPoint: false,
        low: 0,
        axisY: {
          offset: 40
        },
        axisX: {
          labelInterpolationFnc: (value: any, index: any) => index % 24 === 0 ? formatDate(value, 'HH:mm', this.locale) : null,
          offset: 20
        },
        plugins: [
          Chartist.plugins.ctTargetLine({
            value: 1667
          }),
        ]
      };
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    return {
      labels: labels,
      series: [mempoolStats.map((stats) => stats.vbytes_per_second)],
    };
  }

  trackByBlock(index: number, block: Block) {
    return block.height;
  }

  toggleCollapsed() {
    if (this.collapseLevel === 'one') {
      this.collapseLevel = 'two';
    } else if (this.collapseLevel === 'two') {
      this.collapseLevel = 'three';
    } else {
      this.collapseLevel = 'one';
    }
    this.storageService.setValue('dashboard-collapsed', this.collapseLevel);
  }

  setLanguageFromUrl() {
    const urlLanguage = this.document.location.pathname.split('/')[1];
    if (this.languages.map((lang) => lang.code).indexOf(urlLanguage) > -1) {
      this.languageForm.get('language').setValue(urlLanguage);
    } else {
      this.languageForm.get('language').setValue('en');
    }
  }

  changeLanguage() {
    const language = this.languageForm.get('language').value;
    try {
      document.cookie = `lang=${language}; expires=Thu, 18 Dec 2050 12:00:00 UTC; path=/`;
    } catch (e) { }
    this.document.location.href = `${language === 'en' ? '' : '/' + language}/${this.stateService.network}`;
  }
}
