import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityContributionHistoryComponent } from './community-contribution-history.component';

describe('CommunityContributionHistoryComponent', () => {
  let component: CommunityContributionHistoryComponent;
  let fixture: ComponentFixture<CommunityContributionHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityContributionHistoryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityContributionHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
