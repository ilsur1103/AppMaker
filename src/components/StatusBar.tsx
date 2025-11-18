import React from 'react';

const StatusBar: React.FC<{ 
  version: string; 
  updateInfo: any; 
  updateProgress: any; 
  updateDownloaded: boolean;
}> = ({ version, updateInfo, updateProgress, updateDownloaded }) => {
  return (
    <div className="status-bar">
      <div className="status-left">
        <span>Version: {version}</span>
      </div>
      <div className="status-right">
        {updateInfo && !updateDownloaded && (
          <div className="update-available">
            <span>Update available: v{updateInfo.version}</span>
            {updateProgress && (
              <div className="update-progress">
                <div 
                  className="progress-bar" 
                  style={{ width: `${updateProgress.percent}%` }}
                />
              </div>
            )}
          </div>
        )}
        {updateDownloaded && (
          <button 
            className="update-button"
            onClick={() => window.electron.installUpdate()}
          >
            Install Update
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusBar;