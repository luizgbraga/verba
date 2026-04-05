import { ReactFlowProvider } from "@xyflow/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchInput } from "@/components/SearchInput";
import { EtymologyGraph } from "@/components/EtymologyGraph";
import { useVerba } from "@/hooks/useVerba";

function AppContent() {
  const hasSearched = useVerba((s) => s.hasSearched);
  const error = useVerba((s) => s.error);
  const nodes = useVerba((s) => s.nodes);
  const loading = useVerba((s) => s.loading);

  return (
    <div className="h-full w-full flex flex-col">
      <header
        className={`flex flex-col items-center justify-center px-6 shrink-0 transition-all duration-700 ease-out ${hasSearched ? "pt-4 pb-3" : "pt-[25vh] pb-8"}`}
      >
        <h1
          className={`font-light tracking-[0.3em] uppercase text-foreground/80 transition-all duration-700 ease-out select-none ${hasSearched ? "text-lg mb-3" : "text-4xl mb-8"}`}
        >
          Verba
        </h1>
        {!hasSearched && (
          <p className="text-muted-foreground text-sm mb-8 tracking-wide">The etymology explorer</p>
        )}
        <SearchInput />
      </header>

      {error && !loading && (
        <div className="flex-1 flex items-start justify-center pt-20">
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      )}

      {hasSearched && nodes.length > 0 && !error && (
        <div className="flex-1 min-h-0">
          <EtymologyGraph />
        </div>
      )}

      {hasSearched && !nodes.length && !error && !loading && (
        <div className="flex-1 flex items-start justify-center pt-20">
          <p className="text-muted-foreground text-sm">No results found</p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </TooltipProvider>
  );
}
