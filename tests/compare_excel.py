import openpyxl
import os
import sys

def compare_sheets(sheet1, sheet2):
    diffs = []
    max_r = max(sheet1.max_row, sheet2.max_row)
    max_c = max(sheet1.max_column, sheet2.max_column)
    
    for r in range(1, max_r + 1):
        for c in range(1, max_c + 1):
            val1 = sheet1.cell(row=r, column=c).value
            val2 = sheet2.cell(row=r, column=c).value
            
            # Normalize numeric types to avoid float comparison issues
            if isinstance(val1, float) and isinstance(val2, float):
                if abs(val1 - val2) < 0.01:
                    continue
            if val1 != val2:
                # Format cell coordinate (e.g. A1, B5)
                coord = f"{openpyxl.utils.get_column_letter(c)}{r}"
                diffs.append((coord, val1, val2))
    return diffs

def compare_workbooks(file1, file2, label):
    print(f"\n==========================================")
    print(f"Comparing {label} Workbooks:")
    print(f"  File A (Original): {os.path.basename(file1)}")
    print(f"  File B (Complete): {os.path.basename(file2)}")
    print(f"==========================================")
    
    if not os.path.exists(file1):
        print(f"Error: {file1} not found")
        return
    if not os.path.exists(file2):
        print(f"Error: {file2} not found")
        return
        
    wb1 = openpyxl.load_workbook(file1, data_only=True)
    wb2 = openpyxl.load_workbook(file2, data_only=True)
    
    sheets1 = set(wb1.sheetnames)
    sheets2 = set(wb2.sheetnames)
    
    common_sheets = sheets1.intersection(sheets2)
    only_in_1 = sheets1 - sheets2
    only_in_2 = sheets2 - sheets1
    
    if only_in_1:
        print(f"[WARN] Sheets only in Original: {only_in_1}")
    if only_in_2:
        print(f"[WARN] Sheets only in Complete: {only_in_2}")
        
    for name in sorted(common_sheets):
        sheet1 = wb1[name]
        sheet2 = wb2[name]
        
        diffs = compare_sheets(sheet1, sheet2)
        if not diffs:
            print(f"[PASS] Sheet '{name}': Perfect Match")
        else:
            print(f"[FAIL] Sheet '{name}': {len(diffs)} differences found")
            # Print first 10 differences
            for coord, v1, v2 in diffs[:10]:
                print(f"   Cell {coord}: Original = '{v1}', Complete = '{v2}'")
            if len(diffs) > 10:
                print(f"   ... and {len(diffs) - 10} more differences")

if __name__ == "__main__":
    root_dir = "c:/Dev Projects/Report Card Enhancements"
    
    # 1. Compare CLA
    cla_original = os.path.join(root_dir, "CLA for 06.03.2026 TK (Harlot) (TK in 2_27_08) on June 04, 2026 01_44_10 in Tempest Keep.xlsx")
    cla_complete = os.path.join(root_dir, "Complete - CLA for 06.03.2026 TK (Harlot) (TK in 2_27_08) on June 04, 2026 01_44_10 in The Eye.xlsx")
    compare_workbooks(cla_original, cla_complete, "CLA")
    
    # 2. Compare RPB
    rpb_original = os.path.join(root_dir, "RPB for 06.03.2026 TK (Harlot) (TK in 2_27_08) on Thu Jun 04 2026 01_44_10 GMT+0200 (Central European Summer Time) in Tempest Keep.xlsx")
    rpb_complete = os.path.join(root_dir, "Complete RPB for 06.03.2026 TK (Harlot) (TK in 2_27_08) on Thu Jun 04 2026 01_44_10 GMT+0200 (Central European Summer Time) in The Eye.xlsx")
    compare_workbooks(rpb_original, rpb_complete, "RPB")
