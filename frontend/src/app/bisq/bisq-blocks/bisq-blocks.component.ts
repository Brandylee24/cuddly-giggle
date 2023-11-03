import { Component, OnInit } from '@angular/core';
import { BisqApiService } from '../bisq-api.service';
import { switchMap, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { BisqBlock, BisqOutput, BisqTransaction } from '../bisq.interfaces';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-bisq-blocks',
  templateUrl: './bisq-blocks.component.html',
  styleUrls: ['./bisq-blocks.component.scss']
})
export class BisqBlocksComponent implements OnInit {
  blocks: BisqBlock[];
  totalCount: number;
  page = 1;
  itemsPerPage: number;
  contentSpace = window.innerHeight - (165 + 75);
  fiveItemsPxSize = 250;
  loadingItems: number[];
  isLoading = true;
  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;

  pageSubject$ = new Subject<number>();

  constructor(
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Blocks', true);
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);
    this.loadingItems = Array(this.itemsPerPage);
    if (document.body.clientWidth < 768) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.pageSubject$
      .pipe(
        tap(() => this.isLoading = true),
        switchMap((page) => this.bisqApiService.listBlocks$((page - 1) * this.itemsPerPage, this.itemsPerPage))
      )
      .subscribe((response) => {
        this.isLoading = false;
        this.blocks = response.body;
        this.totalCount = parseInt(response.headers.get('x-total-count'), 10);
      }, (error) => {
        console.log(error);
      });

    this.pageSubject$.next(1);
  }

  calculateTotalOutput(block: BisqBlock): number {
    return block.txs.reduce((a: number, tx: BisqTransaction) =>
      a + tx.outputs.reduce((acc: number, output: BisqOutput) => acc + output.bsqAmount, 0), 0
    );
  }

  trackByFn(index: number) {
    return index;
  }

  pageChange(page: number) {
    this.pageSubject$.next(page);
  }
}
