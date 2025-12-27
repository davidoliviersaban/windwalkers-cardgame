"use client";
import { useState, useCallback, useRef } from "react";

export function usePanHandlers(
    offset: { x: number; y: number },
    setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
) {
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button === 1 || e.shiftKey) {
                setIsPanning(true);
                setPanStart({ x: e.clientX + offset.x, y: e.clientY + offset.y });
                e.preventDefault();
            }
        },
        [offset],
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isPanning) {
                setOffset({
                    x: panStart.x - e.clientX,
                    y: panStart.y - e.clientY,
                });
            }
        },
        [isPanning, panStart, setOffset],
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    return {
        isPanning,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
    };
}

export function useWheelHandler(
    zoomIn: () => void,
    zoomOut: () => void,
    setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
) {
    const zoomThresholdRef = useRef(0);

    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.ctrlKey || e.metaKey) {
                zoomThresholdRef.current += e.deltaY;

                const threshold = 50;
                if (zoomThresholdRef.current < -threshold) {
                    zoomIn();
                    zoomThresholdRef.current = 0;
                } else if (zoomThresholdRef.current > threshold) {
                    zoomOut();
                    zoomThresholdRef.current = 0;
                }
            } else {
                setOffset((prev) => ({
                    x: prev.x + e.deltaX,
                    y: prev.y + e.deltaY,
                }));
            }
        },
        [zoomIn, zoomOut, setOffset],
    );

    return handleWheel;
}
