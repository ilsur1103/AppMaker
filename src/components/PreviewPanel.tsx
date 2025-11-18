import React, { useEffect, useRef } from 'react';

const PreviewPanel: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.onload = () => {
        injectConsoleLogger();
      };
    }
  }, []);

  return (
    <div className="preview-panel">
      <div className="panel-header">
        <h2>Preview</h2>
      </div>
      <div className="preview-content">
        <iframe 
          ref={iframeRef}
          src="http://localhost:3000" 
          title="Project Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={injectConsoleLogger}
        />
        <div className="preview-placeholder">
          <p>Project preview will appear here</p>
          <p>Make sure your project is running on port 3000</p>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
