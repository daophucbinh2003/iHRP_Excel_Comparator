import * as XLSX from 'xlsx';
import { parseNumSafe } from './formatters';
import { extractVariables } from './astCompiler';
import { normalizeHeader } from './excelUtils';
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

// Trích xuất dữ liệu — hỗ trợ file có header đa tầng và dòng index (1,2,3...)
const extractMappedData = (workbook, sheetName, baseColsToExtract, baseKeyColumns, mapping, headerRowIdx, prebuiltHeaders) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return [];

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const startRow = range.s.r;

    // Đọc sheet dạng mảng 2D với defval '' để xử lý nhanh
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const relativeHeaderIdx = headerRowIdx - startRow;
    if (relativeHeaderIdx < 0 || relativeHeaderIdx >= rows.length) return [];

    // Xây dựng map tên cột → index trong file
    // Ưu tiên dùng prebuiltHeaders (đã xử lý merge đa tầng) nếu có
    const colIndices = [];
    const targetToBase = {};
    baseKeyColumns.forEach(k => {
        if (mapping[k]) targetToBase[mapping[k]] = k;
    });
    baseColsToExtract.forEach(baseCol => {
        if (mapping[baseCol]) targetToBase[mapping[baseCol]] = baseCol;
    });

    if (prebuiltHeaders && prebuiltHeaders.length > 0) {
        // Dùng prebuiltHeaders (tên cột đã được giải mã từ merge)
        const seen = {};
        prebuiltHeaders.forEach((colName, idx) => {
            let text = colName ? String(colName).trim() : '';
            if (text !== '') {
                if (seen[text]) { seen[text]++; text = `${text} (${seen[text]})`; }
                else seen[text] = 1;
            }
            if (targetToBase[text]) {
                colIndices.push({ idx, baseCol: targetToBase[text] });
            }
        });
    } else {
        // Fallback: đọc từ dòng header đơn giản (file không có merge phức tạp)
        const headerRow = rows[relativeHeaderIdx] || [];
        const seen = {};
        headerRow.forEach((cellVal, idx) => {
            let text = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
            if (text !== '') {
                if (seen[text]) { seen[text]++; text = `${text} (${seen[text]})`; }
                else seen[text] = 1;
            }
            if (targetToBase[text]) colIndices.push({ idx, baseCol: targetToBase[text] });
        });
    }

    // Tìm dòng bắt đầu data thực sự:
    // Bỏ qua các dòng ngay sau headerRowIdx nếu là dòng index (1,2,3...) hoặc sub-header
    let dataStartRelIdx = relativeHeaderIdx + 1;
    while (dataStartRelIdx < rows.length && dataStartRelIdx <= relativeHeaderIdx + 5) {
        const row = rows[dataStartRelIdx];
        if (!row) break;
        const nonEmpty = row.filter(x => x !== '' && x !== null && x !== undefined);
        if (nonEmpty.length < 3) { dataStartRelIdx++; continue; }
        // Kiểm tra dòng index (1,2,3,4,5...)
        const firstFive = nonEmpty.slice(0, 5);
        const isIndexRow = firstFive.length >= 3 && firstFive.every((cell, idx) => {
            const v = parseInt(cell);
            return !isNaN(v) && v === idx + 1;
        });
        if (isIndexRow) { dataStartRelIdx++; continue; }
        break; // Đây là dòng data thực
    }

    const data = [];
    for (let i = dataStartRelIdx; i < rows.length; i++) {
        const row = rows[i];
        const rowObj = {};
        let isValidKey = false;
        
        colIndices.forEach(({ idx, baseCol }) => {
            const rawVal = row[idx];
            rowObj[baseCol] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
        });

        // Build composite key
        const keyParts = [];
        baseKeyColumns.forEach(k => {
            const val = rowObj[k] || '';
            if (val !== '') {
                const keyLower = val.toLowerCase();
                if (!(keyLower.includes('tổng') || keyLower === 'stt' || keyLower === 'mã' || keyLower.includes('mã nhân viên') || keyLower.includes('mã nv'))) {
                    isValidKey = true;
                }
            }
            keyParts.push(val);
        });

        if (isValidKey) {
            rowObj._compositeKey = keyParts.join(' _|_ ');
            data.push(rowObj);
        }
    }
    return data;
};


