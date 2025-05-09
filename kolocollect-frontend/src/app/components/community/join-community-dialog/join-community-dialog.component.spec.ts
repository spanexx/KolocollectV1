import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinCommunityDialogComponent } from './join-community-dialog.component';

describe('JoinCommunityDialogComponent', () => {
  let component: JoinCommunityDialogComponent;
  let fixture: ComponentFixture<JoinCommunityDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinCommunityDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(JoinCommunityDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
