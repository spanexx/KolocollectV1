import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityHeaderComponent } from './community-header.component';

describe('CommunityHeaderComponent', () => {
  let component: CommunityHeaderComponent;
  let fixture: ComponentFixture<CommunityHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityHeaderComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
