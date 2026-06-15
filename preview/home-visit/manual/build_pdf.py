#!/usr/bin/env python3
# 外来・在宅ベースアップ評価料シミュレータ 操作マニュアル（A4 1枚）PDF生成
from fpdf import FPDF

FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf"

# 配色
TEAL = (15, 118, 110)
TEAL_D = (6, 95, 70)
GREEN = (5, 150, 105)
AMBER = (245, 158, 11)
AMBER_BG = (255, 251, 235)
AMBER_BD = (252, 211, 77)
AMBER_DEEP_BG = (254, 243, 199)
GREEN_BG = (236, 253, 245)
GREEN_BD = (110, 231, 183)
SLATE = (30, 41, 59)
GRAY = (71, 85, 105)
NOTE_BG = (254, 243, 199)
NOTE_BD = (253, 230, 138)
HEAD_BG = (241, 245, 249)
BORDER = (203, 213, 225)

pdf = FPDF(orientation="P", unit="mm", format="A4")
pdf.set_auto_page_break(auto=False)
pdf.set_margins(10, 9, 10)
pdf.add_page()
pdf.add_font("ipa", "", FONT)

CW = 210 - 20  # 190mm

def set_fill(c): pdf.set_fill_color(*c)
def set_text(c): pdf.set_text_color(*c)
def set_draw(c): pdf.set_draw_color(*c)

# ---- タイトル ----
set_text(TEAL)
pdf.set_font("ipa", "", 13)
pdf.set_xy(10, 9)
pdf.cell(CW, 6, "外来・在宅ベースアップ評価料シミュレータ 操作マニュアル")
set_text(GRAY)
pdf.set_font("ipa", "", 7.5)
pdf.set_xy(10, 15.5)
pdf.cell(CW, 3.5, "無床診療所向け／令和8年度（2026年6月）診療報酬改定対応　― 入力データは端末内で処理され外部に送信されません ―")

y = 21

# ---- フロー帯 ----
def flow_box(x, w, num, text, color, txtcolor=SLATE, numcolor=AMBER, border=AMBER_BD):
    set_fill(color); set_draw(border)
    pdf.rect(x, y, w, 10, "DF")
    if num:
        set_fill(numcolor)
        pdf.ellipse(x+1.5, y+2.6, 4.6, 4.6, "F")
        set_text((255,255,255)); pdf.set_font("ipa", "", 9)
        pdf.set_xy(x+1.5, y+2.9); pdf.cell(4.6, 4, num, align="C")
    set_text(txtcolor); pdf.set_font("ipa", "", 7.5)
    pdf.set_xy(x+(7 if num else 1.5), y+1.5)
    pdf.multi_cell(w-(7.5 if num else 2.5), 3.3, text, align="L")

fw = 38; gap = 5; ax = 10
flow_box(ax, fw, "1", "3か月分の\n回数を入力", AMBER_BG)
set_text(AMBER); pdf.set_font("ipa", "", 12); pdf.set_xy(ax+fw, y+2.5); pdf.cell(gap, 5, "▶", align="C")
ax += fw+gap
flow_box(ax, fw, "2", "算定パターン\nと人数を選ぶ", AMBER_BG)
set_text(AMBER); pdf.set_font("ipa", "", 12); pdf.set_xy(ax+fw, y+2.5); pdf.cell(gap, 5, "▶", align="C")
ax += fw+gap
flow_box(ax, fw, "3", "(必要なら)\n区分を選ぶ", AMBER_BG)
set_text(GREEN); pdf.set_font("ipa", "", 12); pdf.set_xy(ax+fw, y+2.5); pdf.cell(gap, 5, "⇒", align="C")
ax += fw+gap
set_fill(GREEN); set_draw(GREEN); pdf.rect(ax, y, CW-(ax-10), 10, "DF")
set_text((255,255,255)); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(ax+1, y+1.5); pdf.multi_cell(CW-(ax-10)-2, 3.4, "✓ 結果が自動で\n表示されます", align="C")

