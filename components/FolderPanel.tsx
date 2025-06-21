
import React from 'react';
import { Folder } from '../types';
import { ICONS, ALL_CERTIFICATES_FOLDER_ID } from '../constants';
import ActionButton from './ActionButton';

interface FolderPanelProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  isLoading: boolean;
}

const FolderPanel: React.FC<FolderPanelProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  isLoading
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Folders</h3>
        <ActionButton
          onClick={onCreateFolder}
          title="Create New Folder"
          className="text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-700/50 p-1.5"
          disabled={isLoading}
        >
          {ICONS.folderPlus}
        </ActionButton>
      </div>
      {isLoading && folders.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Loading folders...</p>}
      <ul className="space-y-1">
        <li>
          <button
            onClick={() => onSelectFolder(ALL_CERTIFICATES_FOLDER_ID)}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${selectedFolderId === ALL_CERTIFICATES_FOLDER_ID 
                ? 'bg-sky-100 dark:bg-sky-700 text-sky-700 dark:text-sky-200' 
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
          >
            {ICONS.folderOpen}
            <span>All Certificates</span>
          </button>
        </li>
        {folders.map(folder => (
          <li key={folder.id}>
            <div
              className={`group w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer
                ${selectedFolderId === folder.id 
                  ? 'bg-sky-100 dark:bg-sky-700 text-sky-700 dark:text-sky-200' 
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
            >
              <div onClick={() => onSelectFolder(folder.id)} className="flex items-center space-x-2 flex-grow min-w-0">
                {ICONS.folder}
                <span className="truncate" title={folder.name}>{folder.name}</span>
              </div>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ActionButton
                  onClick={() => onEditFolder(folder)}
                  title="Edit folder name"
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-1"
                >
                  {ICONS.pencil}
                </ActionButton>
                <ActionButton
                  onClick={() => onDeleteFolder(folder)}
                  title="Delete folder"
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                >
                  {ICONS.trash}
                </ActionButton>
              </div>
            </div>
          </li>
        ))}
         {!isLoading && folders.length === 0 && (
           <li>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-3 px-2">
              No folders created yet. Click the <span className="inline-flex align-middle mx-1">{ICONS.folderPlus}</span> icon to add one.
            </p>
           </li>
         )}
      </ul>
    </div>
  );
};

export default FolderPanel;
