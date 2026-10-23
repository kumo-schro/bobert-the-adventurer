// Every control in the game, with its default keys. Players can change them in-game
// (from the pause menu, or Ctrl / Command); their choices are saved in the browser.
// Read them with game.input.held('shield'), game.input.hit('swing'), game.input.axisOf('left', 'right').

export const ACTIONS = [
  { id: 'forward', label: 'Move forward', keys: ['KeyW', 'ArrowUp'] },
  { id: 'back', label: 'Move back', keys: ['KeyS', 'ArrowDown'] },
  { id: 'left', label: 'Move left', keys: ['KeyA', 'ArrowLeft'] },
  { id: 'right', label: 'Move right', keys: ['KeyD', 'ArrowRight'] },
  { id: 'jump', label: 'Jump', keys: ['Space'] },
  { id: 'dodge', label: 'Roll (hold to run)', keys: ['ShiftLeft', 'ShiftRight'] },
  { id: 'swing', label: 'Sword (hold for spin)', keys: ['Enter', 'NumpadEnter'] },
  { id: 'shield', label: 'Block (hold)', keys: ['KeyJ'] },
  { id: 'bow', label: 'Bow (hold to charge)', keys: ['KeyK'] },
  { id: 'power', label: 'Star Burst (dream power)', keys: ['KeyL'] },
  { id: 'eat', label: 'Eat food', keys: ['KeyF'] },
  { id: 'interact', label: 'Talk / open / use', keys: ['KeyT'] },
  { id: 'camLeft', label: 'Turn camera left', keys: ['KeyQ'] },
  { id: 'camRight', label: 'Turn camera right', keys: ['KeyE'] },
  { id: 'tiltUp', label: 'Tilt camera up', keys: ['KeyR'] },
  { id: 'tiltDown', label: 'Tilt camera down', keys: ['KeyG'] },
  { id: 'camBehind', label: 'Camera behind you', keys: ['KeyC'] },
  { id: 'zoomIn', label: 'Zoom in', keys: ['Equal', 'NumpadAdd'] },
  { id: 'zoomOut', label: 'Zoom out', keys: ['Minus', 'NumpadSubtract'] },
  { id: 'quests', label: 'Show all quests', keys: ['Tab'] },
  { id: 'suggest', label: 'Suggest a change', keys: ['Slash'] },
  { id: 'customize', label: 'Customize Bobert', keys: ['KeyP'] },
  { id: 'mute', label: 'Sound on / off', keys: ['KeyM'] },
];

// Keys the game itself uses for menus; they can't be given to anything else.
export const RESERVED = new Set(['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'Escape', 'Backquote']); // ` = debug menu

const NAMES = {
  Space: 'Space',
  Enter: 'Return',
  NumpadEnter: 'Enter',
  ShiftLeft: 'Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'R-Ctrl',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Backquote: '`',
  Tab: 'Tab',
  Backspace: 'Delete',
};

/** A short, friendly name for a key code ('KeyW' -> 'W'). */
export function keyName(code) {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

const STORAGE_KEY = 'bobert-controls-v2'; // v2: the simpler control scheme (old saved keys don't carry over)

/** The saved bindings (falling back to the defaults). Returns { actionId: [codes] }. */
export function loadBindings() {
  const bindings = Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.keys]]));
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const [id, keys] of Object.entries(saved)) {
      if (bindings[id] && Array.isArray(keys) && keys.length) bindings[id] = keys;
    }
  } catch {
    // No saved controls (or storage is blocked): use the defaults.
  }
  return bindings;
}

export function saveBindings(bindings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Storage blocked: the change still works until the page is reloaded.
  }
}
