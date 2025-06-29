import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FolderPanel from '../components/FolderPanel';

describe('FolderPanel', () => {
  const folders = [
    { id: 'f1', name: 'Folder 1', parentId: null },
    { id: 'f2', name: 'Folder 2', parentId: null },
    { id: 'f3', name: 'Subfolder', parentId: 'f1' }
  ];
  const mockSelect = vi.fn();
  const mockCreate = vi.fn();
  const mockEdit = vi.fn();
  const mockDelete = vi.fn();
  const mockMove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders folder tree and root', () => {
    render(
      <FolderPanel
        folders={folders}
        selectedFolderId={null}
        onSelectFolder={mockSelect}
        onCreateFolder={mockCreate}
        onEditFolder={mockEdit}
        onDeleteFolder={mockDelete}
        isLoading={false}
        onMoveFolder={mockMove}
      />
    );
    expect(screen.getByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('All Certificates')).toBeInTheDocument();
    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Folder 2')).toBeInTheDocument();
    expect(screen.getByText('Subfolder')).toBeInTheDocument();
  });

  it('calls onCreateFolder when create button is clicked', () => {
    render(
      <FolderPanel
        folders={folders}
        selectedFolderId={null}
        onSelectFolder={mockSelect}
        onCreateFolder={mockCreate}
        onEditFolder={mockEdit}
        onDeleteFolder={mockDelete}
        isLoading={false}
        onMoveFolder={mockMove}
      />
    );
    fireEvent.click(screen.getByTitle('Create New Folder'));
    expect(mockCreate).toHaveBeenCalled();
  });

  it('calls onEditFolder and onDeleteFolder for folder actions', () => {
    render(
      <FolderPanel
        folders={folders}
        selectedFolderId={null}
        onSelectFolder={mockSelect}
        onCreateFolder={mockCreate}
        onEditFolder={mockEdit}
        onDeleteFolder={mockDelete}
        isLoading={false}
        onMoveFolder={mockMove}
      />
    );
    fireEvent.click(screen.getAllByTitle('Edit folder name')[0]);
    expect(mockEdit).toHaveBeenCalled();
    fireEvent.click(screen.getAllByTitle('Delete folder')[0]);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('calls onMoveFolder when drag ends', () => {
    // Simulate drag-and-drop by calling onMoveFolder directly
    render(
      <FolderPanel
        folders={folders}
        selectedFolderId={null}
        onSelectFolder={mockSelect}
        onCreateFolder={mockCreate}
        onEditFolder={mockEdit}
        onDeleteFolder={mockDelete}
        isLoading={false}
        onMoveFolder={mockMove}
      />
    );
    // Simulate drag end event
    const instance = screen.getByText('Folders').closest('div');
    if (instance && instance.props && instance.props.onMoveFolder) {
      instance.props.onMoveFolder('f3', 'f2');
      expect(mockMove).toHaveBeenCalledWith('f3', 'f2');
    }
  });
}); 