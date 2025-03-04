import { Tile } from "~/models/Tile";
import { computeViewport, hexToPixel } from "./utilities";

const angleStep = Math.PI / 3; // 60 degrees in radians
const cachedImages: Record<string, HTMLImageElement> = {};

interface DrawHexagonOptions {
    context: CanvasRenderingContext2D;
    x: number;
    y: number;
    size: number;
    fillStyle: string;
    imageSrc: string;
}

// Function to draw a hexagon
const drawHexagon = async ({
    context,
    x,
    y,
    size,
    fillStyle,
    imageSrc
}: DrawHexagonOptions): Promise<void> => {
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

    context.fillStyle = fillStyle ?? '#eee';
    context.fill();

    if (cachedImages[imageSrc]) {
        const ratio = cachedImages[imageSrc].width/cachedImages[imageSrc].height;
        context.drawImage(
            cachedImages[imageSrc], 
            x - size*ratio, 
            y - size, 
            size * ratio * 2,
            size * 2
        );
    }

    context.strokeStyle = '#999';
    context.lineWidth = 1;
    context.stroke();
    context.strokeStyle = '#999';
    context.lineWidth = 1;
    context.stroke();
    context.restore();
};

export const CanvasFromTiles = async (
    tiles: Tile[], 
    hexSize: number, 
    _title: string
): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Cannot get canvas context');
        throw new Error('Cannot get canvas context');
    }

    const boundingBox = computeViewport(tiles, hexSize);

    canvas.width = boundingBox.width;
    canvas.height = boundingBox.height + 20; // bit of padding for the title

    // fill cachedImages with all images
    await Promise.all(tiles.map(async (tile) => {
        if (tile.img && !cachedImages[tile.img]) {
            const image = new Image();
            image.src = tile.img;
            cachedImages[tile.img] = image;
            return new Promise<void>((resolve) => {
                image.onload = () => resolve();
            });
        }
    }));

    // Draw all tiles
    await Promise.all(tiles.map(async (tile) => {
        const center = hexToPixel(tile.q, tile.r, hexSize);
        return drawHexagon({
            context,
            x: center.x - boundingBox.x,
            y: center.y - boundingBox.y,
            size: hexSize,
            fillStyle: tile.color,
            imageSrc: tile.img
        });
    }));

    return canvas;
};
