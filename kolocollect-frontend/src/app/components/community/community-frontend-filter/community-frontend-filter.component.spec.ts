import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityFrontendFilterComponent } from './community-frontend-filter.component';

describe('CommunityFrontendFilterComponent', () => {
  let component: CommunityFrontendFilterComponent;
  let fixture: ComponentFixture<CommunityFrontendFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityFrontendFilterComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityFrontendFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
