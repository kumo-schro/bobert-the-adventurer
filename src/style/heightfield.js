import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Turns a grid of unit cells into one faceted (flat-shaded) mesh: each cell is a quad whose
 * corners are smoothed between neighbouring cells, with straight cliff sides where the shape
 * stops. Used for the cave mountains: blocky in plan, but smooth on top, not stacked cubes.
 *
 *   top(ix, iz)    -> height of the cell's top, or null where there's no cell
 *   bottom(ix, iz) -> how far down its cliff sides go
 *   blend(ix, iz)  -> optional height an empty cell pulls neighbouring corners toward (null = don't)
 *   color(y)       -> THREE.Color for a point at height y
 *   underside(ix, iz) -> optional: give the cell a downward-facing face at its bottom
 */
export function heightfieldGeometry({ minX, maxX, minZ, maxZ, top, bottom, blend = () => null, color, underside = () => false }) {
  const positions = [];
  const colors = [];
  const corner = (gx, gz) => {
    let sum = 0;
    let n = 0;
    for (const [cx, cz] of [[gx - 1, gz - 1], [gx, gz - 1], [gx - 1, gz], [gx, gz]]) {
      const h = top(cx, cz) ?? blend(cx, cz);
      if (h === null || h === undefined) continue;
      sum += h;
      n++;
    }
    return sum / n;
  };
  // Adds a quad (corners in order around its edge), turned so it faces `outward`.
  const quad = (p0, p1, p2, p3, outward) => {
    _n.crossVectors(_a.subVectors(p1, p0), _b.subVectors(p2, p0));
    const tris = _n.dot(outward) >= 0 ? [p0, p1, p2, p0, p2, p3] : [p0, p2, p1, p0, p3, p2];
    for (const p of tris) {
      positions.push(p.x, p.y, p.z);
      const c = color(p.y);
      colors.push(c.r, c.g, c.b);
    }
  };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = v(0, 1, 0);
  const DOWN = v(0, -1, 0);
  const SIDES = [
    [0, -1, v(0, 0, -1)],
    [0, 1, v(0, 0, 1)],
    [-1, 0, v(-1, 0, 0)],
    [1, 0, v(1, 0, 0)],
  ];

  for (let ix = minX; ix <= maxX; ix++) {
    for (let iz = minZ; iz <= maxZ; iz++) {
      const h = top(ix, iz);
      if (h === null || h === undefined) continue;
      const y00 = corner(ix, iz);
      const y10 = corner(ix + 1, iz);
      const y01 = corner(ix, iz + 1);
      const y11 = corner(ix + 1, iz + 1);
      const c = {
        '0,0': v(ix, y00, iz),
        '1,0': v(ix + 1, y10, iz),
        '0,1': v(ix, y01, iz + 1),
        '1,1': v(ix + 1, y11, iz + 1),
      };
      quad(c['0,0'], c['0,1'], c['1,1'], c['1,0'], UP);
      const b = bottom(ix, iz);
      for (const [dx, dz, out] of SIDES) {
        const n = top(ix + dx, iz + dz);
        if (n !== null && n !== undefined) continue;
        // The two top corners along this edge.
        const [k0, k1] = dx === 0 ? (dz < 0 ? ['0,0', '1,0'] : ['0,1', '1,1']) : dx < 0 ? ['0,0', '0,1'] : ['1,0', '1,1'];
        const t0 = c[k0];
        const t1 = c[k1];
        if (Math.max(t0.y, t1.y) - b < 0.05) continue;
        quad(t0, t1, v(t1.x, b, t1.z), v(t0.x, b, t0.z), out);
      }
      if (underside(ix, iz)) quad(v(ix, b, iz), v(ix + 1, b, iz), v(ix + 1, b, iz + 1), v(ix, b, iz + 1), DOWN);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** A color ramp by height: stops = [[height, '#color'], ...] from low to high. */
export function heightRamp(stops) {
  const colors = stops.map(([h, c]) => [h, new THREE.Color(c)]);
  const out = new THREE.Color();
  return (y) => {
    if (y <= colors[0][0]) return out.copy(colors[0][1]);
    for (let i = 1; i < colors.length; i++) {
      if (y <= colors[i][0]) {
        const [h0, c0] = colors[i - 1];
        const [h1, c1] = colors[i];
        return out.copy(c0).lerp(c1, (y - h0) / (h1 - h0));
      }
    }
    return out.copy(colors[colors.length - 1][1]);
  };
}
