import React, { useState } from 'react';
import { PageBanner } from '../ui/Shared.jsx';

// Simple offline calculator with a one-operator-at-a-time working memory (prev value + pending operator).
export default function Calculator() {
  const [display, setDisplay] = useState('0');
  // prev holds the accumulated value; op is the pending operator; waiting means the next digit starts a fresh entry.
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [waiting, setWaiting] = useState(false);

  function inputDigit(d) {
    // While "waiting" after choosing an operator, the first typed digit replaces the display.
    if (waiting) {
      setDisplay(String(d));
      setWaiting(false);
    } else {
      // Otherwise append, but never let the display start with more than one leading zero.
      setDisplay(display === '0' ? String(d) : display + d);
    }
  }

  function inputDot() {
    if (waiting) {
      setDisplay('0.');
      setWaiting(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }

  function clear() {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setWaiting(false);
  }

  // When an operator is pressed, evaluate any pending operation first, then remember the new operator.
  function chooseOp(nextOp) {
    const value = parseFloat(display);
    if (prev === null) {
      setPrev(value);
    } else if (op) {
      const result = calc(prev, value, op);
      setPrev(result);
      setDisplay(String(result));
    }
    setOp(nextOp);
    setWaiting(true);
  }

  // Apply the pending operator; division by zero is clamped to 0 instead of producing Infinity/NaN.
  function calc(a, b, operator) {
    switch (operator) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '\u00D7':
        return a * b;
      case '\u00F7':
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  }

  function equals() {
    const value = parseFloat(display);
    if (op === null || prev === null) return;
    const result = calc(prev, value, op);
    // Round to 10 decimals to avoid floating-point noise such as 0.1 + 0.2.
    setDisplay(String(Number(result.toFixed(10))));
    setPrev(null);
    setOp(null);
    setWaiting(false);
  }

  const buttons = [
    ['C', 'op'], ['\u00B1', ''], ['%', ''], ['\u00F7', 'op'],
    ['7', ''], ['8', ''], ['9', ''], ['\u00D7', 'op'],
    ['4', ''], ['5', ''], ['6', ''], ['-', 'op'],
    ['1', ''], ['2', ''], ['3', ''], ['+', 'op'],
    ['0', ''], ['.', ''], ['=', 'op'],
  ];

  // Route every button press to the matching handler based on its label.
  function press(b) {
    if (b === 'C') return clear();
    // ± toggles the sign of the current value.
    if (b === '\u00B1') return setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display);
    // % converts the current value to a percentage.
    if (b === '%') return setDisplay(String(parseFloat(display) / 100));
    if (b === '=') return equals();
    if (b === '.') return inputDot();
    if ('+-\u00D7\u00F7'.includes(b)) return chooseOp(b);
    return inputDigit(b);
  }

  return (
    <div>
      <PageBanner title="Calculator" subtitle="Simple offline calculator" />
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <div className="calc-display">{display}</div>
        <div className="calc-grid">
          {buttons.map(([b, type]) => (
            <button key={b} className={`calc-btn ${type}`} onClick={() => press(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
