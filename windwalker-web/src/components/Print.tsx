import { CanvasFromTiles } from "~/hex/CanvasFromTiles";
import ImageFromCanvas from "~/assets/ImageFromCanvas";
import { Tile } from "~/models/Tile";

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
const Print = async (title: string, grid: Tile[]) => {
  console.log('Printing:', title, grid);
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Cannot open print window');

  const canvas = true;
  let content = '';
  if (canvas) {
    const canvas = await CanvasFromTiles(grid, SIZE, title);
    const image = ImageFromCanvas(canvas, 'image/webp', 1);
    // retrieve blob from canvas
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed'));
      }, 'image/webp', 1);
    });
    downloadImage(blob, title + '.webp');
    content = `<img src="${image}" />`;
  }
  printWindow.document.write(content, title);

  printWindow.document.close();
  printWindow.onload = () => {
    // printWindow.print();
  };
};

export { Print };