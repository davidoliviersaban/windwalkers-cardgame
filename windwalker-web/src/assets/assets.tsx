import { IconComponents } from "./IconComponents";

interface Asset {
  type: string;
  name: string;
  icon: (() => JSX.Element) | null;
  color: string;
  img: string;
}
// Assets are the different types of tiles that can be placed on the grid
// this is a library of all the assets that can be placed on the grid

const Assets: { [key: string]: Asset; empty: Asset } = {
    empty: { type: '', name: 'empty', icon: null, color: '#eee', img: "" },
    plain:  { type: 'terrain', name: 'plain', icon: null, color: '#90EE90',  img: 'terrain/chapter1.14.png' },
    mountain:  { type: 'terrain', name: 'mountain', icon: IconComponents.Mountain ?? null, color: '#A0522D',  img: 'terrain/chapter1.12.png' },
    forest:  { type: 'terrain', name: 'forest', icon: IconComponents.Tree, color: '#228B22',  img: 'terrain/chapter1.13.png' },
    water:  { type: 'terrain', name: 'water', icon: IconComponents.Water, color: '#4682B4',  img: 'terrain/chapter2.17.png' },
    hut: { type: 'terrain', name: 'hut', icon: IconComponents.Village, color: '#FFD700', img: 'terrain/chapter1.16.png' },
    desert: { type: 'terrain', name: 'desert', icon: null, color: '#FFD700', img: 'terrain/chapter3.19.png' },
    swamp: { type: 'terrain', name: 'swamp', icon: null, color: '#FFD700', img: 'terrain/chapter4.21.png' },
    nordska: { type: 'terrain', name: 'ice', icon: null, color: '#FFD700', img: 'terrain/chapter5.23.png' },
    villageR: { type: 'building', name: 'RedVillage', icon: IconComponents.Village, color: '#FFD700', img: 'terrain/chapter.02.png' },
    villageB: { type: 'building', name: 'BlueVillage', icon: IconComponents.Village, color: '#DFFF00', img: 'terrain/chapter.01.png' },
    villageV: { type: 'building', name: 'GreenVillage', icon: IconComponents.Village, color: '#00D7FF', img: 'terrain/chapter.00.png' },
    aberlaas: { type: 'building', name: 'Aberlaas', icon: IconComponents.City, color: '#FF4500', img: 'terrain/chapter.03.png' },
    portChoon: { type: 'building', name: 'PortChoon', icon: IconComponents.City, color: '#FF4500', img: 'terrain/chapter.04.png' },
    tourFontaine: { type: 'building', name: 'TourFontaine', icon: IconComponents.Challenge, color: '#004500', img: 'terrain/chapter.05.png' },
    chawondasee: { type: 'building', name: 'Chawondasee', icon: IconComponents.City, color: '#FF4500', img: 'terrain/chapter.06.png' },
    alticcio: { type: 'building', name: 'Alticcio', icon: IconComponents.City, color: '#FF4500', img: 'terrain/chapter.07.png' },
    porteDHurle: { type: 'building', name: 'PorteDHurle', icon: IconComponents.Challenge, color: '#004500', img: 'terrain/chapter.08.png' },
    campBoban: { type: 'building', name: 'CampBoban', icon: IconComponents.City, color: '#FF4500', img: 'terrain/chapter.09.png' },
    village: { type: 'building', name: 'village', icon: IconComponents.Village, color: '#FFD700', img: 'terrain/chapter.10.png' },
    compass: { type: 'building', name: 'compass', icon: null, color: '#FFD700', img: 'terrain/chapter.11.png' },

    // temple: { type: 'building', name: 'temple', icon: IconComponents.Temple, color: '#DEB887' },
    // tour: { type: 'building', name: 'tower', icon: IconComponents.Tower, color: '#808080' }
  };



  const loadImageAssetsToSvg = (size: number) => {         
    return (<>
      {Object.values(Assets).filter(asset => asset.img !== null).map(asset => (
        <pattern 
          key={asset.name} 
          id={`pattern-image-${asset.name}`} 
          patternUnits="objectBoundingBox"
          preserveAspectRatio="xMidYMid slice"
          width="1" 
          height="1"
        >
          <image 
            width={1.06*size*2} 
            height={1.06*size*2}
            x={ -.06*size }  // Centrage: (1 - 1.03) / 2
            y={ -.06*size*3}  // Centrage: (1 - 1.03) / 2
            preserveAspectRatio="xMidYMid meet"
            href={asset?.img}
            style={{
              imageRendering: "auto",
              // webkitImageRendering: "optimize-contrast"
            }}
            />
        </pattern>
      ))}
    </>);
  };

export { Assets, loadImageAssetsToSvg };
export type { Asset };