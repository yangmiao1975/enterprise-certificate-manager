
import React, { useState, useEffect } from 'react';
import { Folder } from '../../types';

interface CreateEditFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, folderId?: string) => Promise<void>;
  existingFolder?: Folder | null; // Pass this if editing
  isLoading: boolean;
}

const CreateEditFolderModal: React.FC<CreateEditFolderModalProps> = ({ isOpen, onClose, onSave, existingFolder, isLoading }) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingFolder) {
      setFolderName(existingFolder.name);
    } else {
      setFolderName('');
    }
    setError(null); // Reset error when modal opens or existingFolder changes
  }, [existingFolder, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!folderName.trim()) {
      setError('Folder name cannot be empty.');
      return;
    }
    try {
      await onSave(folderName.trim(), existingFolder?.id);
      // onClose will be called by parent on successful save
    } catch (err: any) {
      setError(err.message || 'Failed to save folder.');
    }
  };

  if (!isOpen) return null;

  return (
    // Using Modal component structure directly as it's simple enough
    // For more complex modals, wrap in the generic Modal component
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 p-2 rounded-md">{error}</p>}
      <div>
        <label htmlFor="folderName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Folder Name
        </label>
        <input
          type="text"
          id="folderName"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-slate-700 dark:text-slate-100"
          placeholder="e.g., Production Servers"
          required
          disabled={isLoading}
        />
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
          disabled={isLoading || !folderName.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition disabled:opacity-50 flex items-center justify-center min-w-[80px]"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  );
};

export default CreateEditFolderModal;
