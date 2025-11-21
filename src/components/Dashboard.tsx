// Dashboard.tsx
import React, { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  status: string;
  created: string;
  port?: number;
}

interface DashboardProps {
  onProjectSelect: (name: string, id: string, port?: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const result = await window.electron.listContainers();
      if (result.success) {
        const projectList = await Promise.all(
          (result.containers?.map(async (container: any) => {
            // Получаем порт для каждого контейнера
            const portResult = await window.electron.getContainerPort(container.Id);
            const port = portResult.success ? portResult.port : undefined;
            
            return {
              id: container.Id,
              name: container.Names[0].replace('/ai-dev-', '').replace(/-\d+$/, ''),
              status: container.State,
              created: new Date(container.Created * 1000).toLocaleString(),
              port
            };
          })) || []
        );
        setProjects(projectList);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    setLoading(true);
    setErrorMessage('');
    try {
      console.log(`Создание проекта: ${newProjectName}`);
      const result = await window.electron.createProject(newProjectName);
      console.log('Результат создания проекта:', result);
      
      if (result.success && result.containerId) {
        console.log(`Проект создан успешно: ${result.containerId}`);
        onProjectSelect(newProjectName, result.containerId, result.port);
        await loadProjects();
      } else {
        const errorMessage = result.error || 'Unknown error';
        console.error('Failed to create project:', errorMessage);
        setErrorMessage(`Failed to create project: ${errorMessage}`);
        alert(`Failed to create project: ${errorMessage}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error('Failed to create project:', errorMessage);
      setErrorMessage(`Failed to create project: ${errorMessage}`);
      alert(`Failed to create project: ${errorMessage}`);
    } finally {
      setLoading(false);
      setNewProjectName(''); // Очищаем поле ввода после создания
    }
  };

  const handleStartProject = async (containerId: string) => {
    setActionLoading(prev => ({ ...prev, [containerId]: true }));
    try {
      const result = await window.electron.startContainer(containerId);
      if (result.success) {
        await loadProjects();
      } else {
        alert('Failed to start project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to start project: ' + (error as Error).message);
    } finally {
      setActionLoading(prev => ({ ...prev, [containerId]: false }));
    }
  };

  const handleStopProject = async (containerId: string) => {
    setActionLoading(prev => ({ ...prev, [containerId]: true }));
    try {
      const result = await window.electron.stopContainer(containerId);
      if (result.success) {
        await loadProjects();
      } else {
        alert('Failed to stop project: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to stop project: ' + (error as Error).message);
    } finally {
      setActionLoading(prev => ({ ...prev, [containerId]: false }));
    }
  };

  const handleDeleteProject = async (containerId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${projectName}"? This will remove the container.`)) {
      return;
    }
    
    setActionLoading(prev => ({ ...prev, [containerId]: true }));
    try {
      const result = await window.electron.removeContainer(containerId);
      if (result.success) {
        await loadProjects();
        // Сбрасываем состояние loading после успешного удаления
        setLoading(false);
      } else {
        alert('Failed to delete project: ' + (result.error || 'Unknown error'));
        // Сбрасываем состояние loading даже при ошибке
        setLoading(false);
      }
    } catch (error) {
      alert('Failed to delete project: ' + (error as Error).message);
      // Сбрасываем состояние loading даже при ошибке
      setLoading(false);
    } finally {
      setActionLoading(prev => ({ ...prev, [containerId]: false }));
    }
  };

  if (initialLoading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>AI Development Assistant</h1>
        <p>Create and manage isolated development environments</p>
      </div>

      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      <div className="create-project-section">
        <h2>Create New Project</h2>
        <div className="create-form">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Enter project name"
            disabled={loading}
          />
          <button 
            onClick={handleCreateProject} 
            disabled={loading || !newProjectName.trim()}
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
        {loading && (
          <div className="loading-message">
            Please wait... This may take a few minutes while downloading the Node.js image.
          </div>
        )}
      </div>

      <div className="projects-section">
        <h2>Recent Projects</h2>
        {projects.length === 0 ? (
          <p>No projects found. Create your first project above.</p>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <p>Status: <span className={`status ${project.status}`}>{project.status}</span></p>
                <p>Created: {project.created}</p>
                {project.port && (
                  <p>Port: <a href={`http://localhost:${project.port}`} target="_blank" rel="noopener noreferrer">{project.port}</a></p>
                )}
                <div className="project-actions">
                  {project.status === 'running' ? (
                    <button 
                      onClick={() => handleStopProject(project.id)}
                      disabled={actionLoading[project.id]}
                      className="stop-button"
                    >
                      {actionLoading[project.id] ? 'Stopping...' : 'Stop'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleStartProject(project.id)}
                      disabled={actionLoading[project.id]}
                      className="start-button"
                    >
                      {actionLoading[project.id] ? 'Starting...' : 'Start'}
                    </button>
                  )}
                  <button 
                    onClick={() => project.status === 'running' ? 
                      onProjectSelect(project.name, project.id, project.port) : 
                      handleStartProject(project.id).then(() => onProjectSelect(project.name, project.id, project.port))}
                    disabled={actionLoading[project.id] || project.status === 'exited'}
                    className="open-button"
                  >
                    {actionLoading[project.id] ? 'Opening...' : 'Open'}
                  </button>
                  <button 
                    onClick={() => handleDeleteProject(project.id, project.name)}
                    disabled={actionLoading[project.id]}
                    className="delete-button"
                  >
                    {actionLoading[project.id] ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
