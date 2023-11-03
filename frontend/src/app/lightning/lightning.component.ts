import { Component, OnInit } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { map, share } from 'rxjs/operators';
import { MempoolInfo } from '../interfaces/websocket.interface';
import { StateService } from '../services/state.service';

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressColor: string;
}
@Component({
  selector: 'app-lightning',
  templateUrl: './lightning.component.html',
  styleUrls: ['./lightning.component.scss']
})
export class LightningComponent implements OnInit {
  vBytesPerSecondLimit = 1667;
  mempoolInfoData$: Observable<MempoolInfoData>;
  network$ = of('liquid');
  liquidPegsMonth$: Observable<any>;
  collapseLevel = 'one';
  blocks$: Observable<any[]>;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit(): void {


    this.liquidPegsMonth$ = of([{"amount":"1100000","date":"2018-09-01"},{"amount":"111096669","date":"2018-10-01"},{"amount":"2409213685","date":"2018-11-01"},{"amount":"1781120","date":"2018-12-01"},{"amount":"2706719658","date":"2019-01-01"},{"amount":"31836594","date":"2019-02-01"},{"amount":"3650987","date":"2019-03-01"},{"amount":"9812517","date":"2019-04-01"},{"amount":"60372302","date":"2019-05-01"},{"amount":"53564810","date":"2019-06-01"},{"amount":"3459768257","date":"2019-07-01"},{"amount":"60732172","date":"2019-08-01"},{"amount":"3160141","date":"2019-09-01"},{"amount":"8727627","date":"2019-10-01"},{"amount":"472114752","date":"2019-11-01"},{"amount":"300125560","date":"2019-12-01"},{"amount":"50306401744","date":"2020-01-01"},{"amount":"23294069756","date":"2020-02-01"},{"amount":"12102379257","date":"2020-03-01"},{"amount":"110051533400","date":"2020-04-01"},{"amount":"10094511088","date":"2020-05-01"},{"amount":"492821658","date":"2020-06-01"},{"amount":"32088161097","date":"2020-07-01"},{"amount":"11177697786","date":"2020-08-01"},{"amount":"71895991","date":"2020-09-01"},{"amount":"341689703","date":"2020-10-01"},{"amount":"238129170","date":"2020-11-01"},{"amount":"68142667","date":"2020-12-01"},{"amount":"15675762076","date":"2021-01-01"},{"amount":"12060564991","date":"2021-02-01"},{"amount":"617810855","date":"2021-03-01"},{"amount":"734247768","date":"2021-04-01"},{"amount":"4580450055","date":"2021-05-01"},{"amount":"-286204104","date":"2021-06-01"},{"amount":"506120759","date":"2021-07-01"},{"amount":"27242308874","date":"2021-08-01"},{"amount":"8271190134","date":"2021-09-01"},{"amount":"6992135209","date":"2021-10-01"},{"amount":"-1173302855","date":"2021-11-01"},{"amount":"-748102541","date":"2021-12-01"},{"amount":"18225426070","date":"2022-01-01"},{"amount":"-430742891","date":"2022-02-01"},{"amount":"-253154599","date":"2022-03-01"},{"amount":"-182706327","date":"2022-04-01"}])
        .pipe(
          map((pegs) => {
            const labels = pegs.map(stats => stats.date);
            const series = pegs.map(stats => parseFloat(stats.amount) / 100000000);
            series.reduce((prev, curr, i) => series[i] = prev + curr, 0);
            return {
              series,
              labels
            };
          }),
          share(),
        );


        
    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ])
    .pipe(
      map(([mempoolInfo, vbytesPerSecond]) => {
        const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);

        let progressColor = '#7CB342';
        if (vbytesPerSecond > 1667) {
          progressColor = '#FDD835';
        }
        if (vbytesPerSecond > 2000) {
          progressColor = '#FFB300';
        }
        if (vbytesPerSecond > 2500) {
          progressColor = '#FB8C00';
        }
        if (vbytesPerSecond > 3000) {
          progressColor = '#F4511E';
        }
        if (vbytesPerSecond > 3500) {
          progressColor = '#D81B60';
        }

        const mempoolSizePercentage = (mempoolInfo.usage / mempoolInfo.maxmempool * 100);
        let mempoolSizeProgress = 'bg-danger';
        if (mempoolSizePercentage <= 50) {
          mempoolSizeProgress = 'bg-success';
        } else if (mempoolSizePercentage <= 75) {
          mempoolSizeProgress = 'bg-warning';
        }

        return {
          memPoolInfo: mempoolInfo,
          vBytesPerSecond: vbytesPerSecond,
          progressWidth: percent + '%',
          progressColor: progressColor,
          mempoolSizeProgress: mempoolSizeProgress,
        };
      })
    );
  }

}
