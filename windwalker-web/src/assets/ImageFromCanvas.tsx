const CanvasToImage = (
    canvas: HTMLCanvasElement, 
    type = 'image/png',
    quality = 1
): string => {
    return canvas.toDataURL(type, quality);
}

export default CanvasToImage;