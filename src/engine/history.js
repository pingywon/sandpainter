/** Undo stack of world snapshots. */
export class History {
  constructor(cap = 10) {
    this.cap = cap;
    this.stack = [];
    this.listeners = new Set();
  }

  push(world) {
    this.stack.push(world.snapshot());
    if (this.stack.length > this.cap) this.stack.shift();
    this.notify();
  }

  pop(world) {
    const snap = this.stack.pop();
    if (!snap) return false;
    world.restore(snap);
    this.notify();
    return true;
  }

  get canUndo() { return this.stack.length > 0; }

  onChange(fn) { this.listeners.add(fn); }
  notify() { for (const fn of this.listeners) fn(this.canUndo); }
}
