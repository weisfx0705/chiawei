from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import qrcode
import math

ROOT = Path(__file__).resolve().parent
DELIVERABLES = ROOT.parent / "成果報告繳交"
OUT = DELIVERABLES / "114-2_電影混音_創新教學成果海報.png"
OUT_PDF = DELIVERABLES / "114-2_電影混音_創新教學成果海報.pdf"
SITE_OUT = ROOT / "114-2_電影混音_創新教學成果海報.png"
URL = "https://reurl.cc/xWrGGN"

SCALE = 2
W, H = 1587, 2245
BG = "#E8ECFF"
NAVY = "#060B2D"
INK = "#151515"
PAPER = "#FFFDF5"
MUTED = "#5E6473"
GREEN = "#3FE9A1"
CYAN = "#63D5FF"
AMBER = "#FFB84D"
RED = "#FF5B55"
LINE = "#D4D8EC"

FONT_CJK = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_LATIN = "/Users/weisfx/.gemini/config/skills/canvas-design/canvas-fonts/InstrumentSans-Bold.ttf"
FONT_LATIN_REG = "/Users/weisfx/.gemini/config/skills/canvas-design/canvas-fonts/InstrumentSans-Regular.ttf"
FONT_MONO = "/Users/weisfx/.gemini/config/skills/canvas-design/canvas-fonts/JetBrainsMono-Bold.ttf"


def font(size, path=FONT_CJK):
    return ImageFont.truetype(path, size * SCALE)


def sc(v):
    return int(round(v * SCALE))


def sc_box(box):
    return tuple(sc(v) for v in box)


class ScaledDraw:
    def __init__(self, draw):
        self.draw = draw

    def rounded_rectangle(self, box, radius=0, fill=None, outline=None, width=1):
        self.draw.rounded_rectangle(sc_box(box), radius=sc(radius), fill=fill, outline=outline, width=sc(width))

    def rectangle(self, box, fill=None, outline=None, width=1):
        self.draw.rectangle(sc_box(box), fill=fill, outline=outline, width=sc(width))

    def ellipse(self, box, fill=None, outline=None, width=1):
        self.draw.ellipse(sc_box(box), fill=fill, outline=outline, width=sc(width))

    def line(self, xy, fill=None, width=1):
        self.draw.line(sc_box(xy), fill=fill, width=sc(width))

    def text(self, xy, text, fill=None, font=None, anchor=None, spacing=4, align="left"):
        self.draw.text((sc(xy[0]), sc(xy[1])), text, fill=fill, font=font, anchor=anchor, spacing=sc(spacing), align=align)

    def textlength(self, text, font=None):
        return self.draw.textlength(text, font=font) / SCALE


F = {
    "title": font(70),
    "title_latin": font(70, FONT_LATIN),
    "h1": font(43),
    "h2": font(31),
    "h3": font(24),
    "body": font(22),
    "small": font(18),
    "tiny": font(15),
    "micro": font(13),
    "num": font(44, FONT_MONO),
    "mono": font(17, FONT_MONO),
}


def rr(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, s, fill=INK, f=None, anchor=None, spacing=4, align="left"):
    draw.text(xy, s, fill=fill, font=f or F["body"], anchor=anchor, spacing=spacing, align=align)


def wrap_text(draw, s, f, max_w, max_lines=None):
    lines, line = [], ""
    for ch in s:
        trial = line + ch
        if draw.textlength(trial, font=f) <= max_w or not line:
            line = trial
        else:
            lines.append(line)
            line = ch
            if max_lines and len(lines) >= max_lines:
                break
    if line and (not max_lines or len(lines) < max_lines):
        lines.append(line)
    if max_lines and len(lines) == max_lines and len("".join(lines)) < len(s):
        lines[-1] = lines[-1].rstrip("，。；、") + "…"
    return "\n".join(lines)


def draw_wrapped(draw, box, s, f, fill=INK, line_gap=8, max_lines=None):
    x, y, x2, _ = box
    wrapped = wrap_text(draw, s, f, x2 - x, max_lines=max_lines)
    draw.text((x, y), wrapped, fill=fill, font=f, spacing=line_gap)
    return y + len(wrapped.splitlines()) * (f.size + line_gap)


def crop_fit(path, size, pos=(0.5, 0.5)):
    img = Image.open(path).convert("RGB")
    return ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=pos)


