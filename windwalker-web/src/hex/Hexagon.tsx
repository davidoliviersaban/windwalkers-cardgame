"use client";
import { useState, useEffect } from "react";
import { useZoom } from "../providers/ZoomProvider";
import { hexToPixel, hexPoints } from "~/hex/utilities";

// Use Record type instead of index signature
const cache: Record<string, HTMLElement | null> = {};

interface Point {
  x: number;
  y: number;
}

interface HexagonProps {
  q: number;
  r: number;
  tile: {
    name?: string;
    color?: string;
  };
  onClick: () => void;
}

const Hexagon: React.FC<HexagonProps> = ({ q, r, tile, onClick }) => {
  const { hexSize } = useZoom();
  const coordinates: Point = hexToPixel(q, r, hexSize);
  const [mounted, setMounted] = useState(false);

  // Calculate initial fill value consistently for SSR and client
  const getInitialFill = () => {
    if (tile?.color) return tile.color;
    return "#eee";
  };

  const [image, setImage] = useState(getInitialFill);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Reset to default or color when tile has no name (empty/cleared)
    if (!tile?.name) {
      setImage(tile?.color ?? "#eee");
      return;
    }

    // Set pattern image if tile has a name
    if (cache[tile.name]) {
      setImage(`url(#pattern-image-${tile.name})`);
    } else if (document.getElementById(`pattern-image-${tile.name}`)) {
      cache[tile.name] = document.getElementById(`pattern-image-${tile.name}`);
      setImage(`url(#pattern-image-${tile.name})`);
    } else {
      // Fallback to color if pattern not found
      setImage(tile?.color ?? "#eee");
    }
  }, [tile, tile?.name, tile?.color]);

  // Don't render until mounted to avoid hydration mismatch with floating-point calculations
  if (!mounted) {
    return null;
  }

  return (
    <g
      transform={`translate(${coordinates.x}, ${coordinates.y})`}
      onClick={onClick}
      className="cursor-pointer hover:opacity-80"
    >
      <polygon
        points={hexPoints(hexSize)}
        fill={image}
        stroke="#999"
        strokeWidth="1"
      />
    </g>
  );
};

export default Hexagon;
