import openpyxl
from openpyxl.chart import BarChart, Reference

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Budget"

# Headers
headers = ["Month", "Revenue", "Costs", "Profit", "Margin %"]
ws.append(headers)

# Data
data = [
    ["October", 48000, 31500, "=B2-C2", "=D2/B2"],
    ["November", 52500, 33800, "=B3-C3", "=D3/B3"],
    ["December", 61200, 39950, "=B4-C4", "=D4/B4"]
]

for row in data:
    ws.append(row)

# Total row
ws.append(["Total", "=SUM(B2:B4)", "=SUM(C2:C4)", "=SUM(D2:D4)", "=D5/B5"])

# Format Margin % column (E2:E5)
for row in range(2, 6):
    ws[f"E{row}"].number_format = '0.0%'

# Add bar chart for Profit by month
chart = BarChart()
chart.type = "col"
chart.style = 10
chart.title = "Profit by Month"
chart.y_axis.title = "Profit"
chart.x_axis.title = "Month"

data_ref = Reference(ws, min_col=4, min_row=1, max_row=4) # Profit including header
cats_ref = Reference(ws, min_col=1, min_row=2, max_row=4) # Months
chart.add_data(data_ref, titles_from_data=True)
chart.set_categories(cats_ref)

ws.add_chart(chart, "G2")

wb.save("Q4_Budget.xlsx")
print("Workbook created successfully.")
