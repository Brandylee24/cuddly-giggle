import { Component, Input, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import * as QRCode from 'qrcode/build/qrcode.js';

@Component({
  selector: 'app-qrcode',
  templateUrl: './qrcode.component.html',
  styleUrls: ['./qrcode.component.scss']
})
export class QrcodeComponent implements AfterViewInit {
  @Input() data: string;
  @ViewChild('canvas') canvas: ElementRef;

  qrcodeObject: any;

  constructor() { }

  ngAfterViewInit() {
    const opts = {
      errorCorrectionLevel: 'H',
      margin: 0,
      color: {
        dark: '#000',
        light: '#fff'
      },
      width: 125,
      height: 125,
    };

    if (!this.data) {
      return;
    }

    const address = this.data;
    if (this.data.indexOf('bc1') === 0 || this.data.indexOf('tb1') === 0) {
      address.toUpperCase();
    }

    QRCode.toCanvas(this.canvas.nativeElement, address, opts, (error: any) => {
      if (error) {
         console.error(error);
      }
    });
  }
}
