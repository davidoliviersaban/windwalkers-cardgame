"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const SIZE = 100;
const ZOOM_LIST = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type ZoomLevel = (typeof ZOOM_LIST)[number];

interface ZoomContextType {
  hexSize: number;
  zoomIndex: number;
  zoom: ZoomLevel;
  zoomIn: () => void;
  zoomOut: () => void;
  onZoomChange: (
    callback: (oldZoom: ZoomLevel, newZoom: ZoomLevel) => void,
  ) => () => void;
}

const defaultContext: ZoomContextType = {
  hexSize: SIZE,
  zoomIndex: 3,
  zoom: 1,
  zoomIn: () => undefined,
  zoomOut: () => undefined,
  onZoomChange: () => () => undefined,
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
  const [listeners] = useState<
    Set<(oldZoom: ZoomLevel, newZoom: ZoomLevel) => void>
  >(new Set());

  const onZoomChange = useCallback(
    (callback: (oldZoom: ZoomLevel, newZoom: ZoomLevel) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    [listeners],
  );

  const notifyListeners = useCallback(
    (oldZoom: ZoomLevel, newZoom: ZoomLevel) => {
      listeners.forEach((cb) => cb(oldZoom, newZoom));
    },
    [listeners],
  );

  const zoomIn = () => {
    setZoomIndex((prev) => {
      const newIndex = Math.min(prev + 1, ZOOM_LIST.length - 1);
      const newZoom = ZOOM_LIST[newIndex] ?? 1;
      const oldZoom = ZOOM_LIST[prev] ?? 1;
      setZoom(newZoom);
      setHexSize(SIZE * newZoom);
      setTimeout(() => notifyListeners(oldZoom, newZoom), 0);
      return newIndex;
    });
  };

  const zoomOut = () => {
    setZoomIndex((prev) => {
      const newIndex = Math.max(prev - 1, 0);
      const newZoom = ZOOM_LIST[newIndex] ?? 1;
      const oldZoom = ZOOM_LIST[prev] ?? 1;
      setZoom(newZoom);
      setHexSize(SIZE * newZoom);
      setTimeout(() => notifyListeners(oldZoom, newZoom), 0);
      return newIndex;
    });
  };

  return (
    <ZoomContext.Provider
      value={{ hexSize, zoomIndex, zoom, zoomIn, zoomOut, onZoomChange }}
    >
      {children}
    </ZoomContext.Provider>
  );
};
