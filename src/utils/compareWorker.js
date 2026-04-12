import * as XLSX from 'xlsx';
import { parseNumSafe } from './formatters';
import { extractVariables } from './astCompiler';

// TỐI ƯU HÓA: Chuyển các hàm xử lý ra ngoài để tránh khởi tạo lại trong vòng lặp
const normalize = (v) => {
    if (v === null || v === undefined) return '0';
    if (typeof v === 'number') return parseFloat(v.toFixed(4)).toString();
    
    // Xử lý chuỗi nhanh hơn bằng cách hạn chế replace liên tục
    let s = String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (s === '' || s === '-') return '0';
    
    let isNegative = false;
    let checkStr = s;
    if (checkStr.startsWith('(') && checkStr.endsWith(')')) { 
        isNegative = true; 
        checkStr = checkStr.slice(1, -1).trim(); 
    } else if (checkStr.startsWith('-')) { 
        isNegative = true; 
        checkStr = checkStr.slice(1).trim(); 
    }

    const commaCount = (checkStr.match(/,/g) || []).length;
    const dotCount = (checkStr.match(/\./g) || []).length;
    let numStr = checkStr;
    
    if (commaCount > 0 && dotCount > 0) {
        numStr = checkStr.lastIndexOf(',') > checkStr.lastIndexOf('.') 
                 ? checkStr.replace(/\./g, '').replace(',', '.') 
                 : checkStr.replace(/,/g, '');
    } else if (commaCount > 1) { numStr = checkStr.replace(/,/g, ''); } 
    else if (commaCount === 1) { numStr = checkStr.replace(',', '.'); } 
    else if (dotCount > 1) { numStr = checkStr.replace(/\./g, ''); }
    
    numStr = numStr.replace(/\s+/g, '');
    if (numStr !== '' && !isNaN(numStr)) {
        const finalNum = isNegative ? -parseFloat(numStr) : parseFloat(numStr);
        return parseFloat(finalNum.toFixed(4)).toString();
    }
    
    // Nếu là text, chuẩn hóa NFC để so sánh chính xác tiếng Việt
    return s.replace(/\s+/g, ' ').toLowerCase().normalize('NFC');
};

const compareCells = (v1, v2, colName, advancedRules) => {
    const rule = advancedRules[colName] || {};
    let s1 = v1 !== undefined && v1 !== null ? String(v1).trim() : '';
    let s2 = v2 !== undefined && v2 !== null ? String(v2).trim() : '';

    if (rule.partialMatch) {
        const n1 = parseNumSafe(s1);
        const n2 = parseNumSafe(s2);
        const norm1 = s1.toLowerCase();
        const norm2 = s2.toLowerCase();
        if (n1 === null && n2 === null && norm1 && norm2 && (norm1.includes(norm2) || norm2.includes(norm1))) return true;
    }

    if (rule.roundNumber) {
        const n1 = parseNumSafe(s1);
        const n2 = parseNumSafe(s2);
        if (n1 !== null && n2 !== null) {
            const dec = (rule.decimals !== undefined && rule.decimals !== '') ? parseInt(rule.decimals, 10) : 2;
            return n1.toFixed(dec) === n2.toFixed(dec);
        }
    }

    return normalize(s1) === normalize(s2);
};

