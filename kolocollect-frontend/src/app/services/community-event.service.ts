import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommunityEventService {
  // Subject to emit events when community membership changes
  private communityMembershipChangedSource = new Subject<string>();
  
  // Observable that components can subscribe to
  communityMembershipChanged$ = this.communityMembershipChangedSource.asObservable();
  
  /**
   * Notify all components that a user has joined a community
   * @param communityId The ID of the community that was joined
   */
  notifyCommunityJoined(communityId: string): void {
    this.communityMembershipChangedSource.next(communityId);
  }
}
