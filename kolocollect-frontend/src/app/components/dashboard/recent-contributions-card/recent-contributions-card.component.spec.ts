import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentContributionsCardComponent } from './recent-contributions-card.component';

describe('RecentContributionsCardComponent', () => {
  let component: RecentContributionsCardComponent;
  let fixture: ComponentFixture<RecentContributionsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentContributionsCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RecentContributionsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
