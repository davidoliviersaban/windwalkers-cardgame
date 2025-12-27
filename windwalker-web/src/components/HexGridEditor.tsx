"use client";
/**
 * HexGridEditor Component
 *
 * A comprehensive hex-based map editor with infinite scrolling, zoom, and pan capabilities.
 *
 * This is the main orchestration component that combines:
 * - Technical utilities from ~/hooks (container size, zoom, pan, error handling)
 * - Business functions from ~/utils (map operations, grid manipulation)
 * - UI components from ~/components (GridCanvas, ToolBar, NavBar)
 *
 * Features:
 * - Virtual infinite canvas with offset-based rendering
 * - Zoom centered on hex tiles (not pixels)
 * - Pan with middle mouse or Shift+drag
 * - Pinch-to-zoom and Ctrl+wheel support
 * - Dynamic container sizing with ResizeObserver
 * - Import/export JSON map files
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
import { ToolBar } from "./ToolBar";
import { NavBar } from "./NavBar";
import { GridCanvas } from "./GridCanvas";
import type { Asset } from "~/assets/assets";
import { Assets } from "~/assets/assets";
import type { Tile } from "~/models/Tile";
import { useZoom } from "~/providers/ZoomProvider";
import { computeViewport } from "~/hex/utilities";

// Import technical utilities (hooks)
import {
  useContainerSize,
  useZoomOffset,
  usePanHandlers,
  useWheelHandler,
  useErrorHandler,
} from "~/hooks";

// Import business functions
import {
  loadMapFromFile,
  saveMapToFile,
  printMapData,
  handleHexClick,
} from "~/utils";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HexGridEditor() {
  // Zoom context
  const { hexSize, onZoomChange, zoomIn, zoomOut } = useZoom();

  // Container management
  const containerRef = useRef<HTMLDivElement>(null);
  const { containerSize, containerSizeRef } = useContainerSize(containerRef);

  // Editor state
  const [title, setTitle] = useState("Windwalker-Map");
  const [grid, setGrid] = useState([] as Tile[]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(Assets.empty);

  // Virtual offset - represents where we are in the infinite canvas
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Keep a ref to the current offset for zoom calculations
  const offsetRef = useRef(offset);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // =========================================================================
  // HOOKS - Technical utilities
  // =========================================================================

  // Adjust offset when zoom changes to keep the central hex tile at the center
  useZoomOffset(onZoomChange, containerSizeRef, offsetRef, setOffset);

  // Pan and interaction handlers
  const { isPanning, handleMouseDown, handleMouseMove, handleMouseUp } =
    usePanHandlers(offset, setOffset);
  const handleWheel = useWheelHandler(zoomIn, zoomOut, setOffset);

  // Error handling
  useErrorHandler();

  // =========================================================================
  // CALLBACKS - Map operations
  // =========================================================================

  /**
   * Center the view on the given tiles
   */
  const centerViewOnGrid = useCallback(
    (tiles: Tile[]) => {
      if (tiles.length === 0) return;

      const bounds = computeViewport(tiles, hexSize);
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;

      setOffset({
        x: centerX - containerSize.width / 2,
        y: centerY - containerSize.height / 2,
      });
    },
    [hexSize, containerSize],
  );

  const loadMap: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (file) {
        loadMapFromFile(file, setTitle, setGrid, centerViewOnGrid);
      }
    },
    [centerViewOnGrid],
  );

  const saveMap = useCallback(() => {
    saveMapToFile(title, grid);
  }, [title, grid]);

  const printMap = useCallback(async () => {
    await printMapData(title, grid, selectedAsset);
  }, [title, grid, selectedAsset]);

  const clearMap = useCallback(() => {
    setGrid([]);
  }, []);

  // =========================================================================
  // CALLBACKS - Grid manipulation
  // =========================================================================

  const onClick = useCallback(
    (q: number, r: number) => {
      handleHexClick(q, r, selectedAsset, setGrid);
    },
    [selectedAsset],
  );

  // =========================================================================
  // RENDER
  // =========================================================================

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

          <GridCanvas
            containerRef={containerRef}
            containerSize={containerSize}
            offset={offset}
            hexSize={hexSize}
            isPanning={isPanning}
            grid={grid}
            onClick={onClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          />
        </div>
      </div>
    </div>
  );
}
