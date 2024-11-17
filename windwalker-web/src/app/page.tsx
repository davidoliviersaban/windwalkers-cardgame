import { ZoomProvider } from "~/providers/ZoomProvider";
import HexGridEditor from "~/components/HexGridEditor";

export default function HomePage() {
  return (
    <ZoomProvider>
      <h1>Windwalker</h1>
      <p>Windwalker is a game about exploring the world.</p>
      <div className="container mx-auto p-4">
        <HexGridEditor/>
      </div>
    </ZoomProvider>
  );
}