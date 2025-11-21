import React, { useState } from 'react';

const Calculator = () => {
  const [display, setDisplay] = useState('0');
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForSecondOperand) {
      setDisplay(num);
      setWaitingForSecondOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputDecimal = () => {
    if (waitingForSecondOperand) {
      setDisplay('0.');
      setWaitingForSecondOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator) {
      const currentValue = firstOperand || 0;
      const newValue = calculate(currentValue, inputValue, operator);

      setDisplay(String(newValue));
      setFirstOperand(newValue);
    }

    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (first: number, second: number, operator: string): number => {
    switch (operator) {
      case '+':
        return first + second;
      case '-':
        return first - second;
      case '×':
        return first * second;
      case '÷':
        return first / second;
      default:
        return second;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (firstOperand !== null && operator) {
      const newValue = calculate(firstOperand, inputValue, operator);
      setDisplay(String(newValue));
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(true);
    }
  };

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div className="buttons">
        <button onClick={clear} className="btn clear">C</button>
        <button onClick={() => performOperation('÷')} className="btn operator">÷</button>
        <button onClick={() => performOperation('×')} className="btn operator">×</button>
        <button onClick={() => performOperation('-')} className="btn operator">-</button>
        <button onClick={() => performOperation('+')} className="btn operator">+</button>
        <button onClick={() => inputNumber('7')} className="btn number">7</button>
        <button onClick={() => inputNumber('8')} className="btn number">8</button>
        <button onClick={() => inputNumber('9')} className="btn number">9</button>
        <button onClick={() => inputNumber('4')} className="btn number">4</button>
        <button onClick={() => inputNumber('5')} className="btn number">5</button>
        <button onClick={() => inputNumber('6')} className="btn number">6</button>
        <button onClick={() => inputNumber('1')} className="btn number">1</button>
        <button onClick={() => inputNumber('2')} className="btn number">2</button>
        <button onClick={() => inputNumber('3')} className="btn number">3</button>
        <button onClick={() => inputNumber('0')} className="btn number zero">0</button>
        <button onClick={inputDecimal} className="btn number">.</button>
        <button onClick={handleEquals} className="btn equals">=</button>
      </div>
    </div>
  );
};

export default Calculator;