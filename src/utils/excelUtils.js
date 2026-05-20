// src/utils/excelUtils.js
export const normalizeHeader = (h) => {
    return String(h || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove invisible characters
        .replace(/[\s.,\-_;:|/\\()\[\]{}<>?+="'`~!@#$%^&*]/g, ''); // Remove spaces and punctuation
};

// Lấy phần tên sau dấu chấm cuối cùng (ví dụ: PITT.TK_ABC -> TK_ABC)
export const extractCleanName = (name) => {
    if (!name) return '';
    const parts = String(name).split('.');
    return parts[parts.length - 1];
};

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

export const stringSimilarity = (s1, s2) => {
    if (!s1 || !s2) return 0;
    const str1 = String(s1).toLowerCase();
    const str2 = String(s2).toLowerCase();
    if (str1 === str2) return 1;
    let longer = str1;
    let shorter = str2;
    if (str1.length < str2.length) { longer = str2; shorter = str1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    
    const baseScore = (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
    
    // Tự động boost điểm lên 0.85 nếu chuỗi dài bắt đầu bằng chuỗi ngắn và độ dài chuỗi ngắn >= 8
    if (longer.startsWith(shorter) && shorter.length >= 8) {
        return Math.max(baseScore, 0.85);
    }
    
    return baseScore;
};

export const isSTT = (colName) => {
    if (!colName) return false;
    const lower = String(colName).toLowerCase().trim();
    return lower === 'stt' || lower === 'số thứ tự' || lower === 'so thu tu';
};