import React, { useState } from 'react';
import { ThemeProvider } from './ThemeContext';
import { WorkflowProvider } from './WorkflowContext';
import { ComparisonProvider } from './ComparisonContext';
import { FormulaProvider } from './FormulaContext';

export const AppProvider = ({ children }) => {
    const defaultMockFormulas = [
        { targetCol: 'TT_TongThuNhap_Gross', expression: 'ROUND(HT_ThucLinh_LCD + HT_ThucLinh_LHQ + HT_ThuongHSG + HT_LuongBSTetAm + HT_Thuong3004 + HT_Thuong0106 + HT_Thuong0803 + HT_Thuong2010 + HT_Thuong0209 + HT_LuongBST13 + HT_TetDuongLich + HT_ThuongSNSHB,0) + ROUND(HT_ThueBS_HSG + HT_ThueBS_TetAm + HT_ThueBS_TetDuong  + HT_ThueBS_2707 + HT_ThueBS_LuongT13 + HT_ThueBS_HiemNgheo + HT_ThueBS_TriAnDongGop + HT_ThueBS_TriAnSinhNhatSHB + HT_ThuNhapBS,0)' },
        { targetCol: 'HT_ThueBS_HSG', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'006',2)" },
        { targetCol: 'HT_ThueBS_TetAm', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'007',2)" },
        { targetCol: 'HT_ThueBS_TetDuong', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'008',2)" },
        { targetCol: 'HT_ThueBS_2707', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'009',2)" },
        { targetCol: 'HT_ThueBS_LuongT13', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'010',2)" },
        { targetCol: 'HT_ThueBS_HiemNgheo', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'011',2)" },
        { targetCol: 'HT_ThueBS_TriAnDongGop', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'012',2)" },
        { targetCol: 'HT_ThueBS_TriAnSinhNhatSHB', expression: "dbo.PR_fnGetQuyetToanThueBoSungByCode(PIT.EmpID,PIT.ToDate,'013',2)" },
        { targetCol: 'HT_ThuNhapBS', expression: "1500000" },
        { targetCol: 'HT_ThucLinh_LCD', expression: "12000000" },
        { targetCol: 'HT_ThucLinh_LHQ', expression: "2000000" },
        { targetCol: 'HT_ThuongHSG', expression: "500000" },
        { targetCol: 'HT_LuongBSTetAm', expression: "0" },
        { targetCol: 'HT_Thuong3004', expression: "1000000" },
        { targetCol: 'HT_Thuong0106', expression: "0" },
        { targetCol: 'HT_Thuong0803', expression: "0" },
        { targetCol: 'HT_Thuong2010', expression: "0" },
        { targetCol: 'HT_Thuong0209', expression: "1000000" },
        { targetCol: 'HT_LuongBST13', expression: "10000000" },
        { targetCol: 'HT_TetDuongLich', expression: "500000" },
        { targetCol: 'HT_ThuongSNSHB', expression: "200000" },
        { targetCol: 'TK_DonViCap1', expression: "dbo.HR_fnGetLevel1(PR.EmpID,DATEADD(month, ((YEAR(CONVERT(DATE,'01/' + PIT.ToDate,103)) - 1900) * 12) + MONTH(CONVERT(DATE,'01/' + PIT.ToDate,103)), -1),3)" },
        { targetCol: 'Total_Net_Salary', expression: 'ROUND(Base_Salary + Performance_Bonus - Social_Insurance_Amt, 0)' },
        { targetCol: 'Performance_Bonus', expression: 'CASE WHEN KPI_Score >= 100 THEN Base_Salary * 0.2 WHEN KPI_Score >= 80 THEN Base_Salary * 0.1 ELSE 0 END' },
        { targetCol: 'Social_Insurance_Amt', expression: 'IF(Is_Full_Insurance == 1, Base_Salary * 0.105, Min_Wages * 0.105)' },
        { targetCol: 'Is_Full_Insurance', expression: '1' },
        { targetCol: 'KPI_Score', expression: '95' },
        { targetCol: 'Base_Salary', expression: '15000000' },
        { targetCol: 'Min_Wages', expression: '4420000' }
    ];

    const [customFormulas, setCustomFormulas] = useState(defaultMockFormulas);
    const [selectedEmpIdForTest, setSelectedEmpIdForTest] = useState('');

    return (
        <ThemeProvider>
            <WorkflowProvider>
                <ComparisonProvider customFormulas={customFormulas} selectedEmpIdForTest={selectedEmpIdForTest} setSelectedEmpIdForTest={setSelectedEmpIdForTest}>
                    <FormulaProvider customFormulas={customFormulas} setCustomFormulas={setCustomFormulas} selectedEmpIdForTest={selectedEmpIdForTest} setSelectedEmpIdForTest={setSelectedEmpIdForTest}>
                        {children}
                    </FormulaProvider>
                </ComparisonProvider>
            </WorkflowProvider>
        </ThemeProvider>
    );
};
