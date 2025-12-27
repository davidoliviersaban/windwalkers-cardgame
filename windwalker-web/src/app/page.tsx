import { ZoomProvider } from "~/providers/ZoomProvider";
import HexGridEditor from "~/components/HexGridEditor";

export default function HomePage() {
  return (
    <ZoomProvider>
      <div className="h-screen overflow-hidden">
        <HexGridEditor />
      </div>
    </ZoomProvider>
  );
}
