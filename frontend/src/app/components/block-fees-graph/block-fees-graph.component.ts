import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel } from 'src/app/shared/graphs.utils';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-block-fees-graph',
  templateUrl: './block-fees-graph.component.html',
  styleUrls: ['./block-fees-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockFeesGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@6c453b11fd7bd159ae30bc381f367bc736d86909:Block Fees`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockFees$(timespan)
            .pipe(
              tap((response) => {
                this.prepareChartOptions({
                  blockFees: response.body.map(val => [val.timestamp * 1000, val.avgFees / 100000000, val.avgHeight]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      animation: false,
      color: [
        new graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
      ],
      grid: {
        top: 30,
        bottom: 80,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks) => {
          let tooltip = `<b style="color: white; margin-left: 2px">${formatterXAxis(this.locale, this.timespan, parseInt(ticks[0].axisValue, 10))}</b><br>`;
          tooltip += `${ticks[0].marker} ${ticks[0].seriesName}: ${formatNumber(ticks[0].data[1], this.locale, '1.3-3')} BTC`;
          tooltip += `<br>`;

          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += `<small>` + $localize`At block: ${ticks[0].data[2]}` + `</small>`;
          } else {
            tooltip += `<small>` + $localize`Around block: ${ticks[0].data[2]}` + `</small>`;
          }

          return tooltip;
        }
      },
      xAxis: {
        name: formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            }
          },
        },
      ],
      series: [
        {
          zlevel: 0,
          name: $localize`:@@c20172223f84462032664d717d739297e5a9e2fe:Fees`,
          showSymbol: false,
          symbol: 'none',
          data: data.blockFees,
          type: 'line',
          lineStyle: {
            width: 2,
          },
        },
      ],
      dataZoom: [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 5,
        moveOnMouseMove: false,
      }, {
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        left: 20,
        right: 15,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          }
        },
      }],
    };
  }

  onChartInit(ec) {
    this.chartInstance = ec;
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart() {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-fees-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
