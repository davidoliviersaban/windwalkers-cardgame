import { ZoomProvider } from "~/providers/ZoomProvider";
import HexGridEditor from "~/components/HexGridEditor";

export default function HomePage() {
  return (
    <ZoomProvider>
      <div className="container mx-auto p-4">
        <HexGridEditor />
      </div>
    </ZoomProvider>
  );
}
