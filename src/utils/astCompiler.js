// CƠ CHẾ SQL COMPILER DÀNH RIÊNG CHO CÔNG THỨC (AST EVALUATOR)

export const tokenizeSQL = (code) => {
    const tokens = [];
    let i = 0;
    // Chuẩn hóa loại bỏ dòng comment (bao gồm cả lỗi Word) và dấu nháy thông minh
    code = code.replace(/(?:--|–|—|\/\/).*$/gm, ' ');
    code = code.replace(/[“”‘’`]/g, "'");

    while (i < code.length) {
        let char = code[i];
        if (/\s/.test(char)) { i++; continue; }

        if (char === "'") {
            let str = ''; i++;
            while (i < code.length && code[i] !== "'") { str += code[i++]; }
            i++; 
            tokens.push({ type: 'STRING', value: str });
            continue;
        }

        if (/[0-9]/.test(char) || (char === '-' && /[0-9\.]/.test(code[i+1]))) {
            let num = '';
            if (char === '-') { num += '-'; i++; }
            while (i < code.length && /[0-9\.]/.test(code[i])) { num += code[i++]; }
            // Loại bỏ dấu chấm thừa ở cuối
            if (num.endsWith('.')) { num = num.slice(0, -1); i--; }
            tokens.push({ type: 'NUMBER', value: parseFloat(num) });
            continue;
        }

        if (/[a-zA-Z_\[]/.test(char)) {
            let id = '';
            if (char === '[') {
                i++;
                while(i < code.length && code[i] !== ']') { id += code[i++]; }
                i++;
            } else {
                while (i < code.length && /[a-zA-Z0-9_\.]/.test(code[i])) { id += code[i++]; }
                if (id.endsWith('.')) { id = id.slice(0, -1); i--; }
            }
            const lower = id.toLowerCase();
            const keywords = ['case','when','then','else','end','in','between','and','or','not','is','null'];
            if (keywords.includes(lower)) {
                tokens.push({ type: 'KEYWORD', value: lower });
            } else {
                tokens.push({ type: 'VAR', value: id });
            }
            continue;
        }

        if (char === '=' && code[i+1] === '=') { tokens.push({ type: 'OP', value: '==' }); i+=2; continue; }
        if (char === '<' && code[i+1] === '>') { tokens.push({ type: 'OP', value: '<>' }); i+=2; continue; }
        if (char === '!' && code[i+1] === '=') { tokens.push({ type: 'OP', value: '!=' }); i+=2; continue; }
        if (char === '<' && code[i+1] === '=') { tokens.push({ type: 'OP', value: '<=' }); i+=2; continue; }
        if (char === '>' && code[i+1] === '=') { tokens.push({ type: 'OP', value: '>=' }); i+=2; continue; }
        if (/[=<>+\-*/%]/.test(char)) { tokens.push({ type: 'OP', value: char }); i++; continue; }
        if (char === '(' || char === ')' || char === ',') { tokens.push({ type: 'PUNC', value: char }); i++; continue; }

        i++;
    }
    return tokens;
};

export const extractVariables = (expr) => {
    if (!expr) return [];
    try {
        const tokens = tokenizeSQL(expr);
        const vars = new Set();
        
        // Danh sách đen các hàm SQL/Math và từ khóa phổ biến
        const functionBlacklist = new Set([
            'round', 'abs', 'floor', 'ceiling', 'isnull', 'coalesce', 
            'getdate', 'datediff', 'dateadd', 'convert', 'cast',
            'sum', 'avg', 'max', 'min', 'count', 'len', 'replace',
            'substring', 'left', 'right', 'charindex', 'ltrim', 'rtrim',
            'case', 'when', 'then', 'else', 'end', 'and', 'or', 'not', 'in', 'is', 'null', 'like'
        ]);

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            
            if (t.type === 'VAR') {
                const valLower = t.value.toLowerCase();
                
                // 1. Skip functions
                const nextToken = tokens[i + 1];
                if (nextToken && nextToken.type === 'PUNC' && nextToken.value === '(') {
                    continue;
                }

                // 2. Skip blacklist
                if (functionBlacklist.has(valLower)) {
                    continue;
                }

                vars.add(t.value);
            }
        }
        return Array.from(vars);
    } catch(e) {
        console.error("Variable Extraction Error:", e);
        return [];
    }
};

export const evaluateFormula = (expr, variablesObj, enableLog = false) => {
    const logs = [];
    const log = (msg) => { if(enableLog) logs.push(msg); };

    if (!expr || !expr.trim()) return { result: '', logs };
    
    try {
        log(`[START] Bộ SQL Compiler Khởi Động...`);
        
        const tokens = tokenizeSQL(expr);
        
        let pos = 0;
        const peek = () => tokens[pos];
        const consume = () => tokens[pos++];

        const parsePrimary = () => {
            const t = consume();
            if (!t) return null;
            if (t.type === 'NUMBER' || t.type === 'STRING') return { type: 'LITERAL', value: t.value };
            if (t.type === 'VAR') {
                // Check if it's a function call
                if (peek() && peek().type === 'PUNC' && peek().value === '(') {
                    consume(); // consume '('
                    const args = [];
                    if (peek() && peek().value !== ')') {
                        while (true) {
                            args.push(parseExpr());
                            if (peek() && peek().value === ',') {
                                consume();
                            } else {
                                break;
                            }
                        }
                    }
                    if (peek() && peek().value === ')') consume(); // consume ')'
                    return { type: 'CALL', name: t.value.toLowerCase(), args };
                }
                return { type: 'VAR', name: t.value };
            }
            if (t.type === 'OP' && (t.value === '-' || t.value === '+')) {
                const expr = parseOp(6);
                return { type: 'UNARY', op: t.value, expr };
            }
            if (t.type === 'PUNC' && t.value === '(') {
                const expr = parseExpr();
                consume();
                return expr;
            }
            if (t.type === 'KEYWORD' && t.value === 'case') {
                const cases = [];
                let elseExpr = null;
                while (peek() && peek().value === 'when') {
                    consume();
                    const cond = parseExpr();
                    if (peek() && peek().value === 'then') consume();
                    const res = parseExpr();
                    cases.push({ cond, res });
                }
                if (peek() && peek().value === 'else') {
                    consume();
                    elseExpr = parseExpr();
                }
                if (peek() && peek().value === 'end') consume();
                return { type: 'CASE', cases, elseExpr };
            }
            return null;
        };

        const parseOp = (precedence) => {
            let left = parsePrimary();
            if (!left) return null;
            
            while (peek()) {
                const t = peek();
                let opPrec = 0;
                
                if (t.type === 'KEYWORD') {
                    if (t.value === 'or') opPrec = 1;
                    else if (t.value === 'and') opPrec = 2;
                    else if (t.value === 'in') opPrec = 4;
                    else if (t.value === 'between') opPrec = 4;
                } else if (t.type === 'OP') {
                    if (['=', '==', '<>', '!=', '>', '<', '>=', '<='].includes(t.value)) opPrec = 3;
                    else if (['+', '-'].includes(t.value)) opPrec = 5;
                    else if (['*', '/', '%'].includes(t.value)) opPrec = 6;
                }
                
                if (opPrec === 0 || opPrec < precedence) break;
                
                consume();
                
                if (t.value === 'between') {
                    const min = parseOp(5);
                    if (peek() && peek().value === 'and') consume();
                    const max = parseOp(5);
                    left = { type: 'BETWEEN', left, min, max };
                } else if (t.value === 'in') {
                    if (peek() && peek().value === '(') consume();
                    const list = [];
                    while (peek() && peek().value !== ')') {
                        const itm = parseExpr();
                        if (itm) list.push(itm);
                        if (peek() && peek().value === ',') consume();
                    }
                    if (peek() && peek().value === ')') consume();
                    left = { type: 'IN', left, list };
                } else {
                    const right = parseOp(opPrec + 1);
                    left = { type: 'BINARY', op: t.value, left, right };
                }
            }
            return left;
        };

        const parseExpr = () => parseOp(1);
        const ast = parseExpr();

        if (!ast) throw new Error("Cú pháp không hợp lệ hoặc rỗng");

        const stringifyAST = (node) => {
            if (!node) return '';
            if (node.type === 'LITERAL') return typeof node.value === 'string' ? `'${node.value}'` : node.value;
            if (node.type === 'VAR') return node.name;
            if (node.type === 'UNARY') return `${node.op}${stringifyAST(node.expr)}`;
            if (node.type === 'BINARY') return `${stringifyAST(node.left)} ${node.op.toUpperCase()} ${stringifyAST(node.right)}`;
            if (node.type === 'BETWEEN') return `${stringifyAST(node.left)} BETWEEN ${stringifyAST(node.min)} AND ${stringifyAST(node.max)}`;
            if (node.type === 'IN') return `${stringifyAST(node.left)} IN (${node.list.map(stringifyAST).join(', ')})`;
            if (node.type === 'CASE') return `(Biểu thức CASE lồng)`;
            if (node.type === 'CALL') return `${node.name.toUpperCase()}(${node.args.map(stringifyAST).join(', ')})`;
            return '';
        };

        log(`[VARIABLES] Chuẩn bị biến số:`);
        Object.keys(variablesObj).forEach(k => {
           let showVal = variablesObj[k];
           if (showVal === undefined || showVal === null) showVal = '';
           log(`  -> ${k} = ${showVal !== '' && isNaN(Number(showVal)) ? `'${showVal}'` : (showVal || "''")}`);
        });

        const evalNode = (node) => {
            if (!node) return null;
            if (node.type === 'LITERAL') return node.value;
            if (node.type === 'VAR') {
                let v;
                const lowerName = node.name.toLowerCase();
                for (const k in variablesObj) {
                    if (k.toLowerCase() === lowerName) { v = variablesObj[k]; break; }
                }
                if (v === undefined || v === null) return '';

                let sVal = String(v).trim();
                let cleanNum = sVal.replace(/[\(\)\-]/g, '');
                const commaCount = (cleanNum.match(/,/g) || []).length;
                const dotCount = (cleanNum.match(/\./g) || []).length;
                if (commaCount > 0 && dotCount > 0) {
                    cleanNum = cleanNum.lastIndexOf(',') > cleanNum.lastIndexOf('.') ? cleanNum.replace(/\./g, '').replace(',', '.') : cleanNum.replace(/,/g, '');
                } else if (commaCount > 1) { cleanNum = cleanNum.replace(/,/g, ''); }
                else if (commaCount === 1) { cleanNum = cleanNum.replace(',', '.'); }
                else if (dotCount > 1) { cleanNum = cleanNum.replace(/\./g, ''); }
                
                if (sVal === '') return '';
                if (/[a-zA-Z]/.test(sVal) || (sVal.startsWith('0') && sVal.length > 1 && !sVal.includes('.'))) {
                    return sVal; 
                } else if (!isNaN(cleanNum.replace(/\s+/g, ''))) {
                    let isNegative = sVal.startsWith('-') || (sVal.startsWith('(') && sVal.endsWith(')'));
                    return isNegative ? -parseFloat(cleanNum.replace(/\s+/g, '')) : parseFloat(cleanNum.replace(/\s+/g, ''));
                }
                return sVal;
            }
            if (node.type === 'UNARY') {
                const e = Number(evalNode(node.expr));
                return node.op === '-' ? -e : e;
            }
            if (node.type === 'BINARY') {
                const l = evalNode(node.left);
                const r = evalNode(node.right);
                switch(node.op.toLowerCase()) {
                    case '+': return Number(l) + Number(r);
                    case '-': return Number(l) - Number(r);
                    case '*': return Number(l) * Number(r);
                    case '/': return Number(l) / Number(r);
                    case '%': return Number(l) % Number(r);
                    case '=': 
                    case '==': return l == r;
                    case '<>':
                    case '!=': return l != r;
                    case '>': return Number(l) > Number(r);
                    case '<': return Number(l) < Number(r);
                    case '>=': return Number(l) >= Number(r);
                    case '<=': return Number(l) <= Number(r);
                    case 'and': return l && r;
                    case 'or': return l || r;
                    default: return null;
                }
            }
            if (node.type === 'BETWEEN') {
                const l = Number(evalNode(node.left));
                const min = Number(evalNode(node.min));
                const max = Number(evalNode(node.max));
                return l >= min && l <= max;
            }
            if (node.type === 'IN') {
                const l = String(evalNode(node.left)).toLowerCase();
                const vals = node.list.map(n => String(evalNode(n)).toLowerCase());
                return vals.includes(l);
            }
            if (node.type === 'CALL') {
                if (node.name === 'round') {
                    const evaluatedArgs = node.args.map(evalNode);
                    const val = Number(evaluatedArgs[0]);
                    const precision = evaluatedArgs[1] !== undefined ? Number(evaluatedArgs[1]) : 0;
                    const factor = Math.pow(10, precision);
                    const res = Math.round(val * factor) / factor;
                    log(`ROUND(${val}, ${precision}) => ${res}`);
                    return res;
                }
                if (node.name === 'if') {
                    const cond = evalNode(node.args[0]);
                    const condStr = stringifyAST(node.args[0]);
                    if (cond) {
                        const trueRes = evalNode(node.args[1]);
                        log(`IF [ ${condStr} ] => ✅ PASS (TRUE)`);
                        log(`=> CHỌN KẾT QUẢ: ${stringifyAST(node.args[1])} (Thực tế: ${trueRes})`);
                        return trueRes;
                    } else {
                        const falseRes = evalNode(node.args[2]);
                        log(`IF [ ${condStr} ] => ❌ FAIL (FALSE)`);
                        log(`=> CHỌN KẾT QUẢ: ${stringifyAST(node.args[2])} (Thực tế: ${falseRes})`);
                        return falseRes;
                    }
                }
                if (node.name === 'abs') return Math.abs(Number(evalNode(node.args[0])));
                return null;
            }
            if (node.type === 'CASE') {
                for (const c of node.cases) {
                    const condStr = stringifyAST(c.cond);
                    const condRes = evalNode(c.cond);
                    if (condRes) {
                        log(`CASE WHEN [ ${condStr} ] => ✅ PASS`);
                        const res = evalNode(c.res);
                        log(`=> CHỌN KẾT QUẢ: ${stringifyAST(c.res)} (Thực tế: ${res})`);
                        return res;
                    } else {
                        log(`CASE WHEN [ ${condStr} ] => ❌ FAIL`);
                    }
                }
                if (node.elseExpr) {
                    log(`=> RỚT VÀO ELSE`);
                    const res = evalNode(node.elseExpr);
                    log(`=> CHỌN KẾT QUẢ ELSE: ${stringifyAST(node.elseExpr)} (Thực tế: ${res})`);
                    return res;
                }
                return null;
            }
        };

        const rawResult = evalNode(ast);
        
        if (typeof rawResult === 'string') return { result: rawResult, logs };
        if (typeof rawResult === 'boolean') return { result: rawResult ? 'TRUE' : 'FALSE', logs };
        if (rawResult === null || rawResult === undefined || isNaN(rawResult) || !isFinite(rawResult)) {
            const errorMsg = `[ERROR] Kết quả không hợp lệ: ${rawResult}`;
            log(errorMsg);
            return { result: 'Lỗi tính toán', logs };
        }
        
        return { result: parseFloat(rawResult.toFixed(4)), logs };
    } catch (e) {
        const fatalMsg = `[FATAL ERROR] ${e.message}`;
        log(fatalMsg);
        return { result: 'Lỗi hệ thống', logs };
    }
};