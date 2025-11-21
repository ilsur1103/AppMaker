import React from 'react';
import ChatPanel from './ChatPanel';
import PreviewPanel from './PreviewPanel';
import ConsolePanel from './ConsolePanel';
import CodeEditorPanel from './CodeEditorPanel';

interface ProjectViewProps {
  projectName: string;
  containerId: string;
  projectPort: number | null;
  onBack: () => void;
  viewMode: 'preview' | 'code';
  onViewModeChange: (mode: 'preview' | 'code') => void;
}

const ProjectView: React.FC<ProjectViewProps> = ({ 
  projectName, 
  containerId, 
  projectPort,
  onBack,
  viewMode,
  onViewModeChange
}) => {
  return (
    <div className="project-view">
      <header className="project-header">
        <button onClick={onBack} className="back-button">← Back</button>
        <h1>{projectName}</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={viewMode === 'preview' ? 'active' : ''}
              onClick={() => onViewModeChange('preview')}
            >
              Preview
            </button>
            <button 
              className={viewMode === 'code' ? 'active' : ''}
              onClick={() => onViewModeChange('code')}
            >
              Code
            </button>
          </div>
          {projectPort && (
            <a 
              href={`http://localhost:${projectPort}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="project-link"
            >
              Open in Browser (Port: {projectPort})
            </a>
          )}
          <button className="publish-button">Publish to GitHub</button>
        </div>
      </header>

      <div className="project-content">
        <div className="left-panel">
          <ChatPanel containerId={containerId} />
        </div>
        <div className="right-panel">
          {viewMode === 'preview' ? (
            <>
              <PreviewPanel />
              <ConsolePanel containerId={containerId} />
            </>
          ) : (
            <CodeEditorPanel containerId={containerId} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectView;
