import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'Sales'
ws.append(['Region', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'])
ws.append(['North', 120, 135, 150, 160, '=SUM(B2:E2)'])
ws.append(['South', 90, 95, 110, 105, '=SUM(B3:E3)'])
ws.append(['East', 75, 80, 85, 95, '=SUM(B4:E4)'])
ws.append(['Grand total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)'])
for col in range(1, 7):
    ws.cell(row=1, column=col).font = openpyxl.styles.Font(bold=True)
wb.save('Sales_2026.xlsx')
