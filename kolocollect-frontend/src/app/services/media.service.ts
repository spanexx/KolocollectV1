import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { HttpHeaders } from '@angular/common/http';

export interface UploadResponse {
  fileId: string;
  url: string;
  fileName: string;
  fileType: string;
  uploadDate: Date;
}

export interface MediaFile {
  fileId: string;
  url: string;
  fileName: string;
  fileType: string;
  uploadDate: Date;
  status?: 'pending' | 'verified' | 'rejected';
  documentType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  constructor(private api: ApiService) {}

  /**
   * Upload a file to the server
   * @param file The file to upload
   * @param userId The ID of the user uploading the file
   * @param type The type of file (profile, document, etc.)
   * @param documentType Optional document type for verification documents
   */
  uploadFile(file: File, userId: string, type: string, documentType?: string): Observable<UploadResponse> {
    console.log(`Uploading file with type: ${type}, documentType: ${documentType || 'none'}`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('type', type);
    
    if (documentType) {
      formData.append('documentType', documentType);
    }
    
    // Don't set content type header as it will be set automatically with the correct boundary
    return this.api.post<UploadResponse>('/media/upload', formData);
  }  /**
   * Get a signed URL for a file
   * @param fileId The ID of the file to get the URL for
   * @returns An object with url (relative path) and absoluteUrl (full URL with host)
   */
  getFileUrl(fileId: string): Observable<{ url: string, absoluteUrl?: string }> {
    console.log('Getting signed URL for file:', fileId);
    return this.api.get<{ url: string, absoluteUrl?: string }>(`/media/url/${fileId}`);
  }

  /**
   * Delete a file
   * @param fileId The ID of the file to delete
   */
  deleteFile(fileId: string): Observable<any> {
    return this.api.delete<any>(`/media/files/${fileId}`);
  }

  /**
   * List all files for a user
   * @param userId The ID of the user
   * @param type Optional filter by file type
   */
  listUserFiles(userId: string, type?: string): Observable<MediaFile[]> {
    const params: any = {};
    if (type) {
      params.type = type;
    }
    return this.api.get<MediaFile[]>(`/media/files/${userId}`, params);
  }
  /**
   * Update profile picture for a user
   * Note: This method only sends the fileId to the backend.
   * For complete profile picture updates that require both fileId and url,
   * use UserService.updateProfilePicture instead.
   * 
   * @param userId The ID of the user
   * @param fileId The ID of the file to set as profile picture
   */
  updateProfilePicture(userId: string, fileId: string): Observable<any> {
    return this.api.put<any>(`/users/${userId}/profile-picture`, { fileId });
  }

  /**
   * Upload a verification document
   * @param userId The ID of the user
   * @param file The document file
   * @param documentType The type of document
   */
  uploadVerificationDocument(
    userId: string, 
    file: File, 
    documentType: 'id' | 'passport' | 'driverLicense' | 'utilityBill' | 'other'
  ): Observable<UploadResponse> {
    return this.uploadFile(file, userId, 'document', documentType);
  }

  /**
   * Get verification documents for a user
   * @param userId The ID of the user
   */
  getVerificationDocuments(userId: string): Observable<MediaFile[]> {
    return this.listUserFiles(userId, 'document');
  }

  /**
   * Delete a verification document
   * @param userId The ID of the user
   * @param fileId The ID of the document to delete
   */
  deleteVerificationDocument(userId: string, fileId: string): Observable<any> {
    return this.api.delete<any>(`/users/${userId}/verification-documents/${fileId}`);
  }
}