// TỐI ƯU HÓA: Trích xuất dữ liệu bằng cách lặp qua mảng thô (SheetJS utils.sheet_to_json)
const extractMappedData = (workbook, sheetName, baseColsToExtract, baseKeyColumn, mapping, headerRowIdx) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return [];

    // Sử dụng sheet_to_json với header: 1 để lấy mảng 2 chiều nhanh nhất
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length <= headerRowIdx) return [];

    const headerRow = rows[headerRowIdx];
    const colIndices = [];
    const targetToBase = {};

    // Map các cột cần thiết với index tương ứng
    if (mapping[baseKeyColumn]) targetToBase[mapping[baseKeyColumn]] = baseKeyColumn;
    baseColsToExtract.forEach(baseCol => {
        if (mapping[baseCol]) targetToBase[mapping[baseCol]] = baseCol;
    });

    headerRow.forEach((cellVal, idx) => {
        const text = String(cellVal || '').trim();
        if (targetToBase[text]) {
            colIndices.push({ idx, baseCol: targetToBase[text] });
        }
    });

    const data = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const rowObj = {};
        let hasKey = false;
        let keyValue = "";

        colIndices.forEach(({ idx, baseCol }) => {
            const val = String(row[idx] || '').trim();
            if (baseCol === baseKeyColumn && val !== "") {
                const keyLower = val.toLowerCase();
                // Loại bỏ các dòng rác (tài liệu, STT, cộng tổng...)
                if (!(keyLower.includes('tổng') || keyLower === 'stt' || keyLower === 'mã' || keyLower.includes('mã nhân viên') || keyLower.includes('mã nv'))) {
                    hasKey = true;
                    keyValue = val;
                }
            }
            rowObj[baseCol] = val;
        });

        if (hasKey) {
            rowObj[baseKeyColumn] = keyValue;
            data.push(rowObj);
        }
    }
    return data;
};

