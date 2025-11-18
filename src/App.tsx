import { useState } from 'react';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';

function App() {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const handleProjectSelect = (projectName: string, id: string) => {
    setCurrentProject(projectName);
    setContainerId(id);
  };

  const handleBackToDashboard = () => {
    setCurrentProject(null);
    setContainerId(null);
    setViewMode('preview');
  };

  return (
    <div className="app">
      {currentProject && containerId ? (
        <ProjectView 
          projectName={currentProject} 
          containerId={containerId} 
          onBack={handleBackToDashboard}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : (
        <Dashboard onProjectSelect={handleProjectSelect} />
      )}
    </div>
  );
}

export default App;
