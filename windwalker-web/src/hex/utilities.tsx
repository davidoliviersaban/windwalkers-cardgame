
const sqrt3 = Math.sqrt(3);

function pixelToHex(x: number, y: number, hexSize: number): { q: number; r: number; } {
    const q = (2/3 * x) / hexSize;
    const r = (-1/3 * x + sqrt3/3 * y) / hexSize;
    return { q, r };
}

function hexPoints(hexSize: number, offsetX = 0, offsetY = 0): string {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (60 * i) * Math.PI / 180;
        return `${hexSize * Math.cos(angle) + offsetX},${hexSize * Math.sin(angle) + offsetY}`;
    }).join(' ');
}

function hexToPixel(q: number, r: number, hexSize: number): { x: number; y: number; } {
    const x = hexSize * (3/2 * q);
    const y = hexSize * (sqrt3/2 * q + sqrt3 * r);
    return { x, y };
}

function computeViewport(hexagons: {q:number,r: number}[], hexSize: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  hexagons.forEach(({ q, r }) => {
    const { x, y } = hexToPixel(q, r, hexSize);
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;

    minX = Math.min(minX, x - hexWidth / 2);
    minY = Math.min(minY, y - hexHeight / 2);
    maxX = Math.max(maxX, x + hexWidth / 2);
    maxY = Math.max(maxY, y + hexHeight / 2);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  return { x: minX, y: minY, width, height };
}

export { hexToPixel, computeViewport, hexPoints, pixelToHex };