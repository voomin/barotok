import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductsService } from 'src/app/services/products/products.service';
import { AuthService } from 'src/app/services/auth.service';
import { BaseketService } from 'src/app/services/baseket.service';
import { ManagementPointService } from 'src/app/services/admin/management-point.service';
import { defaultUrlMatcher } from '@angular/router/src/shared';
import { OrderService } from 'src/app/services/order.service';
import { ProductBasket} from 'src/app/interfaces/user';
import { AlertService } from 'ngx-alerts';
import { Order } from 'src/app/interfaces/order';
import { userPointWallet } from 'src/app/interfaces/point';
import { PaymentService } from 'src/app/services/payment.service';

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.sass']
})
export class OrderComponent implements OnInit {
  private registerForm: FormGroup;
  private submitted = false;
  public inputShippingDeepAddress = '';
  public inputShippingMessege = '';
  public checkedBuyerAgreement = false;

  public submitAddress = false;
  //public bilge;
  public basket;
  public shippingPrice = 0;
  public totalPrice = 0;
  public userWallet;
  public userHavePoint = 0;
  public userBasketData;

  private user;
  private packagesinBasket;

  constructor(
    public auth: AuthService,
    private formBuilder: FormBuilder,
    private _orderService : OrderService,
    private _productsService: ProductsService,
    private _basketService: BaseketService,
    private _managementPoint: ManagementPointService,
    private _alertService: AlertService,
    private _paymentService : PaymentService,
    ) { }

  ngOnInit() {
    this.auth.user$.subscribe(u=>{
      if(u){
        this.user = u;
        this.basket = this._basketService.getBasket(u.uid);
        this.basket.subscribe((pks:ProductBasket[])=>{
          this.totalPrice = 0;
          this.packagesinBasket = pks;
          pks.forEach((pk:ProductBasket)=>{ this.totalPrice += pk.package_total_price; });
          this.shippingPrice = (this.totalPrice<30000)?2500:0;
        });
        //this.bilge = this._basketService.getBilge(u.uid);
        this.userWallet = this._managementPoint.getUserWallet(u.uid);
        this.userWallet.subscribe((wallet:userPointWallet)=>{ this.userHavePoint = wallet.have_point });
        this.userBasketData = this._basketService.getUserBasketData(u.uid);
      }
    })
    this.registerForm = this.formBuilder.group({
      recieverName: ['', [Validators.required]],
      tel: ['', [Validators.required]],
      // postcode: [''],
      // shippingAddress: [''],
      // shippingDeepAddress: [''],
      // shippingSubAddress: [''],
      // shippingMessege: [''],
    });
  }
  // convenience getter for easy access to form fields
  get f() { return this.registerForm.controls; }

  onPayment(payType:string,inputShippingObj:any){
    this.submitted = true;

    if (this.registerForm.invalid) {
      this._alertService.warning('수하인 정보를 입력해주세요.');
      return;
    }
    if(!inputShippingObj.shippingAddress){
      this._alertService.warning('주소가 입력되지 않았습니다.');
      return ;
    }
    if(!this.checkedBuyerAgreement){
      this._alertService.warning('주문자 동의가 체크되어 있지 않습니다.');
      return ;
    }
    if( payType==='point' && (!this.userHavePoint || this.userHavePoint< this.totalPrice + this.shippingPrice)){
      this._alertService.warning('point 잔액이 부족합니다.');
      return ;
    }

    const order:Order = {
      buyer_uid : this.user.uid,
      buyer_displayName : this.user.displayName,
      reciever_displayName : this.registerForm.value.recieverName,
      reciever_tel : this.registerForm.value.tel,
      shipping_price : this.shippingPrice,
      shipping_postcode : inputShippingObj.postcode,
      shipping_address : `${inputShippingObj.shippingAddress} ${inputShippingObj.shippingSubAddress} ${this.inputShippingDeepAddress} `,
      shipping_message : this.inputShippingMessege,
      pay_amount : this.totalPrice + this.shippingPrice,
      components_packages : this.packagesinBasket
    }
    
    switch(payType){
      case 'point': this.onPointPayment(order); break;
      case 'card': this.onCardPayment(order); break;
      default: this._alertService.warning('결제타입이 유효하지 않습니다 : '+payType); break;
    }
  }

