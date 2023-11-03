import { ChangeDetectionStrategy, Component, OnInit, HostBinding, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { EChartsOption, PieSeriesOption } from 'echarts';
import { combineLatest, map, Observable, share, Subject, switchMap, tap } from 'rxjs';
import { chartColors } from 'src/app/app.constants';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { download } from 'src/app/shared/graphs.utils';
import { AmountShortenerPipe } from 'src/app/shared/pipes/amount-shortener.pipe';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-nodes-per-isp-chart',
  templateUrl: './nodes-per-isp-chart.component.html',
  styleUrls: ['./nodes-per-isp-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerISPChartComponent implements OnInit {
  isLoading = true;
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  timespan = '';
  chartInstance = undefined;

  @HostBinding('attr.dir') dir = 'ltr';

  nodesPerAsObservable$: Observable<any>;
  showTorObservable$: Observable<boolean>;
  groupBySubject = new Subject<boolean>();
  showTorSubject = new Subject<boolean>();

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private amountShortenerPipe: AmountShortenerPipe,
    private router: Router,
    private zone: NgZone,
    private stateService: StateService,
  ) {
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`Lightning nodes per ISP`);

    this.showTorObservable$ = this.showTorSubject.asObservable();
    this.nodesPerAsObservable$ = combineLatest([this.groupBySubject, this.showTorSubject])
      .pipe(
        switchMap((selectedFilters) => {
          return this.apiService.getNodesPerAs(
            selectedFilters[0] ? 'capacity' : 'node-count',
            selectedFilters[1] // Show Tor nodes
          )
            .pipe(
              tap(data => {
                this.isLoading = false;
                this.prepareChartOptions(data);
              }),
              map(data => {
                for (let i = 0; i < data.length; ++i) {
                  data[i].rank = i + 1;
                }
                return data.slice(0, 100);
              })
            );
        }),
        share()
      );
  }

  generateChartSerieData(as): PieSeriesOption[] {
    const shareThreshold = this.isMobile() ? 2 : 0.5;
    const data: object[] = [];
    let totalShareOther = 0;
    let totalNodeOther = 0;

    let edgeDistance: string | number = '10%';
    if (this.isMobile()) {
      edgeDistance = 0;
    }

    as.forEach((as) => {
      if (as.share < shareThreshold) {
        totalShareOther += as.share;
        totalNodeOther += as.count;
        return;
      }
      data.push({
        itemStyle: {
          color: as.ispId === null ? '#7D4698' : undefined,
        },
        value: as.share,
        name: as.name + (this.isMobile() ? `` : ` (${as.share}%)`),
        label: {
          overflow: 'truncate',
          color: '#b1b1b1',
          alignTo: 'edge',
          edgeDistance: edgeDistance,
        },
        tooltip: {
          show: !this.isMobile(),
          backgroundColor: 'rgba(17, 19, 31, 1)',
          borderRadius: 4,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          textStyle: {
            color: '#b1b1b1',
          },
          borderColor: '#000',
          formatter: () => {
            return `<b style="color: white">${as.name} (${as.share}%)</b><br>` +
              $localize`${as.count.toString()} nodes<br>` +
              $localize`${this.amountShortenerPipe.transform(as.capacity / 100000000, 2)} BTC capacity`
            ;
          }
        },
        data: as.ispId,
      } as PieSeriesOption);
    });

    // 'Other'
    data.push({
      itemStyle: {
        color: 'grey',
      },
      value: totalShareOther,
      name: 'Other' + (this.isMobile() ? `` : ` (${totalShareOther.toFixed(2)}%)`),
      label: {
        overflow: 'truncate',
        color: '#b1b1b1',
        alignTo: 'edge',
        edgeDistance: edgeDistance
      },
      tooltip: {
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
        },
        borderColor: '#000',
        formatter: () => {
          return `<b style="color: white">${'Other'} (${totalShareOther.toFixed(2)}%)</b><br>` +
            totalNodeOther.toString() + ` nodes`;
        }
      },
      data: 9999 as any,
    } as PieSeriesOption);

    return data;
  }

  prepareChartOptions(as): void {
    let pieSize = ['20%', '80%']; // Desktop
    if (this.isMobile()) {
      pieSize = ['15%', '60%'];
    }

    this.chartOptions = {
      color: chartColors.slice(3),
      tooltip: {
        trigger: 'item',
        textStyle: {
          align: 'left',
        }
      },
      series: [
        {
          zlevel: 0,
          minShowLabelAngle: 1.8,
          name: 'Lightning nodes',
          type: 'pie',
          radius: pieSize,
          data: this.generateChartSerieData(as),
          labelLine: {
            lineStyle: {
              width: 2,
            },
            length: this.isMobile() ? 1 : 20,
            length2: this.isMobile() ? 1 : undefined,
          },
          label: {
            fontSize: 14,
          },
          itemStyle: {
            borderRadius: 1,
            borderWidth: 1,
            borderColor: '#000',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 40,
              shadowColor: 'rgba(0, 0, 0, 0.75)',
            },
            labelLine: {
              lineStyle: {
                width: 4,
              }
            }
          }
        }
      ],
    };
  }

  isMobile(): boolean {
    return (window.innerWidth <= 767.98);
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      if (e.data.data === 9999 || e.data.data === null) { // "Other" or Tor
        return;
      }
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/lightning/nodes/isp/${e.data.data}`);
        this.router.navigate([url]);
      });
    });
  }

  onSaveChart(): void {
    const now = new Date();
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `ln-nodes-per-as-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  onTorToggleStatusChanged(e): void {
    this.showTorSubject.next(e);
  }

  onGroupToggleStatusChanged(e): void {
    this.groupBySubject.next(e);
  }
}

