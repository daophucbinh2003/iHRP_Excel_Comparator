import * as XLSX from 'xlsx';
import { parseNumSafe } from './formatters';
import { extractVariables } from './astCompiler';

const extractMappedData = (workbook, sheetName, baseColsToExtract, baseKeyColumn, mapping, headerRowIdx) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) return [];
    
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headers = {}; 
    const seen = {};
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({ c: C, r: headerRowIdx })];
      if (cell && cell.v) {
          const text = String(cell.v).trim();
          if (seen[text]) {
              seen[text]++;
              headers[C] = `${text} (${seen[text]})`;
          } else {
              seen[text] = 1;
              headers[C] = text;
          }
      }
    }

    const targetToBase = {};
    if (mapping[baseKeyColumn]) targetToBase[mapping[baseKeyColumn]] = baseKeyColumn;
    baseColsToExtract.forEach(baseCol => {
       if (mapping[baseCol]) targetToBase[mapping[baseCol]] = baseCol;
    });

    const data = [];
    for (let R = headerRowIdx + 1; R <= range.e.r; ++R) {
      const rowObj = {};
      let hasKey = false;
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const targetHeader = headers[C];
        if (!targetHeader) continue;
        const baseHeader = targetToBase[targetHeader];
        if (!baseHeader) continue;
        
        const cell = sheet[XLSX.utils.encode_cell({ c: C, r: R })];
        let rawVal;
        if (cell) {
          if (cell.v !== undefined && cell.v !== null) rawVal = cell.v;
          else if (cell.w !== undefined) rawVal = cell.w;
          else rawVal = "";
        } else rawVal = "";
        
        const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";

        if (baseHeader === baseKeyColumn && val !== "") {
          const keyLower = val.toLowerCase();
          if (keyLower.includes('tổng') || keyLower === 'stt' || keyLower === 'mã' || keyLower.includes('mã nhân viên') || keyLower.includes('mã nv')) {
             hasKey = false;
          } else {
             hasKey = true;
             rowObj[baseKeyColumn] = val;
          }
        }
        if (baseColsToExtract.includes(baseHeader) || baseHeader === baseKeyColumn) {
          rowObj[baseHeader] = val;
        }
      }
      if (hasKey) data.push(rowObj);
    }
    return data;
};

