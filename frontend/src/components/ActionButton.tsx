import React from 'react';

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, children, title, className = '', disabled = false }) => {
  const baseClasses = "p-2 rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50";
  const enabledClasses = "hover:bg-gray-200 dark:hover:bg-gray-700";
  const disabledClasses = "opacity-50 cursor-not-allowed";

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${baseClasses} ${disabled ? disabledClasses : enabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

export default ActionButton; 