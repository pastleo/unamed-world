import * as ss from 'superstruct';

class RowCol<T> {
  readonly array: T[] = [];
  startI: number = 0;

  constructor(fillData?: (i: number) => T, left: number = 0, right: number = 0) {
    if (typeof fillData === 'function') {
      this.array = Array(right - left + 1).fill(null).map((_, i) => fillData(left + i));
      this.startI = left;
    }
  }

  put(i: number, data: T) {
    if (i < this.startI) {
      this.array.splice(0, 0, data, ...Array(this.startI - i - 1).fill(null));
      this.startI = i;
    } else if (i > this.startI + this.array.length - 1) {
      this.array.push(...Array(i - this.startI - this.array.length).fill(null), data);
    } else {
      this.array[this.arrayIndex(i)] = data;
    }
  }

  get(i: number): T {
    return this.array[this.arrayIndex(i)];
  }

  private arrayIndex(i: number) {
    return i - this.startI;
  }
}

class Map2D<T> {
  private map: RowCol<RowCol<T>> = new RowCol();

  constructor(fillData?: (i: number, j: number) => T, top: number = 0, bottom: number = 0, left: number = 0, right: number = 0) {
    if (typeof fillData === 'function') {
      this.map = new RowCol(j => {
        return new RowCol(i => fillData(i, j), left, right)
      }, top, bottom);
    }
  }

  static fromEntries<T>(entries: [[number, number], T][]): Map2D<T> {
    const map2d = new Map2D<T>();
    entries.forEach(([[i, j], data]) => {
      map2d.put(i, j, data);
    });

    return map2d;
  }

  put(i: number, j: number, data: T): void {
    let row = this.map.get(j);
    if (!row) {
      row = new RowCol();
      this.map.put(j, row);
    }
    row.put(i, data);
  }

  get(i: number, j: number): T {
    const row = this.map.get(j);
    if (!row) return null;
    return row.get(i);
  }

  entries(): [[number, number], T][] {
    return this.map.array.flatMap((row, j) => {
      return !row ? [] : row.array.flatMap((data, i) => {
        return !data ? [] : [[
          [row.startI + i, this.map.startI + j] as [number, number],
          data
        ]];
      })
    });
  }
}

export function map2DEntriesType<T>(t: ss.Struct<T>) {
  return ss.array(
    ss.tuple([ss.tuple([ss.number(), ss.number()]), t])
  );
}
export type Map2DEntries<T> = [[number, number], T][] & ss.Infer<ReturnType<typeof map2DEntriesType>>;

export default Map2D;
