import React, { useEffect, useRef, useState } from 'react';

interface PreviewPanelProps {
  port: number | null;
  containerId: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ port, containerId }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 30; // Максимум 30 попыток (примерно 5 минут с интервалом 10 секунд)

  // Инжектируем скрипт для перехвата консольных сообщений
  const injectConsoleLogger = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const script = iframeRef.current.contentWindow.document.createElement('script');
      script.textContent = `
        // Сохраняем оригинальные методы консоли
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        // Переопределяем методы консоли
        console.log = function(...args) {
          window.parent.postMessage({
            type: 'console-log',
            message: args.join(' ')
          }, '*');
          originalLog.apply(console, args);
        };
        
        console.error = function(...args) {
          window.parent.postMessage({
            type: 'error',
            message: args.join(' ')
          }, '*');
          originalError.apply(console, args);
        };
        
        console.warn = function(...args) {
          window.parent.postMessage({
            type: 'console-log',
            message: args.join(' ')
          }, '*');
          originalWarn.apply(console, args);
        };
        
        // Отправляем сообщение о загрузке
        window.parent.postMessage({
          type: 'info',
          message: 'Iframe loaded successfully'
        }, '*');
      `;
      iframeRef.current.contentWindow.document.head.appendChild(script);
    }
  };

  const checkAppReady = async () => {
    if (!port) return;
    
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) {
        setIsLoading(false);
        setError(null);
        retryCount.current = 0;
        
        // Обновляем src iframe для загрузки приложения
        if (iframeRef.current) {
          iframeRef.current.src = `http://localhost:${port}`;
        }
      } else {
        throw new Error('App not ready');
      }
    } catch (err) {
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        retryTimeout.current = setTimeout(checkAppReady, 10000); // Повторяем каждые 10 секунд
      } else {
        setError('Failed to load application after multiple attempts');
        setIsLoading(false);
      }
    }
  };

  const reloadIframe = async () => {
    if (!containerId || !port) return;
    
    try {
      setIsLoading(true);
      setError(null);
      retryCount.current = 0;
      
      // Пересобираем проект
      const result = await window.electron.rebuildProject(containerId, port);
      if (!result.success) {
        throw new Error(result.error || 'Failed to rebuild project');
      }
      
      // Обновляем iframe
      if (iframeRef.current) {
        iframeRef.current.src = `http://localhost:${port}`;
      }
      
      // Начинаем проверку готовности приложения
      checkAppReady();
    } catch (err) {
      setError(`Failed to rebuild project: ${(err as Error).message}`);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Сброс состояния при изменении порта
    setIsLoading(true);
    setError(null);
    retryCount.current = 0;
    
    // Очищаем предыдущий таймер
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
    }
    
    if (port) {
      // Начинаем проверку готовности приложения
      checkAppReady();
    } else {
      setIsLoading(false);
      setError('No port specified');
    }

    return () => {
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current);
      }
    };
  }, [port]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && port) {
      iframe.onload = () => {
        injectConsoleLogger();
      };
    }
  }, [port]);

  return (
    <div className="preview-panel">
      <div className="panel-header">
        <h2>Preview</h2>
        {port && (
          <div className="preview-controls">
            <span className="port-info">Port: {port}</span>
            <button onClick={reloadIframe} className="reload-button">
              🔄 Reload & Rebuild
            </button>
          </div>
        )}
      </div>
      <div className="preview-content">
        {port ? (
          <>
            {isLoading && (
              <div className="preview-loading">
                <div className="spinner"></div>
                <p>Waiting for application to start...</p>
                <p>Checking port {port}... (Attempt {retryCount.current}/{maxRetries})</p>
              </div>
            )}
            {error && (
              <div className="preview-error">
                <p>{error}</p>
                <button onClick={reloadIframe}>Retry</button>
              </div>
            )}
            <iframe 
              ref={iframeRef}
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
              style={{ display: isLoading || error ? 'none' : 'block' }}
              onLoad={injectConsoleLogger}
            />
          </>
        ) : (
          <div className="preview-placeholder">
            <p>No project selected</p>
            <p>Please select or create a project to view preview</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
