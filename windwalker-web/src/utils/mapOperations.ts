import type { Tile } from "~/models/Tile";
import { createTile } from "~/models/Tile";
import type { Asset } from "~/assets/assets";
import { computeViewport } from "~/hex/utilities";
import { Print } from "~/components/Print";

// ============================================================================
// MAP FILE OPERATIONS
// ============================================================================

/**
 * Load a map from a JSON file
 */
export function loadMapFromFile(
    file: File,
    setTitle: (title: string) => void,
    setGrid: React.Dispatch<React.SetStateAction<Tile[]>>,
    centerViewOnGrid: (tiles: Tile[]) => void,
): void {
    const reader = new FileReader();

    reader.onload = (e) => {
        if (e.target) {
            const content = e.target.result;
            if (typeof content === "string") {
                const data = JSON.parse(content) as { title: string; grid: Tile[] };
                const { title, grid } = data;
                setTitle(title);
                setGrid(grid);
                // Center view on the imported map after a short delay to ensure render
                setTimeout(() => centerViewOnGrid(grid), 100);
            }
        }
    };

    reader.readAsText(file);
}

/**
 * Save the current map to a JSON file
 */
export function saveMapToFile(title: string, grid: Tile[]): void {
    const mapData = {
        title,
        grid,
        metadata: { createdAt: new Date().toISOString(), name: "Windwalker map" },
    };
    const content = JSON.stringify(mapData, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.json`;
    a.click();
}

/**
 * Print the current map
 */
export async function printMapData(
    title: string,
    grid: Tile[],
    selectedAsset: Asset,
): Promise<void> {
    console.log("Printing:", title, grid);
    await Print({ title, grid, selectedAsset });
}

// ============================================================================
// GRID MANIPULATION
// ============================================================================

/**
 * Handle hex tile click - add, remove, or update tile
 */
export function handleHexClick(
    q: number,
    r: number,
    selectedAsset: Asset,
    setGrid: React.Dispatch<React.SetStateAction<Tile[]>>,
): void {
    setGrid((prev) => {
        const newGrid = [...prev];
        const existingTileIndex = newGrid.findIndex(
            (tile) => tile.q === q && tile.r === r,
        );

        if (!selectedAsset || selectedAsset?.name === "empty") {
            if (existingTileIndex >= 0) {
                newGrid.splice(existingTileIndex, 1);
            }
            return newGrid;
        } else if (existingTileIndex >= 0) {
            newGrid[existingTileIndex] = createTile(q, r, selectedAsset);
        } else {
            newGrid.push(createTile(q, r, selectedAsset));
        }
        return newGrid;
    });
}

// ============================================================================
// VIEW OPERATIONS
// ============================================================================

/**
 * Center the view on the given tiles
 */
export function createCenterViewOnGrid(
    hexSize: number,
    containerSize: { width: number; height: number },
    setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
) {
    return (tiles: Tile[]) => {
        if (tiles.length === 0) return;

        const bounds = computeViewport(tiles, hexSize);
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        setOffset({
            x: centerX - containerSize.width / 2,
            y: centerY - containerSize.height / 2,
        });
    };
}