self.onmessage = (e) => {
    try {
        const { baseFile, targetFiles, columnMappings, keyCols, compareColumns, customFormulas, advancedRules } = e.data;

        // Xác định các cột cần lấy cho công thức
        const formulaColsNeeded = new Set();
        customFormulas.forEach(f => {
            if (f.targetCol) {
                const actual = baseFile.headers.find(h => normalizeHeader(h) === normalizeHeader(f.targetCol)) || f.targetCol;
                formulaColsNeeded.add(actual);
            }
            const varsList = extractVariables(f.expression);
            varsList.forEach(colName => {
                const actual = baseFile.headers.find(h => normalizeHeader(h) === normalizeHeader(colName)) || colName;
                formulaColsNeeded.add(actual);
            });
        });

        const allColsToExtract = [...new Set([...compareColumns, ...Array.from(formulaColsNeeded)])];
        const baseMapping = baseFile.headers.reduce((acc, h) => {
            acc[h] = h;
            return acc;
        }, {});

        self.postMessage({ type: 'progress', message: 'Đang trích xuất dữ liệu gốc...' });
        const dataGoc = extractMappedData(baseFile.wb, baseFile.sheet, allColsToExtract, keyCols, baseMapping, baseFile.headerRowIdx, baseFile.headers);
        const mapGoc = {};
        dataGoc.forEach(row => mapGoc[row._compositeKey] = row);

        const targetMaps = targetFiles.map((tf, idx) => {
            self.postMessage({ type: 'progress', message: `Đang trích xuất dữ liệu file so sánh ${idx + 1}...` });
            const mapping = columnMappings[tf.id] || {};
            const targetHasAllKeys = keyCols.every(k => mapping[k]);
            if (!targetHasAllKeys) return { id: tf.id, name: tf.customName || tf.name, map: {}, hasKey: false, mapping };

            const data = extractMappedData(tf.wb, tf.sheet, allColsToExtract, keyCols, mapping, tf.headerRowIdx, tf.headers);
            const map = {};
            data.forEach(row => map[row._compositeKey] = row);
            return { id: tf.id, name: tf.customName || tf.name, map, hasKey: true, mapping };
        });

        const allKeysSet = new Set(Object.keys(mapGoc));
        targetMaps.forEach(tm => {
            for (const k in tm.map) allKeysSet.add(k);
        });
        const allKeys = Array.from(allKeysSet);
        const totalKeys = allKeys.length;

        // TỐI ƯU HÓA: Map tra cứu O(1) thay vì .find() O(n) trong mỗi vòng lặp
        const targetMapsById = new Map(targetMaps.map(tm => [tm.id, tm]));

        // TỐI ƯU HÓA: Bộ đệm Unique Values
        const uniqueValues = {
            'V_status': new Set()
        };
        keyCols.forEach(k => { uniqueValues[`V_${k}`] = new Set(); });
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
                _compositeKey: key, 
                status: [], 
                diffCells: {}, 
                baseVals: rowGoc || {}, 
                targetVals: {} 
            };

            // Unique Values cho Key
            if (rowGoc) {
                keyCols.forEach(k => {
                    if (rowGoc[k] !== undefined) uniqueValues[`V_${k}`].add(String(rowGoc[k]));
                });
            } else {
                // If rowGoc is missing, we try to split the composite key? 
                // Or just rely on targetVals later.
            }

            if (!rowGoc) {
                hasDiff = true; isMissing = true; isPerfectMatch = false;
                const st = 'Chỉ có ở Target';
                diffRow.status.push(st);
                uniqueValues['V_status'].add(st);
            }

            targetFiles.forEach((tf) => {
                const tm = targetMapsById.get(tf.id);
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
                    if (!rowGoc) {
                        keyCols.forEach(k => {
                            if (rowT[k] !== undefined) uniqueValues[`V_${k}`].add(String(rowT[k]));
                        });
                    }
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