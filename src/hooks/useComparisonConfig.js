import { useState, useEffect, useMemo, useRef } from 'react';
import { isSTT, normalizeHeader, stringSimilarity } from '../utils/excelUtils'; // Import isSTT

const getAutoCompareColumns = (headers, keyCols) => {
    if (!Array.isArray(headers)) return [];
    const keys = Array.isArray(keyCols) ? keyCols : [keyCols];
    return headers.filter(col => col && !keys.includes(col) && !isSTT(col));
};

export function useComparisonConfig(baseFile, targetFiles) {
    const [availableCols, setAvailableCols] = useState([]);
    const [keyCols, setKeyCols] = useState([]);
    const [valCols, setValCols] = useState([]);

    // Advanced Comparison Options
    const [advancedRules, setAdvancedRules] = useState({});
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [advSelectedCol, setAdvSelectedCol] = useState('');
    const [advSearchCol, setAdvSearchCol] = useState('');
    const [isAdvComboOpen, setIsAdvComboOpen] = useState(false);
    const advComboRef = useRef(null); // Ref cho dropdown "Chọn cột cần cấu hình"

    // Danh sách cột được lọc theo advSearchCol để hiển thị trong dropdown
    const filteredAdvCols = useMemo(() => {
        const search = advSearchCol.toLowerCase().trim();
        if (!search) return availableCols.filter(Boolean);
        return availableCols.filter(c => c && c.toLowerCase().includes(search));
    }, [availableCols, advSearchCol]);

    // Column Mapping
    const [columnMappings, setColumnMappings] = useState({});
    const [showMapped, setShowMapped] = useState(false);
    const [mappingFilters, setMappingFilters] = useState({});

    useEffect(() => {
        if (baseFile) {
            const baseHeaders = baseFile.headers;
            setAvailableCols(baseHeaders);
            if (baseHeaders.length > 0 && keyCols.length === 0) {
                const potentialKey = baseHeaders.find(h => h.toLowerCase().includes('mã') && (h.toLowerCase().includes('nv') || h.toLowerCase().includes('nhân viên'))) || baseHeaders[0];
                setKeyCols(potentialKey ? [potentialKey] : []);
            }
        } else {
            setAvailableCols([]);
            setKeyCols([]);
            setValCols([]);
        }
    }, [baseFile]);

    useEffect(() => {
        setValCols(getAutoCompareColumns(availableCols, keyCols));
    }, [availableCols, keyCols]);

    useEffect(() => {
        if (baseFile && targetFiles.length > 0) {
            setColumnMappings(prev => {
                const newMap = { ...prev };
                let updated = false;
                targetFiles.forEach(tf => {
                    if (!newMap[tf.id]) {
                        newMap[tf.id] = {};
                        updated = true;
                    }
                    baseFile.headers.forEach(bCol => {
                        if (newMap[tf.id][bCol] === undefined) {
                            const bNorm = normalizeHeader(bCol);
                            let match = tf.headers.find(h => normalizeHeader(h) === bNorm);
                            if (!match) {
                                let bestMatch = null;
                                let bestScore = 0;
                                tf.headers.forEach(h => {
                                    const score = stringSimilarity(normalizeHeader(h), bNorm);
                                    if (score >= 0.80 && score > bestScore) {
                                        bestScore = score;
                                        bestMatch = h;
                                    }
                                });
                                if (bestMatch) match = bestMatch;
                            }
                            newMap[tf.id][bCol] = match ? match : '';
                            updated = true;
                        }
                    });
                });
                return updated ? newMap : prev;
            });
        }
    }, [baseFile, targetFiles]);

    const missingKeyTargets = useMemo(() => {
        if (!Array.isArray(keyCols) || keyCols.length === 0) return [];
        return targetFiles.filter(tf => keyCols.some(k => !columnMappings[tf.id]?.[k]));
    }, [targetFiles, columnMappings, keyCols]);

    const getMappingUnique = (colKey) => (baseFile && colKey === 'base') ? baseFile.headers : [];

    const mappingColsToShow = useMemo(() => baseFile ? baseFile.headers.filter(bCol => {
        if (!showMapped) {
            const needsMapping = targetFiles.some(tf => {
                const bNorm = normalizeHeader(bCol);
                let autoMatched = false;
                if (tf.headers.some(h => normalizeHeader(h) === bNorm)) {
                    autoMatched = true;
                } else {
                    let bestScore = 0;
                    tf.headers.forEach(h => {
                        const score = stringSimilarity(normalizeHeader(h), bNorm);
                        if (score >= 0.80 && score > bestScore) {
                            bestScore = score;
                        }
                    });
                    if (bestScore >= 0.80) autoMatched = true;
                }
                return !autoMatched;
            });
            if (!needsMapping) return false;
        }
        const allowedVals = mappingFilters['base'];
        if (allowedVals && !allowedVals.includes(bCol)) return false;
        return true;
    }) : [], [baseFile, targetFiles, showMapped, mappingFilters]);

    return {
        availableCols, keyCols, setKeyCols, valCols, setValCols,
        advancedRules, setAdvancedRules, showAdvancedOptions, setShowAdvancedOptions,
        advSelectedCol, setAdvSelectedCol, advSearchCol, setAdvSearchCol, isAdvComboOpen, setIsAdvComboOpen,
        advComboRef, filteredAdvCols,
        columnMappings, setColumnMappings, showMapped, setShowMapped, mappingFilters, setMappingFilters,
        missingKeyTargets, getMappingUnique, mappingColsToShow, getAutoCompareColumns, isSTT,
    };
}