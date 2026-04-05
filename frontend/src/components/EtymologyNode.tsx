import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface NodeData {
  term: string;
  lang: string;
  definition?: string;
  isRoot: boolean;
  color: string;
  [key: string]: unknown;
}

const HANDLE_CLASS = "!bg-transparent !border-0";
const NODE_WIDTH = 150;

function withAlpha(hslColor: string, alpha: number): string {
  const match = hslColor.match(/hsl\((.+)\)/);
  if (match) return `hsla(${match[1]}, ${alpha})`;
  return hslColor;
}

function EtymologyNodeRaw({ data }: NodeProps) {
  const { term, lang, definition, isRoot, color } = data as unknown as NodeData;
  const [visible, setVisible] = useState(false);
  const [showDef, setShowDef] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="cursor-pointer"
      style={{
        width: NODE_WIDTH,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.92)",
        transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} className={`${HANDLE_CLASS} !w-3 !h-1 !min-h-0`} />
      <Handle type="source" position={Position.Bottom} className={`${HANDLE_CLASS} !w-3 !h-1 !min-h-0`} />
      <Handle type="target" position={Position.Left} id="left-in" className={`${HANDLE_CLASS} !w-1 !h-3 !min-w-0`} />
      <Handle type="source" position={Position.Right} id="right-out" className={`${HANDLE_CLASS} !w-1 !h-3 !min-w-0`} />

      <div
        style={{
          padding: isRoot ? "14px 16px" : "10px 12px",
          borderRadius: 14,
          border: isRoot ? `2px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
          background: isRoot
            ? "linear-gradient(135deg, rgba(28,25,23,0.95), rgba(12,10,9,0.95))"
            : "rgba(28,25,23,0.7)",
          backdropFilter: "blur(8px)",
          boxShadow: isRoot
            ? `0 0 30px ${withAlpha(color, 0.08)}, 0 4px 20px rgba(0,0,0,0.4)`
            : "0 2px 8px rgba(0,0,0,0.3)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.borderColor = isRoot ? color : "rgba(255,255,255,0.12)";
          if (definition) setShowDef(true);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = isRoot ? color : "rgba(255,255,255,0.06)";
          setShowDef(false);
        }}
      >
        <div style={{
          fontSize: isRoot ? 15 : 13,
          fontWeight: 600,
          textAlign: "center",
          color: isRoot ? color : "#e7e5e4",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {term}
        </div>
        <div style={{
          fontSize: 9,
          textAlign: "center",
          marginTop: 4,
          color: withAlpha(color, 0.6),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
        }}>
          {lang}
        </div>
      </div>

      {/* Definition tooltip */}
      {showDef && definition && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: 8,
            width: 240,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(12,10,9,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <div style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: "rgba(212,208,204,0.85)",
          }}>
            {definition}
          </div>
        </div>
      )}
    </div>
  );
}

export const EtymologyNode = memo(EtymologyNodeRaw);