y += 12.5

def band(label, color=TEAL):
    global y
    set_fill(color); set_draw(color)
    pdf.rect(10, y, CW, 5, "F")
    set_text((255,255,255)); pdf.set_font("ipa", "", 9)
    pdf.set_xy(12, y+0.5); pdf.cell(CW-4, 4, label)
    y += 6.5

def step_header(x, w, num, title):
    set_fill(AMBER)
    pdf.ellipse(x, y, 5, 5, "F")
    set_text((255,255,255)); pdf.set_font("ipa", "", 9)
    pdf.set_xy(x, y+0.2); pdf.cell(5, 4.6, num, align="C")
    set_text(SLATE); pdf.set_font("ipa", "", 9)
    pdf.set_xy(x+6.5, y+0.4); pdf.cell(w-6.5, 4.2, title)

# ===== 入力する =====
band("入力する（黄色の欄に入力・選択します）", TEAL)

col_w = (CW-3)/2
left_x = 10
right_x = 10+col_w+3

# STEP1 / STEP2 ヘッダ
step_header(left_x, col_w, "1", "3か月分の算定回数を入力")
step_header(right_x, col_w, "2", "算定パターンと対象人数を選ぶ")
y += 6

box_y = y
# STEP1 本文
set_fill(AMBER_BG); set_draw(AMBER_BD)
pdf.rect(left_x, box_y, col_w, 22, "DF")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(left_x+1.8, box_y+1.2)
pdf.multi_cell(col_w-3.5, 3.3,
  "直近3か月分の初診料・再診料の算定回数（月ごとの合計）を黄色の欄に入力します。\n"
  "・3か月平均は自動で計算・表示されます。\n"
  "・どれか1つでも入力すると計算が始まります。\n"
  "・空欄の月は平均から除外（全部空欄なら0）。")
# STEP2 本文
set_fill(AMBER_BG); set_draw(AMBER_BD)
pdf.rect(right_x, box_y, col_w, 22, "DF")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(right_x+1.8, box_y+1.2)
pdf.multi_cell(col_w-3.5, 3.3,
  "(1) 算定する評価料：「(Ⅰ)のみ」か「(Ⅰ)+(Ⅱ)」を選択。\n"
  "(2) 賃上げ区分：「2026/3/31時点で届出済（継続的賃上げ実施）」または「それ以外」。\n"
  "(3) 対象従業員数：医師・歯科医師を除く看護・薬剤・事務職員等。空欄でも計算可（1人あたり額のみ非表示）。")
y = box_y + 22 + 1.5

# STEP 2.5 改定前(II)区分
set_fill(AMBER_DEEP_BG); set_draw(AMBER_BD)
pdf.rect(10, y, CW, 14, "DF")
set_fill(AMBER)
pdf.ellipse(11.5, y+1.5, 5, 5, "F")
set_text((255,255,255)); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(11.5, y+1.7); pdf.cell(5, 4.6, "2.5", align="C")
set_text(SLATE); pdf.set_font("ipa", "", 9)
pdf.set_xy(18, y+0.8); pdf.cell(CW-30, 4, "改定前（令和8年3月時点）の評価料(Ⅱ) 区分")
set_fill(AMBER_BD); pdf.rect(CW-60+10, y+0.6, 60, 4.5, "F")
set_text((120,53,15)); pdf.set_font("ipa", "", 7)
pdf.set_xy(CW-60+10, y+0.8); pdf.cell(60, 4, "継続的賃上げ実施を選んだ場合のみ", align="C")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(12, y+6)
pdf.multi_cell(CW-4, 3.3,
  "「継続的賃上げ実施」を選んだ場合、システムが改定前の算定額を自動で控除します。表から改定前(令和8年3月時点)に算定していた(Ⅱ)区分を選んでください。\n"
  "・各行は改定前(Ⅰ)+(Ⅱ)の合計点数と月額を表示。 ・改定前に(Ⅱ)を算定していなかった場合は「改定前は(Ⅱ)を算定していない（(Ⅰ)のみ）」を選択。")