def header_logo(path):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    img = img.crop((0, 0, int(w * 0.34), h))
    pix = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = pix[x, y]
            if abs(r - 51) < 11 and abs(g - 51) < 11 and abs(b - 51) < 11:
                pix[x, y] = (r, g, b, 0)
            elif r < 24 and g < 24 and b < 24:
                pix[x, y] = (245, 247, 255, a)
            elif 24 <= r < 80 and 24 <= g < 80 and 24 <= b < 80:
                pix[x, y] = (220, 225, 240, a)
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def paste_round(base, img, box, r=18):
    x, y, x2, y2 = box
    x, y, x2, y2 = sc(x), sc(y), sc(x2), sc(y2)
    img = img.resize((x2 - x, y2 - y), Image.Resampling.LANCZOS)
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, img.size[0], img.size[1]), radius=sc(r), fill=255)
    base.paste(img, (x, y), mask)


def paste_round_contain(base, img, box, r=18, fill="#0B1730", pad=0):
    x, y, x2, y2 = box
    x, y, x2, y2 = sc(x), sc(y), sc(x2), sc(y2)
    pad = sc(pad)
    panel = Image.new("RGB", (x2 - x, y2 - y), fill)
    fit_size = (max(1, panel.size[0] - pad * 2), max(1, panel.size[1] - pad * 2))
    img = ImageOps.contain(img.convert("RGB"), fit_size, method=Image.Resampling.LANCZOS)
    panel.paste(img, ((panel.size[0] - img.size[0]) // 2, (panel.size[1] - img.size[1]) // 2))
    mask = Image.new("L", panel.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, panel.size[0], panel.size[1]), radius=sc(r), fill=255)
    base.paste(panel, (x, y), mask)


def add_card(draw, box, title, body=None, header_color=NAVY, title_color=PAPER):
    x, y, x2, y2 = box
    rr(draw, box, 15, PAPER)
    rr(draw, (x, y, x2, y + 70), 15, header_color)
    draw.rectangle((x, y + 42, x2, y + 70), fill=header_color)
    text(draw, (x + 24, y + 21), title, fill=title_color, f=F["h2"])
    if body:
        draw_wrapped(draw, (x + 24, y + 92, x2 - 24, y2 - 20), body, F["body"], INK, 7)


def pill(draw, box, label, fill, fg=INK):
    rr(draw, box, 14, fill)
    text(draw, ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2), label, fill=fg, f=F["small"], anchor="mm")


canvas = Image.new("RGB", (sc(W), sc(H)), BG)
draw = ScaledDraw(ImageDraw.Draw(canvas))

# faint acoustic grid
for x in range(0, W, 54):
    draw.line((x, 0, x, H), fill="#DCE1F5", width=1)
for y in range(0, H, 54):
    draw.line((0, y, W, y), fill="#DCE1F5", width=1)

# header
M = 115
header = (M, 120, W - M, 285)
rr(draw, header, 32, NAVY)
logo = header_logo(ROOT.parent / "isufilmtv.webp")
logo.thumbnail((sc(245), sc(118)), Image.Resampling.LANCZOS)
logo_x = sc(M + 48)
logo_y = sc(203) - logo.height // 2
canvas.paste(logo, (logo_x, logo_y), logo)
draw.line((M + 335, 150, M + 335, 255), fill="#30395C", width=2)
text(draw, (M + 375, 164), "114-2", fill=AMBER, f=font(31, FONT_MONO), anchor="lm")
text(draw, (M + 500, 164), "電影混音", fill=AMBER, f=font(31), anchor="lm")
text(draw, (M + 375, 222), "創新教學成果海報", fill=PAPER, f=font(61), anchor="lm")

# course info strips
left_info = (M, 310, M + 675, 430)
right_info = (M + 705, 310, W - M, 430)
rr(draw, left_info, 0, PAPER)
rr(draw, right_info, 0, PAPER)
text(draw, (M + 28, 340), "課程名稱", f=F["h3"])
text(draw, (M + 195, 340), "《電影混音》 A1945700", f=F["h3"])
text(draw, (M + 28, 385), "授課教師", f=F["h3"])
text(draw, (M + 195, 385), "陳嘉暐", f=F["h3"])
text(draw, (M + 735, 340), "開課系級", f=F["h3"])
text(draw, (M + 900, 340), "義守大學影視系", f=F["h3"])
text(draw, (M + 735, 385), "成果網站", f=F["h3"])
text(draw, (M + 900, 389), "reurl.cc/xWrGGN", f=F["small"], fill=MUTED)

col_gap = 36
left_x, left_w = M, 675
right_x, right_w = M + left_w + col_gap, W - M - (M + left_w + col_gap)
y0 = 475

