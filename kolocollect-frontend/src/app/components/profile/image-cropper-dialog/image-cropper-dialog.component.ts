import { Component, Inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-cropper-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, ImageCropperComponent],  template: `
    <div class="image-cropper-dialog">
      <h2 mat-dialog-title>Crop Profile Picture</h2>
      
      <div class="cropper-container">
        <image-cropper
          #imageCropper
          [imageChangedEvent]="data.imageChangedEvent"
          [maintainAspectRatio]="true"
          [aspectRatio]="1"
          [roundCropper]="true"
          [resizeToWidth]="300"
          [cropperMinWidth]="150"
          [onlyScaleDown]="true"
          [output]="'blob'"
          format="png"
          (imageCropped)="imageCropped($event)"
          (loadImageFailed)="loadImageFailed()"
        ></image-cropper>
      </div>
      
      <div class="dialog-actions">
        <button mat-button (click)="cancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="save()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    .image-cropper-dialog {
      padding: 16px;
    }
    
    .cropper-container {
      max-height: 400px;
      overflow: hidden;
    }
    
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    
    .dialog-actions button:not(:last-child) {
      margin-right: 8px;
    }
  `]
})
export class ImageCropperDialogComponent {
  croppedImageData: string = '';
  @ViewChild('imageCropper') imageCropper?: ImageCropperComponent;

  constructor(
    public dialogRef: MatDialogRef<ImageCropperDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { imageChangedEvent: any }
  ) {}imageCropped(event: ImageCroppedEvent): void {
    console.log('Image cropped event received', event);
    
    // Try using the blob from the event to create a base64 string if base64 is missing
    if (event.blob && (!event.base64 || event.base64.length === 0)) {
      console.log('Base64 is empty, creating from blob');
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.croppedImageData = e.target.result;
        console.log('Created base64 from blob, length:', this.croppedImageData.length);
      };
      reader.readAsDataURL(event.blob);
    } else {
      this.croppedImageData = event.base64 || '';
      console.log('Using provided base64, length:', this.croppedImageData?.length || 0);
    }
  }  save(): void {
    console.log('Save button clicked, returning cropped image data');
    if (!this.croppedImageData || this.croppedImageData.length === 0) {
      console.warn('No cropped image data available, trying to get from cropper');
      
      // Try to get the cropped image directly from the image cropper component
      if (this.imageCropper) {
        try {
          // Force the cropper to emit the cropped image again
          const cropEvent = this.imageCropper.crop();
          if (cropEvent && cropEvent.base64) {
            this.croppedImageData = cropEvent.base64;
            console.log('Got base64 directly from cropper component, length:', this.croppedImageData.length);
            this.closeWithResult();
          } else if (cropEvent && cropEvent.blob) {
            // Convert blob to base64
            const reader = new FileReader();
            reader.onload = (e: any) => {
              this.croppedImageData = e.target.result;
              console.log('Created base64 from blob in save method, length:', this.croppedImageData.length);
              // Close dialog after conversion is complete
              this.dialogRef.close(this.croppedImageData);
            };
            reader.readAsDataURL(cropEvent.blob);
            return; // Exit early as we'll close the dialog in the onload callback
          }
        } catch (error) {
          console.error('Error getting data from cropper component:', error);
        }
      }
      
      // Fallback method - try to get directly from canvas
      if (!this.croppedImageData) {
        const imageElement = document.querySelector('.ngx-ic-cropper canvas') as HTMLCanvasElement;
        if (imageElement) {
          try {
            this.croppedImageData = imageElement.toDataURL('image/png');
            console.log('Retrieved base64 from canvas element, length:', this.croppedImageData.length);
          } catch (error) {
            console.error('Error getting canvas data:', error);
          }
        }
      }
    }
    
    this.closeWithResult();
  }
  
  /**
   * Helper method to consistently close the dialog with the cropped image data
   */
  closeWithResult(): void {
    if (this.croppedImageData && this.croppedImageData.length > 0) {
      console.log('Closing dialog with cropped image data, length:', this.croppedImageData.length);
      this.dialogRef.close(this.croppedImageData);
    } else {
      console.warn('No cropped image data available when closing dialog');
      this.dialogRef.close(null);
    }
  }
  
  loadImageFailed(): void {
    console.error('Image failed to load');
    this.dialogRef.close(); // Close dialog if image fails to load
  }

  cancel(): void {
    console.log('Cancel button clicked');
    this.dialogRef.close();
  }
}
