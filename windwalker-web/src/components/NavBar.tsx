"use client";
import type { ChangeEvent } from "react";
import React from "react";
import { useZoom } from "~/providers/ZoomProvider";

interface NavBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onLoad: (event: ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  onClear: () => void;
}

export const NavBar = ({
  title,
  onTitleChange,
  onSave,
  onLoad,
  onPrint,
  onClear,
}: NavBarProps) => {
  const { zoomIn, zoomOut, zoomIndex, zoom } = useZoom();

  return (
    <div className="mb-4">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full border-b border-transparent bg-transparent px-2 py-1 text-2xl font-bold outline-none hover:border-gray-300 focus:border-blue-500"
      />
      <div className="mt-4 flex justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="flex items-center gap-2 rounded bg-blue-500 p-2 text-white"
          >
            Sauvegarder
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded bg-green-500 p-2 text-white">
            Importer
            <input
              type="file"
              accept=".json"
              onChange={(e) => onLoad(e)}
              className="hidden"
            />
          </label>
          <button
            onClick={onPrint}
            className="flex items-center gap-2 rounded bg-gray-500 p-2 text-white"
          >
            Imprimer
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-2 rounded bg-red-500 p-2 text-white"
          >
            Effacer
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={zoomIn}
            className="rounded bg-blue-500 px-4 py-2 text-white"
          >
            Zoom In
          </button>
          <button
            onClick={zoomOut}
            className="rounded bg-blue-500 px-4 py-2 text-white"
          >
            Zoom Out
          </button>
        </div>
      </div>
    </div>
  );
};

// export { NavBar };
