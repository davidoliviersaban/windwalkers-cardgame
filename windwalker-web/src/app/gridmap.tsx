import React from 'react';

interface Tile {
  id: string;
  type: string;
  color: string;
  icon?: React.ComponentType;
}

interface GridMapProps {
  grid: Tile[];
  selectedTile: Tile | null;
  setSelectedTile: (tile: Tile) => void;
}

const GridMap: React.FC<GridMapProps> = ({ grid, selectedTile, setSelectedTile }) => {
  const handleTileClick = (tile: Tile) => {
    if (selectedTile) {
      const updatedTile: Tile = { 
        ...tile, 
        color: selectedTile.color 
      };
      setSelectedTile(updatedTile);
    }
  };

  return (
    <div className="grid-map">
      {grid.map((tile: Tile) => (
        <div
          key={tile.id}
          className={`tile ${tile.type}`}
          style={{ backgroundColor: tile.color }}
          onClick={() => handleTileClick(tile)}
        >
          {tile.icon && React.createElement(tile.icon)}
        </div>
      ))}
    </div>
  );
};

export default GridMap;