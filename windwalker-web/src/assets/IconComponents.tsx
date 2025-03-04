import React from 'react';

// Custom SVG icon components
const IconComponents = {
    Mountain: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M4 18L10 5L16 18" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
    Tree: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 4L6 12H9V16H15V12H18L12 4Z" stroke="currentColor" fill="none" strokeWidth="2" />
        <rect x="11" y="16" width="2" height="4" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
    Water: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M4 12C8 6 16 6 20 12C16 18 8 18 4 12Z" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
    Village: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M3 12L12 4L21 12V20H3V12Z" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
    Temple: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 3L4 8V20H20V8L12 3Z" stroke="currentColor" fill="none" strokeWidth="2" />
        <line x1="8" y1="20" x2="8" y2="12" stroke="currentColor" strokeWidth="2" />
        <line x1="16" y1="20" x2="16" y2="12" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    Tower: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <rect x="8" y="4" width="8" height="16" stroke="currentColor" fill="none" strokeWidth="2" />
        <path d="M6 4H18L16 2H8L6 4Z" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
    City: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M3 12L12 4L21 12L12 20L3 12Z" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
    Challenge: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M3 12L12 4L21 12L12 20L3 12Z" stroke="currentColor" fill="none" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
    ),
  };

  export {IconComponents};