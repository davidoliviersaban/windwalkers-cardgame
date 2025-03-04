"use client";
import { createContext, useContext, useState, type ReactNode } from 'react';

const SIZE = 100;
const ZOOM_LIST = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type ZoomLevel = (typeof ZOOM_LIST)[number];

interface ZoomContextType {
  hexSize: number;
  zoomIndex: number;
  zoom: ZoomLevel;
  zoomIn: () => void;
  zoomOut: () => void;
}

const defaultContext: ZoomContextType = {
  hexSize: SIZE,
  zoomIndex: 3,
  zoom: 1,
  zoomIn: () => undefined,
  zoomOut: () => undefined
};

const ZoomContext = createContext<ZoomContextType>(defaultContext);

export const useZoom = () => useContext(ZoomContext);

interface ZoomProviderProps {
  children: ReactNode;
}

export const ZoomProvider = ({ children }: ZoomProviderProps) => {
  const [hexSize, setHexSize] = useState<number>(SIZE);
  const [zoomIndex, setZoomIndex] = useState<number>(3);
  const [zoom, setZoom] = useState<ZoomLevel>(1);

  const zoomIn = () => {
    setZoomIndex((prev) => {
      const newIndex = Math.min(prev + 1, ZOOM_LIST.length - 1);
      const newZoom = ZOOM_LIST[newIndex] ?? 1;
      setZoom(newZoom);
      setHexSize(SIZE * newZoom);
      return newIndex;
    });
  };

  const zoomOut = () => {
    setZoomIndex((prev) => {
      const newIndex = Math.max(prev - 1, 0);
      const newZoom = ZOOM_LIST[newIndex] ?? 1;
      setZoom(newZoom);
      setHexSize(SIZE * newZoom);
      return newIndex;
    });
  };

  return (
    <ZoomContext.Provider value={{ hexSize, zoomIndex, zoom, zoomIn, zoomOut }}>
      {children}
    </ZoomContext.Provider>
  );
};