/// <reference types="vite/client" />

import React, { useState } from 'react';
import { Certificate } from '../types';
import { ICONS } from '../constants';

interface ViewCertificateDataModalProps {
  certificate: Certificate | null;
  onClose: () => void;
  mode: 'view' | 'download';
}

const DetailItem: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
  <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100 sm:mt-0 sm:col-span-2 break-all">{value || 'N/A'}</dd>
  </div>
);

const ViewCertificateDataModal: React.FC<ViewCertificateDataModalProps> = ({ certificate, onClose, mode }) => {
  const [pemCopied, setPemCopied] = useState(false);
  
  if (!certificate) return null;

  const handleCopyPem = () => {
    if (certificate.pem) {
      navigator.clipboard.writeText(certificate.pem)
        .then(() => {
          setPemCopied(true);
          setTimeout(() => setPemCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy PEM: ', err));
    }
  };

  const handleDownloadPem = () => {
    if (certificate.pem) {
      // Create blob with PEM content
      const blob = new Blob([certificate.pem], { type: 'application/x-pem-file' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename based on certificate common name
      const sanitizedName = certificate.commonName.replace(/[^a-zA-Z0-9.-]/g, '_');
      link.download = `${sanitizedName}.pem`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };
  
  const title = mode === 'download' ? `Certificate PEM: ${certificate.commonName}` : `Certificate Details: ${certificate.commonName}`;

  return (
    <div className="text-slate-800 dark:text-slate-100">
        <dl className="divide-y divide-slate-200 dark:divide-slate-700">
            <DetailItem label="Common Name" value={certificate.commonName} />
            <DetailItem label="Subject" value={certificate.subject} />
            <DetailItem label="Issuer" value={certificate.issuer} />
            <DetailItem label="Serial Number" value={certificate.serialNumber} />
            <DetailItem label="Algorithm" value={certificate.algorithm} />
            <DetailItem label="Valid From" value={new Date(certificate.validFrom).toUTCString()} />
            <DetailItem label="Valid To" value={new Date(certificate.validTo).toUTCString()} />
            <DetailItem label="Status" value={certificate.status} />
            
            {/* Certificate Management Metadata */}
            <div className="py-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Certificate Timeline</h4>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-md p-3 space-y-2">
                    <DetailItem 
                        label="Created" 
                        value={certificate.uploadedAt ? new Date(certificate.uploadedAt).toUTCString() : 'N/A'} 
                    />
                    <DetailItem 
                        label="Last Updated" 
                        value={certificate.updatedAt ? new Date(certificate.updatedAt).toUTCString() : 'Not updated'} 
                    />
                    <DetailItem 
                        label="Renewal Count" 
                        value={certificate.renewalCount?.toString() || '0'} 
                    />
                    {certificate.uploadedBy && (
                        <DetailItem label="Uploaded By" value={certificate.uploadedBy} />
                    )}
                </div>
            </div>
        </dl>

        {mode === 'download' && certificate.pem && (
            <div className="mt-6">
            <h3 className="text-md font-semibold text-slate-800 dark:text-slate-100 mb-2">Certificate Data (PEM)</h3>
            <div className="relative bg-slate-100 dark:bg-slate-900 p-3 rounded-md max-h-60 overflow-y-auto">
                <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                {certificate.pem}
                </pre>
                <div className="absolute top-2 right-2 flex space-x-1">
                    <button
                    onClick={handleDownloadPem}
                    title="Download PEM file"
                    className="p-1.5 bg-emerald-100 dark:bg-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-700 rounded text-emerald-600 dark:text-emerald-300 transition"
                    >
                    {ICONS.download}
                    </button>
                    <button
                    onClick={handleCopyPem}
                    title="Copy PEM to clipboard"
                    className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 transition"
                    >
                    {pemCopied ? <span className="text-xs">Copied!</span> : ICONS.copy}
                    </button>
                </div>
            </div>
            </div>
        )}

        <div className="mt-6 flex justify-end">
            <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition"
            >
            Close
            </button>
        </div>
    </div>
  );
};

export default ViewCertificateDataModal;
 