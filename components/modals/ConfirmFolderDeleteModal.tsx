
import React from 'react';
import { Folder } from '../../types';
import { ICONS } from '../../constants';

interface ConfirmFolderDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  folder: Folder | null;
  isLoading: boolean;
}

const ConfirmFolderDeleteModal: React.FC<ConfirmFolderDeleteModalProps> = ({ isOpen, onClose, onConfirm, folder, isLoading }) => {
  if (!isOpen || !folder) return null;

  return (
    <div className="text-slate-700 dark:text-slate-200">
      <p className="mb-4">
        Are you sure you want to delete the folder <strong className="font-semibold">{folder.name}</strong>?
      </p>
      <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">
        Certificates currently in this folder will be unassigned (they will not be deleted).
      </p>
      <p className="text-sm text-red-600 dark:text-red-400 mb-6">This action cannot be undone.</p>
      
      <div className="flex justify-end space-x-3 pt-4">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition flex items-center space-x-2 min-w-[100px] justify-center disabled:opacity-50"
        >
          {isLoading ? (
             <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <>
              {ICONS.trash}
              <span>Delete Folder</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ConfirmFolderDeleteModal;