# left top: core
add_card(
    draw,
    (left_x, y0, left_x + left_w, y0 + 270),
    "課程核心與創新動機",
    "以5.1環繞錄音室為核心，先建立場域聆聽標準，再導入 Suno、ElevenLabs、Krotos 與 LLM。課程不把AI當成捷徑，而是要求學生比較原始聲、AI生成、現場錄音與最終混音，並把AI素材來源寫入作品標注。",
)

# AI tools block
tool_y = y0 + 300
text(draw, (left_x + 10, tool_y), "AI 賦能：工具、流程與標注", f=F["h2"], fill=INK)
for i, (name, desc, c) in enumerate([
    ("Suno AI", "配樂初稿、情緒方向與版本標注", AMBER),
    ("ElevenLabs", "語音置換 / ADR可信度比較", GREEN),
    ("Krotos", "AI腳步聲與真實Foley比較", CYAN),
    ("LLM", "觀影心得、Prompt與概念整理", "#C7B6FF"),
]):
    y = tool_y + 55 + i * 55
    pill(draw, (left_x + 10, y, left_x + 160, y + 36), name, c)
    text(draw, (left_x + 180, y + 7), desc, f=F["small"], fill=INK)

# traceability card
note_y = tool_y + 275
add_card(
    draw,
    (left_x, note_y, left_x + left_w, note_y + 270),
    "AI MUSIC TRACEABILITY",
    "AI配樂不只要生成，還要能被說明與標注。因金種子影展是本系期末全系成果影展，學生作品片尾需揭露生成來源、工具版本、演出角色與音效來源，例如 Suno AI V4.5 與 ElevenLabs AI。",
    header_color="#102046",
)

# QR card
qr_y = note_y + 300
rr(draw, (left_x, qr_y, left_x + left_w, qr_y + 255), 15, PAPER)
text(draw, (left_x + 24, qr_y + 25), "成果網站與影片", f=F["h2"], fill=INK)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=2, box_size=10)
qr.add_data(URL)
qr.make(fit=True)
qr_img = qr.make_image(fill_color=NAVY, back_color=PAPER).convert("RGB").resize((sc(178), sc(178)), Image.Resampling.NEAREST)
canvas.paste(qr_img, (sc(left_x + 28), sc(qr_y + 72)))
text(draw, (left_x + 230, qr_y + 78), "掃描 QR code", f=F["h3"], fill=INK)
draw_wrapped(draw, (left_x + 230, qr_y + 118, left_x + left_w - 32, qr_y + 210), "完整成果網站包含五階段課程、學生影片、Suno帳號分析、AI標注範例、Krotos腳步聲比較與教學現場照片。", F["body"], INK, 7)
text(draw, (left_x + 230, qr_y + 216), "reurl.cc/xWrGGN", f=F["small"], fill=MUTED)
pill(draw, (left_x + 490, qr_y + 174, left_x + 615, qr_y + 222), "WEB", RED, PAPER)

