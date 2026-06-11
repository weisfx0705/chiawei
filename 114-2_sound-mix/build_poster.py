from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import qrcode
import math

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "114-2_電影混音_創新教學成果海報.png"
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
    "以5.1環繞錄音室為核心，先建立場域聆聽標準，再導入 ElevenLabs、Suno、Krotos 與 LLM。課程不把AI當成捷徑，而是要求學生比較原始聲、AI生成、現場錄音與最終混音，回到電影聲音工藝的判斷。",
)

# AI tools block
tool_y = y0 + 300
text(draw, (left_x + 10, tool_y), "AI 賦能：課程中的四個工具", f=F["h2"], fill=INK)
for i, (name, desc, c) in enumerate([
    ("ElevenLabs", "語音置換 / ADR可信度比較", GREEN),
    ("Suno AI", "情緒標籤 / 配樂初稿生成", AMBER),
    ("Krotos", "音效與環境音設計", CYAN),
    ("LLM", "觀影心得與Prompt思考", "#C7B6FF"),
]):
    y = tool_y + 55 + i * 55
    pill(draw, (left_x + 10, y, left_x + 160, y + 36), name, c)
    text(draw, (left_x + 180, y + 7), desc, f=F["small"], fill=INK)

# note card
note_y = tool_y + 275
add_card(
    draw,
    (left_x, note_y, left_x + left_w, note_y + 270),
    "高品質課堂筆記",
    "學生利用老師錄音室教學轉錄稿，整理完成《5.1聲道錄音室教學筆記》。一次性的現場示範被轉化為可回看、可練習的技術文件，涵蓋HD Native、I/O、Sync HD、監聽校準與Cue Bus流程。",
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
draw_wrapped(draw, (left_x + 230, qr_y + 118, left_x + left_w - 32, qr_y + 210), "完整成果網站包含五階段課程、學生影片、學生筆記、AI問卷分析、教學圖表與現場照片。", F["body"], INK, 7)
text(draw, (left_x + 230, qr_y + 216), "reurl.cc/xWrGGN", f=F["small"], fill=MUTED)
pill(draw, (left_x + 490, qr_y + 174, left_x + 615, qr_y + 222), "WEB", RED, PAPER)

# outcome summary fills the lower-left gap
summary_y = qr_y + 285
rr(draw, (left_x, summary_y, left_x + left_w, summary_y + 250), 15, NAVY)
text(draw, (left_x + 24, summary_y + 24), "學生作業與成果", f=F["h2"], fill=PAPER)
assignments = [
    ("觀影聲音分析", "從默片、Stereo 到 5.1 聲場"),
    ("5.1錄音室筆記", "教學轉錄稿整理成技術文件"),
    ("AI配樂與語音", "Suno配樂、ElevenLabs聲音置換"),
    ("ADR / Foley實作", "錄音室配音、擬音與同步練習"),
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
    "先聽、再用AI、最後回到混音判斷。",
)

method_y = y0 + 180
add_card(
    draw,
    (right_x, method_y, right_x + right_w, method_y + 285),
    "METHODOLOGY",
    "五階段推進：聲音感知與空間聆聽 → LLM報告協作與語音實驗 → AI配樂與音訊工具導入 → 50208錄音室ADR / Foley → 期末重製與AI反思。學生作業影片被嵌入各階段，而非集中展示，使成果能對應真實教學流程。",
)

# survey metrics
survey_y = method_y + 320
rr(draw, (right_x, survey_y, right_x + right_w, survey_y + 245), 15, NAVY)
text(draw, (right_x + 24, survey_y + 24), "AI 反思問卷", f=F["h2"], fill=PAPER)
metrics = [
    ("93%", "期末作業曾\n使用AI工具"),
    ("93%", "認為場域聆聽\n有助判斷AI聲音"),
    ("4.1/5", "AI應用於電影混音\n未來發展平均評分"),
    ("67%", "未來發展正向評分\n給予4至5分"),
]
for i, (n, lab) in enumerate(metrics):
    x = right_x + 26 + (i % 2) * 310
    y = survey_y + 80 + (i // 2) * 78
    rr(draw, (x, y, x + 285, y + 64), 10, PAPER)
    text(draw, (x + 18, y + 9), n, f=F["num"], fill=INK)
    text(draw, (x + 158, y + 15), lab, f=F["micro"], fill=INK, spacing=2)

# diagrams
diag_y = survey_y + 285
text(draw, (right_x + 5, diag_y), "抽象混音流程的圖表化", f=F["h2"], fill=INK)
bus_src = Image.open(ROOT.parent / "教學圖片/bus_stem2026.png").convert("RGB")
bus = bus_src.crop((0, 150, bus_src.width, bus_src.height))
paste_round_contain(canvas, bus, (right_x, diag_y + 48, right_x + right_w, diag_y + 367), 14, fill="#EEF2F5")

wet_src = Image.open(ROOT.parent / "教學圖片/wet_dry.png").convert("RGB")
wet = wet_src.crop((0, 250, wet_src.width, 850))
paste_round_contain(canvas, wet, (right_x, diag_y + 391, right_x + right_w, diag_y + 644), 14, fill="#10223A")

# bottom photo strip
strip_y = 1915
photo_paths = [
    ROOT / "assets/site/listening-room.jpg",
    ROOT / "assets/site/adr-session.jpg",
    ROOT / "assets/site/student-mix.jpg",
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
text(draw, (W - M - 28, 2139), "Sound Design and Mixing", f=font(22, FONT_LATIN_REG), fill="#BFC7E8", anchor="ra")

for i, c in enumerate([GREEN, CYAN, AMBER, RED]):
    draw.ellipse((W - M - 46 - i * 42, 132, W - M - 24 - i * 42, 154), fill=c)

canvas.save(OUT, quality=95)
print(OUT)
