from pathlib import Path

rows = """X23 TOAN DIA CNCN
X24 TOAN DIA CNNN
X21 TOAN DIA GDKTPL
D10 TOAN DIA ANH
X22 TOAN DIA TIN
X54 TOAN GDKTPL CNCN
X55 TOAN GDKTPL CNNN
X53 TOAN GDKTPL TIN
X11 TOAN HOA CNCN
X12 TOAN HOA CNNN
A06 TOAN HOA DIA
X09 TOAN HOA GDKTPL
A05 TOAN HOA SU
B00 TOAN HOA SINH
D07 TOAN HOA ANH
X10 TOAN HOA TIN
X19 TOAN SU CNCN
X20 TOAN SU CNNN
A07 TOAN SU DIA
X17 TOAN SU GDKTPL
D09 TOAN SU ANH
X18 TOAN SU TIN
X03 TOAN VAN CNCN
X04 TOAN VAN CNNN
C04 TOAN VAN DIA
X01 TOAN VAN GDKTPL
C02 TOAN VAN HOA
C03 TOAN VAN SU
B03 TOAN VAN SINH
D01 TOAN VAN ANH
X02 TOAN VAN TIN
C01 TOAN VAN LY
X15 TOAN SINH CNCN
X16 TOAN SINH CNNN
B02 TOAN SINH DIA
X13 TOAN SINH GDKTPL
B01 TOAN SINH SU
B08 TOAN SINH ANH
X14 TOAN SINH TIN
X27 TOAN ANH CNCN
X28 TOAN ANH CNNN
X25 TOAN ANH GDKTPL
X26 TOAN ANH TIN
X56 TOAN TIN CNCN
X57 TOAN TIN CNNN
X07 TOAN LY CNCN
X08 TOAN LY CNNN
A04 TOAN LY DIA
X05 TOAN LY GDKTPL
A00 TOAN LY HOA
A03 TOAN LY SU
A02 TOAN LY SINH
A01 TOAN LY ANH
X06 TOAN LY TIN
X76 VAN DIA CNCN
X77 VAN DIA CNNN
X74 VAN DIA GDKTPL
D15 VAN DIA ANH
X75 VAN DIA TIN
Y08 VAN GDKTPL CNCN
Y09 VAN GDKTPL CNNN
Y07 VAN GDKTPL TIN
X64 VAN HOA CNCN
X65 VAN HOA CNNN
C11 VAN HOA DIA
X62 VAN HOA GDKTPL
C10 VAN HOA SU
C08 VAN HOA SINH
D12 VAN HOA ANH
X63 VAN HOA TIN
X72 VAN SU CNCN
X73 VAN SU CNNN
C00 VAN SU DIA
X70 VAN SU GDKTPL
D14 VAN SU ANH
X71 VAN SU TIN
X68 VAN SINH CNCN
X69 VAN SINH CNNN
C13 VAN SINH DIA
X66 VAN SINH GDKTPL
C12 VAN SINH SU
D13 VAN SINH ANH
X67 VAN SINH TIN
X80 VAN ANH CNCN
X81 VAN ANH CNNN
X78 VAN ANH GDKTPL
X79 VAN ANH TIN
Y10 VAN TIN CNCN
Y11 VAN TIN CNNN
X60 VAN LY CNCN
X61 VAN LY CNNN
C09 VAN LY DIA
X58 VAN LY GDKTPL
C05 VAN LY HOA
C07 VAN LY SU
C06 VAN LY SINH
D11 VAN LY ANH
X59 VAN LY TIN""".strip().splitlines()

labels = {
    "TOAN": "Toán",
    "VAN": "Ngữ văn",
    "LY": "Vật lí",
    "HOA": "Hóa học",
    "SINH": "Sinh học",
    "SU": "Lịch sử",
    "DIA": "Địa lí",
    "GDKTPL": "GDKTPL",
    "TIN": "Tin học",
    "CNCN": "Công nghệ công nghiệp",
    "CNNN": "Công nghệ nông nghiệp",
    "ANH": "Tiếng Anh",
}

out = Path("apps/api/src/domain/career/exam-blocks-2025.ts")
lines = [
    "/** Từ điển tổ hợp xét tuyển 2025 (98 mã công khai thongtintuyensinh.vn). Không sửa file SCDP gốc. */",
    "export type ExamSubjectCode = 'TOAN' | 'VAN' | 'LY' | 'HOA' | 'SINH' | 'SU' | 'DIA' | 'GDKTPL' | 'TIN' | 'CNCN' | 'CNNN' | 'ANH' | 'NGA' | 'PHAP' | 'TRUNG' | 'DUC' | 'NHAT' | 'HAN';",
    "export interface ExamBlock { code: string; subjects: readonly ExamSubjectCode[]; label: string; }",
    "export const SUBJECT_ALIAS: Record<string, ExamSubjectCode> = { GDCD: 'GDKTPL', CIVIC: 'GDKTPL', foreignLanguage: 'ANH' };",
    "export const EXAM_BLOCKS_2025: readonly ExamBlock[] = [",
]
for row in rows:
    code, a, b, c = row.split()
    label = f"{labels[a]}, {labels[b]}, {labels[c]}"
    lines.append(f"  {{ code: '{code}', subjects: ['{a}', '{b}', '{c}'], label: '{label}' }},")
lines.append("] as const;")
lines.append("")
lines.append("export function defaultBlocksForMajor(majorCode: string, group?: string): readonly string[] {")
lines.append("  if (majorCode.startsWith('748') || majorCode.startsWith('746')) return ['A00', 'A01', 'X06', 'A02'];")
lines.append("  if (majorCode.startsWith('772')) return ['B00', 'B08'];")
lines.append("  if (majorCode.startsWith('738')) return ['C00', 'D01', 'X70'];")
lines.append("  if (majorCode.startsWith('734')) return ['A00', 'A01', 'D01', 'D07'];")
lines.append("  if (majorCode.startsWith('721') || majorCode.startsWith('732')) return ['C00', 'D01', 'D14'];")
lines.append("  if (group === 'khtn') return ['A00', 'A01', 'B00'];")
lines.append("  if (group === 'khxh') return ['C00', 'D01', 'C03'];")
lines.append("  return ['A00', 'A01', 'D01', 'C00'];")
lines.append("}")
lines.append("")
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"wrote {len(rows)} blocks to {out}")
