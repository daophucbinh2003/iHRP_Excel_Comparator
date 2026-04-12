import os
import re

directories = ["src/App.jsx", "src/components/layout/TopNavbar.jsx", "src/components/layout/StepHeader.jsx", "src/features/step1_upload/UploadStep.jsx", "src/features/step2_mapping/MappingStep.jsx", "src/features/step3_config/ConfigStep.jsx", "src/features/step3_config/AdvancedOptionsModal.jsx", "src/features/step4_results/ResultsStep.jsx", "src/features/formula_assistant/FormulaAssistant.jsx"]

theme_keys = {"themeUI", "isDarkMode", "setIsDarkMode", "targetColorsLight", "targetColorsDark"}
workflow_keys = {"xlsxLoaded", "setXlsxLoaded", "currentStep", "setCurrentStep", "toastMessage", "setToastMessage", "showAdvancedOptions", "setShowAdvancedOptions"}
formula_keys = {"formulaTab", "setFormulaTab", "customFormulas", "setCustomFormulas", "newFormulaTarget", "setNewFormulaTarget", "newFormulaExpr", "setNewFormulaExpr", "previewVariables", "setPreviewVariables", "hasPreviewed", "setHasPreviewed", "editingFormulaIdx", "setEditingFormulaIdx", "importFormulaRef", "handlePreviewFormula", "handleImportFormulas", "testEmpId", "setTestEmpId", "testFormulaIdx", "setTestFormulaIdx", "isSandboxComboOpen", "setIsSandboxComboOpen", "sandboxSearch", "setSandboxSearch", "sandboxComboRef", "testEmpFound", "setTestEmpFound", "testVariables", "setTestVariables", "showConsole", "setShowConsole", "isCalculated", "setIsCalculated", "testResult", "setTestResult", "testTargetVal", "setTestTargetVal", "calcLogs", "setCalcLogs", "handleTestFormulaLoad", "handleCalculateSandboxFormula", "selectedEmpIdForTest", "setSelectedEmpIdForTest"}

for file_path in directories:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r') as f:
        content = f.read()

    # Find the import { useAppContext } block
    content = re.sub(r'import\s+{\s*useAppContext\s*}\s+from\s+.*?[\'"](.*?/context/AppContext)[\'"];?', '', content)

    # Find the destructuring block: `const { ... } = useAppContext();`
    match = re.search(r'const\s+\{([^}]+)\}\s*=\s*useAppContext\(\);', content)
    if not match:
        continue

    destructured_vars = match.group(1).replace('\n', ' ').split(',')
    
    t_vars = []
    w_vars = []
    f_vars = []
    c_vars = []

    for var in destructured_vars:
        if not var.strip():
            continue
        v_name = var.split(':')[0].strip()
        v_raw = var.strip()
        
        if v_name in theme_keys:
            t_vars.append(v_raw)
        elif v_name in workflow_keys:
            w_vars.append(v_raw)
        elif v_name in formula_keys:
            f_vars.append(v_raw)
        else:
            # Everything else belongs to Comparison
            c_vars.append(v_raw)

    replacement = ""
    imports = []
    # Determine depth to context
    depth = file_path.count('/') - 1
    rel_path = '../' * depth + 'context'
    if depth == 0:
        rel_path = './context'

    if t_vars:
        replacement += f"  const {{ {', '.join(t_vars)} }} = useThemeContext();\n"
        imports.append(f"import {{ useThemeContext }} from '{rel_path}/ThemeContext';")
    if w_vars:
        replacement += f"  const {{ {', '.join(w_vars)} }} = useWorkflow();\n"
        imports.append(f"import {{ useWorkflow }} from '{rel_path}/WorkflowContext';")
    if f_vars:
        replacement += f"  const {{ {', '.join(f_vars)} }} = useFormula();\n"
        imports.append(f"import {{ useFormula }} from '{rel_path}/FormulaContext';")
    if c_vars:
        replacement += f"  const {{ {', '.join(c_vars)} }} = useComparison();\n"
        imports.append(f"import {{ useComparison }} from '{rel_path}/ComparisonContext';")

    new_content = content[:match.start()] + replacement.strip() + content[match.end():]
    
    # insert imports at top (after last import)
    import_idx = new_content.rfind('import ', 0, new_content.find('function '))
    if import_idx == -1:
        import_idx = new_content.rfind('import ', 0, new_content.find('const '))

    end_of_import = new_content.find('\n', import_idx) + 1
    new_content = new_content[:end_of_import] + '\n'.join(imports) + '\n' + new_content[end_of_import:]

    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print(f"Refactored {file_path}")

print("Done")
