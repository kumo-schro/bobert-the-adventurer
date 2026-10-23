// Little pixel-style SVG icons for the action bar (they look the same on every computer, unlike emoji).
// Each is drawn on a 16x16 grid with chunky rectangles: [x, y, width, height, color].

const ICONS = {
  roll: [
    [5, 2, 6, 2, '#bfe6ff'],
    [3, 4, 2, 2, '#bfe6ff'],
    [11, 4, 2, 2, '#bfe6ff'],
    [2, 6, 2, 4, '#bfe6ff'],
    [12, 6, 2, 3, '#bfe6ff'],
    [3, 10, 2, 2, '#bfe6ff'],
    [5, 12, 5, 2, '#bfe6ff'],
    [10, 9, 4, 2, '#ffffff'],
    [12, 11, 2, 2, '#ffffff'],
    [6, 6, 4, 4, '#ffffff'],
  ],
  sword: [
    [11, 1, 4, 2, '#e8f1ff'],
    [10, 2, 3, 3, '#e8f1ff'],
    [8, 4, 3, 3, '#e8f1ff'],
    [6, 6, 3, 3, '#cfdcf0'],
    [3, 7, 2, 6, '#ffc93c'],
    [3, 7, 6, 2, '#ffc93c'],
    [2, 11, 3, 3, '#8a5a35'],
    [1, 13, 2, 2, '#ffc93c'],
  ],
  shield: [
    [3, 2, 10, 2, '#cfdcf0'],
    [2, 3, 12, 6, '#cfdcf0'],
    [3, 9, 10, 2, '#cfdcf0'],
    [4, 11, 8, 2, '#cfdcf0'],
    [6, 13, 4, 2, '#cfdcf0'],
    [4, 4, 8, 6, '#3f8cff'],
    [5, 10, 6, 2, '#3f8cff'],
    [7, 4, 2, 9, '#ffc93c'],
    [4, 6, 8, 2, '#ffc93c'],
  ],
  bow: [
    [9, 1, 3, 2, '#c58b52'],
    [11, 3, 2, 3, '#c58b52'],
    [12, 6, 2, 4, '#c58b52'],
    [11, 10, 2, 3, '#c58b52'],
    [9, 13, 3, 2, '#c58b52'],
    [8, 2, 1, 12, '#ffffff'],
    [2, 7, 10, 2, '#e8f1ff'],
    [1, 6, 2, 4, '#ff6b6b'],
    [11, 6, 2, 1, '#cfdcf0'],
    [11, 9, 2, 1, '#cfdcf0'],
  ],
  burst: [
    [7, 1, 2, 14, '#ffe66b'],
    [1, 7, 14, 2, '#ffe66b'],
    [5, 5, 6, 6, '#ffe66b'],
    [3, 3, 2, 2, '#c8a8ff'],
    [11, 3, 2, 2, '#c8a8ff'],
    [3, 11, 2, 2, '#c8a8ff'],
    [11, 11, 2, 2, '#c8a8ff'],
    [7, 7, 2, 2, '#ffffff'],
  ],
  apple: [
    [7, 1, 2, 3, '#8a5a35'],
    [9, 2, 3, 2, '#35c27a'],
    [4, 4, 8, 2, '#ff4d6d'],
    [3, 5, 10, 7, '#ff4d6d'],
    [4, 12, 8, 2, '#ff4d6d'],
    [5, 6, 2, 2, '#ffb3c1'],
    [6, 14, 4, 1, '#c9203f'],
  ],
  bread: [
    [3, 5, 10, 2, '#e0a35a'],
    [2, 6, 12, 7, '#e0a35a'],
    [3, 13, 10, 1, '#b5793a'],
    [4, 4, 8, 2, '#f2c27f'],
    [5, 7, 1, 3, '#b5793a'],
    [8, 7, 1, 3, '#b5793a'],
    [11, 7, 1, 3, '#b5793a'],
  ],
  pie: [
    [2, 7, 12, 2, '#f2c27f'],
    [1, 9, 14, 4, '#e0a35a'],
    [3, 5, 10, 2, '#f2c27f'],
    [4, 6, 2, 1, '#7b4dff'],
    [8, 6, 2, 1, '#7b4dff'],
    [6, 8, 2, 1, '#7b4dff'],
    [10, 8, 2, 1, '#7b4dff'],
    [2, 13, 12, 1, '#b5793a'],
  ],
};

/** An action bar icon as an SVG string. */
export function icon(name) {
  const rects = ICONS[name] ?? ICONS.sword;
  return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('')}</svg>`;
}
