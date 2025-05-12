import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityStatusComponent } from './community-status.component';

describe('CommunityStatusComponent', () => {
  let component: CommunityStatusComponent;
  let fixture: ComponentFixture<CommunityStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityStatusComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
