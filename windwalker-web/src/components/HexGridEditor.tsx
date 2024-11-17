"use client";
import React, { useEffect, useState } from 'react';
import { ToolBar } from './ToolBar';
import { NavBar } from './NavBar';
import Hexagon from '~/hex/Hexagon';
import type { Asset } from '~/assets/assets';
import { Assets, loadImageAssetsToSvg } from '~/assets/assets';
import type { Tile } from '~/models/Tile';
import { createTile } from '~/models/Tile';
import { useZoom } from '~/providers/ZoomProvider';
import { Print } from './Print';

const HexGridEditor = () => {
  const { hexSize } = useZoom();
  const [dimensions] = useState({ width: 3000, height: 3000 });
    // const [viewportHexes, setViewportHexes] = useState([]);

  const [title, setTitle] = useState("Windwalker-Map");
  const [grid, setGrid] = useState([] as Tile[]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(Assets.empty);
  const [viewport, setViewport] = useState({ x: dimensions.width/2, y: dimensions.height/2, width: 800, height: 600 });
  // const containerRef = useRef(null);

  const onClick = (q: number, r: number) => {
    setGrid(prev => {
      const newGrid = [...prev];
      const existingTileIndex = newGrid.findIndex(tile => tile.q === q && tile.r === r);
      if (!selectedAsset || selectedAsset?.name === 'empty') {
        if (existingTileIndex >= 0) {
          newGrid.splice(existingTileIndex, 1);
        }
        return newGrid;
      }
      else if (existingTileIndex >= 0) {
        newGrid[existingTileIndex] = createTile(q, r, selectedAsset);
      } else {
        newGrid.push(createTile(q, r, selectedAsset));
      }
      return newGrid;
    });
  };

  const loadMap: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target) {
        const content = e.target.result;
        if (typeof content === 'string') {
          const data = JSON.parse(content) as { title: string; grid: Tile[] };
          const { title, grid } = data;
          setTitle(title);
          setGrid(grid);
        }
      }
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  const saveMap = () => {
    const mapData = { title, grid, metadata: { createdAt: new Date().toISOString(), name: "Windwalker map" } };
    const content = JSON.stringify(mapData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.json`;
    a.click();
  };

  const printMap = async () => {
    console.log('Printing:', title, grid);
    await Print(title, grid);
  };

  const clearMap = () => {
    setGrid([]);
  };

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = event.target as HTMLDivElement;
    setViewport({
      x: scrollLeft,
      y: scrollTop,
      width: clientWidth,
      height: clientHeight,
    });
    console.log('Viewport:', viewport);
  };

  useEffect(() => {
    const handleError = (error: Error | ErrorEvent | PromiseRejectionEvent) => {
      console.error('Unhandled error:', error);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  const renderSvgContent = () =>
    (
    <svg width={dimensions.width} height={dimensions.height} className="bg-white">
      <defs>
        {loadImageAssetsToSvg(hexSize)}
      </defs>

      {Array.from({ length: Math.ceil(viewport.width / hexSize) + 2 }, (_, q) =>
        Array.from({ length: Math.ceil(viewport.height / hexSize) + 10 }, (_, r) => {
          const adjustedQ = q + Math.floor(viewport.x / (2*hexSize)) - 1;
          const adjustedR = r + Math.floor(viewport.y / (2*hexSize)) - 5;
          return (
            <Hexagon
              key={`${adjustedQ}-${adjustedR}`}
              q={adjustedQ}
              r={adjustedR}
              tile={grid.find(tile => tile.q === adjustedQ && tile.r === adjustedR) ?? {}}
              onClick={() => onClick(adjustedQ, adjustedR)}
            />
          );
        })
      )}
    </svg>
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg p-4">
        <NavBar title={title} onTitleChange={setTitle} onSave={saveMap} onLoad={loadMap} onPrint={printMap} onClear={clearMap}/>

        <div className="flex gap-4">
          <ToolBar selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />

          <div
            // ref={containerRef}
            className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200"
            onScroll={handleScroll}
            style={{ 
              width: '100vw', 
              height: '100vh',
              overflow: 'auto',  // Enable scrolling
              border: '1px solid #e2e8f0',  // Add a border
            }}
          >
            {renderSvgContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HexGridEditor;