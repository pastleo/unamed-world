class Array2D {
  data: number[];
  width: number;
  height: number;
  constructor(width: number, height?: number, dataOrGenData?: number[] | GenData) {
    this.width = width;
    this.height = height ?? this.width;

    if (typeof dataOrGenData === 'function') {
      this.data = Array(this.height).fill(null).flatMap((_, j) => (
        Array(this.width).fill(null).map((_, i) => (
          dataOrGenData(i, j)
        ))
      ));
    } else if (Array.isArray(dataOrGenData)) {
      this.data = dataOrGenData;
    } else {
      this.data = Array(this.width * this.height);
    }
  }

  get(i: number, j: number): number {
    return this.data[this.index(i, j)];
  }

  set(i: number, j: number, value: number) {
    this.data[this.index(i, j)] = value;
  }

  // TODO: data <-> canvas to support editing feature more easily
  // OffscreenCanvas is not yet widely supported: https://caniuse.com/offscreencanvas
  getCanvas() {}

  private index(i: number, j: number): number {
    return j * this.width + i;
  }
}

export default Array2D;

type GenData = (i: number, j: number) => number
