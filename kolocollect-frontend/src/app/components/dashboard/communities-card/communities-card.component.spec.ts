import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunitiesCardComponent } from './communities-card.component';

describe('CommunitiesCardComponent', () => {
  let component: CommunitiesCardComponent;
  let fixture: ComponentFixture<CommunitiesCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunitiesCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunitiesCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