self.onmessage = (e) => {
    try {
        const { baseFile, targetFiles, columnMappings, keyCol, compareColumns, customFormulas, advancedRules } = e.data;

        // Xác định các cột cần lấy cho công thức
        const formulaColsNeeded = new Set();
        customFormulas.forEach(f => {
            if (f.targetCol) {
                const actual = baseFile.headers.find(h => h.toLowerCase() === f.targetCol.toLowerCase()) || f.targetCol;
                formulaColsNeeded.add(actual);
            }
            const varsList = extractVariables(f.expression);
            varsList.forEach(colName => {
                const actual = baseFile.headers.find(h => h.toLowerCase() === colName.toLowerCase()) || colName;
                formulaColsNeeded.add(actual);
            });
        });

        const allColsToExtract = [...new Set([...compareColumns, ...Array.from(formulaColsNeeded)])];
        const baseMapping = baseFile.headers.reduce((acc, h) => {
            acc[h] = h;
            return acc;
        }, {});

        self.postMessage({ type: 'progress', message: 'Đang trích xuất dữ liệu gốc...' });
        const dataGoc = extractMappedData(baseFile.wb, baseFile.sheet, allColsToExtract, keyCol, baseMapping, baseFile.headerRowIdx);
        const mapGoc = {};
        dataGoc.forEach(row => mapGoc[row[keyCol]] = row);

        const targetMaps = targetFiles.map((tf, idx) => {
            self.postMessage({ type: 'progress', message: `Đang trích xuất dữ liệu file so sánh ${idx + 1}...` });
            const mapping = columnMappings[tf.id] || {};
            const targetKeyCol = mapping[keyCol];
            if (!targetKeyCol) return { id: tf.id, name: tf.customName || tf.name, map: {}, hasKey: false, mapping };

            const data = extractMappedData(tf.wb, tf.sheet, allColsToExtract, keyCol, mapping, tf.headerRowIdx);
            const map = {};
            data.forEach(row => map[row[keyCol]] = row);
            return { id: tf.id, name: tf.customName || tf.name, map, hasKey: true, mapping };
        });

        const allKeysSet = new Set(Object.keys(mapGoc));
        targetMaps.forEach(tm => {
            for (const k in tm.map) allKeysSet.add(k);
        });
        const allKeys = Array.from(allKeysSet);
        const totalKeys = allKeys.length;

        // TỐI ƯU HÓA: Bộ đệm Unique Values
        const uniqueValues = {
            [`V_${keyCol}`]: new Set(),
            'V_status': new Set()
        };
        allColsToExtract.forEach(col => {
            uniqueValues[`V_${col}`] = new Set();
        });

        const results = [];
        self.postMessage({ type: 'progress', message: `Bắt đầu đối soát ${totalKeys} bản ghi...` });

        for (let i = 0; i < totalKeys; i++) {
            const key = allKeys[i];
            if (i % 1000 === 0 && i > 0) {
                self.postMessage({ type: 'progress', message: `Đang xử lý: ${i} / ${totalKeys} dòng...` });
            }

            const rowGoc = mapGoc[key];
            let hasDiff = false, isMissing = false, isPerfectMatch = true;
            const diffRow = { 
                [keyCol]: key, 
                status: [], 
                diffCells: {}, 
                baseVals: rowGoc || {}, 
                targetVals: {} 
            };

            // Unique Values cho Key
            uniqueValues[`V_${keyCol}`].add(String(key));

            if (!rowGoc) {
                hasDiff = true; isMissing = true; isPerfectMatch = false;
                const st = 'Chỉ có ở Target';
                diffRow.status.push(st);
                uniqueValues['V_status'].add(st);
            }

            targetFiles.forEach((tf) => {
                const tm = targetMaps.find(m => m.id === tf.id);
                if (!tm.hasKey) {
                    hasDiff = true; isPerfectMatch = false;
                    diffRow.targetVals[tf.id] = { _error: 'Không có Key' };
                    return;
                }
                const rowT = tm.map[key];
                diffRow.targetVals[tf.id] = rowT || {};

                if (!rowT) {
                    hasDiff = true; isMissing = true; isPerfectMatch = false;
                    const st = `Thiếu ở ${tf.name}`;
                    diffRow.status.push(st);
                    uniqueValues['V_status'].add(st);
                } else {
                    // Unique Values cho các cột so sánh
                    if (rowGoc) {
                        compareColumns.forEach(col => {
                            // Add values to unique sets
                            if (rowGoc[col] !== undefined) uniqueValues[`V_${col}`].add(String(rowGoc[col]));
                            if (rowT[col] !== undefined) uniqueValues[`V_${col}`].add(String(rowT[col]));

                            if (!tm.mapping[col]) {
                                hasDiff = true; isPerfectMatch = false;
                                diffRow.diffCells[`${col}_${tf.id}`] = true;
                                diffRow.targetVals[tf.id][col] = ' Bỏ qua/Thiếu';
                            } else {
                                let valG = diffRow.baseVals[col], valT = diffRow.targetVals[tf.id][col];
                                const rule = advancedRules[col] || {};
                                
                                // Xử lý làm tròn nếu cấu hình yêu cầu
                                if (rule.roundNumber) {
                                    const dec = (rule.decimals !== undefined && rule.decimals !== '') ? parseInt(rule.decimals, 10) : 2;
                                    const n1 = parseNumSafe(valG);
                                    if (n1 !== null) { valG = Number(n1.toFixed(dec)); diffRow.baseVals[col] = valG; }
                                    const n2 = parseNumSafe(valT);
                                    if (n2 !== null && valT !== ' Bỏ qua/Thiếu') { valT = Number(n2.toFixed(dec)); diffRow.targetVals[tf.id][col] = valT; }
                                }
                                
                                if (!compareCells(valG, valT, col, advancedRules)) {
                                    hasDiff = true; isPerfectMatch = false;
                                    diffRow.diffCells[`${col}_Gốc`] = true;
                                    diffRow.diffCells[`${col}_${tf.id}`] = true;
                                }
                            }
                        });
                    }
                }
            });

            diffRow.isMatch = isPerfectMatch;
            diffRow.isDiff = hasDiff && !isMissing;
            diffRow.isMissing = isMissing;
            results.push(diffRow);
        }

        // TỐI ƯU HÓA: Chuyển Set thành Array và Sort trước khi gửi về UI
        const finalUniqueValues = {};
        for (const k in uniqueValues) {
            finalUniqueValues[k] = Array.from(uniqueValues[k]).sort((a, b) => 
                String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' })
            );
        }

        self.postMessage({ 
            type: 'success', 
            results, 
            uniqueValuesCache: finalUniqueValues 
        });

    } catch (error) {
        console.error(error);
        self.postMessage({ type: 'error', message: error.message });
    }
};