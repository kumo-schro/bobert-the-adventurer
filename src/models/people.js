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

  gardener: {
    colors: { skin: '#f0c8a0', shirt: '#ffd23f', pants: '#2fa36b', shoes: '#4a2f1a', hair: '#c0392b' },
    decorate({ head, root }) {
      part(head, [0.9, 0.06, 0.9], '#f2d16b', [0, 0.68, 0]); // sun hat
      part(head, [0.12, 0.12, 0.12], '#ff4d6d', [0.3, 0.74, 0.2]); // flower on the hat
      part(root, [0.6, 0.55, 0.05], '#7ddc55', [0, 1.0, 0.2]); // gardening apron
    },
  },

  fisher: {
    colors: { skin: '#c68642', shirt: '#2f6fd6', pants: '#f2c14e', shoes: '#2b2b2b', hair: '#1d1d1d' },
    decorate({ head, root }) {
      part(head, [0.7, 0.16, 0.7], '#ffd23f', [0, 0.66, 0]); // rain hat
      part(head, [0.8, 0.06, 0.8], '#ffd23f', [0, 0.58, -0.05]);
      part(root, [0.06, 1.6, 0.06], '#8a5a35', [0.45, 1.3, -0.2]).rotation.z = -0.3; // fishing rod
    },
  },

  grandma: {
    colors: { skin: '#ffd5b0', shirt: '#7a4fd1', pants: '#3b2a5a', shoes: '#3b2a5a', hair: '#e6e6e6' },
    decorate({ head, root }) {
      part(head, [0.66, 0.26, 0.66], '#e6e6e6', [0, 0.62, 0]); // curly white hair
      part(head, [0.16, 0.06, 0.02], '#ffc93c', [-0.13, 0.33, 0.31]); // gold glasses
      part(head, [0.16, 0.06, 0.02], '#ffc93c', [0.13, 0.33, 0.31]);
      part(root, [0.72, 0.4, 0.42], '#ff8fab', [0, 0.6, 0]); // skirt
    },
  },

  // Tulane Kingdom: King Stuart, his son the prince, the herald and the soldiers.
  king: {
    colors: { skin: '#f0c8a0', shirt: '#8a1f3a', pants: '#3b2a5a', shoes: '#2b2b2b', hair: '#8a5a2b' },
    decorate({ head, root }) {
      part(head, [0.66, 0.16, 0.66], '#ffcf3f', [0, 0.66, 0]); // crown
      for (const [x, z] of [[-0.25, 0.25], [0.25, 0.25], [0, 0.3], [-0.25, -0.25], [0.25, -0.25]]) part(head, [0.12, 0.2, 0.08], '#ffcf3f', [x, 0.82, z]);
      part(head, [0.1, 0.1, 0.04], '#d9293f', [0, 0.68, 0.34]); // a ruby
      part(head, [0.5, 0.3, 0.1], '#8a5a2b', [0, 0.06, 0.33]); // a big beard
      part(root, [0.7, 1.3, 0.12], '#c0392b', [0, 0.85, -0.25]); // royal cape
      part(root, [0.72, 0.16, 0.42], '#f2f2f2', [0, 1.45, 0]); // fur collar
    },
  },
  prince: {
    colors: { skin: '#f0c8a0', shirt: '#2f5fb8', pants: '#f2f2f2', shoes: '#5e3b22', hair: '#e0a030' },
    decorate({ head, root }) {
      part(head, [0.6, 0.12, 0.6], '#ffcf3f', [0, 0.64, 0]); // little crown
      part(root, [0.66, 1.0, 0.1], '#ffcf3f', [0, 1.0, -0.24]); // short golden cape
    },
  },
  soldier: {
    colors: { skin: '#e0ac69', shirt: '#2f5fb8', pants: '#4a4a4a', shoes: '#2b2b2b', hair: '#3b2a1a' },
    decorate({ head, root, handR }) {
      part(head, [0.66, 0.34, 0.66], '#b0b6bd', [0, 0.62, 0]); // steel helmet
      part(head, [0.1, 0.3, 0.1], '#c0392b', [0, 0.9, 0]); // plume
      part(root, [0.64, 0.5, 0.38], '#ffcf3f', [0, 1.15, 0.02]); // gold Tulane crest on the tabard
      part(root, [0.6, 0.46, 0.4], '#2f5fb8', [0, 1.15, 0.03]);
      part(handR, [0.08, 2.2, 0.08], '#8a5a35', [0, 0.5, 0.1]); // spear
      part(handR, [0.16, 0.3, 0.06], '#d9dde3', [0, 1.7, 0.1]);
    },
  },
  herald: {
    colors: { skin: '#f0c8a0', shirt: '#2f5fb8', pants: '#ffcf3f', shoes: '#2b2b2b', hair: '#5a3a1a' },
    decorate({ head, handR }) {
      part(head, [0.7, 0.14, 0.7], '#2f5fb8', [0, 0.64, 0]); // feathered hat
      part(head, [0.08, 0.5, 0.16], '#ffffff', [0.25, 0.85, -0.1]);
      part(handR, [0.1, 0.1, 0.9], '#ffcf3f', [0, 0, 0.4]); // a trumpet
      part(handR, [0.26, 0.26, 0.1], '#ffcf3f', [0, 0, 0.85]);
    },
  },

  // Master Zach, who taught Master Oak and Master Jackson: a long white beard, a robe and a staff.
  zach: {
    colors: { skin: '#e8c29a', shirt: '#3b5f9e', pants: '#2b3a55', shoes: '#5e3b22', hair: '#f2f2f2' },
    decorate({ head, root, handR }) {
      part(head, [0.5, 0.42, 0.12], '#f2f2f2', [0, 0.02, 0.33]); // long white beard
      part(head, [0.3, 0.3, 0.1], '#f2f2f2', [0, -0.3, 0.33]);
      part(head, [0.66, 0.1, 0.66], '#ffd23f', [0, 0.5, 0]); // golden headband
      part(root, [0.7, 0.75, 0.42], '#3b5f9e', [0, 0.5, 0]); // the robe reaches down to his feet
      part(root, [0.72, 0.12, 0.44], '#ffd23f', [0, 0.86, 0]); // gold sash
      part(handR, [0.1, 1.8, 0.1], '#8a5a35', [0, 0.35, 0.1]); // tall staff
    },
  },

  // Ollie, who looks after the save stones: a kid in a big blue cap and a crystal on a string.
  ollie: {
    colors: { skin: '#f0c8a0', shirt: '#2fb5a8', pants: '#2b3a55', shoes: '#e23b4a', hair: '#e0a030' },
    decorate({ head, root }) {
      part(head, [0.66, 0.14, 0.66], '#3f7fd9', [0, 0.66, 0]); // cap
      part(head, [0.5, 0.06, 0.3], '#3f7fd9', [0, 0.6, 0.42]); // its peak
      part(root, [0.12, 0.16, 0.06], '#7af0ff', [0, 1.25, 0.2], { emissive: '#3fd0ff' }); // a little crystal on a string
    },
  },

  // Ani, who studies the volcano on the fire island: a heat-proof coat and big goggles.
  ember: {
    colors: { skin: '#e0ac69', shirt: '#d9732f', pants: '#4a3a28', shoes: '#2b2b2b', hair: '#ff6a1f' },
    decorate({ head, root }) {
      part(head, [0.66, 0.12, 0.66], '#4a3a28', [0, 0.45, 0]); // goggle strap
      part(head, [0.18, 0.16, 0.06], '#7af0ff', [-0.14, 0.45, 0.33]); // goggles
      part(head, [0.18, 0.16, 0.06], '#7af0ff', [0.14, 0.45, 0.33]);
      part(root, [0.66, 0.5, 0.4], '#c9c2b8', [0, 0.7, 0]); // long heat-proof coat
    },
  },

  jackson: {
    colors: { skin: '#a8714a', shirt: '#ff8a1f', pants: '#2b2b4a', shoes: '#2b2b2b', hair: '#1d1d1d' },
    decorate({ head, root, handR }) {
      part(head, [0.66, 0.12, 0.66], '#d9293f', [0, 0.5, 0]); // red headband
      part(head, [0.12, 0.3, 0.06], '#d9293f', [0.2, 0.42, -0.34]); // headband tails
      part(head, [0.12, 0.24, 0.06], '#d9293f', [0.32, 0.38, -0.34]);
      part(head, [0.4, 0.07, 0.06], '#1d1d1d', [0, 0.17, 0.33]); // big mustache
      part(head, [0.08, 0.2, 0.06], '#1d1d1d', [-0.2, 0.08, 0.33]);
      part(head, [0.08, 0.2, 0.06], '#1d1d1d', [0.2, 0.08, 0.33]);
      part(root, [0.66, 0.14, 0.4], '#1d1d1d', [0, 0.8, 0]); // black belt
      part(root, [0.14, 0.4, 0.06], '#1d1d1d', [0.18, 0.6, 0.21]); // belt ends
      part(handR, [0.1, 1.4, 0.1], '#c58b52', [0, 0.1, 0.1]); // wooden practice sword
      part(handR, [0.3, 0.08, 0.14], '#5e3b22', [0, -0.3, 0.1]);
    },
  },

  guard: {
    colors: { skin: '#e0ac69', shirt: '#d9293f', pants: '#2b3a55', shoes: '#2b2b2b', hair: '#5a3a1a' },
    decorate({ head, root }) {
      part(head, [0.66, 0.22, 0.66], '#b9c2cc', [0, 0.66, 0]); // helmet
      part(head, [0.1, 0.24, 0.1], '#d9293f', [0, 0.86, 0]); // plume
      part(root, [0.08, 2.0, 0.08], '#8a5a35', [-0.45, 1.0, 0.2]); // spear
      part(root, [0.16, 0.3, 0.06], '#b9c2cc', [-0.45, 2.1, 0.2]);
    },
  },

  painter: {
    colors: { skin: '#8d5524', shirt: '#ffffff', pants: '#5a4632', shoes: '#2b2b2b', hair: '#ff8a3d' },
    decorate({ head, root }) {
      part(head, [0.66, 0.12, 0.66], '#d9293f', [0, 0.66, 0]); // beret
      part(head, [0.2, 0.08, 0.2], '#d9293f', [0.1, 0.74, 0]);
      for (const [x, y, c] of [[-0.15, 1.2, '#3f8cff'], [0.12, 1.0, '#ffd23f'], [0.0, 0.9, '#ff4d6d']]) part(root, [0.12, 0.12, 0.04], c, [x, y, 0.2]); // paint splats
    },
  },

  oak: {
    colors: { skin: '#c99a6b', shirt: '#5a7a32', pants: '#4a3a28', shoes: '#3b2a1a', hair: '#3fae3a' },
    decorate(model) {
      const { head, root, handR } = model;
      part(head, [0.56, 0.45, 0.1], '#3fae3a', [0, 0.02, 0.33]); // leafy beard
      part(head, [0.36, 0.3, 0.1], '#2e8b3a', [0, -0.3, 0.33]);
      for (const x of [-0.3, 0, 0.3]) part(head, [0.16, 0.2, 0.16], '#ffd23f', [x, 0.72, 0.1]); // crown of little flowers
      part(root, [0.72, 1.1, 0.42], '#4a6a2a', [0, 0.95, 0]); // mossy robe
      part(handR, [0.1, 2, 0.1], '#6b4a2b', [0, 0.3, 0.1]); // wooden staff
      model.staffGlow = part(handR, [0.26, 0.26, 0.26], '#7dff6b', [0, 1.35, 0.1], { emissive: '#7dff6b' });
    },
  },

  dreamKeeper: {
    colors: { skin: '#e8dcff', shirt: '#5b3f9e', pants: '#3b2a6e', shoes: '#2a1a4a', hair: '#ffffff' },
    decorate({ head, root }) {
      part(root, [0.74, 1.3, 0.44], '#6b4fc0', [0, 0.85, 0]); // long starry robe
      for (const [x, y] of [[-0.2, 1.2], [0.15, 0.7], [0.25, 1.4], [-0.1, 0.4]]) {
        part(root, [0.08, 0.08, 0.04], '#ffe66b', [x, y, 0.23], { emissive: '#ffe66b' }); // stars on the robe
      }
      part(head, [0.7, 0.12, 0.7], '#5b3f9e', [0, 0.64, 0]); // wizard hat
      part(head, [0.5, 0.4, 0.5], '#5b3f9e', [0, 0.9, 0]);
      part(head, [0.28, 0.4, 0.28], '#5b3f9e', [0, 1.25, 0]);
      part(head, [0.14, 0.14, 0.14], '#ffe66b', [0, 1.5, 0], { emissive: '#ffe66b' });
    },
  },

  sprite: {
    colors: { skin: '#fff3c8', shirt: '#ffe66b', pants: '#ffb3e6', shoes: '#ffffff', hair: '#ff8fe0' },
    decorate({ head, root }) {
      for (const s of [-1, 1]) {
        const wing = part(root, [0.06, 0.8, 0.6], '#e8fbff', [s * 0.35, 1.3, -0.3]); // fairy wings
        wing.rotation.y = s * 0.6;
        wing.material.transparent = true;
        wing.material.opacity = 0.7;
      }
      part(head, [0.14, 0.14, 0.14], '#ffffff', [0, 0.8, 0], { emissive: '#ffffff' }); // glowing tuft
    },
  },
};
