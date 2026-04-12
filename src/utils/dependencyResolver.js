import { extractVariables } from './astCompiler';

/**
 * Phân tách một công thức thành đồ thị phụ thuộc hai chiều (Nguồn gốc & Tác động)
 * @param {Object} rootFormula - Công thức gốc { targetCol, expression }
 * @param {Array} allFormulas - Danh sách tất cả công thức đã lưu
 * @param {Set} excelColumnsLowerCase - Set chứa các cột Excel (chữ thường) để xác thực
 * @returns {Object} { nodes: [], links: [] }
 */
export const buildDependencyGraph = (rootFormula, allFormulas, excelColumnsLowerCase = new Set()) => {
    if (!rootFormula) return { nodes: [], links: [] };

    const nodesMap = new Map();
    const links = [];
    const visited = new Set();
    
    // Helper để thêm Node an toàn và chống Case-Sensitivity Duplicate
    const addNode = (id, label, type, expression = '') => {
        const lowerId = String(id).toLowerCase();
        
        let existingKey = null;
        for (const k of nodesMap.keys()) {
            if (String(k).toLowerCase() === lowerId) {
                existingKey = k;
                break;
            }
        }
        
        if (!existingKey) {
            nodesMap.set(id, { id, label, type, expression });
        } else {
            // Nâng cấp lên Formula nếu lúc trước nó bị hiểu nhầm là Error/Source
            if (type === 'formula' && nodesMap.get(existingKey).type !== 'formula') {
                const n = nodesMap.get(existingKey);
                n.type = 'formula';
                n.expression = expression;
            }
        }
    };

    const getRealId = (id) => {
        const lowerId = String(id).toLowerCase();
        for (const k of nodesMap.keys()) {
            if (String(k).toLowerCase() === lowerId) return k;
        }
        return id;
    };

    // TRUY VẾT NGƯỢC (ANCESTORS): Tìm nguồn gốc tạo ra công thức này
    const traceUp = (f) => {
        const lowerId = String(f.targetCol).toLowerCase();
        if (!f || visited.has('up_' + lowerId)) return;
        visited.add('up_' + lowerId);

        addNode(f.targetCol, f.targetCol, 'formula', f.expression);
        const sourceNodeId = getRealId(f.targetCol);

        const variables = extractVariables(f.expression);
        
        variables.forEach(varName => {
            const lowerVar = String(varName).toLowerCase();
            const sourceFormula = allFormulas.find(sf => String(sf.targetCol).toLowerCase() === lowerVar);
            
            // Validate phân loại danh tính
            let nodeType = 'source';
            if (sourceFormula) {
                nodeType = 'formula';
            } else if (excelColumnsLowerCase.size > 0 && !excelColumnsLowerCase.has(lowerVar)) {
                nodeType = 'error'; // Gõ sai chính tả hoặc Biến ma
            }

            const refId = sourceFormula ? sourceFormula.targetCol : varName;
            addNode(refId, refId, nodeType, sourceFormula?.expression || '');
            const targetNodeId = getRealId(refId);

            // Link: Cung cấp (varName) -> Nhận (f.targetCol)
            if (!links.some(l => String(l.source).toLowerCase() === lowerVar && String(l.target).toLowerCase() === lowerId)) {
                links.push({ source: targetNodeId, target: sourceNodeId });
            }
            
            if (sourceFormula) traceUp(sourceFormula);
        });
    };

    // TRUY VẾT XUÔI (DESCENDANTS): Tìm các công thức phía sau có sử dụng mình
    const traceDown = (fName) => {
        const lowerFName = String(fName).toLowerCase();
        if (visited.has('down_' + lowerFName)) return;
        visited.add('down_' + lowerFName);

        allFormulas.forEach(otherF => {
            const vars = extractVariables(otherF.expression).map(v => String(v).toLowerCase());
            if (vars.includes(lowerFName)) {
                addNode(otherF.targetCol, otherF.targetCol, 'formula', otherF.expression);
                const descNodeId = getRealId(otherF.targetCol);
                const srcNodeId = getRealId(fName);
                
                // Link: Cấp nguồn (fName) -> Hưởng (otherF)
                if (!links.some(l => String(l.source).toLowerCase() === lowerFName && String(l.target).toLowerCase() === String(descNodeId).toLowerCase())) {
                    links.push({ source: srcNodeId, target: descNodeId });
                }
                
                traceDown(otherF.targetCol);
            }
        });
    };

    traceUp(rootFormula);
    traceDown(rootFormula.targetCol);

    return {
        nodes: Array.from(nodesMap.values()),
        links: links
    };
};

