// src/components/StatusNode.jsx
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Loader2, CheckCircle, Circle, AlertCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default memo(function StatusNode({ data }) {
  // data.status can be 'idle', 'running', 'done', 'error'
  const { label, status = 'idle', details } = data;

  const statusStyles = {
    idle: 'border-slate-300 bg-white text-slate-500',
    running: 'border-blue-500 bg-blue-50 text-blue-700 shadow-blue-100',
    done: 'border-green-500 bg-green-50 text-green-700 shadow-green-100',
    error: 'border-red-500 bg-red-50 text-red-700 shadow-red-100',
  }[status];

  return (
    <div className={cn(
        "px-4 py-3 shadow-md rounded-xl border-2 transition-all duration-300 min-w-[180px]",
        statusStyles,
        status === 'running' && "scale-105 shadow-xl ring-2 ring-blue-200"
    )}>
      
      <div className="flex items-center gap-3">
        {status === 'running' && <Loader2 className="w-5 h-5 animate-spin" />}
        {status === 'done' && <CheckCircle className="w-5 h-5" />}
        {status === 'error' && <XCircle className="w-5 h-5" />}
        {status === 'idle' && <Circle className="w-5 h-5 opacity-40" />}
        
        <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wide uppercase">{label}</span>
            {status === 'running' && <span className="text-[10px] animate-pulse">Processing...</span>}
            {status === 'done' && <span className="text-[10px]">Complete</span>}
        </div>
      </div>

      {/* Handles for connecting nodes */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />
    </div>
  );
});