# outcome summary fills the lower-left gap
summary_y = qr_y + 285
rr(draw, (left_x, summary_y, left_x + left_w, summary_y + 250), 15, NAVY)
text(draw, (left_x + 24, summary_y + 24), "學生作業與成果", f=F["h2"], fill=PAPER)
assignments = [
    ("觀影聲音分析", "從默片、Stereo 到 5.1 聲場"),
    ("5.1錄音室筆記", "教學轉錄稿整理成技術文件"),
    ("AI配樂與標注", "Suno配樂、片尾來源追溯"),
    ("ADR / Foley實作", "錄音室配音、Krotos腳步聲比較"),
    ("期末聲音重製", "整合AI、實錄素材與混音判斷"),
    ("AI工具反思", "效率、限制、倫理與混音師角色"),
]
for i, (name, desc) in enumerate(assignments):
    x = left_x + 24 + (i % 2) * 318
    y = summary_y + 74 + (i // 2) * 50
    draw.ellipse((x, y + 7, x + 14, y + 21), fill=[GREEN, CYAN, AMBER, RED, "#C7B6FF", PAPER][i])
    text(draw, (x + 24, y), name, f=F["small"], fill=PAPER)
    text(draw, (x + 24, y + 23), desc, f=F["tiny"], fill="#BFC7E8")
text(draw, (left_x + 26, summary_y + 218), "作業設計由聆聽、分析、錄音、生成到混音反思逐步累積。", f=F["small"], fill="#BFC7E8")

# right: objective and methodology
add_card(
    draw,
    (right_x, y0, right_x + right_w, y0 + 145),
    "OBJECTIVE",
    "先聽、再生成、最後回到混音判斷與來源標注。",
)

method_y = y0 + 180
add_card(
    draw,
    (right_x, method_y, right_x + right_w, method_y + 285),
    "METHODOLOGY",
    "五階段推進：聲音感知與空間聆聽 → LLM報告協作與語音實驗 → AI配樂與音訊工具導入 → 50208錄音室ADR / Foley → 期末重製、金種子影展標注與AI反思。學生作業影片被嵌入各階段，使成果能對應真實教學流程。",
)

# usage metrics
survey_y = method_y + 320
rr(draw, (right_x, survey_y, right_x + right_w, survey_y + 245), 15, NAVY)
text(draw, (right_x + 24, survey_y + 24), "AI 使用現況", f=F["h2"], fill=PAPER)
metrics = [
    (">1000", "Suno帳號\n累積生成曲目"),
    ("307", "主工作區\n保留曲目"),
    ("183", "A組主題曲\n測試與重製"),
    ("93%", "期末作業曾\n使用AI工具"),
]
for i, (n, lab) in enumerate(metrics):
    x = right_x + 26 + (i % 2) * 310
    y = survey_y + 80 + (i // 2) * 78
    rr(draw, (x, y, x + 285, y + 64), 10, PAPER)
    text(draw, (x + 18, y + 9), n, f=F["num"], fill=INK)
    text(draw, (x + 158, y + 15), lab, f=F["micro"], fill=INK, spacing=2)

# traceability and comparison evidence
diag_y = survey_y + 285
text(draw, (right_x + 5, diag_y), "來源標注與聲音檢核", f=F["h2"], fill=INK)
krotos = Image.open(ROOT / "assets/site/krotos-footsteps.webp").convert("RGB")
paste_round_contain(canvas, krotos, (right_x, diag_y + 48, right_x + right_w, diag_y + 330), 14, fill="#0E1726")
draw_wrapped(
    draw,
    (right_x + 16, diag_y + 344, right_x + right_w - 16, diag_y + 410),
    "Krotos腳步聲與真實Foley比較：真實錄製自由度與完成度較高；人力不足時，AI可作為快速補位方案。",
    F["small"],
    INK,
    4,
    max_lines=3,
)

credit_imgs = [
    ROOT / "assets/credits/suno-generated-using.webp",
    ROOT / "assets/credits/suno-generate.webp",
    ROOT / "assets/credits/elevenlabs-sfx.webp",
]
cw = (right_w - 24) // 3
for i, p in enumerate(credit_imgs):
    x = right_x + i * (cw + 12)
    img = crop_fit(p, (cw, 145), pos=(0.5, 0.5))
    paste_round(canvas, img, (x, diag_y + 420, x + cw, diag_y + 565), 10)
text(draw, (right_x + 5, diag_y + 590), "金種子影展作品片尾標注：工具、版本、生成與演出角色需清楚揭露。", f=F["small"], fill=MUTED)

# bottom photo strip
strip_y = 1915
photo_paths = [
    ROOT / "assets/site/listening-room.jpg",
    ROOT / "assets/site/ai-tool-studio-briefing.webp",
    ROOT / "assets/site/foley-floor-panel.webp",
    ROOT / "assets/site/protools-session.jpg",
]
pw = (W - 2 * M - 18 * 3) // 4
for i, p in enumerate(photo_paths):
    x = M + i * (pw + 18)
    img = crop_fit(p, (pw, 170), pos=(0.5, 0.45))
    paste_round(canvas, img, (x, strip_y, x + pw, strip_y + 170), 10)

# footer
rr(draw, (M, 2110, W - M, 2185), 12, "#2C3448")
text(draw, (M + 28, 2132), "ISU Department of Film & TV｜義守大學電影與電視學系", f=F["h3"], fill=PAPER)
text(draw, (W - M - 28, 2139), "ISU Film Sound Mixing", f=font(22, FONT_LATIN_REG), fill="#BFC7E8", anchor="ra")

for i, c in enumerate([GREEN, CYAN, AMBER, RED]):
    draw.ellipse((W - M - 46 - i * 42, 132, W - M - 24 - i * 42, 154), fill=c)

DELIVERABLES.mkdir(parents=True, exist_ok=True)
canvas.save(OUT, quality=95)
canvas.save(SITE_OUT, quality=95)
canvas.convert("RGB").save(OUT_PDF, "PDF", resolution=300.0)
print(OUT)
