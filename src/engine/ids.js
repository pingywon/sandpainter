/**
 * Element ids and the per-element property tables that behaviours read.
 * The tables are filled by elements.js at startup; keeping them here avoids
 * an import cycle between behaviors.js and elements.js.
 */
export const EMPTY = 0;
export const WALL = 1;
export const SAND = 2;
export const WATER = 3;
export const SALT = 4;
export const SALT_WATER = 5;
export const OIL = 6;
export const PLANT = 7;
export const FIRE = 8;
export const STEAM = 9;
export const SPOUT = 10;
export const WELL = 11;
export const TORCH = 12;
export const GUNPOWDER = 13;
export const WAX = 14;
export const MOLTEN_WAX = 15;
export const NITRO = 16;
export const NAPALM = 17;
export const C4 = 18;
export const CONCRETE = 19;
export const SET_CONCRETE = 20;
export const FUSE = 21;
export const ICE = 22;
export const LAVA = 23;
export const ROCK = 24;
export const CRYO = 25;
export const METHANE = 26;
export const SOIL = 27;
export const WET_SOIL = 28;
export const SNOW = 29;
export const SEED = 30;
export const STEM = 31;
export const BLOOM_A = 32;
export const BLOOM_B = 33;
export const BLOOM_C = 34;
export const BLOOM_D = 35;
export const BLOOM_E = 36;
export const ACID = 37;
export const CLONE = 38;
export const EMBER = 39;
/** Brush-only meta element: paints a random element per cell. Never stored in the grid. */
export const RANDOM = 250;

export const BLOOMS = [BLOOM_A, BLOOM_B, BLOOM_C, BLOOM_D, BLOOM_E];

/* Flag bits */
export const F_POWDER = 1;
export const F_LIQUID = 2;
export const F_GAS = 4;
export const F_STATIC = 8;
export const F_HOT = 16;
export const F_FUEL = 32;      // keeps adjacent fire alive
export const F_INDESTRUCTIBLE = 64; // acid / explosions cannot remove it

export const FLAGS = new Uint8Array(256);
export const DENSITY = new Float32Array(256);
/** Percent chance per step that the element ignites when touching something hot. */
export const IGNITE = new Uint8Array(256);

export function isPowder(id) { return (FLAGS[id] & F_POWDER) !== 0; }
export function isLiquid(id) { return (FLAGS[id] & F_LIQUID) !== 0; }
export function isGas(id) { return (FLAGS[id] & F_GAS) !== 0; }
export function isHot(id) { return (FLAGS[id] & F_HOT) !== 0; }
export function isFuel(id) { return (FLAGS[id] & F_FUEL) !== 0; }
export function isFluid(id) { return (FLAGS[id] & (F_LIQUID | F_GAS)) !== 0; }
export function isIndestructible(id) { return (FLAGS[id] & F_INDESTRUCTIBLE) !== 0; }
