import { Tile } from "~/models/Tile";
import { Assets } from "~/assets/assets";
import { computeViewport, hexToPixel } from "./utilities";

const angleStep = Math.PI / 3; // 60 degrees in radians

// Get the correct image path for a tile by looking up the asset by name
const getImagePathForTile = (tile: Tile): string => {
  // First try to find the asset by name to get the canonical image path
  const asset = Object.values(Assets).find((a) => a.name === tile.name);
  if (asset?.img) {
    return asset.img;
  }
  // Fallback to tile.img if no matching asset found
  return tile.img;
};

interface DrawHexagonOptions {
  context: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  fillStyle: string;
  image?: HTMLImageElement;
}

// Function to draw a hexagon
const drawHexagon = ({
  context,
  x,
  y,
  size,
  fillStyle,
  image,
}: DrawHexagonOptions): void => {
  context.save();

  context.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = i * angleStep;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.clip();

  context.fillStyle = fillStyle ?? "#eee";
  context.fill();

  if (image) {
    const ratio = image.width / image.height;
    context.drawImage(
      image,
      x - size * ratio,
      y - size,
      size * ratio * 2,
      size * 2,
    );
  }

  context.strokeStyle = "#999";
  context.lineWidth = 1;
  context.stroke();
  context.restore();
};

// Load an image and return it (or undefined if failed)
const loadImage = (src: string): Promise<HTMLImageElement | undefined> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.warn(`Failed to load image: ${src}`);
      resolve(undefined);
    };
    // Ensure absolute path for canvas image loading
    image.src = src.startsWith("/") ? src : `/${src}`;
  });
};

export const CanvasFromTiles = async (
  tiles: Tile[],
  hexSize: number,
  _title: string,
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Cannot get canvas context");
  }

  const boundingBox = computeViewport(tiles, hexSize);

  canvas.width = boundingBox.width;
  canvas.height = boundingBox.height + 20; // bit of padding for the title

  // Load all unique images first (using asset lookup for correct paths)
  const tileImagePaths = tiles
    .map((t) => getImagePathForTile(t))
    .filter(Boolean);
  const uniqueImgSrcs = [...new Set(tileImagePaths)];
  const imageMap = new Map<string, HTMLImageElement>();

  await Promise.all(
    uniqueImgSrcs.map(async (imgSrc) => {
      const image = await loadImage(imgSrc);
      if (image) {
        imageMap.set(imgSrc, image);
      }
    }),
  );

  // Draw all tiles sequentially to avoid canvas context issues
  for (const tile of tiles) {
    const center = hexToPixel(tile.q, tile.r, hexSize);
    const imgPath = getImagePathForTile(tile);
    drawHexagon({
      context,
      x: center.x - boundingBox.x,
      y: center.y - boundingBox.y,
      size: hexSize,
      fillStyle: tile.color,
      image: imageMap.get(imgPath),
    });
  }

  return canvas;
};