self.onmessage = (e) => {
    try {
        const { baseFile, targetFiles, columnMappings, keyCol, compareColumns, customFormulas, advancedRules } = e.data;

        const formulaColsNeeded = new Set();
        customFormulas.forEach(f => {
            if(f.targetCol) {
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
        const baseMapping = baseFile.headers.reduce((acc, h) => ({...acc, [h]: h}), {});
        
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

        let allKeys = new Set(Object.keys(mapGoc));
        targetMaps.forEach(tm => { Object.keys(tm.map).forEach(k => allKeys.add(k)); });
        allKeys = Array.from(allKeys);

        const compareCells = (v1, v2, colName) => {
            const rule = advancedRules[colName] || {};
            let s1 = String(v1 !== undefined && v1 !== null ? v1 : '').trim();
            let s2 = String(v2 !== undefined && v2 !== null ? v2 : '').trim();

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
                    if (n1.toFixed(dec) === n2.toFixed(dec)) return true;
                    return false; 
                }
            }
            const normalize = (v) => {
                if (v === null || v === undefined) return '0'; 
                if (typeof v === 'number') return parseFloat(v.toFixed(4)).toString();
                let s = String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                if (s === '' || s === '-') return '0';
                let isNegative = false;
                let checkStr = s;
                if (checkStr.startsWith('(') && checkStr.endsWith(')')) { isNegative = true; checkStr = checkStr.slice(1, -1).trim(); } 
                else if (checkStr.startsWith('-')) { isNegative = true; checkStr = checkStr.slice(1).trim(); }
                const commaCount = (checkStr.match(/,/g) || []).length;
                const dotCount = (checkStr.match(/\./g) || []).length;
                let numStr = checkStr;
                if (commaCount > 0 && dotCount > 0) {
                    numStr = checkStr.lastIndexOf(',') > checkStr.lastIndexOf('.') ? checkStr.replace(/\./g, '').replace(',', '.') : checkStr.replace(/,/g, '');
                } else if (commaCount > 1) { numStr = checkStr.replace(/,/g, ''); } 
                else if (commaCount === 1) { numStr = checkStr.replace(',', '.'); } 
                else if (dotCount > 1) { numStr = checkStr.replace(/\./g, ''); }
                numStr = numStr.replace(/\s+/g, '');
                if (numStr !== '' && !isNaN(numStr)) {
                    const finalNum = isNegative ? -parseFloat(numStr) : parseFloat(numStr);
                    return parseFloat(finalNum.toFixed(4)).toString();
                }
                return s.replace(/\s+/g, ' ').toLowerCase().normalize('NFC');
            };
            return normalize(s1) === normalize(s2);
        };

        const errors = [];
        const totalKeys = allKeys.length;

        self.postMessage({ type: 'progress', message: `Bắt đầu đối soát ${totalKeys} bản ghi...` });

        allKeys.forEach((key, index) => {
          if (index % 1000 === 0 && index > 0) {
              self.postMessage({ type: 'progress', message: `Đang xử lý: ${index} / ${totalKeys} dòng...` });
          }
          const rowGoc = mapGoc[key];
          let hasDiff = false, isMissing = false, isPerfectMatch = true;
          const diffRow = { [keyCol]: key, status: [], diffCells: {}, baseVals: { ...(rowGoc || {}) }, targetVals: {} };

          if (!rowGoc) { hasDiff = true; isMissing = true; isPerfectMatch = false; diffRow.status.push('Chỉ có ở Target'); }

          targetFiles.forEach((tf) => {
            const tm = targetMaps.find(m => m.id === tf.id);
            if (!tm.hasKey) {
              hasDiff = true; isPerfectMatch = false; diffRow.targetVals[tf.id] = { _error: 'Không có Key' }; return; 
            }
            const rowT = tm.map[key];
            diffRow.targetVals[tf.id] = { ...(rowT || {}) }; 

            if (!rowT) {
              hasDiff = true; isMissing = true; isPerfectMatch = false; diffRow.status.push(`Thiếu ở ${tf.name}`);
            } else if (rowGoc) {
              compareColumns.forEach(col => {
                if (!tm.mapping[col]) {
                  hasDiff = true; isPerfectMatch = false; diffRow.diffCells[`${col}_${tf.id}`] = true; diffRow.targetVals[tf.id][col] = ' Bỏ qua/Thiếu';
                } else {
                  let valG = diffRow.baseVals[col], valT = diffRow.targetVals[tf.id][col];
                  const rule = advancedRules[col] || {};
                  if (rule.roundNumber) {
                      const dec = (rule.decimals !== undefined && rule.decimals !== '') ? parseInt(rule.decimals, 10) : 2;
                      const n1 = parseNumSafe(valG);
                      if (n1 !== null) { valG = Number(n1.toFixed(dec)); diffRow.baseVals[col] = valG; }
                      const n2 = parseNumSafe(valT);
                      if (n2 !== null && valT !== ' Bỏ qua/Thiếu') { valT = Number(n2.toFixed(dec)); diffRow.targetVals[tf.id][col] = valT; }
                  }
                  if (!compareCells(valG, valT, col)) {
                    hasDiff = true; isPerfectMatch = false; diffRow.diffCells[`${col}_Gốc`] = true; diffRow.diffCells[`${col}_${tf.id}`] = true;
                  }
                }
              });
            }
          });

          if (diffRow.status.length === 0) diffRow.status = [];
          diffRow.isMatch = isPerfectMatch; diffRow.isDiff = hasDiff && !isMissing; diffRow.isMissing = isMissing;
          errors.push(diffRow);
        });

        self.postMessage({ type: 'success', results: errors });
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message });
    }
};