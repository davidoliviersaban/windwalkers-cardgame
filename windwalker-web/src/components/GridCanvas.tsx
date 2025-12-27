"use client";
import React from "react";
import Hexagon from "~/hex/Hexagon";
import { loadImageAssetsToSvg } from "~/assets/assets";
import type { Tile } from "~/models/Tile";
import { getVisibleHexagons } from "~/utils/hexVisibility";

// ============================================================================
// GRID CANVAS COMPONENT
// ============================================================================

interface GridCanvasProps {
  containerRef: React.RefObject<HTMLDivElement>;
  containerSize: { width: number; height: number };
  offset: { x: number; y: number };
  hexSize: number;
  isPanning: boolean;
  grid: Tile[];
  onClick: (q: number, r: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
}

/**
 * GridCanvas component - renders the SVG hex grid
 *
 * This component handles the visual rendering of the hexagonal grid.
 * It calculates visible hexagons based on the current viewport and offset,
 * then renders them within an SVG element.
 *
 * Features:
 * - Virtual infinite canvas using offset-based rendering
 * - Only renders hexagons visible in the current viewport
 * - Supports pan and zoom interactions via event handlers
 */
export function GridCanvas({
  containerRef,
  containerSize,
  offset,
  hexSize,
  isPanning,
  grid,
  onClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
}: GridCanvasProps) {
  const visibleHexagons = getVisibleHexagons(offset, containerSize, hexSize);

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
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
    </div>
  );
}
