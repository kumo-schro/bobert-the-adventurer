// Bobert's sword moves, as keyframes. Swinging again quickly chains them into a combo:
// forehand slash -> backhand slash -> overhead finisher (which slams the ground).
//
// Each keyframe sets some of these (anything left out stays at its resting value):
//   armRx, armRy   sword arm: x lifts it forward/up (negative = up), y swings it sideways
//                  (negative = out to the right, positive = across to the left)
//   armLx, armLy   the other arm, for balance
//   twist          turn the whole body (negative = toward the right)
//   lean           lean forward (positive) or back
//   lunge          step forward (blocks)
//   drop           crouch down (negative)
//   blade          how the sword sits in the hand: 0 = resting, 1 = held straight out along the arm
// `ease` is how the move gets INTO that keyframe: 'out' starts fast, 'in' starts slow,
// 'snap' is a very fast whip (for the actual strike), 'smooth' eases both ends.
// `strike` is the part of the move (0..1) that can hit things.

export const MOVES = [
  {
    name: 'forehand slash',
    duration: 0.5,
    strike: [0.3, 0.68],
    keys: [
      { t: 0 },
      { t: 0.28, ease: 'out', armRx: -1.5, armRy: -1.9, armLx: -0.6, armLy: 0.5, twist: -0.55, lean: -0.05, lunge: -0.05, blade: 1 },
      { t: 0.55, ease: 'snap', armRx: -1.3, armRy: 1.5, armLx: 0.3, armLy: -0.3, twist: 0.6, lean: 0.22, lunge: 0.35, drop: -0.06, blade: 1 },
      { t: 1, ease: 'smooth' },
    ],
  },
  {
    name: 'backhand slash',
    duration: 0.5,
    strike: [0.3, 0.68],
    keys: [
      { t: 0 },
      { t: 0.28, ease: 'out', armRx: -1.55, armRy: 1.35, armLx: 0.2, twist: 0.55, lean: -0.05, blade: 1 },
      { t: 0.55, ease: 'snap', armRx: -1.35, armRy: -1.8, armLx: -0.7, armLy: 0.6, twist: -0.65, lean: 0.22, lunge: 0.35, drop: -0.06, blade: 1 },
      { t: 1, ease: 'smooth' },
    ],
  },
  {
    name: 'overhead finisher',
    duration: 0.55,
    strike: [0.4, 0.72],
    slam: 0.55, // when the sword hits the ground: dust and a bigger shake
    keys: [
      { t: 0 },
      { t: 0.32, ease: 'out', armRx: -3.05, armRy: -0.15, armLx: -2.6, armLy: 0.3, twist: -0.15, lean: -0.18, drop: 0.05, blade: 1 },
      { t: 0.55, ease: 'snap', armRx: 0.15, armRy: 0, armLx: -0.2, twist: 0.05, lean: 0.38, lunge: 0.5, drop: -0.18, blade: 1 },
      { t: 0.75, ease: 'smooth', armRx: 0.05, lean: 0.3, lunge: 0.45, drop: -0.15, blade: 1 },
      { t: 1, ease: 'smooth' },
    ],
  },
];

export const POSE_KEYS = ['armRx', 'armRy', 'armLx', 'armLy', 'twist', 'lean', 'lunge', 'drop', 'blade'];

const EASES = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  smooth: (u) => u * u * (3 - 2 * u),
  snap: (u) => 1 - (1 - u) ** 4,
};

/** The pose (all POSE_KEYS) of `move` at time t (0..1). */
export function poseAt(move, t, out = {}) {
  const keys = move.keys;
  let i = 1;
  while (i < keys.length - 1 && keys[i].t < t) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const u = EASES[b.ease ?? 'smooth'](Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1))));
  for (const k of POSE_KEYS) out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * u;
  return out;
}
