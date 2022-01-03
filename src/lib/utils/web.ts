export function parseUrlHash(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const paramPairs = window.location.hash.substring(1).split('&').map((p: string) => {
    const pairs = p.match(/([^=]+)?=(.*)/);
    return pairs ? pairs.slice(1, 3) : ['', p];
  });

  return Object.fromEntries(paramPairs);
}
export function setUrlHash(values: Record<string, string>) {
  const currentParams = parseUrlHash();
  const paramStr = Object.entries({
    ...currentParams,
    ...values,
  }).map(([k, v]) => (k ? [k, v].join('=') : v)).join('&');
  window.location.hash = `#${paramStr}`;
}

export function createJsonBlob(json: any): Blob {
  return new Blob(
    [JSON.stringify(json)],
    { type: 'application/json' },
  );
}

export function downloadJson(json: any, filename: string) {
  const blob = createJsonBlob(json);

  const aTag = document.createElement('a');
  aTag.href = URL.createObjectURL(blob);
  aTag.download = filename;
  document.body.appendChild(aTag);
  aTag.click();
  document.body.removeChild(aTag);
}
export function openJson(): Promise<any> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file && file.type === 'application/json') {
        file.text().then(json => {
          resolve(
            JSON.parse(json)
          );
        });
      }
    });

    input.click();
  });
}

export function createCanvas2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return ctx;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = src;
  });
}

// @ts-ignore
export const supportOffscreenCanvas = typeof OffscreenCanvas === 'function';

interface OffscreenCanvasConvertToBlobOptions {
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
}
export interface OffscreenCanvas extends HTMLCanvasElement {
  convertToBlob: (options?: OffscreenCanvasConvertToBlobOptions) => Promise<Blob>;
  transferControlToOffscreen: () => OffscreenCanvas;
}

export function makeOffscreenCanvas(oriCanvas: HTMLCanvasElement) {
  const canvas = oriCanvas as OffscreenCanvas;
  if (!canvas.convertToBlob) {
    canvas.convertToBlob = ({ type, quality } = {}) => new Promise(resolve => {
      canvas.toBlob(resolve, type, quality)
    });
  }

  return canvas;
}

/**
 * convert blob to base64-encoded data with preceding data url declaration
 */
export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    }
    reader.readAsDataURL(blob);
  });
}
