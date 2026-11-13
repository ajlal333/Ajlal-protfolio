"""
Builds public/LogicFolds_Credentials.pdf.

This replaces the previous file, which was a byte-identical copy of the personal
resume (and therefore published a personal phone number on a business website).
Every claim here traces to content already on the site: the services section,
the process steps, the project explorer, the capability strip and the FAQ.

No invented clients, deployments, benchmarks, testimonials or results.

Regenerate with:  python3 scripts/build-credentials.py
"""

from reportlab.graphics.shapes import Drawing, Path, Rect, String
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = "public/LogicFolds_Credentials.pdf"
CREAM = HexColor("#fcfbf3")
INK = HexColor("#181818")
BLUE = HexColor("#2c6fff")
MUTED = HexColor("#6a6a6a")
LINE = HexColor("#e2ded2")

PAGE_W, PAGE_H = A4
M = 20 * mm

def brand_mark(size):
    """The favicon, redrawn as vectors so the PDF needs no SVG renderer."""
    d = Drawing(64, 64)
    d.add(Rect(0, 0, 64, 64, rx=16, ry=16, fillColor=HexColor("#181818"), strokeColor=None))

    def shape(points, fill, opacity=1):
        path = Path(fillColor=HexColor(fill), strokeColor=None, fillOpacity=opacity)
        path.moveTo(*points[0])
        for seg in points[1:]:
            if len(seg) == 2:
                path.lineTo(*seg)
            else:
                path.curveTo(*seg)
        path.closePath()
        d.add(path)

    # SVG y runs down; flip into reportlab's y-up space.
    f = lambda x, y: (x, 64 - y)
    shape(
        [f(17, 16), f(35, 16), (*f(43, 16), *f(49, 22), *f(49, 30)), f(49, 48), f(31, 48),
         (*f(23, 48), *f(17, 42), *f(17, 34))],
        "#2c6fff",
    )
    shape(
        [f(27, 24), f(37, 24), (*f(42, 24), *f(46, 28), *f(46, 33)), f(46, 40), f(36, 40),
         (*f(31, 40), *f(27, 36), *f(27, 31))],
        "#fcfbf3",
        0.95,
    )
    d.add(String(16, 64 - 47, "LF", fontName="Helvetica-Bold", fontSize=17, fillColor=HexColor("#fcfbf3")))
    d.scale(size / 64, size / 64)
    d.width = d.height = size
    return d


def style(name, size, leading, color=INK, font="Helvetica", space_after=0, space_before=0):
    return ParagraphStyle(
        name,
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
        spaceAfter=space_after,
        spaceBefore=space_before,
        alignment=TA_LEFT,
    )


S = {
    "hero": style("hero", 27, 33, INK, "Helvetica-Bold", 6),
    "h2": style("h2", 15, 20, INK, "Helvetica-Bold", 5, 2),
    "eyebrow": style("eyebrow", 8.2, 12, BLUE, "Helvetica-Bold", 5),
    "body": style("body", 10, 15.5, INK, space_after=7),
    "muted": style("muted", 9.1, 13.6, MUTED, space_after=5),
    "cardh": style("cardh", 11, 14, INK, "Helvetica-Bold", 3),
    "cardb": style("cardb", 8.7, 12.3, MUTED),
    "tag": style("tag", 8.3, 11.6, MUTED),
    "foot": style("foot", 8, 11, MUTED),
}


def bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    if doc.page > 1:
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7.6)
        canvas.drawString(M, 12 * mm, "LogicFolds  |  Capabilities")
        canvas.drawRightString(PAGE_W - M, 12 * mm, f"{doc.page}")
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(M, 16 * mm, PAGE_W - M, 16 * mm)
    canvas.restoreState()


def rule(space_before=4, space_after=8):
    t = Table([[""]], colWidths=[PAGE_W - 2 * M], rowHeights=[0.7])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LINE)]))
    return [Spacer(1, space_before), t, Spacer(1, space_after)]


def cards(items, cols=3, gap=6 * mm):
    """Row of bordered cards. items = [(title, body, tags)]"""
    w = (PAGE_W - 2 * M - gap * (cols - 1)) / cols
    cells = []
    for title, body, tags in items:
        inner = [[Paragraph(title, S["cardh"])], [Paragraph(body, S["cardb"])]]
        if tags:
            inner.append([Paragraph(" &middot; ".join(tags), S["tag"])])
        t = Table(inner, colWidths=[w - 10 * mm])
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        cells.append(t)

    grid = Table([cells], colWidths=[w] * cols)
    grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.7, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 4.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2 * mm),
            ]
        )
    )
    return grid


