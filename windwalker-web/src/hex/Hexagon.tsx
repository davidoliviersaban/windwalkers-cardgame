import { useState, useEffect } from 'react';
import { useZoom } from '../providers/ZoomProvider';
import { hexToPixel, hexPoints } from '~/hex/utilities';

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
    color?: string 
  };
  onClick: () => void;
}

const Hexagon: React.FC<HexagonProps> = ({ q, r, tile, onClick }) => {
  const { hexSize } = useZoom();
  const coordinates: Point = hexToPixel(q, r, hexSize);
  const [image, setImage] = useState('#eee');

  useEffect(() => {
    if (tile) {
      if (tile.name && cache[tile.name]) {
        setImage(`url(#pattern-image-${tile.name})`);
      } else if (tile.name && document.getElementById(`pattern-image-${tile.name}`)) {
        cache[tile.name] = document.getElementById(`pattern-image-${tile.name}`);
        setImage(`url(#pattern-image-${tile.name})`);
      } else if (tile?.color) {
        setImage(tile.color);
      }
    }
  }, [tile]);

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