import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface ConsolePanelProps {
  containerId: string;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ containerId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const dockerLogsInterval = useRef<NodeJS.Timeout | null>(null);
  const commandBuffer = useRef<string>('');
  let previousLine = '';

  // Получаем логи Docker контейнера
  const fetchDockerLogs = async () => {
    try {
      const result = await window.electron.getContainerLogs(containerId);
      if (result.success && result.logs) {
        const logLines: string[] = result.logs.split('\n').filter((line: string) => line.trim() !== '');
        
        logLines.forEach((line: string) => {
          if (previousLine === line) return;
          previousLine = line;
          if (terminal.current) {
            terminal.current.writeln(`[DOCKER] ${line}`);
          }
        });
      }
    } catch (error) {
      if (terminal.current) {
        terminal.current.writeln(`[ERROR] Error fetching Docker logs: ${(error as Error).message}`);
      }
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
          if (terminal.current) {
            terminal.current.writeln(`[IFRAME] Console: ${data.message}`);
          }
        } else if (data.type === 'error') {
          if (terminal.current) {
            terminal.current.writeln(`[IFRAME] Error: ${data.message}`);
          }
        } else if (data.type === 'info') {
          if (terminal.current) {
            terminal.current.writeln(`[IFRAME] ${data.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing iframe message:', error);
    }
  };

  useEffect(() => {
    // Инициализируем терминал
    if (terminalRef.current) {
      terminal.current = new Terminal({
        rows: 20,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4'
        },
        convertEol: true
      });
      
      fitAddon.current = new FitAddon();
      terminal.current.loadAddon(fitAddon.current);
      
      terminal.current.open(terminalRef.current);
      fitAddon.current.fit();
      
      // Добавляем начальные логи
      terminal.current.writeln('[INFO] Container started');
      terminal.current.writeln('[INFO] Node.js v18.17.0');
      
      // Обработчик ввода команд
      terminal.current.onData(async (data) => {
        if (data === '\r') { // Enter
          const command = commandBuffer.current.trim();
          if (command) {
            terminal.current?.writeln(`$ ${command}`);
            
            try {
              const result = await window.electron.runCommandInContainer(containerId, command);
              if (result.success && result.result) {
                terminal.current?.writeln(result.result);
              }
            } catch (error) {
              terminal.current?.writeln(`[ERROR] ${(error as Error).message}`);
            }
          }
          commandBuffer.current = '';
        } else if (data === '\u007F') { // Backspace
          if (commandBuffer.current.length > 0) {
            commandBuffer.current = commandBuffer.current.slice(0, -1);
            terminal.current?.write('\b \b');
          }
        } else {
          commandBuffer.current += data;
          terminal.current?.write(data);
        }
      });
    }
    
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
      
      // Уничтожаем терминал
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, [containerId]);

  return (
    <div className="console-panel">
      <div className="panel-header">
        <h2>Console</h2>
      </div>
      <div className="console-content">
        <div ref={terminalRef} className="terminal-container" />
      </div>
    </div>
  );
};

export default ConsolePanel;
