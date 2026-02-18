// src/components/WorkflowBoard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, addEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import StatusNode from './StatusNode';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { Play, RotateCcw, MonitorPlay, FileText, CheckCircle2, AlertTriangle, Terminal, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ========== 1. GRAPH DEFINITION ==========
const nodeTypes = {
  statusNode: StatusNode,
};

const initialNodes = [
  { 
    id: 'start', 
    type: 'input', 
    data: { label: 'Audit Request' }, 
    position: { x: 250, y: 0 },
    style: { background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '12px', padding: '10px', width: 180, textAlign: 'center', fontWeight: 'bold' }
  },
  { 
    id: 'indexer', 
    type: 'statusNode', 
    data: { label: 'Video Indexer', status: 'idle' }, 
    position: { x: 250, y: 120 } 
  },
  { 
    id: 'auditor', 
    type: 'statusNode', 
    data: { label: 'Compliance Auditor', status: 'idle' }, 
    position: { x: 250, y: 240 } 
  },
  { 
    id: 'end', 
    type: 'output', 
    data: { label: 'Final Report' }, 
    position: { x: 250, y: 360 },
    style: { background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '12px', padding: '10px', width: 180, textAlign: 'center', fontWeight: 'bold' }
  },
];

const initialEdges = [
  { id: 'e1-2', source: 'start', target: 'indexer', animated: false },
  { id: 'e2-3', source: 'indexer', target: 'auditor', animated: false },
  { id: 'e3-4', source: 'auditor', target: 'end', animated: false },
];

const WS_URL = 'ws://localhost:8000/ws/audit';


