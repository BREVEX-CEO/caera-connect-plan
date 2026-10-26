from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
c = canvas.Canvas('receipt.pdf', pagesize=letter)
c.drawString(100, 750, 'Receipt 0')
c.drawString(100, 730, 'customer=Ada Lovelace')
c.drawString(100, 710, 'plan=Express')
c.drawString(100, 690, 'total=1562.00')
c.save()
