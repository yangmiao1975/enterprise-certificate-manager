import React from 'react';
import { Certificate, CertificateStatus } from '../types';
import { ICONS } from '../constants';
import ActionButton from './ActionButton';

interface CertificateRowProps {
  certificate: Certificate;
  onRenew: (id: string) => void;
  onDownload: (certificate: Certificate) => void;
  onViewDetails: (certificate: Certificate) => void;
  onDelete: (certificate: Certificate) => void;
  onMoveToFolder: (certificate: Certificate) => void;
  isRenewing: boolean;
}

const CertificateRow: React.FC<CertificateRowProps> = ({ certificate, onRenew, onDownload, onViewDetails, onDelete, onMoveToFolder, isRenewing }) => {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  };

  const getStatusClasses = (status: CertificateStatus) => {
    switch (status) {
      case CertificateStatus.VALID:
        return 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300';
      case CertificateStatus.EXPIRING_SOON:
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300';
      case CertificateStatus.EXPIRED:
        return 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300';
      case CertificateStatus.REVOKED:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300';
    }
  };

  return (
    <tr className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150">
      <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{certificate.commonName}</td>
      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 hidden md:table-cell">{certificate.issuer}</td>
      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 hidden lg:table-cell">{formatDate(certificate.validFrom)}</td>
      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{formatDate(certificate.validTo)}</td>
      <td className="py-3 px-4 text-sm">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClasses(certificate.status)}`}>
          {certificate.status}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-center space-x-1">
          <ActionButton 
            onClick={() => onRenew(certificate.id)} 
            title="Renew Certificate" 
            className="text-sky-600 dark:text-sky-400" 
            disabled={isRenewing || certificate.status === CertificateStatus.EXPIRED}
          >
            {isRenewing ? (
                <svg className="animate-spin h-5 w-5 text-sky-600 dark:text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : ICONS.refresh}
          </ActionButton>
          <ActionButton onClick={() => onDownload(certificate)} title="Download Certificate PEM" className="text-emerald-600 dark:text-emerald-400">
            {ICONS.download}
          </ActionButton>
           <ActionButton onClick={() => onMoveToFolder(certificate)} title="Move to Folder" className="text-amber-600 dark:text-amber-400">
            {ICONS.folderArrowRight}
          </ActionButton>
          <ActionButton onClick={() => onViewDetails(certificate)} title="View Details" className="text-indigo-600 dark:text-indigo-400">
            {ICONS.eye}
          </ActionButton>
          <ActionButton 
            onClick={() => onDelete(certificate)} 
            title="Delete Certificate" 
            className="text-red-500 dark:text-red-400"
            disabled={isRenewing}
          >
            {ICONS.trash}
          </ActionButton>
        </div>
      </td>
    </tr>
  );
};

export default CertificateRow; 