import React, { useState } from 'react';
import './App.css';

function App() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      let newValue: number;

      switch (operation) {
        case '+':
          newValue = currentValue + inputValue;
          break;
        case '-':
          newValue = currentValue - inputValue;
          break;
        case '×':
          newValue = currentValue * inputValue;
          break;
        case '÷':
          newValue = currentValue / inputValue;
          break;
        default:
          newValue = inputValue;
      }

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const handleEquals = () => {
    if (operation && previousValue !== null) {
      performOperation(operation);
      setOperation(null);
    }
  };

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div className="buttons">
        <button onClick={clear} className="button clear">AC</button>
        <button onClick={() => setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display)} className="button">±</button>
        <button onClick={() => setDisplay(display.slice(0, -1) || '0')} className="button">⌫</button>
        <button onClick={() => performOperation('÷')} className="button operation">÷</button>
        
        <button onClick={() => inputDigit('7')} className="button">7</button>
        <button onClick={() => inputDigit('8')} className="button">8</button>
        <button onClick={() => inputDigit('9')} className="button">9</button>
        <button onClick={() => performOperation('×')} className="button operation">×</button>
        
        <button onClick={() => inputDigit('4')} className="button">4</button>
        <button onClick={() => inputDigit('5')} className="button">5</button>
        <button onClick={() => inputDigit('6')} className="button">6</button>
        <button onClick={() => performOperation('-')} className="button operation">-</button>
        
        <button onClick={() => inputDigit('1')} className="button">1</button>
        <button onClick={() => inputDigit('2')} className="button">2</button>
        <button onClick={() => inputDigit('3')} className="button">3</button>
        <button onClick={() => performOperation('+')} className="button operation">+</button>
        
        <button onClick={() => inputDigit('0')} className="button zero">0</button>
        <button onClick={inputDecimal} className="button">.</button>
        <button onClick={handleEquals} className="button equals">=</button>
      </div>
    </div>
  );
}

export default App;