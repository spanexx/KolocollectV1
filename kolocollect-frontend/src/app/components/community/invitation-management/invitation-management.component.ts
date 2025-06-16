import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { InvitationService, Invitation, InvitationStats } from '../../../services/invitation.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-invitation-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invitation-management.component.html',
  styleUrls: ['./invitation-management.component.scss']
})
export class InvitationManagementComponent implements OnInit, OnDestroy {
  @Input() communityId!: string;
  @Input() isAdmin = false;

  invitations: Invitation[] = [];
  filteredInvitations: Invitation[] = [];
  invitationStats: InvitationStats | null = null;
  isLoading = false;
  
  // Filters and pagination
  statusFilter = 'all';
  searchTerm = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalCount = 0;

  // Search subject for debouncing
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Status options
  statusOptions = [
    { value: 'all', label: 'All Invitations', icon: 'list' },
    { value: 'pending', label: 'Pending', icon: 'clock' },
    { value: 'accepted', label: 'Accepted', icon: 'check-circle' },
    { value: 'expired', label: 'Expired', icon: 'x-circle' },
    { value: 'cancelled', label: 'Cancelled', icon: 'minus-circle' },
    { value: 'rejected', label: 'Rejected', icon: 'x-circle' }
  ];

  constructor(
    private invitationService: InvitationService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit() {
    this.setupSearch();
    this.loadInvitations();
    this.loadInvitationStats();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.currentPage = 1;
      this.loadInvitations();
    });
  }

  async loadInvitations() {
    if (!this.isAdmin) return;

    this.isLoading = true;
    this.loadingService.start('loading-invitations');

    try {
      const filters: any = {};
      if (this.statusFilter !== 'all') {
        filters.status = this.statusFilter;
      }

      const pagination = {
        page: this.currentPage,
        limit: this.itemsPerPage
      };

      const response = await this.invitationService.getCommunityInvitations(
        this.communityId,
        filters,
        pagination
      ).toPromise();

      if (response?.success) {
        this.invitations = response.data.invitations;
        this.filteredInvitations = this.filterInvitations();
        this.totalCount = response.data.pagination.totalCount;
        this.totalPages = response.data.pagination.totalPages;
        this.invitationStats = response.data.statistics;
      }
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      this.toastService.error('Failed to load invitations');
    } finally {
      this.isLoading = false;
      this.loadingService.stop('loading-invitations');
    }
  }

  async loadInvitationStats() {
    if (!this.isAdmin) return;

    try {
      const response = await this.invitationService.getInvitationStats(this.communityId).toPromise();
      if (response?.success) {
        this.invitationStats = response.data.statistics;
      }
    } catch (error) {
      console.error('Error loading invitation stats:', error);
    }
  }

  private filterInvitations(): Invitation[] {
    if (!this.searchTerm) {
      return this.invitations;
    }

    const term = this.searchTerm.toLowerCase();
    return this.invitations.filter(invitation => 
      invitation.inviteeEmail?.toLowerCase().includes(term) ||
      invitation.inviter?.name?.toLowerCase().includes(term) ||
      invitation.inviter?.email?.toLowerCase().includes(term) ||
      invitation.customMessage?.toLowerCase().includes(term)
    );
  }

  onSearchChange(searchTerm: string) {
    this.searchSubject.next(searchTerm);
  }

  onStatusFilterChange(status: string) {
    this.statusFilter = status;
    this.currentPage = 1;
    this.loadInvitations();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.loadInvitations();
  }

  async resendInvitation(invitation: Invitation) {
    if (invitation.status !== 'pending') {
      this.toastService.error('Only pending invitations can be resent');
      return;
    }

    try {
      this.loadingService.start(`resending-${invitation.id}`);
      
      await this.invitationService.resendInvitation(invitation.id).toPromise();
      
      this.toastService.success('Invitation resent successfully');
      this.loadInvitations(); // Refresh the list
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      this.toastService.error(error.error?.message || 'Failed to resend invitation');
    } finally {
      this.loadingService.stop(`resending-${invitation.id}`);
    }
  }

  async cancelInvitation(invitation: Invitation) {
    if (invitation.status !== 'pending') {
      this.toastService.error('Only pending invitations can be cancelled');
      return;
    }

    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      this.loadingService.start(`cancelling-${invitation.id}`);
      
      await this.invitationService.cancelInvitation(invitation.inviteCode).toPromise();
      
      this.toastService.success('Invitation cancelled successfully');
      this.loadInvitations(); // Refresh the list
      this.loadInvitationStats(); // Refresh stats
    } catch (error: any) {
      console.error('Error cancelling invitation:', error);
      this.toastService.error(error.error?.message || 'Failed to cancel invitation');
    } finally {
      this.loadingService.stop(`cancelling-${invitation.id}`);
    }
  }

  async copyInvitationLink(invitation: Invitation) {
    try {
      const success = await this.invitationService.copyInvitationLink(invitation.inviteCode);
      if (success) {
        this.toastService.success('Invitation link copied to clipboard');
      } else {
        this.toastService.error('Failed to copy link to clipboard');
      }
    } catch (error) {
      console.error('Error copying link:', error);
      this.toastService.error('Failed to copy link');
    }
  }

  shareInvitation(invitation: Invitation, platform: 'twitter' | 'facebook' | 'whatsapp' | 'email') {
    this.invitationService.shareInvitation(invitation.inviteCode, platform, 'Community');
  }

  // Utility methods for template
  getStatusColor(status: string): string {
    return this.invitationService.getStatusColor(status);
  }

  getStatusIcon(status: string): string {
    return this.invitationService.getStatusIcon(status);
  }

  formatExpiryDate(expiresAt: string): string {
    return this.invitationService.formatExpiryDate(expiresAt);
  }

  isInvitationExpired(expiresAt: string): boolean {
    return this.invitationService.isInvitationExpired(expiresAt);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isActionLoading(action: string, invitationId: string): boolean {
    return this.loadingService.isLoading(`${action}-${invitationId}`);
  }

  // Pagination helpers
  get paginationPages(): number[] {
    const pages = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  get hasInvitations(): boolean {
    return this.invitations.length > 0;
  }

  get hasFilteredInvitations(): boolean {
    return this.filteredInvitations.length > 0;
  }

  refresh() {
    this.loadInvitations();
    this.loadInvitationStats();
  }
}
