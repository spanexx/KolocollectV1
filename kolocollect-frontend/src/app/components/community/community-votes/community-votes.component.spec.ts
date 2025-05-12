import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityVotesComponent } from './community-votes.component';

describe('CommunityVotesComponent', () => {
  let component: CommunityVotesComponent;
  let fixture: ComponentFixture<CommunityVotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityVotesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunityVotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
