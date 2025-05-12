import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityTabsComponent } from './community-tabs.component';

describe('CommunityTabsComponent', () => {
  let component: CommunityTabsComponent;
  let fixture: ComponentFixture<CommunityTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityTabsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
