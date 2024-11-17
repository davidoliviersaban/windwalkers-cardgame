import React, { useState } from 'react';
import { Asset, Assets as assets } from '~/assets/assets';
import { Tile } from '~/models/Tile';

interface ToolBarProps {
  selectedAsset: Asset;
  setSelectedAsset: (asset: Asset) => void;
}

const ToolBar: React.FC<ToolBarProps> = ({ selectedAsset, setSelectedAsset }) => {
      
  return (
    <div className="w-48 bg-gray-100 p-4 rounded">
    <h3 className="font-bold mb-2">Terrains</h3>
    <div className="flex flex-col gap-2">
        <button 
          key={assets.empty.name} 
          onClick={() => setSelectedAsset({...assets.empty})}
          className={`p-2 rounded flex items-center gap-2 ${
            selectedAsset?.name === assets.empty.name ? 'bg-blue-200' : 'bg-white'
            }`}
          >{assets.empty.name}
        </button>
        {Object.values(assets).filter(asset => asset.type === 'terrain').map(terrain => (
        <button
            key={terrain.name}
            onClick={() => setSelectedAsset({...terrain })}
            className={`p-2 rounded flex items-center gap-2 ${
              selectedAsset?.name === terrain.name ? 'bg-blue-200' : 'bg-white'
            }`}
            style={{ 
              backgroundImage: `url(${terrain?.img})`, 
              backgroundSize: 'cover',
              filter: selectedAsset?.name === terrain.name ? 'brightness(0.7)' : 'none'
            }}
        >
            {terrain.icon && <terrain.icon />}
            {terrain.name}
        </button>
        ))}
    </div>
    <h3 className="font-bold mt-4 mb-2">Bâtiments</h3>
    <div className="flex flex-col gap-2">
      {Object.values(assets).filter(asset => asset.type === 'building').map(building => (
        <button
            key={building.name}
            onClick={() => setSelectedAsset({...building })}
            className={`p-2 rounded flex items-center gap-2 ${
              selectedAsset?.name === building.name ? 'bg-blue-200' : 'bg-white'
            }`}
            style={{ 
              backgroundImage: `url(${building?.img})`, 
              backgroundSize: 'cover',
              filter: selectedAsset?.name === building.name ? 'brightness(0.7)' : 'none'
            }}
        >
            {building.icon && <building.icon />}
            {building.name}
        </button>
        ))}
    </div>
    </div>
    // <div className="toolbar">
    //   <button onClick={() => onSelectIcon(IconComponents.Mountain)}>Mountain</button>
    //   <button onClick={() => onSelectIcon(IconComponents.Tree)}>Tree</button>
    //   <button onClick={() => onSelectIcon(IconComponents.Water)}>Water</button>
    //   <button onClick={() => onSelectIcon(IconComponents.Village)}>Village</button>
    //   <button onClick={() => onSelectIcon(IconComponents.Temple)}>Temple</button>
    //   <button onClick={() => onSelectIcon(IconComponents.Tower)}>Tower</button>
    // </div>
  );
};

export { ToolBar };
