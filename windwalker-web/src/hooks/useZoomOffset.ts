"use client";
import { useEffect } from "react";
import { hexToPixel, pixelToHex } from "~/hex/utilities";

export function calculateZoomOffset(
    oldZoom: number,
    newZoom: number,
    currentOffset: { x: number; y: number },
    containerSize: { width: number; height: number },
) {
    const oldHexSize = 100 * oldZoom;
    const newHexSize = 100 * newZoom;

    const centerPixelX = currentOffset.x + containerSize.width / 2;
    const centerPixelY = currentOffset.y + containerSize.height / 2;
    const centerHex = pixelToHex(centerPixelX, centerPixelY, oldHexSize);

    const centralQ = Math.round(centerHex.q);
    const centralR = Math.round(centerHex.r);

    const newCenterPixel = hexToPixel(centralQ, centralR, newHexSize);

    return {
        x: newCenterPixel.x - containerSize.width / 2,
        y: newCenterPixel.y - containerSize.height / 2,
    };
}

export function useZoomOffset(
    onZoomChange: (
        callback: (oldZoom: number, newZoom: number) => void,
    ) => () => void,
    containerSizeRef: React.RefObject<{ width: number; height: number }>,
    offsetRef: React.RefObject<{ x: number; y: number }>,
    setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
) {
    useEffect(() => {
        const unsubscribe = onZoomChange((oldZoom, newZoom) => {
            const newOffset = calculateZoomOffset(
                oldZoom,
                newZoom,
                offsetRef.current!,
                containerSizeRef.current!,
            );
            setOffset(newOffset);
        });
        return unsubscribe;
    }, [onZoomChange, containerSizeRef, offsetRef, setOffset]);
}
