import { part } from './character.js';

// Outfits for the townsfolk. Each entry is the colors for createCharacter() plus a
// `decorate(model)` that adds hats, beards, aprons... Add new looks here.

export const LOOKS = {
  merchant: {
    colors: { skin: '#f1c27d', shirt: '#7b3fd1', pants: '#3b2a5a', shoes: '#4a2f1a', hair: '#d9d9d9' },
    decorate({ head, root }) {
      part(head, [0.9, 0.08, 0.9], '#1f6f78', [0, 0.72, 0]); // brim
      part(head, [0.56, 0.36, 0.56], '#1f6f78', [0, 0.94, 0]); // crown
      part(head, [0.58, 0.08, 0.58], '#ffc93c', [0, 0.8, 0], { emissive: '#ffc93c' }); // band
      part(head, [0.5, 0.3, 0.08], '#e8e8e8', [0, 0.08, 0.33]); // beard
      part(head, [0.3, 0.12, 0.08], '#e8e8e8', [0, -0.12, 0.33]);
      part(head, [0.3, 0.06, 0.04], '#e8e8e8', [0, 0.2, 0.34]); // mustache
      part(root, [0.56, 0.7, 0.3], '#8a5a35', [0, 1.1, -0.34]); // backpack
      part(root, [0.64, 0.18, 0.18], '#c0392b', [0, 1.5, -0.36]); // bedroll
    },
  },

  blacksmith: {
    colors: { skin: '#d9a066', shirt: '#4a4a4a', pants: '#3b2f2a', shoes: '#2b2b2b', hair: '#2b1d14' },
    decorate({ head, root }) {
      part(root, [0.66, 0.78, 0.06], '#7a4a24', [0, 1.02, 0.2]); // leather apron
      part(head, [0.5, 0.22, 0.08], '#2b1d14', [0, 0.1, 0.33]); // short beard
      part(head, [0.66, 0.1, 0.1], '#ff7a2a', [0, 0.5, 0.3]); // headband
    },
  },

  kid: {
    colors: { skin: '#ffd5b0', shirt: '#2fb5a8', pants: '#f2c14e', shoes: '#e23b4a', hair: '#e0a030' },
    decorate({ head }) {
      part(head, [0.66, 0.14, 0.66], '#e23b4a', [0, 0.66, 0]); // cap
      part(head, [0.5, 0.06, 0.3], '#e23b4a', [0, 0.6, 0.42]); // cap brim
    },
  },

  farmer: {
    colors: { skin: '#e0ac69', shirt: '#4c8ed9', pants: '#6b5a3a', shoes: '#4a2f1a', hair: '#8a5a2b' },
    decorate({ head, root }) {
      part(head, [1.0, 0.06, 1.0], '#f2d16b', [0, 0.68, 0]); // straw hat brim
      part(head, [0.58, 0.28, 0.58], '#e8c35a', [0, 0.84, 0]);
      part(head, [0.6, 0.06, 0.6], '#d9493f', [0, 0.74, 0]); // ribbon
      part(root, [0.08, 0.7, 0.04], '#6b5a3a', [-0.2, 1.1, 0.19]); // overall straps
      part(root, [0.08, 0.7, 0.04], '#6b5a3a', [0.2, 1.1, 0.19]);
    },
  },

  elder: {
    colors: { skin: '#f0c8a0', shirt: '#d94f9a', pants: '#7a4fd1', shoes: '#3b2a5a', hair: '#e6e6e6' },
    decorate({ head, root }) {
      part(head, [0.34, 0.3, 0.3], '#e6e6e6', [0, 0.72, -0.2]); // hair bun
      part(head, [0.16, 0.06, 0.02], '#3b3b3b', [-0.13, 0.33, 0.31]); // glasses
      part(head, [0.16, 0.06, 0.02], '#3b3b3b', [0.13, 0.33, 0.31]);
      part(root, [0.72, 0.5, 0.42], '#f2a6c8', [0, 1.25, 0]); // shawl
    },
  },

  baker: {
    colors: { skin: '#c68642', shirt: '#ffffff', pants: '#4a4a4a', shoes: '#2b2b2b', hair: '#1d1d1d' },
    decorate({ head, root }) {
      part(head, [0.6, 0.4, 0.6], '#ffffff', [0, 0.8, 0]); // chef hat
      part(head, [0.7, 0.2, 0.7], '#ffffff', [0, 1.05, 0]);
      part(root, [0.6, 0.6, 0.05], '#ffe0b2', [0, 1.0, 0.2]); // apron
    },
  },

  sailor: {
    colors: { skin: '#e0ac69', shirt: '#ffffff', pants: '#2b3a8f', shoes: '#2b2b2b', hair: '#e6e6e6' },
    decorate({ head, root }) {
      for (const y of [0.85, 1.05, 1.25]) part(root, [0.64, 0.08, 0.38], '#2f6fd6', [0, y, 0]); // striped shirt
      part(head, [0.66, 0.2, 0.66], '#2b3a55', [0, 0.68, 0]); // captain's hat
      part(head, [0.7, 0.06, 0.4], '#1d1d1d', [0, 0.6, 0.2]); // hat brim
      part(head, [0.16, 0.12, 0.04], '#ffc93c', [0, 0.72, 0.34], { emissive: '#ffc93c' }); // anchor badge
      part(head, [0.56, 0.32, 0.08], '#e6e6e6', [0, 0.06, 0.33]); // bushy beard
      part(head, [0.12, 0.12, 0.04], '#1d1d1d', [0.13, 0.33, 0.31]); // eye patch
      part(head, [0.6, 0.03, 0.02], '#1d1d1d', [0, 0.42, 0.31]);
    },
  },

  villager: {
    colors: { skin: '#8d5524', shirt: '#7ddc55', pants: '#5a4632', shoes: '#3b2a1a', hair: '#1d1d1d' },
    decorate({ head, root }) {
      part(head, [0.7, 0.14, 0.7], '#e0a030', [0, 0.66, 0]); // flat cap
      part(root, [0.66, 0.12, 0.38], '#c0392b', [0, 1.35, 0]); // scarf
    },
  },

  oldMan: {
    colors: { skin: '#e8b98a', shirt: '#6b5a3a', pants: '#4a3a28', shoes: '#2b1d14', hair: '#f2f2f2' },
    decorate({ head, root }) {
      part(head, [0.56, 0.5, 0.1], '#f2f2f2', [0, -0.02, 0.33]); // long white beard
      part(head, [0.4, 0.3, 0.1], '#f2f2f2', [0, -0.35, 0.33]);
      part(head, [0.2, 0.25, 0.1], '#f2f2f2', [0, -0.6, 0.33]);
      part(head, [0.5, 0.06, 0.05], '#f2f2f2', [0, 0.45, 0.32]); // bushy eyebrows
      part(head, [0.6, 0.12, 0.6], '#e8b98a', [0, 0.64, 0]); // bald on top
      part(root, [0.7, 1.1, 0.42], '#4a6b8a', [0, 0.95, 0]); // long sea-blue robe
      part(root, [0.08, 1.4, 0.08], '#8a5a35', [-0.5, 0.7, 0.25]); // walking stick
    },
  },
};
