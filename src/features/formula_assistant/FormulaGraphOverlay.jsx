import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useFormula } from '../../context/FormulaContext';
import { buildDependencyGraph } from '../../utils/dependencyResolver';

export const FormulaGraphOverlay = () => {
    const { isDarkMode, themeUI } = useThemeContext();
    const { graphViewFormula, setGraphViewFormula, isGraphOpen, setIsGraphOpen, customFormulas, results } = useFormula();
    const canvasRef = useRef(null);
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [selectedNode, setSelectedNode] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    
    // Viewport State
    const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
    const isDraggingRef = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragNodeRef = useRef(null);

    // Radial Physics Parameters
    const repulsion = 2500; // Đẩy mạnh để xoè quạt
    const friction = 0.85;
    const centerStrength = 0.002;
    const radialForceStrength = 0.08; // Kéo vào quỹ đạo mindmap
    const orbitDistance = 220; // Bán kính mỗi lớp
    const maxRepulsionDistanceSq = 1000 * 1000;
    const simulationTicks = useRef(0);
    const maxTicks = 600; // Tăng cooling time cho việc xếp hàng mindmap

    useEffect(() => {
        if (isGraphOpen && graphViewFormula) {
            // Extract Excel Columns from results
            const excelColumns = new Set();
            if (results && results.length > 0) {
                const row = results[0];
                Object.keys(row.baseVals || {}).forEach(k => excelColumns.add(String(k).toLowerCase()));
                Object.values(row.targetVals || {}).forEach(tvObj => {
                    Object.keys(tvObj || {}).forEach(k => excelColumns.add(String(k).toLowerCase()));
                });
            }

            const data = buildDependencyGraph(graphViewFormula, customFormulas, excelColumns);
            
            // ============ BFS: CÁCH TÍNH KHOẢNG CÁCH (DEPTH) ============
            const rootId = graphViewFormula.targetCol;
            const depths = { [rootId]: 0 };
            const queue = [rootId];
            
            while (queue.length > 0) {
                const current = queue.shift();
                const currentDepth = depths[current];
                
                // Track theo CẢ 2 CHIỀU: Chiều mẹ (source) và chiều con (descendant)
                // Điều này giúp bắt được các công thức sử dụng rootId (ví dụ DiscrepancyAmount)
                const neighbors = data.links
                    .filter(l => l.target === current || l.source === current)
                    .map(l => l.target === current ? l.source : l.target);
                    
                neighbors.forEach(dep => {
                    if (depths[dep] === undefined) {
                        depths[dep] = currentDepth + 1;
                        queue.push(dep);
                    }
                });
            }
            
            data.nodes = data.nodes.map(n => ({
                ...n,
                depth: depths[n.id] !== undefined ? depths[n.id] : 0,
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 500,
                y: window.innerHeight / 2 + (Math.random() - 0.5) * 500,
                vx: 0,
                vy: 0
            }));
            setGraphData(data);
            setTransform({ x: 0, y: 0, k: 1 });
            simulationTicks.current = 0;
            setSelectedNode(data.nodes.find(n => n.id === graphViewFormula.targetCol) || null);
        }
    }, [isGraphOpen, graphViewFormula, customFormulas, results]);

    // Handle Resize
    useEffect(() => {
        if (!isGraphOpen) return;
        const resize = () => {
            if (!canvasRef.current) return;
            canvasRef.current.width = window.innerWidth * window.devicePixelRatio;
            canvasRef.current.height = window.innerHeight * window.devicePixelRatio;
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [isGraphOpen]);

    // Pointer Event Logic (Mouse + Touch)
    const handleZoom = (clientX, clientY, deltaY) => {
        const scaleFactor = Math.pow(1.1, -deltaY / 100);
        setTransform(prev => {
            const newK = Math.min(Math.max(prev.k * scaleFactor, 0.1), 5);
            const newX = clientX - (clientX - prev.x) * (newK / prev.k);
            const newY = clientY - (clientY - prev.y) * (newK / prev.k);
            return { x: newX, y: newY, k: newK };
        });
        simulationTicks.current = 0;
    };

    const handlePointerDown = (clientX, clientY) => {
        const mouseX = (clientX - transform.x) / transform.k;
        const mouseY = (clientY - transform.y) / transform.k;
        
        const clickedNode = graphData.nodes.find(n => {
            const dist = Math.sqrt((n.x - mouseX)**2 + (n.y - mouseY)**2);
            return dist < 25; // Touch target to hơn xíu
        });

        if (clickedNode) {
            dragNodeRef.current = clickedNode;
            setSelectedNode(clickedNode);
        } else {
            isDraggingRef.current = true;
        }
        lastMousePos.current = { x: clientX, y: clientY };
    };

    const handlePointerMove = (clientX, clientY) => {
        const mouseX = (clientX - transform.x) / transform.k;
        const mouseY = (clientY - transform.y) / transform.k;

        const hNode = graphData.nodes.find(n => {
            const dist = Math.sqrt((n.x - mouseX)**2 + (n.y - mouseY)**2);
            return dist < 20;
        });
        setHoveredNode(hNode);

        if (dragNodeRef.current) {
            dragNodeRef.current.x = mouseX;
            dragNodeRef.current.y = mouseY;
            // CHỐNG ĐÓNG BĂNG VẬT LÝ KHI DRAG LÂU
            simulationTicks.current = 0; 
        } else if (isDraggingRef.current) {
            const dx = clientX - lastMousePos.current.x;
            const dy = clientY - lastMousePos.current.y;
            setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            lastMousePos.current = { x: clientX, y: clientY };
        }
    };

    const handlePointerUp = () => {
        isDraggingRef.current = false;
        dragNodeRef.current = null;
    };

    // DOM Handlers
    const onWheel = (e) => { e.preventDefault(); handleZoom(e.clientX, e.clientY, e.deltaY); };
    const onMouseDown = (e) => handlePointerDown(e.clientX, e.clientY);
    const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
    
    const onTouchStart = (e) => {
        if (e.touches.length === 1) {
            handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }
    };
    const onTouchMove = (e) => {
        if (e.touches.length === 1) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    useEffect(() => {
        if (!isGraphOpen || graphData.nodes.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const simulate = () => {
            if (simulationTicks.current > maxTicks) return;
            simulationTicks.current++;

            const { nodes, links } = graphData;
            
            // Repulsion with Distance Cutoff O(N^2) optimization
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const n1 = nodes[i];
                    const n2 = nodes[j];
                    const dx = n2.x - n1.x;
                    const dy = n2.y - n1.y;
                    const distSq = dx * dx + dy * dy || 1;
                    
                    if (distSq < maxRepulsionDistanceSq) {
                        const force = repulsion / distSq;
                        n1.vx -= (dx / Math.sqrt(distSq)) * force;
                        n1.vy -= (dy / Math.sqrt(distSq)) * force;
                        n2.vx += (dx / Math.sqrt(distSq)) * force;
                        n2.vy += (dy / Math.sqrt(distSq)) * force;
                    }
                }
            }

            // Radial Mindmap Constraints & Center Pull
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            nodes.forEach(n => {
                if (n === dragNodeRef.current) return;
                
                if (n.id === graphViewFormula?.targetCol) {
                    // Node rễ bị khóa tại tâm màn hình
                    n.vx += (centerX - n.x) * 0.1;
                    n.vy += (centerY - n.y) * 0.1;
                } else {
                    // Ép các node cùng hệ thế hệ (depth) nằm trên một vành đai quỹ đạo
                    const targetRadius = n.depth * orbitDistance;
                    const dx = n.x - centerX;
                    const dy = n.y - centerY;
                    const currentRadius = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    const force = (currentRadius - targetRadius) * radialForceStrength;
                    n.vx -= (dx / currentRadius) * force;
                    n.vy -= (dy / currentRadius) * force;
                    
                    // Lực kéo tâm tổng quát
                    n.vx += (centerX - n.x) * centerStrength;
                    n.vy += (centerY - n.y) * centerStrength;
                }
                
                n.x += n.vx;
                n.y += n.vy;
                n.vx *= friction;
                n.vy *= friction;
            });
        };

        const draw = () => {
            simulate();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.k, transform.k);

            // Orbit Rings (Vành đai đồng tâm)
            const maxObservedDepth = Math.max(...graphData.nodes.map(n => n.depth || 0));
            if (maxObservedDepth > 0) {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                for (let d = 1; d <= maxObservedDepth; d++) {
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, d * orbitDistance, 0, Math.PI * 2);
                    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; // Tăng độ sáng radar
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6, 6]); // Nét đứt
                    ctx.stroke();
                    
                    // Sub-label cho từng vành đai
                    ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                    ctx.font = 'bold 11px Inter';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Qũy đạo ${d}`, centerX, centerY - (d * orbitDistance) + 16);
                }
                ctx.setLineDash([]); // Reset nét đứt cho các nét vẽ sau
            }

            // Xác định danh sách highlight dựa trên Hover VÀ Select (Click)
            const highlightedNodeIds = new Set();
            const highlightedLinks = new Set(); 
            const activeNodeId = hoveredNode?.id || selectedNode?.id || null;
            
            if (activeNodeId) {
                highlightedNodeIds.add(activeNodeId);
                graphData.links.forEach((l) => {
                    // Node active là target (ví dụ A). Làm sáng source của nó (B, C)
                    if (l.target === activeNodeId) {
                        highlightedNodeIds.add(l.source);
                        highlightedLinks.add(`${l.source}-${l.target}`);
                    }
                });
            }

            // Helper to draw arrows
            const drawArrow = (ctx, fromX, fromY, toX, toY, color, width, isDimmed) => {
                const headLength = 10;
                const angle = Math.atan2(toY - fromY, toX - fromX);
                
                ctx.beginPath();
                ctx.globalAlpha = isDimmed ? 0.08 : 1;
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                
                // Draw line
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
                
                // Draw arrowhead
                ctx.beginPath();
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(toX, toY);
                ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
                ctx.globalAlpha = 1;
            };

            // Links
            graphData.links.forEach(l => {
                const s = graphData.nodes.find(n => n.id === l.source);
                const t = graphData.nodes.find(n => n.id === l.target);
                if (s && t) {
                    const isLinkHighlighted = highlightedLinks.has(`${l.source}-${l.target}`);
                    const isDimmed = activeNodeId && !isLinkHighlighted;
                    
                    let color = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
                    let width = 1;

                    if (isLinkHighlighted) {
                        color = isDarkMode ? '#fff' : '#0f172a';
                        width = 3;
                    }
                    
                    // Draw from Source to Target (Dependency direction)
                    // We need to calculate the point on the node's edge to stop the arrow
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const targetRadius = (t.id === graphViewFormula?.targetCol) ? 25 : 15;
                    
                    const edgeX = t.x - (dx / dist) * targetRadius;
                    const edgeY = t.y - (dy / dist) * targetRadius;

                    drawArrow(ctx, s.x, s.y, edgeX, edgeY, color, width, isDimmed);
                }
            });

            // Nodes
            graphData.nodes.forEach(n => {
                const isSelected = selectedNode?.id === n.id;
                const isHighlightDependency = highlightedNodeIds.has(n.id);
                const isRoot = n.id === graphViewFormula?.targetCol;
                
                const isDimmed = activeNodeId && !isHighlightDependency;
                ctx.globalAlpha = isDimmed ? 0.12 : 1; 

                // Enhanced Node Background (Shadow + Glow)
                ctx.shadowBlur = (isSelected || isHighlightDependency || isRoot) ? (isRoot ? 35 : 20) : 8;
                if (isRoot) ctx.shadowColor = 'rgba(234,179,8,0.8)'; 
                else if (n.type === 'error') ctx.shadowColor = 'rgba(239,68,68,0.6)'; 
                else if (n.type === 'formula') ctx.shadowColor = 'rgba(99,102,241,0.5)';
                else ctx.shadowColor = 'rgba(16,185,129,0.5)';
                
                // Draw Node Shape (Rounded Box for better text visibility if needed, but keeping circle for consistency)
                const radius = isRoot ? 25 : 15;
                ctx.beginPath();
                ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
                
                // Gradient Fill
                const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius);
                if (isRoot) {
                    grad.addColorStop(0, '#fde047');
                    grad.addColorStop(1, '#eab308');
                } else if (n.type === 'error') {
                    grad.addColorStop(0, '#f87171');
                    grad.addColorStop(1, '#ef4444');
                } else if (n.type === 'formula') {
                    grad.addColorStop(0, '#818cf8');
                    grad.addColorStop(1, '#6366f1');
                } else {
                    grad.addColorStop(0, '#34d399');
                    grad.addColorStop(1, '#10b981');
                }
                
                ctx.fillStyle = grad;
                ctx.fill();

                // Node Border
                ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
                ctx.lineWidth = isSelected ? 4 : 2;
                ctx.stroke();

                // Labels
                ctx.shadowBlur = 0;
                
                // Label Background for better readability
                const labelText = n.label;
                ctx.font = `${isSelected || isRoot || isHighlightDependency || n.type === 'error' ? 'bold' : '500'} ${isRoot ? '14px' : '12px'} Inter`;
                const textWidth = ctx.measureText(labelText).width;
                
                ctx.fillStyle = isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)';
                ctx.fillRect(n.x - (textWidth/2) - 6, n.y + (isRoot ? 35 : 25), textWidth + 12, 18);
                ctx.strokeStyle = isRoot ? '#eab308' : (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)');
                ctx.strokeRect(n.x - (textWidth/2) - 6, n.y + (isRoot ? 35 : 25), textWidth + 12, 18);

                ctx.fillStyle = n.type === 'error' ? '#ef4444' : (isRoot ? (isDarkMode ? '#fff' : '#854d0e') : (isDarkMode ? '#fff' : '#1e293b'));
                ctx.textAlign = 'center';
                ctx.fillText(labelText, n.x, n.y + (isRoot ? 48 : 38));
                
                ctx.globalAlpha = 1; 
            });

            ctx.restore();
            animationFrameId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isGraphOpen, graphData, isDarkMode, transform, selectedNode, hoveredNode]);

    if (!isGraphOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-2xl flex flex-col select-none overflow-hidden">
            <header className="px-6 py-4 flex justify-between items-center border-b border-white/10 shrink-0 bg-black/20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsGraphOpen(false)} className="text-slate-400 hover:text-white transition-colors p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg></button>
                    <div>
                        <h2 className="text-white font-bold tracking-tight">Trực quan hóa cấu trúc V1.2.0</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Balanced Physical Layout / 2D Engine</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="hidden lg:flex items-center gap-6 bg-white/5 py-2 px-4 rounded-full border border-white/5">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tighter"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"></div> Công thức đối chiếu (Gốc)</div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tighter"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div> Công thức phụ thuộc</div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tighter"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div> Dữ liệu đầu vào</div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tighter"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div> Lỗi (Ảo ảnh)</div>
                    </div>
                    <div className="text-white/30 text-xs font-mono">{Math.round(transform.k * 100)}%</div>
                </div>
            </header>

            <div className="flex-1 relative" 
                 onWheel={onWheel} 
                 onMouseDown={onMouseDown} 
                 onMouseMove={onMouseMove} 
                 onMouseUp={handlePointerUp} 
                 onMouseLeave={handlePointerUp}
                 onTouchStart={onTouchStart}
                 onTouchMove={onTouchMove}
                 onTouchEnd={handlePointerUp}>
                
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none" />
                
                {/* DETAILS PANEL - KHÓA EVENT BUBBLING TẠI ĐÂY */}
                {selectedNode && (
                    <div 
                        className="absolute top-6 right-6 w-80 bg-slate-900/90 border border-white/20 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 animate-slide-in-right z-50 cursor-auto"
                        onWheel={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onMouseMove={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                             <h3 className={`font-bold truncate pr-4 ${selectedNode.type === 'error' ? 'text-red-400' : 'text-white'}`}>{selectedNode.label}</h3>
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${selectedNode.type === 'formula' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : (selectedNode.type === 'error' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')}`}>
                                {selectedNode.type === 'source' ? 'input data' : selectedNode.type}
                             </span>
                        </div>
                        
                        {selectedNode.type === 'formula' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1.5">Nội dung công thức:</label>
                                    <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words italic">
                                        {selectedNode.expression}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 italic">Đây là công thức trung gian lấy kết quả từ các biến số có trong đồ thị.</p>
                            </div>
                        ) : selectedNode.type === 'error' ? (
                            <div>
                                <label className="text-[10px] text-red-500/80 font-bold uppercase tracking-widest block mb-1.5">Lỗi - Dữ liệu rỗng ảo ảnh:</label>
                                <p className="text-xs text-red-400/90 font-medium leading-relaxed">Cột dữ liệu này KHÔNG TỒN TẠI trong bảng Excel, và cũng không phải là bất kỳ Công Thức nội bộ nào đang có.<br/><br/>Hãy kiểm tra lại xem có gõ sai chính tả biến này không.</p>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1.5">Dữ liệu đầu vào độc lập:</label>
                                <p className="text-xs text-slate-300 leading-relaxed">Cột dữ liệu này không chứa công thức. Nó trực tiếp là đầu vào (nhập tay, lấy từ Grid tĩnh, phân hệ khác đồng bộ, hoặc Import Excel).</p>
                            </div>
                        )}

                        {selectedNode.id === graphViewFormula.targetCol && (
                             <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2">
                                 <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                 <p className="text-xs font-bold text-white uppercase tracking-tighter">Đang là gốc phân tách</p>
                             </div>
                        )}
                    </div>
                )}

                <div className="absolute bottom-6 left-6 p-4 rounded-xl bg-black/50 border border-white/10 backdrop-blur shadow-xl text-slate-400 text-[10px] font-medium leading-tight pointer-events-none">
                    <p className="mb-1"><span className="text-white">Cuộn chuột / Pinch:</span> Zoom IN/OUT</p>
                    <p className="mb-1"><span className="text-white">Kéo nền / Vuốt:</span> Di chuyển sơ đồ</p>
                    <p><span className="text-white">Click Node:</span> Xem chi tiết</p>
                </div>
            </div>
        </div>
    );
};
