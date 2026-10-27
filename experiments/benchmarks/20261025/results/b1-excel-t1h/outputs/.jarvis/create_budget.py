import openpyxl
from openpyxl.chart import BarChart, Reference

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Budget"

# Headers
ws.append(["Month", "Revenue", "Costs", "Profit", "Margin %"])

# Data
data = [
    ["October", 48000, 31500],
    ["November", 52500, 33800],
    ["December", 61200, 39950]
]

for row_idx, (month, rev, cost) in enumerate(data, start=2):
    ws[f"A{row_idx}"] = month
    ws[f"B{row_idx}"] = rev
    ws[f"C{row_idx}"] = cost
    ws[f"D{row_idx}"] = f"=B{row_idx}-C{row_idx}"
    ws[f"E{row_idx}"] = f"=D{row_idx}/B{row_idx}"
    ws[f"E{row_idx}"].number_format = '0.0%'

# Total row
ws["A5"] = "Total"
ws["B5"] = "=SUM(B2:B4)"
ws["C5"] = "=SUM(C2:C4)"
ws["D5"] = "=SUM(D2:D4)"
ws["E5"] = "=D5/B5"
ws["E5"].number_format = '0.0%'

# Chart
chart = BarChart()
chart.type = "col"
chart.style = 10
chart.title = "Profit by Month"
chart.y_axis.title = "Profit"
chart.x_axis.title = "Month"

data_ref = Reference(ws, min_col=4, min_row=1, max_row=4)
cats_ref = Reference(ws, min_col=1, min_row=2, max_row=4)
chart.add_data(data_ref, titles_from_data=True)
chart.set_categories(cats_ref)
ws.add_chart(chart, "G2")

wb.save("Q4_Budget.xlsx")
