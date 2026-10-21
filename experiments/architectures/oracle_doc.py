"""Independent check of the 300-word essay task: body words (not title or headings), headings, title, PDF pages.

python3 oracle_doc.py <workspace>
"""
import sys, json
from pathlib import Path
from docx import Document
from pypdf import PdfReader
ws=Path(sys.argv[1]); d=ws/"JARVIS_Essay.docx"; p=ws/"JARVIS_Essay.pdf"
out={"docx":d.exists(),"pdf":p.exists(), "files": sorted(x.name for x in ws.iterdir())}
if d.exists():
    doc=Document(str(d)); body=[x for x in doc.paragraphs if not (x.style.name.startswith("Heading") or x.style.name in ("Title","Subtitle")) and x.text.strip()]
    out.update(bodyWords=sum(len(x.text.split()) for x in body), styles=sorted({x.style.name for x in doc.paragraphs}), headings=sum(1 for x in doc.paragraphs if x.style.name.startswith("Heading")), title=any(x.style.name=="Title" for x in doc.paragraphs))
if p.exists(): out["pdfPages"]=len(PdfReader(str(p)).pages)
out["pass"]=bool(out.get("bodyWords",0)>=300 and out.get("title") and out.get("headings",0)>=1 and out.get("pdfPages",0)>=1)
print(json.dumps(out))
