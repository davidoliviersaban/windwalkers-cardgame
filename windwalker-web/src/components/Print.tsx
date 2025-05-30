import { CanvasFromTiles } from "~/hex/CanvasFromTiles";
import ImageFromCanvas from "~/assets/ImageFromCanvas";
import { Tile } from "~/models/Tile";
import type { Asset } from "~/assets/assets";

interface PrintProps {
  title: string;
  grid: Tile[];
  selectedAsset?: Asset;
  width?: number;
  height?: number;
}

const SIZE = 200;

/**
 * Fonction pour télécharger l'image convertie
 */
const downloadImage = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Exemple d'utilisation dans votre fonction Print
 */
const Print = async ({ title, grid, selectedAsset, width, height }: PrintProps) => {
  console.log('Printing:', title, grid);
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Cannot open print window');

  try {
    const canvasElement = await CanvasFromTiles(grid, SIZE, title);
    const image = ImageFromCanvas(canvasElement, 'image/webp', 1);
    
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvasElement.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed'));
      }, 'image/webp', 1);
    });
    
    downloadImage(blob, title + '.webp');
    const content = `<img src="${image}" />`;
    printWindow.document.write(content);
    printWindow.document.title = title;
    printWindow.document.close();
    
    return { success: true };
  } catch (error) {
    console.error('Error during printing:', error);
    printWindow.close();
    throw error;
  }
};

export { Print };