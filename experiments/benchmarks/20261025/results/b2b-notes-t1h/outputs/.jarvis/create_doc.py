import docx

doc = docx.Document()

# Title
doc.add_heading('Weekly Sync', level=0)

# Attendees Heading
doc.add_heading('Attendees', level=1)
doc.add_paragraph('Ana', style='List Bullet')
doc.add_paragraph('Ben', style='List Bullet')
doc.add_paragraph('Chloe', style='List Bullet')

# Decisions Heading
doc.add_heading('Decisions', level=1)
doc.add_paragraph('Ship version 2 on Friday', style='List Number')
doc.add_paragraph('Move the review to Monday', style='List Number')

# Actions Heading
doc.add_heading('Actions', level=1)

table_data = [
    ['Owner', 'Task', 'Due'],
    ['Ana', 'Update the roadmap', '30 October 2026'],
    ['Ben', 'Book the venue', '2 November 2026'],
]

table = doc.add_table(rows=len(table_data), cols=3)
for r_idx, row in enumerate(table_data):
  for c_idx, val in enumerate(row):
    table.cell(r_idx, c_idx).text = val

doc.save('Weekly_Sync.docx')
print('Successfully created Weekly_Sync.docx')
