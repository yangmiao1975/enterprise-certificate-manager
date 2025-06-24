/// <reference types="vite/client" />

import React from 'react';
import { Certificate } from '../types';
import CertificateRow from './CertificateRow';

interface CertificateTableProps {
  certificates: Certificate[];
  onRenew: (id: string) => void;
  onDownload: (certificate: Certificate) => void;
  onViewDetails: (certificate: Certificate) => void;
  onDelete: (certificate: Certificate) => void;
  onMoveToFolder: (certificate: Certificate) => void;
  renewingCertId: string | null;
}

const CertificateTable: React.FC<CertificateTableProps> = ({ certificates, onRenew, onDownload, onViewDetails, onDelete, onMoveToFolder, renewingCertId }) => {
  if (certificates.length === 0) {
    return <p className="text-center text-slate-500 dark:text-slate-400 py-8">No certificates found in this view.</p>;
  }

  return (
    <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Common Name</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider hidden md:table-cell">Issuer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider hidden lg:table-cell">Valid From</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Valid To</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {certificates.map((cert) => (
              <CertificateRow
                key={cert.id}
                certificate={cert}
                onRenew={onRenew}
                onDownload={onDownload}
                onViewDetails={onViewDetails}
                onDelete={onDelete}
                onMoveToFolder={onMoveToFolder}
                isRenewing={renewingCertId === cert.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CertificateTable; 