def steps(items):
    w = (PAGE_W - 2 * M) / len(items)
    row, head = [], []
    for i, (title, body) in enumerate(items, start=1):
        head.append(Paragraph(f'<font color="#2c6fff">Step {i}</font>', S["tag"]))
        inner = Table(
            [[Paragraph(title, S["cardh"])], [Paragraph(body, S["cardb"])]],
            colWidths=[w - 8 * mm],
        )
        inner.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        row.append(inner)

    t = Table([head, row], colWidths=[w] * len(items))
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEABOVE", (0, 0), (-1, 0), 1.1, BLUE),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 4),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def systems_table(rows):
    head = ["System", "Domain", "What it does", "Status"]
    data = [[Paragraph(f"<b>{h}</b>", S["tag"]) for h in head]]
    for name, domain, what, shape in rows:
        data.append(
            [
                Paragraph(f"<b>{name}</b>", S["cardb"]),
                Paragraph(domain, S["tag"]),
                Paragraph(what, S["cardb"]),
                Paragraph(shape, S["tag"]),
            ]
        )

    t = Table(
        data,
        colWidths=[38 * mm, 24 * mm, 86 * mm, 22 * mm],
        repeatRows=1,
    )
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.9, INK),
                ("LINEBELOW", (0, 1), (-1, -2), 0.6, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 2.8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("RIGHTPADDING", (-1, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def build():
    doc = BaseDocTemplate(
        OUT,
        pagesize=A4,
        leftMargin=M,
        rightMargin=M,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        title="LogicFolds Capabilities",
        author="LogicFolds",
        subject="Automations for sales and accounting workflows",
    )
    doc.addPageTemplates(
        PageTemplate(
            id="main",
            frames=[Frame(M, 20 * mm, PAGE_W - 2 * M, PAGE_H - 38 * mm, id="f", showBoundary=0)],
            onPage=bg,
        )
    )

    st = []

    # ---------------- Page 1 ----------------
    logo = brand_mark(13 * mm)
    header = Table(
        [[logo, Paragraph('<font size="15"><b>LogicFolds</b></font>', S["h2"])]],
        colWidths=[16 * mm, None],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    st += [header, Spacer(1, 22 * mm)]

    st.append(Paragraph("CAPABILITIES", S["eyebrow"]))
    st.append(Paragraph("From first enquiry to paid invoice,<br/>without the retyping.", S["hero"]))
    st.append(Spacer(1, 4))
    st.append(
        Paragraph(
            "LogicFolds builds automations for home service companies and real estate agencies that lose "
            "time moving information between their sales and accounting systems. We work with business "
            "owners who have a repeated process that is slow, manual, or dependent on one person "
            "remembering to do it.",
            S["body"],
        )
    )
    st.append(
        Paragraph(
            "We build each automation around the way your business already works, keep a person in "
            "charge of the decisions that matter, and make sure you can see what happened at every step.",
            S["body"],
        )
    )
    st += rule(6, 10)

    st.append(Paragraph("WHAT GETS AUTOMATED", S["eyebrow"]))
    st.append(Spacer(1, 3))
    st.append(
        cards(
            [
                (
                    "Enquiry follow-ups",
                    "Every new enquiry gets a follow-up automatically, so no lead goes quiet because "
                    "someone was busy.",
                    [],
                ),
                (
                    "Invoices when a deal is won",
                    "The invoice is created the moment a deal is won, from details you already entered.",
                    [],
                ),
            ],
            cols=2,
        )
    )
    st.append(Spacer(1, 6))
    st.append(
        cards(
            [
                (
                    "Payment reminders",
                    "Reminders send themselves, so overdue invoices get chased without anyone having "
                    "to remember.",
                    [],
                ),
                (
                    "A weekly report",
                    "One report arrives every week, with no copy and paste.",
                    [],
                ),
            ],
            cols=2,
        )
    )
    st += rule(10, 10)

    st.append(Paragraph("HOW WE WORK", S["eyebrow"]))
    st.append(Spacer(1, 4))
    st.append(
        steps(
            [
                (
                    "Free Automation Audit",
                    "A 30-minute call, then a one-page plan of the three automations that would save "
                    "the most time.",
                ),
                ("First Automation", "One automation built and running, delivered in 2 weeks."),
                ("Monthly Support", "Monitoring, fixes, and small changes."),
            ]
        )
    )

    st += rule(12, 10)
    st.append(Paragraph("WORKS WITH YOUR TOOLS", S["eyebrow"]))
    st.append(Spacer(1, 3))

    groups = [
        ("Odoo", "Connected to your sales and accounting"),
        ("Zoho", "Connected to your sales and accounting"),
        ("Custom-built", "Tools and integrations, when no off-the-shelf tool fits"),
    ]
    gt = Table(
        [[Paragraph(f"<b>{k}</b>", S["cardb"]), Paragraph(v, S["cardb"])] for k, v in groups],
        colWidths=[44 * mm, None],
    )
    gt.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, -2), 0.6, LINE),
            ]
        )
    )
    st.append(gt)

    st.append(PageBreak())

    # ---------------- Page 2 ----------------
    st.append(Paragraph("SELECTED SYSTEMS", S["eyebrow"]))
    st.append(Paragraph("What we have built.", S["h2"]))
    st.append(
        Paragraph(
            "Every build is labeled a Prototype or a Template. Sales and finance builds come first. "
            "The interface views on our site use synthetic, anonymised data.",
            S["muted"],
        )
    )
    st.append(Spacer(1, 6))
    st.append(
        systems_table(
            [
                (
                    "Finance operations system",
                    "Platform",
                    "Brings reimbursements, invoices, approvals, payments, and accounting entries into one "
                    "place, with the right access for each role and a full history of changes.",
                    "Prototype",
                ),
                (
                    "AI opportunity research",
                    "Sales",
                    "Researches each sales lead, finds a real business problem, and scores the best-fit "
                    "solution before anyone reaches out.",
                    "Prototype",
                ),
                (
                    "Network research",
                    "Growth",
                    "Finds reputable employers for a target role across 1,794 connections, maps verified "
                    "direct introductions, and drafts evidence-based outreach. Covered by 9 automated tests.",
                    "Prototype",
                ),
                (
                    "Benefits claim verification",
                    "Public sector",
                    "Combines residency, income, and eligibility checks into one clear decision, with the "
                    "reasons written down.",
                    "Prototype",
                ),
                (
                    "Denial appeal workflow",
                    "Healthcare",
                    "Takes an insurance denial from intake to submission, with a person reviewing before "
                    "it is sent. 19 steps, 3 quality checks.",
                    "Template",
                ),
                (
                    "Prior authorization package",
                    "Healthcare",
                    "Matches clinical evidence to the insurance criteria, drafts the request, and sends it "
                    "for review before submission. 5 stages.",
                    "Template",
                ),
                (
                    "Critical lab alert handoff",
                    "Clinical",
                    "Routes urgent results to the right responder with acknowledgement and escalation.",
                    "Template",
                ),
                (
                    "Protocol deviation review",
                    "Clinical quality",
                    "Checks visits against the study rules, flags anything outside them, and marks each "
                    "finding as major or minor, using the study document.",
                    "Template",
                ),
            ]
        )
    )

    st += rule(9, 7)
    st.append(Paragraph("WORKING TOGETHER", S["eyebrow"]))
    st.append(Paragraph("Three ways to work together.", S["h2"]))
    st.append(Spacer(1, 5))
    st.append(
        cards(
            [
                (
                    "Free Automation Audit",
                    "A 30-minute call plus a one-page plan of the three automations that would save the "
                    "most time. Free.",
                    ["Free"],
                ),
                (
                    "First Automation",
                    "One automation built and running. Fixed price and fixed delivery time.",
                    ["USD 1,200", "Delivered in 2 weeks"],
                ),
                (
                    "Monthly Support",
                    "Monitoring, fixes, and small changes.",
                    ["USD 250 per month"],
                ),
            ]
        )
    )

    st += rule(9, 7)

    contact_head = [
        Paragraph("START A CONVERSATION", S["eyebrow"]),
        Spacer(1, 1),
    ]

    contact = Table(
        [
            [Paragraph("<b>Email</b>", S["cardb"]), Paragraph("ajlal@logicfolds.com", S["cardb"])],
            [Paragraph("<b>LinkedIn</b>", S["cardb"]), Paragraph("linkedin.com/in/ajlalgoraya", S["cardb"])],
            [Paragraph("<b>Founder</b>", S["cardb"]), Paragraph("Muhammad Ajlal Haider", S["cardb"])],
            [
                Paragraph("<b>Background</b>", S["cardb"]),
                Paragraph(
                    "4+ years of experience building software and automations that connect the systems businesses run on.",
                    S["cardb"],
                ),
            ],
        ],
        colWidths=[30 * mm, None],
    )
    contact.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, -2), 0.6, LINE),
            ]
        )
    )
    st.append(KeepTogether(contact_head + [contact]))

    doc.build(st)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
