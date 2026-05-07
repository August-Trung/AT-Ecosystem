
import React from 'react';
import { AppStatus } from '../types';

interface LoadingStateProps {
  status: AppStatus;
}

const LoadingState: React.FC<LoadingStateProps> = ({ status }) => {
  const getMessage = () => {
    switch (status) {
      case AppStatus.REQUESTING_PERMISSION:
        return "Đang yêu cầu quyền truy cập vị trí...";
      case AppStatus.FETCHING_COORDINATES:
        return "Đang xác định tọa độ của bạn...";
      case AppStatus.ANALYZING_LOCATION:
        return "Đang phân tích địa chỉ bằng AI...";
      default:
        return "Đang xử lý...";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{getMessage()}</h3>
      <p className="text-gray-500 max-w-xs">Việc này có thể mất vài giây tùy thuộc vào tín hiệu GPS của bạn.</p>
    </div>
  );
};

export default LoadingState;
