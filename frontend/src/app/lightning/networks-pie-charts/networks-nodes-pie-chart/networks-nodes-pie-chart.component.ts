import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { LightningApiService } from '../../lightning-api.service';
import { formatNumber } from '@angular/common';
import * as venn from '@upsetjs/venn.js';
import * as d3 from 'd3';

@Component({
  selector: 'app-networks-nodes-pie-chart',
  templateUrl: './networks-nodes-pie-chart.component.html',
  styleUrls: ['./networks-nodes-pie-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworksNodesPieChart implements OnInit {
  statsObservable$: Observable<any>;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: LightningApiService
  ) { }

  ngOnInit(): void {
    const that = this;

    this.statsObservable$ = this.apiService.getNetworksNodesStats$()
      .pipe(
        tap((response) => {
          const sets: any[] = [];
          for (const network of response) {
            let set = [];
            if (network.type === 'tor') {
              set = ['Tor'];
            } else if (network.type === 'clearnet') {
              set = ['Clearnet'];
            } else if (network.type === 'torclearnet') {
              set = ['Tor', 'Clearnet'];
            }
            sets.push({
              sets: set,
              size: network.count
            });
          }

          // draw venn diagram
          const div = d3.select('#venn-nodes');
          const chart = venn.VennDiagram({
            colorScheme: [
              '#8E24AA',
              '#1E88E5'
            ],
          });
          chart.useViewBox();
          div.datum(sets).call(chart);
          d3.selectAll('#venn-nodes .venn-circle path').style('fill-opacity', 0.6);
          d3.selectAll('#venn-nodes text').style('fill', 'white');

          // add a tooltip
          const tooltip = d3.select('body').append('div').attr('class', 'venntooltip');

          // add listeners to all the groups to display tooltip on mouseenter
          div
            .selectAll('g')
            .on('mouseenter', function (d) {
              // sort all the areas relative to the current item
              venn.sortAreas(div, d);

              // Display a tooltip with the current size
              tooltip.transition().duration(400).style('opacity', 1);
              tooltip.text(formatNumber(d.size, that.locale, '1.0-0') + ' nodes');
              tooltip.html(`
                <b>${d.sets.length === 1 ? d.sets[0] : d.sets.join(' & ')}</b><br>
                <span style="color:#b1b1b1">${formatNumber(d.size, that.locale, '1.0-0')} nodes
              `);

              // highlight the current path
              const selection = d3.select(this).transition('tooltip').duration(400);
              selection
                .select('path')
                .style('stroke-width', 3)
                .style('fill-opacity', d.sets.length == 1 ? 0.8 : 0.2)
                .style('stroke-opacity', 1);
            })

            .on('mousemove', function () {
              tooltip.style('left', d3.event.pageX + 20 + 'px').style('top', d3.event.pageY - 28 + 'px');
            })

            .on('mouseleave', function (d) {
              tooltip.transition().duration(400).style('opacity', 0);
              const selection = d3.select(this).transition('tooltip').duration(400);
              selection
                .select('path')
                .style('stroke-width', 0)
                .style('fill-opacity', d.sets.length == 1 ? 0.6 : 0.0)
                .style('stroke-opacity', 0);
            });

        })
      );
  }
}

