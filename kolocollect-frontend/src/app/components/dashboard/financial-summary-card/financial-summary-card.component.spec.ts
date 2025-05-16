import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinancialSummaryCardComponent } from './financial-summary-card.component';

describe('FinancialSummaryCardComponent', () => {
  let component: FinancialSummaryCardComponent;
  let fixture: ComponentFixture<FinancialSummaryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialSummaryCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FinancialSummaryCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
