import React from 'react';
import '../styles/frigatesimpleui.css';

/**
 * FrigateSimpleUI Logo Component
 * @param {Object} props - Component props
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - Logo size
 * @returns {JSX.Element} FrigateSimpleUI logo
 */
const FrigateSimpleUILogo = ({ className = '', size = 'default' }) => {
  const containerClass = `frigatesimpleui-logo ${className} ${size === 'small' ? 'frigatesimpleui-logo-sm' : ''}`;

  return (
    <div className={containerClass}>
      <div className="logo-container">
        <div className="logo-icon">
          <div className="icon-bg">
            <svg className="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div className="status-indicator"></div>
        </div>
        <span className="logo-text">
          Frigate<span className="logo-text-accent">SimpleUI</span>
        </span>
      </div>
    </div>
  );
};

export default FrigateSimpleUILogo; 