export default function WorkflowBoard() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [videoUrl, setVideoUrl] = useState("https://youtu.be/dT7S75eYhcQ");
  const [logs, setLogs] = useState([]);
  const [auditResult, setAuditResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef(null);

  const { sendMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const event = JSON.parse(lastMessage.data);
        handleGraphEvent(event);
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const handleGraphEvent = (event) => {
    const timestamp = new Date().toLocaleTimeString();
    
    // Log filtering
    if (event.type === 'system') {
        const logEntry = { time: timestamp, msg: `SYSTEM: ${event.message}`, type: 'system' };
        setLogs(prev => [...prev, logEntry]);
        if (event.message === "Audit complete") setIsRunning(false);
        return;
    }

    // Capture useful logs
    let logMessage = `[${event.type}]`;
    if (event.name) logMessage += ` ${event.name}`;
    
    // Only log significant events to keep UI clean
    if (['on_chain_start', 'on_chain_end', 'on_chain_error'].includes(event.type)) {
         setLogs(prev => [...prev, { time: timestamp, msg: logMessage, type: event.type }]);
    }

    // Node State Updates
    if (event.type === 'on_chain_start') {
      const nodeName = event.name; 
      if (['indexer', 'auditor'].includes(nodeName)) {
        updateNodeStatus(nodeName, 'running');
        highlightEdgeTo(nodeName, true);
      }
    } else if (event.type === 'on_chain_end') {
      const nodeName = event.name;
      if (['indexer', 'auditor'].includes(nodeName)) {
        updateNodeStatus(nodeName, 'done');
        highlightEdgeTo(nodeName, false);
      }
      
      // Look for Final Report
      if (event.name === "LangGraph" && event.data?.output) {
          setAuditResult(event.data.output);
          setIsRunning(false);
      }
      // Fallback
      if (event.name === "auditor" && event.data?.output) {
          setAuditResult(event.data.output);
      }
    } else if (event.type === 'on_chain_error') {
        setLogs(prev => [...prev, { time: timestamp, msg: `ERROR: ${event.error || 'Unknown error'}`, type: 'error' }]);
        if (event.name) updateNodeStatus(event.name, 'error');
        setIsRunning(false);
    }
  };

  const updateNodeStatus = (nodeId, status) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, status: status } };
        }
        return node;
      })
    );
  };

  const highlightEdgeTo = (targetNodeId, animated) => {
      setEdges((eds) => 
        eds.map((edge) => {
            if (edge.target === targetNodeId) {
                return { 
                    ...edge, 
                    animated: animated, 
                    style: { 
                        stroke: animated ? '#3b82f6' : '#b1b1b7', 
                        strokeWidth: animated ? 3 : 2 
                    }
                };
            }
            return edge;
        })
      );
  };

  const startAudit = () => {
    if (readyState !== ReadyState.OPEN) return;
    
    setLogs([]);
    setAuditResult(null);
    setIsRunning(true);
    setNodes(initialNodes);
    setEdges(initialEdges);

    sendMessage(JSON.stringify({ video_url: videoUrl }));
  };

  return (
    <div className="flex flex-row h-full w-full overflow-hidden">
      
      {/* LEFT PANEL */}
      <div className="w-80 bg-white border-r flex flex-col shadow-xl z-20 flex-shrink-0">
        <div className="p-6 border-b">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Configuration</h2>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">YouTube Video URL</label>
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50 focus-within:ring-2 ring-blue-100 transition-all">
                        <MonitorPlay className="w-4 h-4 text-slate-400" />
                        <input 
                            className="bg-transparent text-sm w-full outline-none text-slate-700 placeholder-slate-400" 
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://youtu.be/..."
                        />
                    </div>
                </div>

                <button 
                    onClick={startAudit}
                    disabled={isRunning || readyState !== ReadyState.OPEN}
                    className={cn(
                        "w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all transform active:scale-95",
                        isRunning 
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:from-blue-700 hover:to-indigo-700"
                    )}
                >
                    {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    {isRunning ? "Running Analysis..." : "Start Compliance Audit"}
                </button>
                
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 py-1 rounded-md">
                    <span className={cn(
                        "w-2 h-2 rounded-full animate-pulse", 
                        readyState === ReadyState.OPEN ? "bg-green-500" : "bg-red-500"
                    )} />
                    {readyState === ReadyState.OPEN ? "System Online" : "Connecting..."}
                </div>
            </div>
        </div>

        {/* Audit Results */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
            {auditResult ? (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Final Report
                    </h3>
                    
                    <div className={cn(
                        "p-4 rounded-xl border mb-4 shadow-sm",
                        auditResult.final_status === 'PASS' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    )}>
                        <div className="flex items-center gap-3 font-bold text-base">
                            {auditResult.final_status === 'PASS' 
                                ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                                : <AlertTriangle className="w-6 h-6 text-red-600" />
                            }
                            <span className={auditResult.final_status === 'PASS' ? "text-green-800" : "text-red-800"}>
                                {auditResult.final_status}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border shadow-sm space-y-2 mb-4">
                        <p className="font-bold text-xs text-slate-400 uppercase tracking-wider">AI Summary</p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            {auditResult.final_report}
                        </p>
                    </div>

                    {auditResult.compliance_results && auditResult.compliance_results.length > 0 && (
                        <div className="mt-4 space-y-2 pb-10">
                            <p className="font-bold text-xs text-slate-400 uppercase tracking-wider">Violations Detected</p>
                            {auditResult.compliance_results.map((issue, idx) => (
                                <div key={idx} className="bg-red-50 border border-red-100 p-3 rounded-lg text-xs text-red-800 shadow-sm">
                                    <span className="font-bold block mb-1">[{issue.severity}] {issue.category}</span>
                                    {issue.description}
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-3">
                    <MonitorPlay className="w-12 h-12 opacity-20" />
                    <p className="text-sm font-medium">Ready for analysis</p>
                </div>
            )}
        </div>
      </div>

      {/* CENTER: Visualization */}
      <div className="flex-1 h-full relative bg-slate-50">
        <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur px-3 py-1 rounded-full border text-xs font-semibold text-slate-500 shadow-sm">
            Workflow Visualization
        </div>
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
        >
            <Background color="#94a3b8" gap={25} size={1.5} variant="dots" />
            <Controls className="!bg-white !border-slate-200 !shadow-lg !rounded-lg !text-slate-600" />
        </ReactFlow>
      </div>

      {/* RIGHT: Terminal */}
      <div className="w-80 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-700 shadow-2xl z-20 flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">Live Logs</span>
            </div>
            <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
            </div>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
            {logs.length === 0 && (
                <div className="opacity-30 italic text-center mt-20 text-xs">Waiting for stream...</div>
            )}
            {logs.map((log, i) => (
                <div key={i} className="flex gap-2 group hover:bg-white/5 p-0.5 rounded px-1 transition-colors border-l-2 border-transparent hover:border-slate-600">
                    <span className="text-slate-600 select-none w-14 shrink-0 font-medium opactiy-70">[{log.time.split(' ')[0]}]</span>
                    <span className={cn(
                        "break-all",
                        log.msg.includes("error") || log.msg.includes("ERROR") ? "text-red-400 font-bold" : 
                        log.msg.includes("start") ? "text-blue-400 font-medium" : 
                        log.msg.includes("end") ? "text-emerald-400 font-medium" : 
                        log.msg.includes("SYSTEM") ? "text-yellow-200 font-bold" : "text-slate-300"
                    )}>
                        {log.msg}
                    </span>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
}
