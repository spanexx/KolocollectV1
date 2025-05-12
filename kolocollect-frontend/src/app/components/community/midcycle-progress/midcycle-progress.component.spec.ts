import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MidcycleProgressComponent } from './midcycle-progress.component';

describe('MidcycleProgressComponent', () => {
  let component: MidcycleProgressComponent;
  let fixture: ComponentFixture<MidcycleProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MidcycleProgressComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MidcycleProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