y += 15.5

# STEP3
step_header(10, CW, "3", "改定後（令和8年6月～）の評価料(Ⅱ) の区分を選ぶ（②で「(Ⅰ)+(Ⅱ)」を選んだ場合のみ）")
y += 6
set_fill(AMBER_BG); set_draw(AMBER_BD)
pdf.rect(10, y, CW, 7, "DF")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(12, y+1.0)
pdf.multi_cell(CW-4, 3.3,
  "改定後の(Ⅱ)区分一覧表で、算定する区分の行をクリックして選びます。選んだ区分が増収額・ベースアップ原資に反映されます。\n"
  "（評価料(Ⅰ)のみを算定する場合、この操作は不要です）")
y += 9

# ===== 結果を見る =====
band("結果を見る（入力すると自動で計算されます。入力は不要です）", GREEN)
ry = y
# 結果左：点数表示
set_fill((255,255,255)); set_draw(BORDER)
pdf.rect(left_x, ry, col_w, 22, "DF")
set_text(SLATE); pdf.set_font("ipa", "", 8.5)
pdf.set_xy(left_x+2, ry+1); pdf.cell(col_w-4, 4, "令和8年6月以降の点数")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(left_x+2, ry+5.5)
pdf.multi_cell(col_w-4, 3.3,
  "初診・再診それぞれに (Ⅰ)+(Ⅱ) の合計点数を式形式で表示。\n"
  "例：23点(Ⅰ) ＋ 16点(Ⅱ 区分1) ＝ 39点\n"
  "継続的賃上げ実施の場合は、その下に「令和8年5月までの点数」も同形式で並び、差額が純増点数となります（薄いグレー背景）。")
# 結果右：増収額
set_fill(GREEN_BG); set_draw(GREEN_BD)
pdf.rect(right_x, ry, col_w, 22, "DF")
set_text(TEAL_D); pdf.set_font("ipa", "", 8.5)
pdf.set_xy(right_x+2, ry+1); pdf.cell(col_w-4, 4, "✓ 月間想定増収額（令和8年6月以降）")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(right_x+2, ry+5.5)
pdf.multi_cell(col_w-4, 3.3,
  "・評価料(Ⅰ)の増収（月額）\n"
  "・評価料(Ⅱ)の増収（月額）※区分選択時\n"
  "・継続的賃上げ実施の場合：改定後合計から改定前(Ⅰ)(Ⅱ)月額を控除した純増分\n"
  "・合計増収額（月額／年額）")
y = ry + 22 + 1.5

# 結果（手当原資）フル幅
set_fill(GREEN_BG); set_draw(GREEN_BD)
pdf.rect(10, y, CW, 13, "DF")
set_text(TEAL_D); pdf.set_font("ipa", "", 8.5)
pdf.set_xy(12, y+1); pdf.cell(CW-4, 4, "✓ 令和8年6月からのベースアップの原資 / 1人あたりベースアップ額")
set_text(GRAY); pdf.set_font("ipa", "", 7.5)
pdf.set_xy(12, y+5.5)
pdf.multi_cell(CW-4, 3.3,
  "・増収額から社会保険料の事業主負担増（約16.5%）を差し引いたベースアップ原資（月額／年額）\n"
  "・ベースアップ原資 ÷ 対象従業員数 ＝ 1人あたりベースアップ額（月額／年額）。対象人数が空欄の場合は1人あたり額のみ「―」表示。")
y += 14.5

