import openpyxl
from openpyxl.chart import BarChart, Reference

wb = openpyxl.load_workbook('Q4_Budget.xlsx')
ws = wb['Budget']

chart = BarChart()
chart.type = "col"
chart.title = "Profit by Month"
data = Reference(ws, min_col=4, min_row=1, max_row=4)
cats = Reference(ws, min_col=1, min_row=2, max_row=4)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)

ws.add_chart(chart, "G2")
wb.save('Q4_Budget.xlsx')
