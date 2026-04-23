import React, { useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadStep } from './features/step1_upload/UploadStep';
import { MappingStep } from './features/step2_mapping/MappingStep';
import { ConfigStep } from './features/step3_config/ConfigStep';
import ResultsStep from './features/step4_results/ResultsStep';
import { FormulaAssistant } from './features/formula_assistant/FormulaAssistant';
import { FormulaGraphOverlay } from './features/formula_assistant/FormulaGraphOverlay';
import { FormulaInteractiveGraph } from './features/formula_assistant/FormulaInteractiveGraph';
import AdvancedOptionsModal from './features/step3_config/AdvancedOptionsModal';
import TopNavbar from './components/layout/TopNavbar';
import ToastNotification from './components/common/ToastNotification';
import StepHeader from './components/layout/StepHeader';

import './index.css';
import { useThemeContext } from './context/ThemeContext';
import { useWorkflow } from './context/WorkflowContext';
import { useFormula } from './context/FormulaContext';
import { useComparison } from './context/ComparisonContext';

// Gán XLSX vào window để các module cũ gọi window.XLSX vẫn hoạt động
window.XLSX = XLSX;

function App() {
  const { isDarkMode, themeUI } = useThemeContext();
  const { xlsxLoaded, setXlsxLoaded, currentStep, setCurrentStep, toastMessage, showAdvancedOptions, setShowAdvancedOptions } = useWorkflow();
  const { sandboxComboRef, setIsSandboxComboOpen } = useFormula();
  const { results } = useComparison();

  useEffect(() => {
    // window.XLSX được gán đồng bộ ở trên, luôn available tại thời điểm này
    setXlsxLoaded(!!window.XLSX);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sandboxComboRef.current && !sandboxComboRef.current.contains(event.target)) {
        setIsSandboxComboOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsSandboxComboOpen]);

  if (!xlsxLoaded) {
    return <div className="flex h-screen items-center justify-center bg-gray-100 text-lg font-semibold text-gray-500">Đang tải hệ thống...</div>;
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden text-[13px] transition-colors ${themeUI.appBg} ${isDarkMode ? 'dark' : ''}`}>

      {/* TOAST NOTIFICATION */}
      <ToastNotification message={toastMessage} />

      {/* ADVANCED OPTIONS MODAL */}
      {showAdvancedOptions && <AdvancedOptionsModal />}

      {/* FORMULA GRAPH OVERLAY */}
      <FormulaGraphOverlay />

      {/* TOP NAVBAR */}
      <TopNavbar />

      <StepHeader />

      {/* NỘI DUNG CHÍNH */}
      <main className={`flex-1 overflow-y-auto p-4 md:p-6 relative ${isDarkMode ? 'custom-dark-scrollbar' : 'custom-light-scrollbar'}`}>
        <div className={`mx-auto h-full flex flex-col ${[2, 4, 'formula', 'chain_trace'].includes(currentStep) ? 'w-full max-w-[100%]' : 'max-w-5xl'}`}>

          {/* STEP 1: UPLOAD */}
          {currentStep === 1 && <UploadStep />}

          {/* STEP 2: MAPPING */}
          {currentStep === 2 && <MappingStep />}

          {/* STEP 3 / RENAME: CONFIG */}
          {(currentStep === 3 || currentStep === 'rename') && <ConfigStep />}

          {/* STEP 4: RESULTS */}
          {currentStep === 4 && results !== null && <ResultsStep />}

          {/* STEP formula: TRỢ LÝ CÔNG THỨC */}
          {currentStep === 'formula' && <FormulaAssistant />}

          {/* STEP chain_trace: TRUY NGUỒN CÔNG THỨC */}
          {currentStep === 'chain_trace' && <FormulaInteractiveGraph />}

        </div>
      </main>
    </div>
  );
}

export default App;