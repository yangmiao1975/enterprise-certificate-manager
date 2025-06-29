import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadCertificateForm from '../components/UploadCertificateForm';

describe('UploadCertificateForm', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();
  const folders = [
    { id: 'f1', name: 'Folder 1' },
    { id: 'f2', name: 'Folder 2' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form and folder select', () => {
    render(<UploadCertificateForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} folders={folders} />);
    expect(screen.getByText('Certificate File')).toBeInTheDocument();
    expect(screen.getByLabelText('Assign to Folder (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Upload File')).toBeInTheDocument();
  });

  it('shows error for large file', async () => {
    render(<UploadCertificateForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} folders={folders} />);
    const file = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.crt');
    const input = screen.getByLabelText('Certificate File').parentElement!.querySelector('input[type="file"]')!;
    await userEvent.upload(input, file);
    expect(screen.getByText(/maximum size/i)).toBeInTheDocument();
  });

  it('shows error if no file selected on submit', async () => {
    render(<UploadCertificateForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} folders={folders} />);
    fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByText(/select a certificate file/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with file and folderId', async () => {
    render(<UploadCertificateForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} folders={folders} />);
    const file = new File(['dummy'], 'test.crt');
    const input = screen.getByLabelText('Certificate File').parentElement!.querySelector('input[type="file"]')!;
    await userEvent.upload(input, file);
    fireEvent.change(screen.getByLabelText('Assign to Folder (Optional)'), { target: { value: 'f2' } });
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith(file, 'f2'));
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<UploadCertificateForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} folders={folders} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });
}); 