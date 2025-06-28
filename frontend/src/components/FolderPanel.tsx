/// <reference types="vite/client" />

import React from 'react';
import { Folder } from '../types';
import { ICONS, ALL_CERTIFICATES_FOLDER_ID } from '../constants';
import ActionButton from './ActionButton';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';

interface FolderPanelProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onCreateSubfolder?: (parentId: string) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  isLoading: boolean;
  onMoveFolder?: (folderId: string, newParentId: string | null) => void;
}

// Patch: Extend Folder type locally for tree rendering
interface FolderTreeNode extends Folder {
  children?: FolderTreeNode[];
}

// Update buildFolderTree to use FolderTreeNode
function buildFolderTree(folders: Folder[], parentId: string | null = null): FolderTreeNode[] {
  return folders
    .filter(f => (f.parentId ?? null) === parentId)
    .map(f => ({ ...f, children: buildFolderTree(folders, f.id) }))
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
}

// Update FolderTree props to use FolderTreeNode
const FolderTree: React.FC<{
  nodes: FolderTreeNode[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onMoveFolder: (folderId: string, newParentId: string | null) => void;
  onCreateSubfolder?: (parentId: string) => void;
  parentDroppableId: string;
}> = ({ nodes, selectedFolderId, onSelectFolder, onEditFolder, onDeleteFolder, onMoveFolder, onCreateSubfolder, parentDroppableId }) => {
  return (
    <Droppable droppableId={parentDroppableId} type="FOLDER">
      {(provided, snapshot) => (
        <ul ref={provided.innerRef} {...provided.droppableProps} className={`space-y-1 transition-all duration-200 ${
          snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20 rounded-md border-2 border-dashed border-blue-300 dark:border-blue-600 p-2' : ''
        }`}>
          {nodes.map((folder, idx) => (
            <Draggable key={folder.id} draggableId={folder.id} index={idx}>
              {(dragProvided, dragSnapshot) => (
                <li ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}
                    className={`${dragSnapshot.isDragging ? 'transform rotate-2 scale-105 shadow-xl z-50' : ''} transition-all duration-200`}>
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
                      {onCreateSubfolder && (
                        <ActionButton
                          onClick={() => onCreateSubfolder(folder.id)}
                          title="Create subfolder"
                          className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 p-1"
                        >
                          {ICONS.folderPlus}
                        </ActionButton>
                      )}
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
                  {/* Render children recursively */}
                  {folder.children && folder.children.length > 0 && (
                    <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-2 mt-1">
                      <FolderTree
                        nodes={folder.children}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={onSelectFolder}
                        onEditFolder={onEditFolder}
                        onDeleteFolder={onDeleteFolder}
                        onMoveFolder={onMoveFolder}
                        onCreateSubfolder={onCreateSubfolder}
                        parentDroppableId={folder.id}
                      />
                    </div>
                  )}
                </li>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </ul>
      )}
    </Droppable>
  );
};

const FolderPanel: React.FC<FolderPanelProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onCreateSubfolder,
  onEditFolder,
  onDeleteFolder,
  isLoading,
  onMoveFolder = () => {},
}) => {
  // Build the folder tree from the flat list
  const folderTree = buildFolderTree(folders);

  // Handle drag end
  const onDragEnd = (result: DropResult) => {
    console.log('🔄 Drag end result:', result);
    
    if (!result.destination) {
      console.log('❌ No destination, drag cancelled');
      return;
    }
    
    const folderId = result.draggableId;
    const newParentId = result.destination.droppableId === 'root' ? null : result.destination.droppableId;
    
    console.log('📁 Moving folder:', {
      folderId,
      fromParent: result.source.droppableId,
      toParent: newParentId || 'root',
      fromIndex: result.source.index,
      toIndex: result.destination.index
    });
    
    if (onMoveFolder) {
      onMoveFolder(folderId, newParentId);
    }
  };

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
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="root" type="FOLDER">
          {(provided) => (
            <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
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
              {/* Render the folder tree with drag-and-drop */}
              <FolderTree
                nodes={folderTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onMoveFolder={onMoveFolder}
                onCreateSubfolder={onCreateSubfolder}
                parentDroppableId="root"
              />
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
      {!isLoading && folders.length === 0 && (
        <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-3 px-2">
          No folders created yet. Click the <span className="inline-flex align-middle mx-1">{ICONS.folderPlus}</span> icon to add one.
        </p>
      )}
    </div>
  );
};

export default FolderPanel; 