import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Block } from 'src/app/interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';
import { specialBlocks } from 'src/app/app.constants';

@Component({
  selector: 'app-blockchain-blocks',
  templateUrl: './blockchain-blocks.component.html',
  styleUrls: ['./blockchain-blocks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainBlocksComponent implements OnInit, OnDestroy {
  specialBlocks = specialBlocks;
  network = '';
  blocks: Block[] = [];
  emptyBlocks: Block[] = this.mountEmptyBlocks();
  markHeight: number;
  blocksSubscription: Subscription;
  networkSubscription: Subscription;
  tabHiddenSubscription: Subscription;
  markBlockSubscription: Subscription;
  loadingBlocks$: Observable<boolean>;
  blockStyles = [];
  emptyBlockStyles = [];
  interval: any;
  tabHidden = false;
  feeRounding = '1.0-0';
  arrowVisible = false;
  arrowLeftPx = 30;
  blocksFilled = false;
  transition = '1s';

  gradientColors = {
    '': ['#9339f4', '#105fb0'],
    bisq: ['#9339f4', '#105fb0'],
    liquid: ['#116761', '#183550'],
    testnet: ['#1d486f', '#183550'],
    signet: ['#6f1d5d', '#471850'],
  };

  constructor(
    public stateService: StateService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    if (this.stateService.network === 'liquid') {
      this.feeRounding = '1.0-1';
    }
    this.emptyBlocks.forEach((b) => this.emptyBlockStyles.push(this.getStyleForEmptyBlock(b)));
    this.loadingBlocks$ = this.stateService.isLoadingWebSocket$;
    this.networkSubscription = this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.tabHiddenSubscription = this.stateService.isTabHidden$.subscribe((tabHidden) => this.tabHidden = tabHidden);
    this.blocksSubscription = this.stateService.blocks$
      .subscribe(([block, txConfirmed]) => {
        if (this.blocks.some((b) => b.height === block.height)) {
          return;
        }

        if (this.blocks.length && block.height !== this.blocks[0].height + 1) {
          this.blocks = [];
          this.blocksFilled = false;
        }

        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, this.stateService.env.KEEP_BLOCKS_AMOUNT);

        if (this.blocksFilled && !this.tabHidden) {
          block.stage = block.matchRate >= 66 ? 1 : 2;
        }

        if (txConfirmed) {
          this.markHeight = block.height;
          this.moveArrowToPosition(true, true);
        } else {
          this.moveArrowToPosition(true, false);
        }

        this.blockStyles = [];
        this.blocks.forEach((b) => this.blockStyles.push(this.getStyleForBlock(b)));
        setTimeout(() => {
          this.blockStyles = [];
          this.blocks.forEach((b) => this.blockStyles.push(this.getStyleForBlock(b)));
          this.cd.markForCheck();
        }, 50);

        if (this.blocks.length === this.stateService.env.KEEP_BLOCKS_AMOUNT) {
          this.blocksFilled = true;
        }
        this.cd.markForCheck();
      });

    this.markBlockSubscription = this.stateService.markBlock$
      .subscribe((state) => {
        this.markHeight = undefined;
        if (state.blockHeight) {
          this.markHeight = state.blockHeight;
        }
        this.moveArrowToPosition(false);
        this.cd.markForCheck();
      });
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    this.networkSubscription.unsubscribe();
    this.tabHiddenSubscription.unsubscribe();
    this.markBlockSubscription.unsubscribe();
    clearInterval(this.interval);
  }

  moveArrowToPosition(animate: boolean, newBlockFromLeft = false) {
    if (!this.markHeight) {
      this.arrowVisible = false;
      return;
    }
    const blockindex = this.blocks.findIndex((b) => b.height === this.markHeight);
    if (blockindex > -1) {
      if (!animate) {
        this.transition = 'inherit';
      }
      this.arrowVisible = true;
      if (newBlockFromLeft) {
        this.arrowLeftPx = blockindex * 155 + 30 - 205;
        setTimeout(() => {
          this.transition = '2s';
          this.arrowLeftPx = blockindex * 155 + 30;
          this.cd.markForCheck();
        }, 50);
      } else {
        this.arrowLeftPx = blockindex * 155 + 30;
        if (!animate) {
          setTimeout(() => {
            this.transition = '2s';
            this.cd.markForCheck();
          });
        }
      }
    }
  }

  trackByBlocksFn(index: number, item: Block) {
    return item.height;
  }

  getStyleForBlock(block: Block) {
    const greenBackgroundHeight = 100 - (block.weight / this.stateService.env.BLOCK_WEIGHT_UNITS) * 100;
    let addLeft = 0;

    if (block.stage === 1) {
      block.stage = 2;
      addLeft = -205;
    }

    return {
      left: addLeft + 155 * this.blocks.indexOf(block) + 'px',
      background: `repeating-linear-gradient(
        #2d3348,
        #2d3348 ${greenBackgroundHeight}%,
        ${this.gradientColors[this.network][0]} ${Math.max(greenBackgroundHeight, 0)}%,
        ${this.gradientColors[this.network][1]} 100%
      )`,
    };
  }

  getStyleForEmptyBlock(block: Block) {
    let addLeft = 0;

    if (block.stage === 1) {
      block.stage = 2;
      addLeft = -205;
    }

    return {
      left: addLeft + 155 * this.emptyBlocks.indexOf(block) + 'px',
      background: "#2d3348",
    };
  }

  mountEmptyBlocks() {
    const emptyBlocks = [];
    for (let i = 0; i < this.stateService.env.KEEP_BLOCKS_AMOUNT; i++) {
      emptyBlocks.push({
        id: '',
        height: 0,
        version: 0,
        timestamp: 0,
        bits: 0,
        nonce: 0,
        difficulty: 0,
        merkle_root: '',
        tx_count: 0,
        size: 0,
        weight: 0,
        previousblockhash: '',
        matchRate: 0,
        stage: 0,
      });
    }
    return emptyBlocks;
  }
}
