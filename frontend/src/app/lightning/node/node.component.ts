import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-node',
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeComponent implements OnInit {
  node$: Observable<any>;
  statistics$: Observable<any>;
  publicKey$: Observable<string>;
  selectedSocketIndex = 0;
  qrCodeVisible = false;

  constructor(
    private lightningApiService: LightningApiService,
    private activatedRoute: ActivatedRoute,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.node$ = this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          return this.lightningApiService.getNode$(params.get('public_key'));
        }),
        map((node) => {
          this.seoService.setTitle(`Node: ${node.alias}`);

          const socketsObject = [];
          for (const socket of node.sockets.split(',')) {
            if (socket === '') {
              continue;
            }
            let label = '';
            if (socket.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)) {
              label = 'IPv4';
            } else if (socket.indexOf('[') > -1) {
              label = 'IPv6';
            } else if (socket.indexOf('onion') > -1) {
              label = 'Tor';
            }
            socketsObject.push({
              label: label,
              socket: node.public_key + '@' + socket,
            });
          }
          node.socketsObject = socketsObject;
          return node;
        }),
      );
  }

  changeSocket(index: number) {
    this.selectedSocketIndex = index;
  }

}
