import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InvitationService, CreateInvitationRequest } from '../../../services/invitation.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-invite-member-modal',
    standalone: true,
    imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './invite-member-modal.component.html',
  styleUrls: ['./invite-member-modal.component.scss']
})
export class InviteMemberModalComponent implements OnInit {
  @Input() isOpen = false;
  @Input() communityId!: string;
  @Input() communityName!: string;
  @Output() closeModal = new EventEmitter<void>();
  @Output() invitationSent = new EventEmitter<any>();

  inviteForm!: FormGroup;
  activeTab: 'email' | 'link' = 'email';
  isSubmitting = false;
  generatedInviteLink = '';

  constructor(
    private fb: FormBuilder,
    private invitationService: InvitationService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    this.inviteForm = this.fb.group({
      inviteType: ['email', Validators.required],
      inviteeEmail: ['', [Validators.email]],
      customMessage: ['', [Validators.maxLength(500)]],
      expiresIn: [7, [Validators.min(1), Validators.max(30)]]
    });

    // Update validators based on invite type
    this.inviteForm.get('inviteType')?.valueChanges.subscribe(type => {
      this.updateValidators(type);
    });
  }

  private updateValidators(inviteType: string) {
    const emailControl = this.inviteForm.get('inviteeEmail');
    
    if (inviteType === 'email') {
      emailControl?.setValidators([Validators.required, Validators.email]);
    } else {
      emailControl?.clearValidators();
    }
    
    emailControl?.updateValueAndValidity();
  }

  switchTab(tab: 'email' | 'link') {
    this.activeTab = tab;
    this.inviteForm.patchValue({ inviteType: tab });
    this.generatedInviteLink = '';
  }

  async onSubmit() {
    if (this.inviteForm.invalid) {
      this.markFormGroupTouched();
      return;
    }    this.isSubmitting = true;
    this.loadingService.start('creating-invitation');

    try {
      const formValue = this.inviteForm.value;
      const invitationData: CreateInvitationRequest = {
        inviteType: formValue.inviteType,
        customMessage: formValue.customMessage,
        expiresIn: formValue.expiresIn
      };

      if (formValue.inviteType === 'email') {
        invitationData.inviteeEmail = formValue.inviteeEmail;
      }

      const response = await this.invitationService.createInvitation(this.communityId, invitationData).toPromise();

      if (response?.success) {
        this.toastService.success(
          formValue.inviteType === 'email' 
            ? 'Invitation sent successfully!' 
            : 'Invitation link generated successfully!'
        );

        if (formValue.inviteType === 'link') {
          this.generatedInviteLink = response.data.inviteLink;
        }

        this.invitationSent.emit(response.data);
        
        if (formValue.inviteType === 'email') {
          this.resetForm();
          this.close();
        }
      }
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      this.toastService.error(
        error.error?.message || 'Failed to create invitation. Please try again.'
      );
    } finally {
      this.isSubmitting = false;
      this.loadingService.stop('creating-invitation');
    }
  }
  async copyInviteLink() {
    if (!this.generatedInviteLink) return;

    try {
      await navigator.clipboard.writeText(this.generatedInviteLink);
      this.toastService.success('Invitation link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.toastService.error('Failed to copy link. Please copy it manually.');
    }
  }

  shareInvitation(platform: 'twitter' | 'facebook' | 'whatsapp' | 'email') {
    if (!this.generatedInviteLink) return;

    // Extract invite code from the link
    const inviteCode = this.generatedInviteLink.split('/').pop();
    if (inviteCode) {
      this.invitationService.shareInvitation(inviteCode, platform, this.communityName);
    }
  }

  close() {
    this.resetForm();
    this.generatedInviteLink = '';
    this.closeModal.emit();
  }

  private resetForm() {
    this.inviteForm.reset({
      inviteType: 'email',
      expiresIn: 7
    });
    this.activeTab = 'email';
  }

  private markFormGroupTouched() {
    Object.keys(this.inviteForm.controls).forEach(key => {
      const control = this.inviteForm.get(key);
      control?.markAsTouched();
    });
  }

  // Getters for template
  get inviteType() { return this.inviteForm.get('inviteType'); }
  get inviteeEmail() { return this.inviteForm.get('inviteeEmail'); }
  get customMessage() { return this.inviteForm.get('customMessage'); }
  get expiresIn() { return this.inviteForm.get('expiresIn'); }

  // Validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.inviteForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.inviteForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email address';
      if (field.errors['maxlength']) return `${fieldName} is too long`;
      if (field.errors['min']) return 'Minimum value is 1';
      if (field.errors['max']) return 'Maximum value is 30';
    }
    return '';
  }
}
