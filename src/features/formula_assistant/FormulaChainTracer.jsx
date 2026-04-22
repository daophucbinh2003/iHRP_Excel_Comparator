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
                if (node.type === 'source') {
                    // Try to find a mock formula that has this targetCol as a "leaf" with a simple value
                    const mock = customFormulas.find(f => f.targetCol === node.label);
                    if (mock && !isNaN(Number(mock.expression))) {
                        initialInputs[node.label] = mock.expression;
                    } else {
                        initialInputs[node.label] = '0';
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
        const interval = setInterval(updateConnections, 1000); // Polling as fallback
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
            allLogs.push(`[TRACING] Đang tính toán: ${node.label}...`);
            const { result, logs } = evaluateFormula(node.expression, childValues, true);
            allLogs.push(...logs);
            allLogs.push(`=> KẾT QUẢ ${node.label}: ${result}`);
            allLogs.push('---');
            
            resultsMap[node.id] = result;
            return result;
        };

        try {
            evalRecursive(treeData);
            setTracerResults(resultsMap);
            setCalcLogs(allLogs);
        } catch (err) {
            allLogs.push(`[ERROR] Lỗi tính toán: ${err.message}`);
            setCalcLogs(allLogs);
        } finally {
            setIsCalculating(false);
        }
    };

    if (!treeData) return null;

    return (
        <div className={`flex flex-col h-full animate-fade-in ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} p-0 m-0 overflow-hidden`}>
            
            {/* Header Area */}
            <div className={`px-8 py-5 border-b flex justify-between items-center shrink-0 z-20 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500 shadow-inner">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <div>
                        <h2 className={`font-black text-2xl tracking-tight ${themeUI.textTitle}`}>Truy Nguồn & Mô Phỏng: <span className="text-indigo-500">{chainViewFormula?.targetCol}</span></h2>
                        <p className={`text-sm ${themeUI.textMuted}`}>Nhập dữ liệu vào các Node và bấm "Chạy Mô Phỏng" để kiểm tra luồng tính toán</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 mr-4 cursor-pointer">
                        <input type="checkbox" checked={showConsole} onChange={e => setShowConsole(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hiện Terminal</span>
                    </label>
                    <button 
                        onClick={runFullCalculation}
                        disabled={isCalculating}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isCalculating ? 'bg-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20'}`}
                    >
                        {isCalculating ? (
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/></svg>
                        )}
                        Chạy Mô Phỏng
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                
                {/* Flowchart Diagram */}
                <div 
                    ref={containerRef}
                    className={`flex-1 overflow-auto p-16 relative flex items-start min-h-0 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
                >
                    {/* SVG Layer for Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minWidth: '100%', minHeight: '100%' }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill={isDarkMode ? '#6366f1' : '#4f46e5'} />
                            </marker>
                            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>
                        {connections.map(conn => (
                            <path 
                                key={conn.id}
                                d={`M ${conn.x1} ${conn.y1} C ${conn.x1 + 60} ${conn.y1}, ${conn.x2 - 60} ${conn.y2}, ${conn.x2} ${conn.y2}`}
                                stroke={isDarkMode ? '#6366f1' : '#4f46e5'}
                                strokeWidth="3"
                                strokeOpacity={isCalculating ? "0.2" : "0.5"}
                                fill="none"
                                markerEnd="url(#arrowhead)"
                                className="transition-all duration-500"
                            />
                        ))}
                    </svg>

                    <div className="flex gap-32 relative z-10 mx-auto">
                        {levels.map((level, lIdx) => (
                            <div key={`level-${lIdx}`} className="flex flex-col justify-center gap-12 relative">
                                {level.map((node) => {
                                    const isSelected = selectedNode?.id === node.id;
                                    const isRoot = lIdx === 0;
                                    const result = tracerResults[node.id];
                                    const isCalculated = result !== undefined;
                                    
                                    return (
                                        <div 
                                            key={`${node.id}-${lIdx}`}
                                            ref={nodeRefs[node.id]}
                                            onClick={() => setSelectedNode(node)}
                                            className={`
                                                relative px-6 py-5 rounded-2xl border-2 transition-all duration-300
                                                flex flex-col items-center justify-center min-w-[200px] max-w-[280px]
                                                ${isSelected 
                                                    ? 'ring-4 ring-indigo-500/20 scale-105 z-20' 
                                                    : 'hover:scale-[1.02] z-10'
                                                }
                                                ${isRoot 
                                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400 text-white shadow-xl shadow-amber-500/20' 
                                                    : (node.type === 'source' 
                                                        ? (isDarkMode ? 'bg-slate-800/80 border-emerald-500/30' : 'bg-white border-emerald-200 shadow-md shadow-emerald-500/5') 
                                                        : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 shadow-lg shadow-slate-200/50'))
                                                }
                                            `}
                                        >
                                            {/* Node Label */}
                                            <div className="flex flex-col items-center gap-1 mb-3 w-full text-center">
                                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isRoot ? 'text-white/60' : themeUI.textMuted}`}>
                                                    {node.type === 'source' ? 'Nguồn dữ liệu' : (isRoot ? 'Kết quả cuối' : 'Công thức')}
                                                </span>
                                                <span className={`font-black text-sm truncate w-full ${isRoot ? 'text-white' : (node.type === 'source' ? 'text-emerald-500' : themeUI.textMain)}`}>
                                                    {node.label}
                                                </span>
                                            </div>

                                            {/* Input/Result Box */}
                                            <div className={`w-full p-2 rounded-xl border ${isRoot ? 'bg-white/10 border-white/20' : (isDarkMode ? 'bg-black/20 border-slate-700' : 'bg-slate-50 border-slate-100')}`}>
                                                <input 
                                                    type="text" 
                                                    className={`w-full bg-transparent border-none text-center font-mono font-bold text-sm focus:outline-none 
                                                        ${isRoot ? 'text-white' : (isCalculated ? 'text-indigo-500' : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600'))}
                                                    `}
                                                    value={tracerInputs[node.label] !== undefined ? tracerInputs[node.label] : (isCalculated ? result : '')}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setTracerInputs(prev => ({ ...prev, [node.label]: val }));
                                                        // Clear result if manually changed to avoid confusion
                                                        if (isCalculated) {
                                                            setTracerResults(prev => {
                                                                const next = { ...prev };
                                                                delete next[node.id];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder={node.type === 'formula' ? "Mô phỏng/Ghi đè..." : "Nhập giá trị..."}
                                                />
                                            </div>

                                            {/* Connection Points */}
                                            {!isRoot && <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>}
                                            {node.children.length > 0 && <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Info & Terminal Panels */}
                <div className={`shrink-0 border-t flex transition-all duration-500 ${showConsole ? 'h-72' : 'h-24'} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                    
                    {/* Left Panel: Selected Node Details */}
                    <div className="w-1/3 border-r p-6 flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${selectedNode?.type === 'source' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                {selectedNode?.type === 'source' ? 
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg> :
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a2 2 0 002 2 2 2 0 110 4 2 2 0 00-2 2v1a2 2 0 11-4 0V4z"/></svg>
                                }
                            </div>
                            <div className="min-w-0">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] block leading-none mb-1 ${themeUI.textMuted}`}>Thành phần được chọn:</span>
                                <h3 className={`font-black text-xl truncate ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{selectedNode?.label}</h3>
                            </div>
                        </div>
                        <div className={`flex-1 rounded-2xl p-5 font-mono text-sm overflow-auto ${isDarkMode ? 'bg-black/30 border border-white/5' : 'bg-slate-50 border border-slate-200'}`}>
                            {selectedNode?.type === 'formula' || selectedNode?.id === chainViewFormula?.targetCol ? (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold text-slate-500 mb-1 tracking-wider uppercase">Logic:</span>
                                    <div className={`text-lg font-bold leading-relaxed break-all ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                                        {selectedNode.expression}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col justify-center">
                                    <p className={`font-bold text-sm mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Loại: Dữ liệu đầu vào</p>
                                    <p className="text-xs text-slate-500 leading-relaxed">Đây là dữ liệu thô, không qua tính toán. Hãy nhập giá trị vào ô tương ứng trên sơ đồ để bắt đầu mô phỏng.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Simulation Terminal */}
                    <div className="flex-1 p-6 flex flex-col min-w-0 overflow-hidden relative">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Simulation Terminal Output</h4>
                            </div>
                            <button onClick={() => setCalcLogs([])} className="text-[10px] font-bold text-indigo-500 hover:underline uppercase tracking-widest">Clear Logs</button>
                        </div>
                        <div className={`flex-1 rounded-2xl p-5 font-mono text-xs overflow-y-auto ${isDarkMode ? 'bg-black text-emerald-500 border border-emerald-500/20' : 'bg-slate-900 text-emerald-400 border border-slate-800 shadow-2xl'} ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
                            {calcLogs.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-600 italic opacity-50">
                                    <span className="animate-pulse">_ Chờ lệnh chạy mô phỏng...</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {calcLogs.map((log, i) => (
                                        <div key={i} className={`py-0.5 border-l-2 pl-3 ${log.includes('ERROR') ? 'border-red-500 text-red-400' : (log.includes('=>') ? 'border-indigo-500 text-indigo-300' : 'border-slate-700')}`}>
                                            {log}
                                        </div>
                                    ))}
                                    <div className="mt-2 text-white animate-pulse">_ COMPLETED. SYSTEM IDLE.</div>
                                </div>
                            )}
                        </div>
                        {!showConsole && (
                            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center z-10 cursor-pointer" onClick={() => setShowConsole(true)}>
                                <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl">Hiện Terminal</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
