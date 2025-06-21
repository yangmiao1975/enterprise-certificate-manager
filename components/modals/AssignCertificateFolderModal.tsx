
import React, { useState, useEffect } from 'react';
import { Certificate, Folder } from '../../types';

interface AssignCertificateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (certificateId: string, folderId: string | null) => Promise<void>;
  certificate: Certificate | null;
  folders: Folder[];
  isLoading: boolean;
}

const AssignCertificateFolderModal: React.FC<AssignCertificateFolderModalProps> = ({ isOpen, onClose, onAssign, certificate, folders, isLoading }) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (certificate) {
      setSelectedFolderId(certificate.folderId || null);
    }
    setError(null);
  }, [certificate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!certificate) {
      setError("No certificate selected.");
      return;
    }
    try {
      await onAssign(certificate.id, selectedFolderId);
      // onClose will be called by parent on successful save
    } catch (err: any) {
      setError(err.message || 'Failed to assign certificate to folder.');
    }
  };

  if (!isOpen || !certificate) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Move certificate <strong className="font-semibold">{certificate.commonName}</strong> to folder:
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 p-2 rounded-md">{error}</p>}
      <div>
        <label htmlFor="assignFolderSelect" className="sr-only">
          Select Folder
        </label>
        <select
          id="assignFolderSelect"
          value={selectedFolderId || ''}
          onChange={(e) => setSelectedFolderId(e.target.value || null)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md dark:bg-slate-700 dark:text-slate-100"
          disabled={isLoading}
        >
          <option value="">-- Unassign (No Folder) --</option>
          {folders.map(folder => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition disabled:opacity-50 flex items-center justify-center min-w-[80px]"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            'Move'
          )}
        </button>
      </div>
    </form>
  );
};

export default AssignCertificateFolderModal;
