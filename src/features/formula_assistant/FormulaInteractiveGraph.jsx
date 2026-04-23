import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useFormula } from '../../context/FormulaContext';
import { useWorkflow } from '../../context/WorkflowContext';
import { buildChainTree } from '../../utils/dependencyResolver';
import { evaluateFormula } from '../../utils/astCompiler';

/**
 * FormulaInteractiveGraph
 * Updated: Auto-hide tooltip on mouse leave, original case for names.
 */
export const FormulaInteractiveGraph = () => {
    const { isDarkMode, themeUI } = useThemeContext();
    const { 
        chainViewFormula, 
        customFormulas, 
        results
    } = useFormula();
    const { setCurrentStep } = useWorkflow();

    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const [graphData, setGraphData] = useState(null);
    const [gridCols, setGridCols] = useState(6);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [relatedElements, setRelatedElements] = useState({ nodes: new Set(), links: new Set() });
    
    const [tracerInputs, setTracerInputs] = useState({});
    const [tracerResults, setTracerResults] = useState({});
    const [isCalculating, setIsCalculating] = useState(false);
    const [simulationLogs, setSimulationLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);
    const logEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        if (showLogs && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [simulationLogs, showLogs]);

    // 1. Responsive Grid Logic
    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            if (w < 1000) setGridCols(3);
            else if (w < 1400) setGridCols(4);
            else if (w < 1800) setGridCols(6);
            else setGridCols(8);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 2. Build Data and Compact Layout
    useEffect(() => {
        if (!chainViewFormula) return;

        const excelColumns = new Set();
        if (results && results.length > 0) {
            const row = results[0];
            Object.keys(row.baseVals || {}).forEach(k => excelColumns.add(String(k).toLowerCase()));
            Object.values(row.targetVals || {}).forEach(tvObj => {
                Object.keys(tvObj || {}).forEach(k => excelColumns.add(String(k).toLowerCase()));
            });
        }

        const tree = buildChainTree(chainViewFormula, customFormulas, excelColumns);
        const nodes = [];
        const links = [];
        
        const traverse = (node, depth = 0) => {
            let existingNode = nodes.find(n => n.label === node.label);
            if (!existingNode) {
                existingNode = { ...node, depth, x: 0, y: 0 };
                nodes.push(existingNode);
            }
            node.children.forEach(child => {
                const childNode = traverse(child, depth + 1);
                links.push({
                    source: existingNode.label,
                    target: childNode.label,
                    id: `${existingNode.label}-${childNode.label}`
                });
            });
            return existingNode;
        };

        traverse(tree);

        const rootNode = nodes.find(n => n.label === chainViewFormula.targetCol);
        const otherNodes = nodes.filter(n => n.label !== chainViewFormula.targetCol);

        const SECTION_GAP = 200; 
        const GRID_GAP_X = 265;
        const GRID_GAP_Y = 140; 

        if (rootNode) {
            rootNode.x = 0;
            rootNode.y = -SECTION_GAP - 100;
        }

        otherNodes.forEach((node, idx) => {
            const col = idx % gridCols;
            const row = Math.floor(idx / gridCols);
            node.x = (col - (gridCols - 1) / 2) * GRID_GAP_X;
            node.y = row * GRID_GAP_Y;
        });

        setGraphData({ 
            nodes, 
            links, 
            sectionPositions: { root: -SECTION_GAP - 100, formula: 0 } 
        });
        
        const initialInputs = {};
        nodes.forEach(n => {
            if (n.type === 'source') {
                 const mock = customFormulas.find(f => f.targetCol === n.label);
                 if (mock && !isNaN(Number(mock.expression))) initialInputs[n.label] = mock.expression;
            }
        });
        setTracerInputs(initialInputs);
    }, [chainViewFormula, customFormulas, results, gridCols]);

    const handleNodeHover = useCallback((nodeId) => {
        setHoveredNodeId(nodeId);
        if (!nodeId) { setRelatedElements({ nodes: new Set(), links: new Set() }); return; }
        const relatedNodes = new Set([nodeId]);
        const relatedLinks = new Set();
        const traceDown = (id) => { graphData.links.forEach(l => { if (l.source === id) { relatedNodes.add(l.target); relatedLinks.add(l.id); traceDown(l.target); } }); };
        const traceUp = (id) => { graphData.links.forEach(l => { if (l.target === id) { relatedNodes.add(l.source); relatedLinks.add(l.id); traceUp(l.source); } }); };
        traceDown(nodeId);
        traceUp(nodeId);
        setRelatedElements({ nodes: relatedNodes, links: relatedLinks });
    }, [graphData]);

    const runSimulation = useCallback(() => {
        if (!graphData) return;
        setIsCalculating(true);
        setShowLogs(true);
        const newLogs = [];
        const pushLog = (msg, type = 'info') => {
            newLogs.push({ time: new Date().toLocaleTimeString(), msg, type });
        };

        pushLog(`🚀 Khởi động mô phỏng cho: ${chainViewFormula?.targetCol}`, 'info');

        const resultsMap = {};
        const currentInputs = { ...tracerInputs };
        
        const evalRecursive = (nodeLabel, depth = 0) => {
            const indent = "  ".repeat(depth);
            const node = graphData.nodes.find(n => n.label === nodeLabel);
            if (!node) {
                pushLog(`${indent}❌ Lỗi: Không tìm thấy node ${nodeLabel}`, 'error');
                return 0;
            }

            if (currentInputs[nodeLabel] !== undefined && currentInputs[nodeLabel] !== '' && nodeLabel !== chainViewFormula.targetCol) {
                const val = currentInputs[nodeLabel];
                pushLog(`${indent}⚡ ${nodeLabel} = ${val} (Giá trị nạp tay)`, 'success');
                resultsMap[nodeLabel] = val; 
                return val;
            }

            if (node.type === 'source') { 
                const val = currentInputs[nodeLabel] || 0;
                pushLog(`${indent}📥 ${nodeLabel} = ${val} (Dữ liệu gốc)`, 'info');
                resultsMap[nodeLabel] = val; 
                return resultsMap[nodeLabel]; 
            }

            pushLog(`${indent}🔍 Đang tính toán ${nodeLabel}...`, 'info');
            const childLinks = graphData.links.filter(l => l.source === nodeLabel);
            const childValues = {};
            childLinks.forEach(link => { 
                childValues[link.target] = evalRecursive(link.target, depth + 1); 
            });

            try {
                if (!node.expression || node.expression.trim() === '') {
                    pushLog(`${indent}⚠️ ${nodeLabel} không có công thức, mặc định = 0`, 'info');
                    resultsMap[nodeLabel] = 0;
                    return 0;
                }
                const { result } = evaluateFormula(node.expression, childValues, false);
                
                // Chuẩn hóa kết quả: Nếu là chuỗi lỗi thì chuyển về 0 cho mô phỏng
                const normalizedResult = (result === 'Lỗi tính toán' || result === 'Lỗi hệ thống' || result === 'Sai cú pháp') ? 0 : result;
                
                pushLog(`${indent}✅ ${nodeLabel} = ${normalizedResult}`, 'success');
                resultsMap[nodeLabel] = normalizedResult; 
                return normalizedResult;
            } catch (err) {
                pushLog(`${indent}❌ Lỗi tại ${nodeLabel}: ${err.message}`, 'error');
                resultsMap[nodeLabel] = 0; // Default to 0 on error
                return 0;
            }
        };

        try { 
            const finalResult = evalRecursive(chainViewFormula.targetCol); 
            setTracerResults(resultsMap); 
            pushLog(`✅ Mô phỏng hoàn tất. Kết quả cuối cùng: ${finalResult}`, 'success');
        } catch (err) { 
            pushLog(`❌ Mô phỏng thất bại: ${err.message}`, 'error');
            console.error(err); 
        } finally { 
            setSimulationLogs(newLogs);
            setIsCalculating(false); 
        }
    }, [graphData, tracerInputs, chainViewFormula]);

    const handleWheel = (e) => { e.preventDefault(); setTransform(prev => ({ ...prev, k: Math.min(Math.max(prev.k * Math.pow(1.1, -e.deltaY / 100), 0.1), 3) })); };
    const handleMouseDown = (e) => { 
        if (e.target.closest('.interactive-node')) return; 
        isDraggingRef.current = true; 
        lastMousePos.current = { x: e.clientX, y: e.clientY }; 
        setSelectedNodeId(null); // Click background to deselect
    };
    const handleMouseMove = (e) => { if (!isDraggingRef.current) return; const dx = e.clientX - lastMousePos.current.x; const dy = e.clientY - lastMousePos.current.y; setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); lastMousePos.current = { x: e.clientX, y: e.clientY }; };
    const handleMouseUp = () => { isDraggingRef.current = false; };

    const handleNodeClick = (nodeId) => {
        setSelectedNodeId(prev => prev === nodeId ? null : nodeId);
    };

    if (!graphData) return null;

    const isActive = hoveredNodeId !== null;

    return (
        <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col overflow-hidden animate-fade-in text-slate-300">
            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-slate-900/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentStep('formula')} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg></button>
                    <div>
                        <h2 className="text-white font-black tracking-tight flex items-center gap-2">MÔ PHỎNG CẤU TRÚC<span className="text-amber-500 text-[10px] px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20 uppercase">Pro Visualizer</span></h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{chainViewFormula?.targetCol}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="hidden lg:block px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-slate-500 uppercase">Grid: {gridCols} Columns</div>
                     <button onClick={runSimulation} disabled={isCalculating} className={`px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-2xl ${isCalculating ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}>{isCalculating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>} RUN SIMULATION</button>
                </div>
            </header>

            {/* Main Canvas Area */}
            <div ref={containerRef} className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden bg-slate-950" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                
                <div className="absolute inset-0 transition-transform duration-75 origin-center" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transformOrigin: 'center' }}>
                    
                    <div className="absolute left-1/2 top-1/2 w-0 h-0">
                        
                        {/* Background Grid Labels */}
                        <div className="pointer-events-none opacity-45">
                             <div className="absolute left-[-1000px] w-[2000px] flex items-center gap-4" style={{ top: graphData.sectionPositions.root - 95 }}><div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-black">1</div> <span className="text-[11px] font-black uppercase tracking-[0.4em] whitespace-nowrap text-white">Final Result</span> <div className="flex-1 h-[2px] bg-gradient-to-r from-white/60 to-transparent"></div></div>
                             <div className="absolute left-[-1000px] w-[2000px] flex items-center gap-4" style={{ top: graphData.sectionPositions.formula - 95 }}><div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-black">2</div> <span className="text-[11px] font-black uppercase tracking-[0.4em] whitespace-nowrap text-white">Logic Components</span> <div className="flex-1 h-[2px] bg-gradient-to-r from-white/60 to-transparent"></div></div>
                        </div>

                        {/* SVG Connections */}
                        <svg className="absolute pointer-events-none" style={{ left: 0, top: 0, overflow: 'visible', width: 1, height: 1 }}>
                            <defs>
                                <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" /></marker>
                                <marker id="arrowhead-dim" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto"><polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.08)" /></marker>
                            </defs>
                            {graphData.links.map(link => {
                                const source = graphData.nodes.find(n => n.label === link.source);
                                const target = graphData.nodes.find(n => n.label === link.target);
                                if (!source || !target) return null;
                                const isHighlighted = relatedElements.links.has(link.id);
                                const cpY = (source.y + target.y) / 2;
                                const path = `M ${target.x} ${target.y - 45} C ${target.x} ${cpY}, ${source.x} ${cpY}, ${source.x} ${source.y + 45}`;
                                return (
                                    <g key={link.id}>
                                        <path d={path} stroke={isHighlighted ? '#6366f1' : 'rgba(255,255,255,0.08)'} strokeWidth={isHighlighted ? 3 : 1.2} fill="none" markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead-dim)"} className="transition-all duration-300" />
                                        {isHighlighted && (
                                            <>
                                                <rect x={(source.x + target.x) / 2 - 45} y={cpY - 10} width="90" height="20" rx="10" fill="#1e293b" className="animate-fade-in" />
                                                <text x={(source.x + target.x) / 2} y={cpY + 3} textAnchor="middle" fill="#6366f1" className="text-[8px] font-black uppercase tracking-tighter animate-fade-in">▲ phụ thuộc vào</text>
                                            </>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Nodes Layer */}
                        {graphData.nodes.map(node => {
                            const isRoot = node.label === chainViewFormula.targetCol;
                            const result = tracerResults[node.label];
                            const isCalculated = result !== undefined;
                            const isFocused = isActive && relatedElements.nodes.has(node.label);
                            const dimClass = isActive && !isFocused ? 'opacity-10 scale-90 blur-[2px]' : 'opacity-100 scale-100';

                            return (
                                <div key={node.label} onMouseEnter={() => handleNodeHover(node.label)} onMouseLeave={() => { handleNodeHover(null); setSelectedNodeId(null); }} onClick={() => handleNodeClick(node.label)} className={`interactive-node absolute pointer-events-auto w-[230px] p-4 rounded-xl border transition-all duration-500 cursor-pointer flex flex-col gap-2 shadow-2xl ${dimClass} ${isFocused ? 'z-50 border-indigo-500 bg-[#1e1b4b] shadow-indigo-500/20' : 'z-10 border-white/5 bg-slate-900/80 backdrop-blur-md'} ${isRoot ? 'border-amber-500/50 bg-amber-950/20' : ''} ${selectedNodeId === node.label ? 'ring-2 ring-indigo-400' : ''}`} style={{ left: node.x - 115, top: node.y - 45 }}>
                                    
                                    {/* Formula Tooltip (Click based) */}
                                    {selectedNodeId === node.label && node.expression && (
                                        <div 
                                            className="absolute bottom-full left-0 mb-4 w-[300px] p-3 bg-slate-800 border border-indigo-500 rounded-xl shadow-2xl animate-fade-in z-[101] cursor-text select-text"
                                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the tooltip itself
                                        >
                                            <div className="text-[9px] font-black text-indigo-400 uppercase mb-1">Công thức gốc</div>
                                            <div className="text-[10px] font-mono text-slate-100 break-words leading-relaxed">{node.expression}</div>
                                            <div className="absolute left-6 top-full w-3 h-3 bg-slate-800 border-r border-b border-indigo-500 rotate-45 -translate-y-1.5"></div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-0.5">
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${isRoot ? 'text-amber-500' : (node.type === 'source' ? 'text-emerald-500' : 'text-indigo-400')}`}>{isRoot ? 'Final Result' : (node.type === 'source' ? 'Source Input' : 'Formula Component')}</span>
                                        <h4 className="text-[10px] font-bold truncate text-white">{node.label}</h4>
                                    </div>

                                    <div className={`p-2 rounded-lg border flex items-center justify-center min-h-[38px] transition-colors ${isRoot ? 'bg-amber-500/10 border-amber-500/20' : (isFocused ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-black/40 border-white/5')}`}>
                                        {!isRoot ? (
                                            <input type="text" className={`w-full bg-transparent border-none text-center font-mono font-black text-xs focus:outline-none placeholder-slate-800 ${tracerInputs[node.label] ? 'text-amber-400' : 'text-emerald-400'}`} placeholder={isCalculated ? (typeof result === 'string' ? 0 : result) : "Nhập số..."} value={tracerInputs[node.label] || ''} onChange={(e) => setTracerInputs(prev => ({ ...prev, [node.label]: e.target.value }))} onClick={(e) => e.stopPropagation()} />
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xs font-black font-mono ${isCalculated ? 'text-indigo-400' : 'text-slate-200'}`}>{isCalculated ? (typeof result === 'string' ? 0 : result) : 'READY'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Simulation Logs Drawer (Right Side) */}
                {showLogs && (
                    <div onWheel={(e) => e.stopPropagation()} className="absolute top-0 bottom-0 right-0 w-[450px] bg-slate-950/95 border-l border-white/10 z-[100] flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)] animate-slide-in-right backdrop-blur-2xl">
                        <div className="h-14 bg-slate-900/80 border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] animate-pulse"></div>
                                <div>
                                    <span className="text-[11px] font-black text-white uppercase tracking-widest block leading-none">Simulation Console</span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Diagnostic Output</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSimulationLogs([])} className="text-[10px] font-black text-slate-400 hover:text-white transition-colors uppercase px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/5">Clear</button>
                                <button onClick={() => setShowLogs(false)} className="p-2 text-slate-500 hover:text-white transition-all hover:bg-white/10 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-2 custom-dark-scrollbar bg-black/20">
                            {simulationLogs.map((log, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <span className="text-slate-600 shrink-0 select-none opacity-40 group-hover:opacity-100 transition-opacity">[{log.time}]</span>
                                    <span className={`whitespace-pre-wrap leading-relaxed break-all ${log.type === 'error' ? 'text-red-400 font-bold' : (log.type === 'success' ? 'text-emerald-400' : 'text-slate-300')}`}>
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                            {simulationLogs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
                                    <svg className="w-12 h-12 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Awaiting Simulation</p>
                                </div>
                            )}
                            <div ref={logEndRef} />
                        </div>
                        <div className="p-4 border-t border-white/5 bg-black/40 text-[9px] text-slate-600 font-bold uppercase tracking-widest text-center">
                            Calculated using AST Compiler Engine
                        </div>
                    </div>
                )}
            </div>

            {/* Legend & Controls */}
            <footer className="h-10 border-t border-white/5 bg-black flex items-center justify-between px-6 shrink-0 z-50 text-[9px] font-black tracking-widest uppercase">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Final Result</div>
                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Component</div>
                    <div className="flex items-center gap-4 ml-4 text-slate-500 border-l border-white/10 pl-4 italic">Hover để highlight • Click vào node để xem/ghim công thức</div>
                </div>
                <div className="flex items-center gap-4 text-slate-500">
                    <button onClick={() => setShowLogs(!showLogs)} className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${showLogs ? 'text-indigo-400 bg-indigo-400/10' : 'hover:text-white hover:bg-white/5'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        LOGS
                    </button>
                    <div className="text-white/20 ml-2">Zoom: {Math.round(transform.k * 100)}%</div>
                    <button onClick={() => setTransform({ x: 0, y: 0, k: 0.6 })} className="text-white hover:text-indigo-400 transition-colors">Reset View</button>
                </div>
            </footer>
        </div>
    );
};
