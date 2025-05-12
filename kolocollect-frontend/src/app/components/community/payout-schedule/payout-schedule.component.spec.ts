import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PayoutScheduleComponent } from './payout-schedule.component';

describe('PayoutScheduleComponent', () => {
  let component: PayoutScheduleComponent;
  let fixture: ComponentFixture<PayoutScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PayoutScheduleComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PayoutScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
