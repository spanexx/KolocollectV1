import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsCardComponent } from './notifications-card.component';

describe('NotificationsCardComponent', () => {
  let component: NotificationsCardComponent;
  let fixture: ComponentFixture<NotificationsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NotificationsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
