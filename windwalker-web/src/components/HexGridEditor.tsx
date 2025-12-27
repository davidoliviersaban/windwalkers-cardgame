"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { ToolBar } from "./ToolBar";
import { NavBar } from "./NavBar";
import Hexagon from "~/hex/Hexagon";
import type { Asset } from "~/assets/assets";
import { Assets, loadImageAssetsToSvg } from "~/assets/assets";
import type { Tile } from "~/models/Tile";
import { createTile } from "~/models/Tile";
import { useZoom } from "~/providers/ZoomProvider";
import { Print } from "./Print";
import { computeViewport, hexToPixel, pixelToHex } from "~/hex/utilities";

export default function HexGridEditor() {
  const { hexSize, onZoomChange, zoomIn, zoomOut } = useZoom();
  const containerRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("Windwalker-Map");
  const [grid, setGrid] = useState([] as Tile[]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(Assets.empty);

  // Virtual offset - represents where we are in the infinite canvas
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const containerSizeRef = useRef(containerSize);

  // Keep ref in sync with state
  useEffect(() => {
    containerSizeRef.current = containerSize;
  }, [containerSize]);

  // Update container size on mount, resize, and any layout changes
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

    // Use ResizeObserver to detect all size changes
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    // Initial size update
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  // Keep a ref to the current offset for zoom calculations
  const offsetRef = useRef(offset);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // Adjust offset when zoom changes to keep the central hex tile at the center
  useEffect(() => {
    const unsubscribe = onZoomChange((oldZoom, newZoom) => {
      const currentSize = containerSizeRef.current;
      const currentOffset = offsetRef.current;
      const oldHexSize = 100 * oldZoom;
      const newHexSize = 100 * newZoom;

      // Find the hex at the center of the viewport before zoom
      const centerPixelX = currentOffset.x + currentSize.width / 2;
      const centerPixelY = currentOffset.y + currentSize.height / 2;
      const centerHex = pixelToHex(centerPixelX, centerPixelY, oldHexSize);
      
      // Round to get the actual central tile
      const centralQ = Math.round(centerHex.q);
      const centralR = Math.round(centerHex.r);
      
      // Calculate the pixel position of this hex with the new zoom
      const newCenterPixel = hexToPixel(centralQ, centralR, newHexSize);
      
      // Set offset so this hex is at the center of the viewport
      setOffset({
        x: newCenterPixel.x - currentSize.width / 2,
        y: newCenterPixel.y - currentSize.height / 2,
      });
    });
    return unsubscribe;
  }, [onZoomChange]);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start panning with middle mouse button or when holding space
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
    [isPanning, panStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Wheel to pan (scroll behavior) or zoom with pinch/ctrl+wheel
  const zoomThresholdRef = useRef(0);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Pinch to zoom (trackpad) or Ctrl+wheel
      if (e.ctrlKey || e.metaKey) {
        // Accumulate delta for smoother threshold-based zoom
        zoomThresholdRef.current += e.deltaY;

        // Trigger zoom when threshold is reached
        const threshold = 50;
        if (zoomThresholdRef.current < -threshold) {
          zoomIn();
          zoomThresholdRef.current = 0;
        } else if (zoomThresholdRef.current > threshold) {
          zoomOut();
          zoomThresholdRef.current = 0;
        }
      } else {
        // Regular scroll to pan
        setOffset((prev) => ({
          x: prev.x + e.deltaX,
          y: prev.y + e.deltaY,
        }));
      }
    },
    [zoomIn, zoomOut],
  );

  const onClick = (q: number, r: number) => {
    setGrid((prev) => {
      const newGrid = [...prev];
      const existingTileIndex = newGrid.findIndex(
        (tile) => tile.q === q && tile.r === r,
      );
      if (!selectedAsset || selectedAsset?.name === "empty") {
        if (existingTileIndex >= 0) {
          newGrid.splice(existingTileIndex, 1);
        }
        return newGrid;
      } else if (existingTileIndex >= 0) {
        newGrid[existingTileIndex] = createTile(q, r, selectedAsset);
      } else {
        newGrid.push(createTile(q, r, selectedAsset));
      }
      return newGrid;
    });
  };

  const centerViewOnGrid = (tiles: Tile[]) => {
    if (tiles.length === 0) return;

    const bounds = computeViewport(tiles, hexSize);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Set offset to center on the grid
    setOffset({
      x: centerX - containerSize.width / 2,
      y: centerY - containerSize.height / 2,
    });
  };

  const loadMap: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target) {
        const content = e.target.result;
        if (typeof content === "string") {
          const data = JSON.parse(content) as { title: string; grid: Tile[] };
          const { title, grid } = data;
          setTitle(title);
          setGrid(grid);
          // Center view on the imported map after a short delay to ensure render
          setTimeout(() => centerViewOnGrid(grid), 100);
        }
      }
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  const saveMap = () => {
    const mapData = {
      title,
      grid,
      metadata: { createdAt: new Date().toISOString(), name: "Windwalker map" },
    };
    const content = JSON.stringify(mapData, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.json`;
    a.click();
  };

  const printMap = async () => {
    console.log("Printing:", title, grid);
    await Print({ title, grid, selectedAsset });
  };

  const clearMap = () => {
    setGrid([]);
  };

  useEffect(() => {
    const handleError = (error: Error | ErrorEvent | PromiseRejectionEvent) => {
      console.error("Unhandled error:", error);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleError);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleError);
    };
  }, []);

  // Calculate which hexagons are visible based on offset and container size
  const getVisibleHexagons = () => {
    // Add padding to render hexagons just outside the viewport
    const padding = 3;

    // Convert all 4 corners of the viewport to hex coordinates
    // In axial coordinates, q and r axes are not perpendicular, so we need all corners
    const topLeft = pixelToHex(offset.x, offset.y, hexSize);
    const topRight = pixelToHex(
      offset.x + containerSize.width,
      offset.y,
      hexSize,
    );
    const bottomLeft = pixelToHex(
      offset.x,
      offset.y + containerSize.height,
      hexSize,
    );
    const bottomRight = pixelToHex(
      offset.x + containerSize.width,
      offset.y + containerSize.height,
      hexSize,
    );

    // Find the min/max q and r across all 4 corners
    const minQ = Math.min(topLeft.q, topRight.q, bottomLeft.q, bottomRight.q);
    const maxQ = Math.max(topLeft.q, topRight.q, bottomLeft.q, bottomRight.q);
    const minR = Math.min(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r);
    const maxR = Math.max(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r);

    const startQ = Math.floor(minQ) - padding;
    const startR = Math.floor(minR) - padding;
    const endQ = Math.ceil(maxQ) + padding;
    const endR = Math.ceil(maxR) + padding;

    const hexagons: { q: number; r: number }[] = [];
    for (let q = startQ; q <= endQ; q++) {
      for (let r = startR; r <= endR; r++) {
        hexagons.push({ q, r });
      }
    }
    return hexagons;
  };

  const renderSvgContent = () => {
    const visibleHexagons = getVisibleHexagons();

    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
        className="bg-white"
        style={{ cursor: isPanning ? "grabbing" : "default" }}
      >
        <defs>{loadImageAssetsToSvg(hexSize)}</defs>

        {/* Offset group to simulate infinite canvas */}
        <g transform={`translate(${-offset.x}, ${-offset.y})`}>
          {visibleHexagons.map(({ q, r }) => (
            <Hexagon
              key={`${q}-${r}`}
              q={q}
              r={r}
              tile={grid.find((tile) => tile.q === q && tile.r === r) ?? {}}
              onClick={() => onClick(q, r)}
            />
          ))}
        </g>
      </svg>
    );
  };

  return (
    <div className="flex h-full flex-col px-[15%] py-4">
      <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-white p-4 shadow-lg">
        <NavBar
          title={title}
          onTitleChange={setTitle}
          onSave={saveMap}
          onLoad={loadMap}
          onPrint={printMap}
          onClear={clearMap}
        />

        <div className="flex min-h-0 flex-1 gap-4">
          <ToolBar
            selectedAsset={selectedAsset}
            setSelectedAsset={setSelectedAsset}
          />

          <div
            ref={containerRef}
            className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {renderSvgContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

// export default HexGridEditor;
