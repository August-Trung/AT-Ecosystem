
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-6 px-4 bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto flex items-center gap-2">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">MapMe</h1>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Định vị & Khám phá</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
