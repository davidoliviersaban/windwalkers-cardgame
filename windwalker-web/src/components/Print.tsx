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
  const a = document.createElement("a");
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
const Print = async ({
  title,
  grid,
  selectedAsset,
  width,
  height,
}: PrintProps) => {
  console.log("Printing:", title, grid);

  if (!grid || grid.length === 0) {
    console.error("Print: No tiles to print");
    alert("No tiles to print. Please add some tiles first.");
    return { success: false };
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    console.error("Print: Cannot open print window - popup may be blocked");
    alert("Cannot open print window. Please allow popups for this site.");
    throw new Error("Cannot open print window");
  }

  try {
    console.log("Creating canvas from tiles...");
    const canvasElement = await CanvasFromTiles(grid, SIZE, title);
    console.log(
      "Canvas created:",
      canvasElement.width,
      "x",
      canvasElement.height,
    );

    const image = ImageFromCanvas(canvasElement, "image/webp", 1);
    console.log("Image data URL created");

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvasElement.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas to Blob conversion failed"));
        },
        "image/webp",
        1,
      );
    });
    console.log("Blob created:", blob.size, "bytes");

    downloadImage(blob, title + ".webp");
    const content = `<img src="${image}" />`;
    printWindow.document.write(content);
    printWindow.document.title = title;
    printWindow.document.close();

    return { success: true };
  } catch (error) {
    console.error("Error during printing:", error);
    printWindow.close();
    throw error;
  }
};

export { Print };