  private onPointPayment(order:Order){ this._orderService.setTebahPointOrder(order); }
  private onCardPayment(order:Order){
    //const items=[];
    let name = "";
    let items=[];
    order.components_packages.forEach((p:ProductBasket)=>{
      name += p.package_title + ' ';
      items.push({
        item_name: p.package_title,
        qty: p.package_count, //수량
        unique: p.package_id, //해당 상품을 구분짓는 primary key내
        price: 0,
      });
    });
    this._paymentService.bootpay.request({
      price: order.pay_amount, //실제 결제되는 가격
      application_id: "5c6a4d48396fa651f1535eff",
      name: name, //결제창에서 보여질 이름
      pg: 'kcp',
      method: 'card', //결제수단, 입력하지 않으면 결제수단 선택부터 화면이 시작합니다.
      show_agree_window: 0, // 부트페이 정보 동의 창 보이기 여부
      items: items,
      user_info: {
        username: `주문자:${order.buyer_displayName}, 수취인:${order.reciever_displayName}`,
        email: null,
        addr: `수취인 주소 : ${order.shipping_address}`,
        phone: `수취인 번호 : ${order.reciever_tel}`
      },
      order_id: '고유order_id_1234', //고유 주문번호로, 생성하신 값을 보내주셔야 합니다.
      params: {callback1: '그대로 콜백받을 변수 1', callback2: '그대로 콜백받을 변수 2', customvar1234: '변수명도 마음대로'},
      // account_expire_at: null, // 가상계좌 입금기간 제한 ( yyyy-mm-dd 포멧으로 입력해주세요. 가상계좌만 적용됩니다. )
      // extra: {
      //     start_at: '2018-10-10', // 정기 결제 시작일 - 시작일을 지정하지 않으면 그 날 당일로부터 결제가 가능한 Billing key 지급
      //   end_at: '2021-10-10', // 정기결제 만료일 -  기간 없음 - 무제한
      //       vbank_result: 1, // 가상계좌 사용시 사용, 가상계좌 결과창을 볼지(1), 말지(0), 미설정시 봄(1)
      //       quota: '0,2,3' // 결제금액이 5만원 이상시 할부개월 허용범위를 설정할 수 있음, [0(일시불), 2개월, 3개월] 허용, 미설정시 12개월까지 허용
      // }
    }).error(function (data) {
      //결제 진행시 에러가 발생하면 수행됩니다.
      console.log(data);
    }).cancel(function (data) {
      //결제가 취소되면 수행됩니다.
      console.log(data);
    }).ready(function (data) {
      // 가상계좌 입금 계좌번호가 발급되면 호출되는 함수입니다.
      console.log(data);
    }).confirm(function (data) {
      //결제가 실행되기 전에 수행되며, 주로 재고를 확인하는 로직이 들어갑니다.
      //주의 - 카드 수기결제일 경우 이 부분이 실행되지 않습니다.
      console.log(data);
      var enable = true; // 재고 수량 관리 로직 혹은 다른 처리
      if (enable) {
        this.transactionConfirm(data); // 조건이 맞으면 승인 처리를 한다.
      } else {
        this.removePaymentWindow(); // 조건이 맞지 않으면 결제 창을 닫고 결제를 승인하지 않는다.
      }
    }).close(function (data) {
        // 결제창이 닫힐때 수행됩니다. (성공,실패,취소에 상관없이 모두 수행됨)
        console.log(data);
    }).done(function (data) {
      //결제가 정상적으로 완료되면 수행됩니다
      //비즈니스 로직을 수행하기 전에 결제 유효성 검증을 하시길 추천합니다.
      this._orderService.setTebahKRWOrder(order);
      console.log(data);
    });
  }
  onDeltoBasket(basketId:string){ this._basketService.setDeltoBasket(basketId); }
}
