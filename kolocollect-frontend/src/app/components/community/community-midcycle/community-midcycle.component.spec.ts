import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityMidcycleComponent } from './community-midcycle.component';

describe('CommunityMidcycleComponent', () => {
  let component: CommunityMidcycleComponent;
  let fixture: ComponentFixture<CommunityMidcycleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityMidcycleComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityMidcycleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
