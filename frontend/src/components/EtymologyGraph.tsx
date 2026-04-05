import { useCallback, useEffect } from "react";
import {
  ReactFlow, Background, Controls, useReactFlow,
  type NodeTypes, type Node, BackgroundVariant,
} from "@xyflow/react";
import { useVerba } from "@/hooks/useVerba";
import { EtymologyNode } from "@/components/EtymologyNode";
import { Button } from "@/components/ui/button";

const nodeTypes: NodeTypes = { etymology: EtymologyNode };

export function EtymologyGraph() {
  const nodes = useVerba((s) => s.nodes);
  const edges = useVerba((s) => s.edges);
  const rootId = useVerba((s) => s.rootId);
  const history = useVerba((s) => s.history);
  const goBack = useVerba((s) => s.goBack);
  const recenter = useVerba((s) => s.recenter);
  const { setCenter, getZoom } = useReactFlow();

  useEffect(() => {
    if (!nodes.length || !rootId) return;
    const root = nodes.find((n) => n.id === rootId);
    if (!root) return;
    const timer = setTimeout(() => {
      setCenter(root.position.x + 75, root.position.y + 30, {
        zoom: Math.max(getZoom(), 0.7),
        duration: 600,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [nodes, rootId, setCenter, getZoom]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && history.length) goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [history, goBack]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => recenter(node.id), [recenter]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      minZoom={0.1} maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false} nodesConnectable={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#292524" />
      <Controls showInteractive={false} />

      {history.length > 0 && (
        <div className="absolute top-4 left-4 z-10">
          <Button variant="outline" size="sm" onClick={goBack} className="gap-2 bg-card/90 backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Back
            <kbd className="text-[10px] text-muted-foreground ml-1">Esc</kbd>
          </Button>
        </div>
      )}
    </ReactFlow>
  );
}
