import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpcomingPayoutsCardComponent } from './upcoming-payouts-card.component';

describe('UpcomingPayoutsCardComponent', () => {
  let component: UpcomingPayoutsCardComponent;
  let fixture: ComponentFixture<UpcomingPayoutsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcomingPayoutsCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UpcomingPayoutsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
