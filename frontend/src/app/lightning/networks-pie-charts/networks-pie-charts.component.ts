import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '/Users/nymkappa/Documents/mempool.space/frontend/projects/mempool/src/app/services/seo.services';
@Component({
  selector: 'app-networks-pie-charts',
  templateUrl: './networks-pie-charts.component.html',
  styleUrls: ['./networks-pie-charts.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworksPieCharts implements OnInit {
  constructor(private seoService: SeoService) {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`Networks share in Lightning`);
  }
}

