import { Vec2 } from './utils';

class SetVec2 {
  private sets: Map<number, Set<number>>;

  constructor() {
    this.sets = new Map();
  }

  add(v: Vec2) {
    const [i, j] = v;
    let is = this.sets.get(j);
    if (!is) {
      is = new Set<number>();
      this.sets.set(j, is);
    }
    is.add(i);
  }

  has(v: Vec2) {
    const [i, j] = v;
    const is = this.sets.get(j);
    if (!is) return false;
    return is.has(i);
  }

  values(): Vec2[] {
    return [...this.sets.entries()].flatMap(
      ([j, is]) => [...is.values()].map(i => ([i, j] as Vec2))
    );
  }

  isEmpty() {
    return this.sets.size <= 0;
  }
}

export default SetVec2;
