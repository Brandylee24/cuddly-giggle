import { Component, OnDestroy, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable, Subscription } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { delay, map, retryWhen, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit, OnDestroy {
  gitCommit$: Observable<string>;
  donationForm: FormGroup;
  paymentForm: FormGroup;
  donationStatus = 1;
  sponsors$: Observable<any>;
  donationObj: any;
  sponsorsEnabled = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  sponsors = null;
  requestSubscription: Subscription | undefined;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private apiService: ApiService,
    private sanitizer: DomSanitizer,
  ) { }

  ngOnInit() {
    this.gitCommit$ = this.stateService.gitCommit$.pipe(map((str) => str.substr(0, 8)));
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.websocketService.want(['blocks']);

    this.donationForm = this.formBuilder.group({
      amount: [0.01, [Validators.min(0.001), Validators.required]],
      handle: [''],
    });

    this.paymentForm = this.formBuilder.group({
      'method': 'chain'
    });

    this.apiService.getDonation$()
      .subscribe((sponsors) => {
        this.sponsors = sponsors;
      });
  }

  ngOnDestroy() {
    if (this.requestSubscription) {
      this.requestSubscription.unsubscribe();
    }
  }

  submitDonation() {
    if (this.donationForm.invalid) {
      return;
    }
    this.requestSubscription = this.apiService.requestDonation$(
      this.donationForm.get('amount').value,
      this.donationForm.get('handle').value
    )
    .pipe(
      tap((response) => {
        this.donationObj = response;
        this.donationStatus = 3;
      }),
      switchMap(() => this.apiService.checkDonation$(this.donationObj.id)
        .pipe(
          retryWhen((errors) => errors.pipe(delay(2000)))
        )
      )
    ).subscribe(() => {
      this.donationStatus = 4;
      if (this.donationForm.get('handle').value) {
        this.sponsors.unshift({ handle: this.donationForm.get('handle').value });
      }
    });
  }

  bypassSecurityTrustUrl(text: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(text);
  }
}
