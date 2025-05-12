import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityPayoutsComponent } from './community-payouts.component';

describe('CommunityPayoutsComponent', () => {
  let component: CommunityPayoutsComponent;
  let fixture: ComponentFixture<CommunityPayoutsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityPayoutsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityPayoutsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
