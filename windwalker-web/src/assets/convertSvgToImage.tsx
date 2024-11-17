"use client";

// Types pour TypeScript
interface ConversionOptions {
    height: number| undefined;
    width: number | undefined;
    format: 'png' | 'webp' | 'avif';
    quality?: number;
    scale?: number;
}

export const ensureSvgRendered = async (svgElement: SVGSVGElement) => {
    return new Promise<void>((resolve) => {
        // Wait for the next animation frame to ensure DOM updates are complete
        requestAnimationFrame(() => {
            // Check if there are any external resources in the SVG
            const images = svgElement.querySelectorAll('image');
            if (images.length === 0) {
                // No external resources, resolve immediately
                resolve();
                return;
            }

            // Ensure all images are loaded
            let loadedCount = 0;
            images.forEach((img) => {
                const image = new Image();
                image.onload = () => {
                    loadedCount += 1;
                    if (loadedCount === images.length) {
                        resolve();
                    }
                };
                image.onerror = () => {
                    // Handle any loading errors
                    console.warn(`Error loading image: ${img.getAttribute('href')}`);
                    loadedCount += 1;
                    if (loadedCount === images.length) {
                        resolve();
                    }
                };
                image.src = img.getAttribute('href') ?? img.getAttribute('xlink:href') ?? "";
            });
        });
    });
};

/**
 * Convertit un SVG en image (PNG, WebP, ou AVIF)
 */
const convertSvgToImage = async (
    svgElement: SVGSVGElement,
    options: ConversionOptions = {
        format: 'png', quality: 0.8, scale: 2, height: undefined, width: undefined
    }
): Promise<Blob> => {
    // Créer une copie du SVG pour ne pas modifier l'original
    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
    console.log('svgClone');
    await ensureSvgRendered(svgClone);
    console.log('ensureSvgRendered');

    // Récupérer les dimensions originales
    const bbox = svgElement.getBBox();
    const width = options?.width ?? bbox.width;
    const height = options?.height ?? bbox.height;

    // Appliquer l'échelle pour augmenter la résolution
    const scaledWidth = width * (options.scale ?? 2);
    const scaledHeight = height * (options.scale ?? 2);

    // Préparer le SVG pour la conversion
    svgClone.setAttribute('width', scaledWidth.toString());
    svgClone.setAttribute('height', scaledHeight.toString());

    // Convertir le SVG en chaîne de caractères
    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const loadImage = (url: string) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.src = url;
            image.onload = () => resolve(image);
            image.onerror = (_err) => reject(new Error('Failed to convert SVG to image'));
            return image;
        });
    };

    // Créer un canvas pour le rendu
    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Cannot get canvas context');
    }

    // Configurer la qualité du rendu
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    try {
        const img: HTMLImageElement = await loadImage(svgUrl);
        // Dessiner l'image sur le canvas
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        // Convertir le canvas en blob avec le format demandé
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas to Blob conversion failed'));
                },
                `image/${options.format}`,
                options.quality
            );
            URL.revokeObjectURL(svgUrl);
        });

        return blob;
    } catch (error) {
        URL.revokeObjectURL(svgUrl);
        throw error;
    }
};

export { convertSvgToImage };
export type { ConversionOptions };
