import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useFormula } from '../../context/FormulaContext';
import { buildChainTree } from '../../utils/dependencyResolver';
import { evaluateFormula } from '../../utils/astCompiler';

export const FormulaChainTracer = () => {
    const { isDarkMode, themeUI } = useThemeContext();
    const { 
        chainViewFormula, 
        customFormulas, results 
    } = useFormula();

    const [selectedNode, setSelectedNode] = useState(null);
    const [treeData, setTreeData] = useState(null);
    const containerRef = useRef(null);
    const [connections, setConnections] = useState([]);
    
    // Simulation states
    const [tracerInputs, setTracerInputs] = useState({});
    const [tracerResults, setTracerResults] = useState({});
    const [calcLogs, setCalcLogs] = useState([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [showConsole, setShowConsole] = useState(true);

    // Initialize tree data and default inputs
    useEffect(() => {
        if (chainViewFormula) {
            const excelColumns = new Set();
            if (results && results.length > 0) {
                const row = results[0];
                Object.keys(row.baseVals || {}).forEach(k => excelColumns.add(String(k).toLowerCase()));
                Object.values(row.targetVals || {}).forEach(tvObj => {
                    Object.keys(tvObj || {}).forEach(k => excelColumns.add(String(k).toLowerCase()));
                });
            }

            const tree = buildChainTree(chainViewFormula, customFormulas, excelColumns);
            setTreeData(tree);
            setSelectedNode(tree);

            // Initialize inputs from mock data if available
            const initialInputs = {};
            const extractDefaultValues = (node) => {
                if (node.type === 'source' || node.type === 'formula') {
                    const mock = customFormulas.find(f => f.targetCol === node.label);
                    if (mock && !isNaN(Number(mock.expression))) {
                        initialInputs[node.label] = mock.expression;
                    }
                }
                node.children.forEach(extractDefaultValues);
            };
            if (tree) extractDefaultValues(tree);
            setTracerInputs(initialInputs);
            setTracerResults({});
            setCalcLogs([]);
        }
    }, [chainViewFormula, customFormulas, results]);

    // Flatten tree to levels for rendering
    const { levels, nodeRefs } = useMemo(() => {
        const lvls = [];
        const refs = {};
        if (!treeData) return { levels: [], nodeRefs: {} };

        const traverse = (node, depth = 0) => {
            if (!lvls[depth]) lvls[depth] = [];
            if (!lvls[depth].some(n => n.id === node.id)) {
                lvls[depth].push(node);
                refs[node.id] = React.createRef();
            }
            node.children.forEach(child => traverse(child, depth + 1));
        };
        traverse(treeData);
        return { levels: lvls, nodeRefs: refs };
    }, [treeData]);

    // Calculate connection paths after render
    useEffect(() => {
        if (!treeData || levels.length === 0) return;

        const updateConnections = () => {
            if (!containerRef.current) return;
            const newConnections = [];
            const containerRect = containerRef.current.getBoundingClientRect();
            const scrollLeft = containerRef.current.scrollLeft;
            const scrollTop = containerRef.current.scrollTop;

            const findAndAdd = (node) => {
                const startRef = nodeRefs[node.id];
                if (startRef && startRef.current) {
                    const startRect = startRef.current.getBoundingClientRect();
                    const startX = startRect.right - containerRect.left + scrollLeft;
                    const startY = startRect.top + startRect.height / 2 - containerRect.top + scrollTop;

                    node.children.forEach(child => {
                        const endRef = nodeRefs[child.id];
                        if (endRef && endRef.current) {
                            const endRect = endRef.current.getBoundingClientRect();
                            const endX = endRect.left - containerRect.left + scrollLeft;
                            const endY = endRect.top + endRect.height / 2 - containerRect.top + scrollTop;

                            newConnections.push({
                                id: `${node.id}-${child.id}`,
                                x1: startX,
                                y1: startY,
                                x2: endX,
                                y2: endY
                            });
                        }
                        findAndAdd(child);
                    });
                }
            };

            findAndAdd(treeData);
            setConnections(newConnections);
        };

        const timer = setTimeout(updateConnections, 300);
        const interval = setInterval(updateConnections, 1000);
        window.addEventListener('resize', updateConnections);
        
        const currentContainer = containerRef.current;
        if (currentContainer) {
            currentContainer.addEventListener('scroll', updateConnections);
        }

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
            window.removeEventListener('resize', updateConnections);
            if (currentContainer) {
                currentContainer.removeEventListener('scroll', updateConnections);
            }
        };
    }, [treeData, levels, nodeRefs]);

    // Recursive calculation function
    const runFullCalculation = () => {
        setIsCalculating(true);
        const allLogs = [];
        const resultsMap = {};
        const currentInputs = { ...tracerInputs };

        const evalRecursive = (node) => {
            // Check for manual input/override first (except for the root target we want to compute)
            if (currentInputs[node.label] !== undefined && currentInputs[node.label] !== '' && node.id !== treeData.id) {
                const val = currentInputs[node.label];
                resultsMap[node.id] = val;
                return val;
            }

            if (node.type === 'source') {
                const val = currentInputs[node.label] || 0;
                resultsMap[node.id] = val;
                return val;
            }

            // For formula nodes, first evaluate all children
            const childValues = {};
            node.children.forEach(child => {
                childValues[child.label] = evalRecursive(child);
            });

            // Then evaluate this node's expression using the child results
            allLogs.push(`[PROCESS] ${node.label} (${node.expression})`);
            const { result, logs } = evaluateFormula(node.expression, childValues, true);
            allLogs.push(...logs);
            allLogs.push(`=> RESULT ${node.label}: ${result}`);
            allLogs.push('---');
            
            resultsMap[node.id] = result;
            return result;
        };

        try {
            evalRecursive(treeData);
            setTracerResults(resultsMap);
            setCalcLogs(allLogs);
        } catch (err) {
            allLogs.push(`[ERROR] Fatal Error: ${err.message}`);
            setCalcLogs(allLogs);
        } finally {
            setIsCalculating(false);
        }
    };

    if (!treeData) return null;

    return (
        <div className={`flex flex-col h-full animate-fade-in ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} p-0 m-0 overflow-hidden`}>
            
            {/* COMPACT HEADER */}
            <div className={`px-6 py-3 border-b flex justify-between items-center shrink-0 z-20 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <div>
                        <h2 className={`font-black text-lg tracking-tight ${themeUI.textTitle}`}>Mô Phỏng: <span className="text-indigo-500">{chainViewFormula?.targetCol}</span></h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 mr-2 cursor-pointer group">
                        <input type="checkbox" checked={showConsole} onChange={e => setShowConsole(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-500 transition-colors">Hiện Terminal</span>
                    </label>
                    <button 
                        onClick={runFullCalculation}
                        disabled={isCalculating}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 ${isCalculating ? 'bg-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}
                    >
                        {isCalculating ? (
                            <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/></svg>
                        )}
                        Chạy Mô Phỏng
                    </button>
                </div>
            </div>

            {/* MAIN WORKSPACE - LARGER CONTAINER */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                <div 
                    ref={containerRef}
                    className={`flex-1 overflow-auto p-12 relative flex items-start min-h-0 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
                >
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minWidth: '100%', minHeight: '100%' }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orientation="auto">
                                <polygon points="0 0, 8 3, 0 6" fill={isDarkMode ? '#6366f1' : '#4f46e5'} />
                            </marker>
                        </defs>
                        {connections.map(conn => (
                            <path 
                                key={conn.id}
                                d={`M ${conn.x1} ${conn.y1} C ${conn.x1 + 40} ${conn.y1}, ${conn.x2 - 40} ${conn.y2}, ${conn.x2} ${conn.y2}`}
                                stroke={isDarkMode ? '#6366f1' : '#4f46e5'}
                                strokeWidth="2.5"
                                strokeOpacity={isCalculating ? "0.2" : "0.4"}
                                fill="none"
                                markerEnd="url(#arrowhead)"
                                className="transition-all duration-500"
                            />
                        ))}
                    </svg>

                    <div className="flex gap-20 relative z-10 mx-auto">
                        {levels.map((level, lIdx) => (
                            <div key={`level-${lIdx}`} className="flex flex-col justify-center gap-8 relative">
                                {level.map((node) => {
                                    const isSelected = selectedNode?.id === node.id;
                                    const isRoot = lIdx === 0;
                                    const result = tracerResults[node.id];
                                    const isCalculated = result !== undefined;
                                    const isError = String(result).includes('Lỗi');
                                    
                                    return (
                                        <div 
                                            key={`${node.id}-${lIdx}`}
                                            ref={nodeRefs[node.id]}
                                            onClick={() => setSelectedNode(node)}
                                            className={`
                                                relative px-4 py-3 rounded-xl border-2 transition-all duration-300
                                                flex flex-col items-center justify-center min-w-[160px] max-w-[240px]
                                                ${isSelected 
                                                    ? 'ring-4 ring-indigo-500/20 scale-105 z-20 border-indigo-500' 
                                                    : 'hover:scale-[1.02] z-10'
                                                }
                                                ${isRoot 
                                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400 text-white shadow-lg' 
                                                    : (node.type === 'source' 
                                                        ? (isDarkMode ? 'bg-slate-800/80 border-emerald-500/30' : 'bg-white border-emerald-200 shadow-sm') 
                                                        : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 shadow-sm'))
                                                }
                                                ${isError ? 'border-rose-500 animate-shake' : ''}
                                            `}
                                        >
                                            <div className="flex flex-col items-center gap-0.5 mb-2 w-full text-center">
                                                <span className={`text-[8px] font-black uppercase tracking-wider ${isRoot ? 'text-white/60' : 'text-slate-400'}`}>
                                                    {node.type === 'source' ? 'INPUT' : (isRoot ? 'RESULT' : 'FORMULA')}
                                                </span>
                                                <span className={`font-bold text-xs truncate w-full ${isRoot ? 'text-white' : (node.type === 'source' ? 'text-emerald-500' : themeUI.textMain)}`}>
                                                    {node.label}
                                                </span>
                                            </div>

                                            <div className={`w-full p-1.5 rounded-lg border ${isRoot ? 'bg-white/10 border-white/20' : (isDarkMode ? 'bg-black/20 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                                                <input 
                                                    type="text" 
                                                    className={`w-full bg-transparent border-none text-center font-mono font-bold text-xs focus:outline-none 
                                                        ${isRoot ? 'text-white' : (isError ? 'text-rose-500' : (isCalculated ? 'text-indigo-500' : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')))}
                                                    `}
                                                    value={tracerInputs[node.label] !== undefined ? tracerInputs[node.label] : (isCalculated ? result : '')}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setTracerInputs(prev => ({ ...prev, [node.label]: val }));
                                                        if (isCalculated) {
                                                            setTracerResults(prev => {
                                                                const next = { ...prev };
                                                                delete next[node.id];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="..."
                                                />
                                            </div>
                                            {!isRoot && <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 border border-white dark:border-slate-900 shadow-sm"></div>}
                                            {node.children.length > 0 && <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 border border-white dark:border-slate-900 shadow-sm"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLORED TERMINAL PANEL */}
                <div className={`shrink-0 border-t flex transition-all duration-500 ${showConsole ? 'h-64' : 'h-16'} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                    <div className="w-1/4 border-r p-4 flex flex-col gap-3 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${themeUI.textMuted}`}>Detail Inspector</span>
                        </div>
                        <div className={`flex-1 rounded-xl p-3 font-mono text-xs overflow-auto ${isDarkMode ? 'bg-black/30 border border-white/5' : 'bg-slate-50 border border-slate-200'}`}>
                            <h4 className="font-bold text-indigo-500 mb-1">{selectedNode?.label}</h4>
                            <p className="opacity-60 text-[10px] break-all leading-relaxed">{selectedNode?.expression || 'Source Data'}</p>
                        </div>
                    </div>

                    <div className="flex-1 p-4 flex flex-col min-w-0 overflow-hidden relative">
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Execution Logs</h4>
                            </div>
                        </div>
                        <div className={`flex-1 rounded-xl p-4 font-mono text-[11px] overflow-y-auto ${isDarkMode ? 'bg-slate-950 text-slate-300 border border-white/5' : 'bg-slate-900 text-slate-300 border border-slate-800'}`}>
                            {calcLogs.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-600 italic opacity-40">
                                    <span>_ Ready for simulation run...</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {calcLogs.map((log, i) => {
                                        const isPass = log.includes('✅ PASS') || log.includes('TRUE');
                                        const isFail = log.includes('❌ FAIL') || log.includes('FALSE');
                                        const isError = log.includes('[ERROR]') || log.includes('[FATAL]');
                                        const isResult = log.includes('=> RESULT') || log.includes('=> KẾT QUẢ');
                                        
                                        let colorClass = 'text-slate-400';
                                        if (isPass) colorClass = 'text-emerald-400 font-bold';
                                        if (isFail) colorClass = 'text-rose-400 font-bold';
                                        if (isError) colorClass = 'text-rose-500 font-black bg-rose-500/10 px-1 rounded';
                                        if (isResult) colorClass = 'text-indigo-400 font-black border-t border-white/5 mt-1 pt-1';

                                        return (
                                            <div key={i} className={`py-0.5 ${colorClass}`}>
                                                {log}
                                            </div>
                                        );
                                    })}
                                    <div className="mt-2 text-indigo-500/50 text-[9px] tracking-widest uppercase">_ End of sequence.</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
