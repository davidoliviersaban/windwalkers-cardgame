import type { Asset } from '~/assets/assets';

interface Tile {
    q: number;
    r: number;
    type: string;
    name: string;
    color: string;
    img: string;
}

// create a function that can generate a Tile from an asset
const createTile = (q: number, r: number, asset: Asset): Tile => {
    return { q, r, type: asset.type, name: asset.name, color: asset.color, img: asset.img ?? '' };
};

export type { Tile };
export { createTile };