"use client";
import { useEffect, useState, useRef } from "react";

export function useContainerSize(
    containerRef: React.RefObject<HTMLDivElement | null>,
) {
    const [containerSize, setContainerSize] = useState({
        width: 800,
        height: 600,
    });
    const containerSizeRef = useRef(containerSize);

    useEffect(() => {
        containerSizeRef.current = containerSize;
    }, [containerSize]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const newSize = {
                width: container.clientWidth,
                height: container.clientHeight,
            };
            setContainerSize(newSize);
            containerSizeRef.current = newSize;
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);
        updateSize();

        return () => resizeObserver.disconnect();
    }, [containerRef]);

    return { containerSize, containerSizeRef };
}
