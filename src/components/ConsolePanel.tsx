import React, { useState, useEffect, useRef } from 'react';

interface ConsolePanelProps {
  containerId: string;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ containerId }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const hasAddedRunningLog = useRef(false);
  const dockerLogsInterval = useRef<NodeJS.Timeout | null>(null);
  let previousLine = '';
  
  // Функция для добавления логов в консоль
  const addLog = (message: string, type: 'info' | 'error' | 'command' | 'output' | 'docker' | 'iframe' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = '';
    
    switch (type) {
      case 'command':
        prefix = '[COMMAND] ';
        break;
      case 'error':
        prefix = '[ERROR] ';
        break;
      case 'output':
        prefix = '[OUTPUT] ';
        break;
      case 'docker':
        prefix = '[DOCKER] ';
        break;
      case 'iframe':
        prefix = '[IFRAME] ';
        break;
      default:
        prefix = '[INFO] ';
    }
    
    setLogs(prev => [...prev, `[${timestamp}] ${prefix}${message}`]);
  };

  // Получаем логи Docker контейнера
    const fetchDockerLogs = async () => {
      try {
        const result = await window.electron.getContainerLogs(containerId);
        if (result.success && result.logs) {
          const logLines: string[] = result.logs.split('\n').filter((line: string) => line.trim() !== '');
          // Отслеживаем уже добавленные логи, чтобы избежать дублирования
          const newLogs = logLines.filter(line => !logs.includes(`[DOCKER] ${line}`));
          
          newLogs.forEach((line: string) => {
            if(previousLine===line) return;
            previousLine=line;
            addLog(line, 'docker');
          });
        }
      } catch (error) {
        addLog(`Error fetching Docker logs: ${(error as Error).message}`, 'error');
      }
    };

    // Обработчик сообщений из iframe
    const handleIframeMessage = (event: MessageEvent) => {
      try {
        // Проверяем, что сообщение пришло от нашего iframe
        if (event.origin === 'http://localhost:3000' || event.origin === window.location.origin) {
          const data = event.data;
          
          // Добавляем логи из iframe
          if (data.type === 'console-log') {
            addLog(`Console: ${data.message}`, 'iframe');
          } else if (data.type === 'error') {
            addLog(`Error: ${data.message}`, 'error');
          } else if (data.type === 'info') {
            addLog(data.message, 'iframe');
          }
        }
      } catch (error) {
        console.error('Error processing iframe message:', error);
      }
    };

  useEffect(() => {
    // Сбрасываем флаг при смене контейнера
    hasAddedRunningLog.current = false;
    
    // Добавляем начальные логи
    addLog('Container started');
    addLog('Node.js v18.17.0');
    
    // Начинаем получать логи Docker
    fetchDockerLogs();
    
    // Устанавливаем интервал для периодического получения логов
    dockerLogsInterval.current = setInterval(() => {
      fetchDockerLogs();
    }, 5000); // Каждые 5 секунд
    
    // Добавляем обработчик сообщений из iframe
    window.addEventListener('message', handleIframeMessage);
    
    return () => {
      // Очищаем интервал при размонтировании
      if (dockerLogsInterval.current) {
        clearInterval(dockerLogsInterval.current);
      }
      
      // Удаляем обработчик сообщений
      window.removeEventListener('message', handleIframeMessage);
    };
  }, [containerId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="console-panel">
      <div className="panel-header">
        <h2>Console</h2>
      </div>
      <div className="console-content">
        <pre>
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </pre>
      </div>
    </div>
  );
};

export default ConsolePanel;
