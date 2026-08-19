"""
Builds public/LogicFolds_Credentials.pdf.

This replaces the previous file, which was a byte-identical copy of the personal
resume (and therefore published a personal phone number on a business website).
Every claim here traces to content already on the site: the services section,
the process steps, the project explorer, the capability strip and the FAQ.

No invented clients, deployments, benchmarks, testimonials or results.

Regenerate with:  python3 scripts/build-credentials.py
"""

import io

import cairosvg
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
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

# The favicon, rasterised once so the mark always matches the site.
MARK = io.BytesIO(cairosvg.svg2png(url="public/favicon.svg", output_width=160, output_height=160))


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
    head = ["System", "Domain", "What it does", "Shape"]
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
        colWidths=[38 * mm, 24 * mm, 74 * mm, 34 * mm],
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
        subject="Practical AI systems for business operations",
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
    logo = Image(MARK, width=13 * mm, height=13 * mm)
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
    st.append(Paragraph("Practical AI systems<br/>that save teams time.", S["hero"]))
    st.append(Spacer(1, 4))
    st.append(
        Paragraph(
            "LogicFolds combines AI agents, human review, and production software to make complex "
            "operations easier to run. We work with business owners and operations leaders who have a "
            "repeated process that is slow, document-heavy, or dependent on scarce expert attention.",
            S["body"],
        )
    )
    st.append(
        Paragraph(
            "We build the software around the workflow, not just the prompt: bounded agent behaviour, "
            "traceable inputs, explicit decision paths, and human approval gates where a decision "
            "carries real consequences.",
            S["body"],
        )
    )
    st += rule(6, 10)

    st.append(Paragraph("WHAT WE BUILD", S["eyebrow"]))
    st.append(Spacer(1, 3))
    st.append(
        cards(
            [
                (
                    "Agentic orchestration",
                    "Coordinate agents and people across complex operations, with the handoffs made explicit.",
                    ["Business rules", "Human review", "Audit trails"],
                ),
                (
                    "Decision intelligence",
                    "Turn documents and business context into bounded, explainable decisions.",
                    ["Extraction", "Grounding", "Validation"],
                ),
                (
                    "Platforms and integrations",
                    "Ship the software around the workflow so it runs inside the systems you already use.",
                    ["FastAPI", "MCP and APIs", "Deployment"],
                ),
            ]
        )
    )
    st += rule(10, 10)

    st.append(Paragraph("HOW WE WORK", S["eyebrow"]))
    st.append(Spacer(1, 4))
    st.append(
        steps(
            [
                ("Discover", "Workflow, friction, risk, and the success metric."),
                ("Orchestrate", "Agents, rules, decisions, and human review."),
                ("Integrate", "Data, APIs, systems, and the product surface."),
                ("Prove and launch", "Evaluate, deploy, hand off, improve."),
            ]
        )
    )

    st += rule(12, 10)
    st.append(Paragraph("TECHNICAL FOUNDATION", S["eyebrow"]))
    st.append(Spacer(1, 3))

    groups = [
        ("Orchestration", "UiPath Maestro, agentic workflows, human-in-the-loop review"),
        ("Models and grounding", "Gemini, LLM APIs, RAG pipelines, evaluation harnesses"),
        ("Systems", "FastAPI, MCP and API integrations, PostgreSQL, Docker, Playwright"),
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
    st.append(Paragraph("Workflow designs and platforms we have built.", S["h2"]))
    st.append(
        Paragraph(
            "The shape column is deliberate. Several of these are reusable workflow templates and "
            "prototypes rather than live clinical or production deployments, and the interface views on "
            "our site use synthetic, anonymised data.",
            S["muted"],
        )
    )
    st.append(Spacer(1, 6))
    st.append(
        systems_table(
            [
                (
                    "Denial appeal orchestration",
                    "Healthcare",
                    "Coordinates intake, extraction, code confirmation, policy research, evidence matching, "
                    "review, and submission across 19 nodes with 3 evaluators.",
                    "Workflow template",
                ),
                (
                    "Role-based network intelligence",
                    "Growth",
                    "Filters reputable employers for a target role across 1,794 connections, maps verified "
                    "first-degree routes, and drafts grounded outreach. Daily caching, 9 automated tests.",
                    "Working system",
                ),
                (
                    "AI opportunity research",
                    "Sales",
                    "Researches each lead, grounds a real business problem, and scores the best-fit AI "
                    "solution before outreach. Gemini-powered.",
                    "Working system",
                ),
                (
                    "Benefits claim verification",
                    "Public sector",
                    "Combines residency, income, and eligibility checks into one explainable decision "
                    "workflow with a grounded rationale.",
                    "Grounded workflow",
                ),
                (
                    "Prior authorization package",
                    "Healthcare",
                    "Maps clinical evidence to payer criteria, drafts the request, and routes it through "
                    "review and submission across 5 stages.",
                    "Workflow design",
                ),
                (
                    "Critical lab alert handoff",
                    "Clinical",
                    "Routes urgent results to the right responder with acknowledgement and escalation.",
                    "Workflow design",
                ),
                (
                    "Protocol deviation review",
                    "Clinical quality",
                    "Checks study rules, detects deviations, and classifies major or minor findings from "
                    "PDF-grounded context.",
                    "Workflow design",
                ),
                (
                    "Finance operations ERP",
                    "Platform",
                    "Centralises reimbursements, invoices, approvals, payments, journals, and intercompany "
                    "work with role-based access and audit history.",
                    "Full-stack platform",
                ),
            ]
        )
    )

    st += rule(9, 7)
    st.append(Paragraph("WORKING TOGETHER", S["eyebrow"]))
    st.append(Paragraph("Two ways to start.", S["h2"]))
    st.append(Spacer(1, 5))
    st.append(
        cards(
            [
                (
                    "AI Support Workflow Sprint",
                    "For IT services and support teams. We turn one repeated ticket process into a "
                    "build-ready, human-supervised AI workflow with a clear implementation path.",
                    ["Scoped", "Decision package"],
                ),
                (
                    "Full build",
                    "Start from a validated template, then harden it with APIs, auth, auditability, "
                    "evaluations, and deployment until it runs as a dependable system.",
                    ["Design to production"],
                ),
            ],
            cols=2,
        )
    )

    st += rule(9, 7)

    contact_head = [
        Paragraph("START A CONVERSATION", S["eyebrow"]),
        Spacer(1, 1),
    ]

    contact = Table(
        [
            [Paragraph("<b>Email</b>", S["cardb"]), Paragraph("ajlalgoraya333@gmail.com", S["cardb"])],
            [Paragraph("<b>Founder</b>", S["cardb"]), Paragraph("Muhammad Ajlal Haider", S["cardb"])],
            [
                Paragraph("<b>Background</b>", S["cardb"]),
                Paragraph(
                    "3+ years building and deploying AI and backend systems in production.",
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
