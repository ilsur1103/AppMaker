import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';
import StatusBar from './components/StatusBar';

function App() {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [projectPort, setProjectPort] = useState<number | null>(null);

  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateProgress, setUpdateProgress] = useState<any>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  const handleProjectSelect = (projectName: string, id: string, port?: number) => {
    setCurrentProject(projectName);
    setContainerId(id);
    setProjectPort(port || null);
  };

  const handleBackToDashboard = () => {
    setCurrentProject(null);
    setContainerId(null);
    setViewMode('preview');
    setProjectPort(null);
  };

  useEffect(() => {
    window.electron.onUpdateAvailable((info) => {
      setUpdateInfo(info);
    });
    
    window.electron.onUpdateDownloaded(() => {
      setUpdateDownloaded(true);
    });
    
    window.electron.onUpdateProgress((progress) => {
      setUpdateProgress(progress);
    });
  }, []);

  return (
    <div className="app">
      {currentProject && containerId ? (
        <ProjectView 
          projectName={currentProject} 
          containerId={containerId} 
          projectPort={projectPort}
          onBack={handleBackToDashboard}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : (
        <Dashboard onProjectSelect={handleProjectSelect} />
      )}
      <StatusBar version={''} updateInfo={updateInfo} updateProgress={updateProgress} updateDownloaded={updateDownloaded} />
    </div>
  );
}

export default App;
