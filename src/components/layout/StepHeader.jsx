import React from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { useWorkflow } from '../../context/WorkflowContext';


const StepHeader = () => {
    const { themeUI } = useThemeContext();
  const { currentStep } = useWorkflow();

    // Bước 4 không cần hiển thị header phụ này
    if (currentStep === 4) return null;

    let stepTitle = '';
    let stepDesc = '';

    if (currentStep === 1) {
        stepTitle = 'Bước 1: Tải Lên Tập Tin Dữ Liệu';
        stepDesc = 'Cung cấp File gốc và các File cần đối chiếu.';
    } else if (currentStep === 2) {
        stepTitle = 'Bước 2: Bảng Gán Cột (Mapping)';
        stepDesc = 'Tìm kiếm và gán các cột không trùng tên giữa File gốc và các File so sánh.';
    } else if (currentStep === 3) {
        stepTitle = 'Bước 3: Cấu Hình Quy Tắc So Sánh';
        stepDesc = 'Chỉ định tiêu chí kiểm tra dữ liệu (Cột Key, Giá trị).';
    } else if (currentStep === 'rename') {
        stepTitle = 'Đổi Tên Hiển Thị Của Bảng';
        stepDesc = 'Đặt tên ngắn gọn, dễ nhớ cho các file để tiện quan sát khi đối soát.';
    } else if (currentStep === 'formula') {
        stepTitle = 'Trợ Lý Cấu Hình & Kiểm Tra Công Thức';
        stepDesc = 'Quản lý, tạo mới và mô phỏng các công thức tính toán tùy chỉnh.';
    }

    return (
        <div className={`${themeUI.headerBg} shadow-sm px-6 py-3 flex items-center justify-between shrink-0 z-40 transition-colors ${currentStep === 'formula' ? `border-b ${themeUI.border}` : ''}`}>
            <div className="flex items-center gap-3">
                <div>
                    {currentStep === 'formula' ? (
                        <h1 className={`text-[16px] font-bold ${themeUI.textTitle} leading-tight flex items-center gap-2`}>
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                            {stepTitle}
                        </h1>
                    ) : (
                        <h1 className={`text-[15px] font-bold ${themeUI.textTitle} leading-tight`}>
                            {stepTitle}
                        </h1>
                    )}
                    <p className={`text-xs ${themeUI.textMuted} mt-0.5`}>{stepDesc}</p>
                </div>
            </div>
        </div>
    );
};

export default StepHeader;