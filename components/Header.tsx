
import React from 'react';
import { APP_TITLE, ICONS } from '../constants';

interface HeaderProps {
  onUploadClick: () => void;
  onSettingsClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onUploadClick, onSettingsClick }) => {
  return (
    <header className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_TITLE}</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={onUploadClick}
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center space-x-2"
            aria-label="Upload certificate"
          >
            {ICONS.upload}
            <span>Upload</span>
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-full hover:bg-slate-700 transition duration-150 ease-in-out"
            title="Notification Settings"
            aria-label="Notification Settings"
          >
            {ICONS.cog}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
