import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContributionHistoryHierarchicalComponent } from './contribution-history-hierarchical.component';

describe('ContributionHistoryHierarchicalComponent', () => {
  let component: ContributionHistoryHierarchicalComponent;
  let fixture: ComponentFixture<ContributionHistoryHierarchicalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContributionHistoryHierarchicalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ContributionHistoryHierarchicalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
