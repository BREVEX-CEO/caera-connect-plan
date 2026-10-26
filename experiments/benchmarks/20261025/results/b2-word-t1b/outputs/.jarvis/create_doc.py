import docx

doc = docx.Document()
doc.add_heading('Project Atlas Status', level=0)

doc.add_heading('Summary', level=1)
p = doc.add_paragraph()
p.add_run('Project Atlas is progressing according to schedule and all initial phase deliverables have met quality standards. The steering committee has reviewed the progress and marked the initiative as ')
r = p.add_run('Approved')
r.bold = True
p.add_run('.')

doc.add_heading('Risks', level=1)
doc.add_paragraph('Resource constraints in the engineering department may impact delivery speed.', style='List Bullet')
doc.add_paragraph('Supply chain delays for specialized hardware components.', style='List Bullet')
doc.add_paragraph('Potential scope creep if stakeholder requirements expand during the pilot.', style='List Bullet')

doc.add_heading('Next Steps', level=1)
data = [
    ('Milestone', 'Date'),
    ('Design freeze', '14 November 2026'),
    ('Pilot', '5 December 2026'),
    ('Launch', '20 January 2027')
]
t = doc.add_table(rows=4, cols=2)
for i, row in enumerate(data):
    for j, val in enumerate(row):
        c = t.cell(i, j)
        c.text = val
        if i == 0:
            for p_cell in c.paragraphs:
                for run in p_cell.runs:
                    run.bold = True

doc.save('Atlas_Status.docx')
