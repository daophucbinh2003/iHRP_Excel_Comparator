import { useState, useEffect, useMemo } from 'react';
import { isSTT } from '../utils/excelUtils'; // Import isSTT

const getAutoCompareColumns = (headers, keyColumn) => {
    if (!Array.isArray(headers)) return [];
    return headers.filter(col => col !== keyColumn && !isSTT(col));
};

export function useComparisonConfig(baseFile, targetFiles) {
    const [availableCols, setAvailableCols] = useState([]);
    const [keyCol, setKeyCol] = useState('');
    const [valCols, setValCols] = useState([]);

    // Advanced Comparison Options
    const [advancedRules, setAdvancedRules] = useState({});
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [advSelectedCol, setAdvSelectedCol] = useState('');
    const [advSearchCol, setAdvSearchCol] = useState('');
    const [isAdvComboOpen, setIsAdvComboOpen] = useState(false);

    // Column Mapping
    const [columnMappings, setColumnMappings] = useState({});
    const [showMapped, setShowMapped] = useState(false);
    const [mappingFilters, setMappingFilters] = useState({});

    useEffect(() => {
        if (baseFile) {
            const baseHeaders = baseFile.headers;
            setAvailableCols(baseHeaders);
            if (baseHeaders.length > 0 && !baseHeaders.includes(keyCol)) {
                const potentialKey = baseHeaders.find(h => h.toLowerCase().includes('mã') && (h.toLowerCase().includes('nv') || h.toLowerCase().includes('nhân viên'))) || baseHeaders[0];
                setKeyCol(potentialKey);
            }
        } else {
            setAvailableCols([]);
            setKeyCol('');
            setValCols([]);
        }
    }, [baseFile]);

    useEffect(() => {
        setValCols(getAutoCompareColumns(availableCols, keyCol));
    }, [availableCols, keyCol]);

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
                            newMap[tf.id][bCol] = tf.headers.includes(bCol) ? bCol : '';
                            updated = true;
                        }
                    });
                });
                return updated ? newMap : prev;
            });
        }
    }, [baseFile, targetFiles]);

    const missingKeyTargets = useMemo(() => targetFiles.filter(tf => !columnMappings[tf.id]?.[keyCol]), [targetFiles, columnMappings, keyCol]);

    const getMappingUnique = (colKey) => (baseFile && colKey === 'base') ? baseFile.headers : [];

    const mappingColsToShow = useMemo(() => baseFile ? baseFile.headers.filter(bCol => {
        if (!showMapped) {
            const needsMapping = targetFiles.some(tf => !tf.headers.includes(bCol));
            if (!needsMapping) return false;
        }
        const allowedVals = mappingFilters['base'];
        if (allowedVals && !allowedVals.includes(bCol)) return false;
        return true;
    }) : [], [baseFile, targetFiles, showMapped, mappingFilters]);

    return {
        availableCols, keyCol, setKeyCol, valCols, setValCols,
        advancedRules, setAdvancedRules, showAdvancedOptions, setShowAdvancedOptions,
        advSelectedCol, setAdvSelectedCol, advSearchCol, setAdvSearchCol, isAdvComboOpen, setIsAdvComboOpen,
        columnMappings, setColumnMappings, showMapped, setShowMapped, mappingFilters, setMappingFilters,
        missingKeyTargets, getMappingUnique, mappingColsToShow, getAutoCompareColumns, isSTT,
    };
}