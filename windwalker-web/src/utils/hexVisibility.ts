import { pixelToHex } from "~/hex/utilities";

// ============================================================================
// HEX VISIBILITY CALCULATION
// ============================================================================

/**
 * Calculate which hexagons are visible based on offset and container size
 */
export function getVisibleHexagons(
    offset: { x: number; y: number },
    containerSize: { width: number; height: number },
    hexSize: number,
): Array<{ q: number; r: number }> {
    // Add padding to render hexagons just outside the viewport
    const padding = 3;

    // Convert all 4 corners of the viewport to hex coordinates
    // In axial coordinates, q and r axes are not perpendicular, so we need all corners
    const topLeft = pixelToHex(offset.x, offset.y, hexSize);
    const topRight = pixelToHex(
        offset.x + containerSize.width,
        offset.y,
        hexSize,
    );
    const bottomLeft = pixelToHex(
        offset.x,
        offset.y + containerSize.height,
        hexSize,
    );
    const bottomRight = pixelToHex(
        offset.x + containerSize.width,
        offset.y + containerSize.height,
        hexSize,
    );

    // Find the min/max q and r across all 4 corners
    const minQ = Math.min(topLeft.q, topRight.q, bottomLeft.q, bottomRight.q);
    const maxQ = Math.max(topLeft.q, topRight.q, bottomLeft.q, bottomRight.q);
    const minR = Math.min(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r);
    const maxR = Math.max(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r);

    const startQ = Math.floor(minQ) - padding;
    const startR = Math.floor(minR) - padding;
    const endQ = Math.ceil(maxQ) + padding;
    const endR = Math.ceil(maxR) + padding;

    const hexagons: { q: number; r: number }[] = [];
    for (let q = startQ; q <= endQ; q++) {
        for (let r = startR; r <= endR; r++) {
            hexagons.push({ q, r });
        }
    }
    return hexagons;
}
