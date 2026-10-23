/**
 * Colliders live in game.colliders and come in three flavors:
 *   circle: { x, z, radius }              e.g. tree trunks, characters
 *   box:    { x, z, halfX, halfZ }         axis-aligned, e.g. houses
 *   grid:   { isSolid(ix, iz) }            1x1 cells, e.g. the mountain around the cave
 *
 * pushOut() moves a circle at `pos` (radius `radius`) so it no longer overlaps any of them.
 */
export function pushOut(pos, radius, colliders, ignore = null) {
  const skip = typeof ignore === 'function' ? ignore : (c) => c === ignore;
  for (const c of colliders) {
    if (skip(c)) continue;
    if (c.isSolid) pushOutOfGrid(pos, radius, c);
    else if (c.halfX !== undefined) pushOutOfBox(pos, radius, c);
    else pushOutOfCircle(pos, radius, c);
  }
}

function pushOutOfCircle(pos, radius, c) {
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  const min = c.radius + radius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= min * min || distSq === 0) return;
  const dist = Math.sqrt(distSq);
  pos.x = c.x + (dx / dist) * min;
  pos.z = c.z + (dz / dist) * min;
}

function pushOutOfBox(pos, radius, c) {
  const nearestX = Math.max(c.x - c.halfX, Math.min(pos.x, c.x + c.halfX));
  const nearestZ = Math.max(c.z - c.halfZ, Math.min(pos.z, c.z + c.halfZ));
  const dx = pos.x - nearestX;
  const dz = pos.z - nearestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq > 0) {
    if (distSq >= radius * radius) return;
    const dist = Math.sqrt(distSq);
    pos.x = nearestX + (dx / dist) * radius;
    pos.z = nearestZ + (dz / dist) * radius;
    return;
  }

  // Center is inside the box: leave by the closest side.
  const overlapX = c.halfX - Math.abs(pos.x - c.x);
  const overlapZ = c.halfZ - Math.abs(pos.z - c.z);
  if (overlapX < overlapZ) pos.x = c.x + Math.sign(pos.x - c.x || 1) * (c.halfX + radius);
  else pos.z = c.z + Math.sign(pos.z - c.z || 1) * (c.halfZ + radius);
}

const cellBox = { x: 0, z: 0, halfX: 0.5, halfZ: 0.5 };

function pushOutOfGrid(pos, radius, grid) {
  const reach = Math.ceil(radius) + 1;
  const cx = Math.floor(pos.x);
  const cz = Math.floor(pos.z);
  for (let ix = cx - reach; ix <= cx + reach; ix++) {
    for (let iz = cz - reach; iz <= cz + reach; iz++) {
      if (!grid.isSolid(ix, iz)) continue;
      cellBox.x = ix + 0.5;
      cellBox.z = iz + 0.5;
      pushOutOfBox(pos, radius, cellBox);
    }
  }
}

/** The first collider that the point (x, z) is inside, or null. Used for arrows. */
export function colliderAt(x, z, colliders, skip = null) {
  for (const c of colliders) {
    if (skip?.(c)) continue;
    if (c.isSolid) {
      if (c.isSolid(Math.floor(x), Math.floor(z))) return c;
    } else if (c.halfX !== undefined) {
      if (Math.abs(x - c.x) < c.halfX && Math.abs(z - c.z) < c.halfZ) return c;
    } else if (Math.hypot(x - c.x, z - c.z) < c.radius) {
      return c;
    }
  }
  return null;
}
