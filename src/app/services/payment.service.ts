import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  public bootpay = BootPay;
  constructor() { }
}