# ===== 点数早見 =====
band("令和8年6月～の点数（早見）　※1点＝10円", TEAL)
ty = y
def cell_row(x, w_cols, texts, h, fill=None, font=7.5, align=None, text_color=None):
    if fill: set_fill(fill)
    cx = x
    for i, (cw, t) in enumerate(zip(w_cols, texts)):
        set_draw(BORDER)
        pdf.rect(cx, y, cw, h, "DF" if fill else "D")
        set_text(text_color or SLATE); pdf.set_font("ipa", "", font)
        a = align[i] if align else "L"
        pdf.set_xy(cx+1, y+(h-3)/2)
        pdf.multi_cell(cw-2, 3, t, align=a)
        cx += cw

# 左：評価料(I)
lw = [col_w*0.5, col_w*0.25, col_w*0.25]
y = ty
cell_row(left_x, lw, ["評価料(Ⅰ)","初診","再診"], 4.5, HEAD_BG, 7.5, ["C","C","C"])
y += 4.5
cell_row(left_x, lw, ["継続的賃上げ実施","23点","6点"], 4.5, None, 7.5, ["L","R","R"])
y += 4.5
cell_row(left_x, lw, ["それ以外（新規届出）","17点","4点"], 4.5, None, 7.5, ["L","R","R"])
y += 4.5
cell_row(left_x, lw, ["（参考）令和8年5月までの(Ⅰ)","6点","2点"], 4.5, HEAD_BG, 7.5, ["L","R","R"], (100,116,139))
# 右：評価料(II)
rw = [col_w*0.4, col_w*0.22, col_w*0.38]
y = ty
cell_row(right_x, rw, ["評価料(Ⅱ)","区分数","備考"], 4.5, HEAD_BG, 7.5, ["C","C","C"])
y += 4.5
cell_row(right_x, rw, ["継続的賃上げ実施","12区分","初診・再診に区分点数を加算"], 4.5, None, 7.5, ["L","R","L"])
y += 4.5
cell_row(right_x, rw, ["それ以外","8区分","外来延患者数に応じ選択"], 4.5, None, 7.5, ["L","R","L"])
y += 4.5
cell_row(right_x, rw, ["（参考）改定前(Ⅱ)","8区分","継続的賃上げ実施時の控除に使用"], 4.5, HEAD_BG, 7.5, ["L","R","L"], (100,116,139))
y = ty + 18 + 1.5

# ===== 便利な機能 =====
band("便利な機能", TEAL)
feats = [
    ("クリア", "すべての入力欄を空欄に戻します。"),
    ("印刷 / PDF", "試算結果を印刷、またはPDFとして保存できます（選択した区分・選択肢のみ印刷）。"),
    ("計算の詳細を表示", "クリックで評価料(Ⅰ)(Ⅱ)の内訳とベースアップ原資の計算過程を開閉できます。"),
    ("データの保存", "入力内容は自動でブラウザに保存され、次回開いたときに復元されます。"),
]
for k, v in feats:
    set_draw(BORDER)
    pdf.rect(10, y, 34, 4.8, "D")
    pdf.rect(44, y, CW-34, 4.8, "D")
    set_text(TEAL_D); pdf.set_font("ipa", "", 7.5)
    pdf.set_xy(11, y+0.9); pdf.cell(32, 3, k)
    set_text(GRAY); pdf.set_font("ipa", "", 7.5)
    pdf.set_xy(45, y+0.9); pdf.cell(CW-36, 3, v)
    y += 4.8
y += 1.5

# ===== 注意 =====
set_fill(NOTE_BG); set_draw(NOTE_BD)
note = ("ご利用上の注意：本ツールの試算結果は厚生労働省の告示・通知に基づく目安です。"
        "実際の届出・算定にあたっては、必ず最新の通知および地方厚生(支)局の指導内容をご確認ください。"
        "試算結果に基づく算定・経営判断について、本サイトは一切の責任を負いません。")
pdf.set_font("ipa", "", 7)
pdf.rect(10, y, CW, 8, "DF")
set_text((120,53,15))
pdf.set_xy(12, y+1)
pdf.multi_cell(CW-4, 3.0, note)

pdf.output("/home/user/-/manual/manual.pdf")
print("OK: manual.pdf generated")
