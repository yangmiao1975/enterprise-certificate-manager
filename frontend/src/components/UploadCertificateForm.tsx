/// <reference types="vite/client" />
import React, { useState, useRef } from 'react';
import { ICONS } from '../constants'; 
import { Folder } from '../types';

interface UploadCertificateFormProps {
  onSubmit: (file: File, folderId: string | null) => Promise<void>;
  onCancel: () => void;
  folders: Folder[];
}

const UploadCertificateForm: React.FC<UploadCertificateFormProps> = ({ onSubmit, onCancel, folders }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSelectedFile(null);
        setError('File is too large. Maximum size is 5MB.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a certificate file to upload.');
      return;
    }
    setError('');
    setIsUploading(true);
    try {
      await onSubmit(selectedFile, selectedFolderId);
    } catch (submitError: any) {
      console.error("Upload submission error:", submitError);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSelectedFile(null);
        setError('File is too large. Maximum size is 5MB.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900 dark:text-red-200 p-3 rounded-md">{error}</p>}
      
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Certificate File
        </label>
        <div 
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md transition-colors
            ${isUploading ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-700' : 'cursor-pointer hover:border-sky-500 dark:hover:border-sky-400'}`}
          onClick={triggerFileInput}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="space-y-1 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex text-sm text-slate-600 dark:text-slate-400">
              <span className={`relative rounded-md font-medium text-sky-600 dark:text-sky-400 ${!isUploading ? 'hover:text-sky-500 dark:hover:text-sky-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-sky-500' : ''}`}>
                Upload a file
              </span>
              <input 
                ref={fileInputRef} 
                id="file-upload" 
                name="file-upload" 
                type="file" 
                className="sr-only" 
                onChange={handleFileChange} 
                accept=".pem,.crt,.cer,.der,application/x-x509-ca-cert,application/pkix-cert,application/x-pem-file"
                disabled={isUploading} 
              />
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              PEM, CRT, CER, DER files. Max 5MB.
            </p>
          </div>
        </div>
        {selectedFile && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Selected file: <strong className="font-medium">{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
          </p>
        )}
      </div>

      <div>
        <label htmlFor="folderSelect" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Assign to Folder (Optional)
        </label>
        <select
          id="folderSelect"
          name="folderSelect"
          value={selectedFolderId || ''}
          onChange={(e) => setSelectedFolderId(e.target.value || null)}
          disabled={isUploading}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="">-- No Folder --</option>
          {folders.map(folder => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <button 
          type="button" 
          onClick={onCancel} 
          disabled={isUploading}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button 
          type="submit"
          disabled={!selectedFile || isUploading}
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
        >
          {isUploading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              {ICONS.upload}
              <span className="ml-2">Upload File</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default UploadCertificateForm; 