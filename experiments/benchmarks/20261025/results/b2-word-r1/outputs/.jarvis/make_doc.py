import docx

doc = docx.Document()

# Title
doc.add_heading('Project Atlas Status', level=0)

# Summary Heading & Content
doc.add_heading('Summary', level=1)
p1 = doc.add_paragraph()
p1.add_run('Project Atlas has completed its initial planning phase and is proceeding on schedule. The stakeholder review has been ')
run_bold = p1.add_run('Approved')
run_bold.bold = True
p1.add_run(' without conditions.')

# Risks Heading & Content (Bulleted list)
doc.add_heading('Risks', level=1)
doc.add_paragraph('Resource constraints in the engineering team during Q4.', style='List Bullet')
doc.add_paragraph('Potential supply chain delays for staging hardware.', style='List Bullet')
doc.add_paragraph('Integration complexity with legacy enterprise systems.', style='List Bullet')

# Next Steps Heading & Table
doc.add_heading('Next Steps', level=1)

table = doc.add_table(rows=1, cols=2)
hdr_cells = table.rows[0].cells
hdr_cells[0].text = 'Milestone'
hdr_cells[1].text = 'Date'

data = [
    ('Design freeze', '14 November 2026'),
    ('Pilot', '5 December 2026'),
    ('Launch', '20 January 2027')
]

for milestone, date in data:
    row_cells = table.add_row().cells
    row_cells[0].text = milestone
    row_cells[1].text = date

doc.save('Atlas_Status.docx')
print('Successfully generated Atlas_Status.docx')
