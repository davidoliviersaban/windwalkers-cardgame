"use client";
import React, { useEffect, useState, useRef } from "react";
import { ToolBar } from "./ToolBar";
import { NavBar } from "./NavBar";
import Hexagon from "~/hex/Hexagon";
import type { Asset } from "~/assets/assets";
import { Assets, loadImageAssetsToSvg } from "~/assets/assets";
import type { Tile } from "~/models/Tile";
import { createTile } from "~/models/Tile";
import { useZoom } from "~/providers/ZoomProvider";
import { Print } from "./Print";
import { computeViewport } from "~/hex/utilities";

export default function HexGridEditor() {
  const { hexSize, onZoomChange } = useZoom();
  const [dimensions] = useState({ width: 5000, height: 5000 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("Windwalker-Map");
  const [grid, setGrid] = useState([] as Tile[]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(Assets.empty);
  const [viewport, setViewport] = useState({
    x: dimensions.width / 2,
    y: dimensions.height / 2,
    width: 800,
    height: 600,
  });

  // Adjust scroll position when zoom changes to keep the center
  useEffect(() => {
    const unsubscribe = onZoomChange((oldZoom, newZoom) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const zoomRatio = newZoom / oldZoom;

      // Calculate current center point
      const centerX = container.scrollLeft + container.clientWidth / 2;
      const centerY = container.scrollTop + container.clientHeight / 2;

      // Calculate new scroll position to keep the same center
      const newScrollX = centerX * zoomRatio - container.clientWidth / 2;
      const newScrollY = centerY * zoomRatio - container.clientHeight / 2;

      // Apply new scroll position after render
      requestAnimationFrame(() => {
        container.scrollTo({
          left: newScrollX,
          top: newScrollY,
          behavior: "instant",
        });
      });
    });

    return unsubscribe;
  }, [onZoomChange]);

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
    if (!containerRef.current || tiles.length === 0) return;

    const bounds = computeViewport(tiles, hexSize);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    const container = containerRef.current;
    const scrollX = centerX - container.clientWidth / 2;
    const scrollY = centerY - container.clientHeight / 2;

    container.scrollTo({
      left: scrollX,
      top: scrollY,
      behavior: "smooth",
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

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    const { scrollLeft, scrollTop, clientWidth, clientHeight } =
      event.target as HTMLDivElement;
    setViewport({
      x: scrollLeft,
      y: scrollTop,
      width: clientWidth,
      height: clientHeight,
    });
    console.log("Viewport:", viewport);
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

  const renderSvgContent = () => (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      className="bg-white"
    >
      <defs>{loadImageAssetsToSvg(hexSize)}</defs>

      {Array.from({ length: Math.ceil(viewport.width / hexSize) + 2 }, (_, q) =>
        Array.from(
          { length: Math.ceil(viewport.height / hexSize) + 10 },
          (_, r) => {
            const adjustedQ = q + Math.floor(viewport.x / (2 * hexSize)) - 1;
            const adjustedR = r + Math.floor(viewport.y / (2 * hexSize)) - 5;
            return (
              <Hexagon
                key={`${adjustedQ}-${adjustedR}`}
                q={adjustedQ}
                r={adjustedR}
                tile={
                  grid.find(
                    (tile) => tile.q === adjustedQ && tile.r === adjustedR,
                  ) ?? {}
                }
                onClick={() => onClick(adjustedQ, adjustedR)}
              />
            );
          },
        ),
      )}
    </svg>
  );

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="rounded-lg bg-white p-4 shadow-lg">
        <NavBar
          title={title}
          onTitleChange={setTitle}
          onSave={saveMap}
          onLoad={loadMap}
          onPrint={printMap}
          onClear={clearMap}
        />

        <div className="flex gap-4">
          <ToolBar
            selectedAsset={selectedAsset}
            setSelectedAsset={setSelectedAsset}
          />

          <div
            ref={containerRef}
            className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white"
            onScroll={handleScroll}
            style={{
              maxWidth: "calc(100vw - 200px)",
              maxHeight: "calc(100vh - 200px)",
              overflow: "auto",
            }}
          >
            {renderSvgContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

// export default HexGridEditor;
