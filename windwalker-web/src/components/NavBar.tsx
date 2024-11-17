import type { ChangeEvent } from 'react';
import React from 'react';
import { useZoom } from '~/providers/ZoomProvider';


interface NavBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onLoad: (event: ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  onClear: () => void;
}

const NavBar = ({ title, onTitleChange, onSave, onLoad, onPrint, onClear } : NavBarProps) => {
  const { zoomIn, zoomOut, zoomIndex, zoom } = useZoom();

  return (
    <div className="mb-4">
    <input
      type="text"
      value={title}
      onChange={(e) => onTitleChange(e.target.value)}
      className="text-2xl font-bold w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-2 py-1"
    />
    <div className="flex gap-2 mt-4 justify-between">
      <div className="flex gap-2">
      <button onClick={onSave} className="p-2 bg-blue-500 text-white rounded flex items-center gap-2">
        Sauvegarder
      </button>
      <label className="p-2 bg-green-500 text-white rounded flex items-center gap-2 cursor-pointer">
        Importer
        <input type="file" accept=".json" onChange={(e) => onLoad(e)} className="hidden" />
      </label>
      <button onClick={onPrint} className="p-2 bg-gray-500 text-white rounded flex items-center gap-2">
        Imprimer
      </button>
      <button onClick={onClear} className="p-2 bg-red-500 text-white rounded flex items-center gap-2">
        Effacer
      </button>
      </div>
      <div className="flex gap-2">
        <button onClick={zoomIn} className="px-4 py-2 bg-blue-500 text-white rounded">Zoom In</button>
        <button onClick={zoomOut} className="px-4 py-2 bg-blue-500 text-white rounded">Zoom Out</button>
      </div>
    </div>
  </div>

  );
};

export { NavBar };
