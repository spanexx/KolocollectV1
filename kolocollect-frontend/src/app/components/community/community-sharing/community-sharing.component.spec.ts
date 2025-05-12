import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunitySharingComponent } from './community-sharing.component';

describe('CommunitySharingComponent', () => {
  let component: CommunitySharingComponent;
  let fixture: ComponentFixture<CommunitySharingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunitySharingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunitySharingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
