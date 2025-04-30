import { useState } from 'react';

export const Tooltip = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-10 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg -top-8 left-1/2 transform -translate-x-1/2">
          {content}
        </div>
      )}
    </div>
  );
};
