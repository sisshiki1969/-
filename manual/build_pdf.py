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
GREEN_BG = (236, 253, 245)
GREEN_BD = (110, 231, 183)
SLATE = (30, 41, 59)
GRAY = (71, 85, 105)
LGRAY = (100, 116, 139)
NOTE_BG = (254, 243, 199)
NOTE_BD = (253, 230, 138)
HEAD_BG = (241, 245, 249)
BORDER = (203, 213, 225)

pdf = FPDF(orientation="P", unit="mm", format="A4")
pdf.set_auto_page_break(auto=False)
pdf.set_margins(12, 11, 12)
pdf.add_page()
pdf.add_font("ipa", "", FONT)
pdf.add_font("ipa", "B", FONT)  # IPAは単一ウェイト。太字は塗りで表現

CW = 210 - 24  # コンテンツ幅 186mm

def set_fill(c): pdf.set_fill_color(*c)
def set_text(c): pdf.set_text_color(*c)
def set_draw(c): pdf.set_draw_color(*c)

# ---- タイトル ----
set_text(TEAL)
pdf.set_font("ipa", "", 14)
pdf.set_xy(12, 11)
pdf.cell(CW, 7, "外来・在宅ベースアップ評価料シミュレータ 操作マニュアル")
set_text(GRAY)
pdf.set_font("ipa", "", 8)
pdf.set_xy(12, 18.5)
pdf.cell(CW, 4, "無床診療所向け／令和8年度（2026年6月）診療報酬改定対応　― 入力データは端末内で処理され外部に送信されません ―")

y = 25

# ---- フロー帯 ----
def flow_box(x, w, num, text, color, txtcolor=(255,255,255), numcolor=AMBER):
    set_fill(color); set_draw(color)
    pdf.rect(x, y, w, 11, "DF")
    if num:
        set_fill(numcolor)
        pdf.ellipse(x+1.5, y+3, 5, 5, "F")
        set_text((255,255,255)); pdf.set_font("ipa", "", 10)
        pdf.set_xy(x+1.5, y+3.2); pdf.cell(5, 4.6, num, align="C")
    set_text(txtcolor); pdf.set_font("ipa", "", 8)
    pdf.set_xy(x+(7.5 if num else 1.5), y+1.5)
    pdf.multi_cell(w-(8.5 if num else 2.5), 3.6, text, align="L")

fw = 40; gap = 6; ax = 12
flow_box(ax, fw, "1", "3か月分の\n回数を入力", AMBER_BG, SLATE)
set_text(AMBER); pdf.set_font("ipa", "", 13); pdf.set_xy(ax+fw, y+3); pdf.cell(gap, 5, "▶", align="C")
ax += fw+gap
flow_box(ax, fw, "2", "算定パターン\nと人数を選ぶ", AMBER_BG, SLATE)
set_text(AMBER); pdf.set_font("ipa", "", 13); pdf.set_xy(ax+fw, y+3); pdf.cell(gap, 5, "▶", align="C")
ax += fw+gap
flow_box(ax, fw, "3", "(必要なら)\n区分を選ぶ", AMBER_BG, SLATE)
set_text(GREEN); pdf.set_font("ipa", "", 13); pdf.set_xy(ax+fw, y+3); pdf.cell(gap, 5, "⇒", align="C")
ax += fw+gap
set_fill(GREEN); set_draw(GREEN); pdf.rect(ax, y, CW-(ax-12), 11, "DF")
set_text((255,255,255)); pdf.set_font("ipa", "", 8.5)
pdf.set_xy(ax+1, y+1.5); pdf.multi_cell(CW-(ax-12)-2, 3.8, "✓ 結果が自動で\n表示されます", align="C")

y += 14

def band(label, color=TEAL):
    global y
    set_fill(color); set_draw(color)
    pdf.rect(12, y, CW, 5.5, "F")
    set_text((255,255,255)); pdf.set_font("ipa", "", 10)
    pdf.set_xy(14, y+0.7); pdf.cell(CW-4, 4, label)
    y += 7

def step_header(x, w, num, title):
    set_fill(AMBER)
    pdf.ellipse(x, y, 5.5, 5.5, "F")
    set_text((255,255,255)); pdf.set_font("ipa", "", 10)
    pdf.set_xy(x, y+0.4); pdf.cell(5.5, 4.8, num, align="C")
    set_text(SLATE); pdf.set_font("ipa", "", 9.5)
    pdf.set_xy(x+7, y+0.6); pdf.cell(w-7, 4.4, title)

# ===== 入力する =====
band("入力する（黄色の欄に入力・選択します）", TEAL)

col_w = (CW-4)/2
left_x = 12
right_x = 12+col_w+4
top_y = y

# STEP1 ヘッダ
step_header(left_x, col_w, "1", "3か月分の算定回数を入力")
step_header(right_x, col_w, "2", "算定パターンと対象人数を選ぶ")
y += 6.5

box_y = y
# STEP1 本文
set_fill(AMBER_BG); set_draw(AMBER_BD)
pdf.rect(left_x, box_y, col_w, 24, "DF")
set_text(GRAY); pdf.set_font("ipa", "", 8)
pdf.set_xy(left_x+2, box_y+1.5)
pdf.multi_cell(col_w-4, 3.5,
  "直近3か月分の初診料・再診料の算定回数（月ごとの合計）を黄色の欄に入力します。\n"
  "・3か月平均は自動で計算・表示されます。\n"
  "・どれか1つでも入力すると計算が始まります。\n"
  "・空欄の月は平均から除外（全部空欄なら0）。")
# STEP2 本文
set_fill(AMBER_BG); set_draw(AMBER_BD)
pdf.rect(right_x, box_y, col_w, 24, "DF")
set_text(GRAY); pdf.set_font("ipa", "", 8)
pdf.set_xy(right_x+2, box_y+1.5)
pdf.multi_cell(col_w-4, 3.5,
  "(1) 算定する評価料：「(Ⅰ)のみ」か「(Ⅰ)+(Ⅱ)」を選択。\n"
  "(2) 賃上げ区分：2026/3/31時点で届出済み（継続的賃上げ実施）か、それ以外かを選択。\n"
  "(3) 対象従業員数：医師・歯科医師を除く看護・薬剤・事務職員等の人数。空欄でも計算可（その場合「1人あたり額」のみ非表示）。")
y = box_y + 24 + 2

# STEP3
step_header(12, CW, "3", "評価料(Ⅱ)の区分を選ぶ（②で「(Ⅰ)+(Ⅱ)」を選んだ場合のみ）")
y += 6.5
set_fill(AMBER_BG); set_draw(AMBER_BD)
pdf.rect(12, y, CW, 8, "DF")
set_text(GRAY); pdf.set_font("ipa", "", 8)
pdf.set_xy(14, y+1.3)
pdf.multi_cell(CW-4, 3.5,
  "画面の区分一覧表で、算定する区分の行をクリックして選びます。選んだ区分が増収額・手当額に反映されます。\n"
  "（評価料(Ⅰ)のみを算定する場合、この操作は不要です）")
y += 10

# ===== 結果を見る =====
band("結果を見る（入力すると自動で計算されます。入力は不要です）", GREEN)
ry = y
# 結果左
set_fill(GREEN_BG); set_draw(GREEN_BD)
pdf.rect(left_x, ry, col_w, 22, "DF")
set_text(TEAL_D); pdf.set_font("ipa", "", 9)
pdf.set_xy(left_x+2, ry+1.5); pdf.cell(col_w-4, 4, "✓ 月間想定増収額")
set_text(GRAY); pdf.set_font("ipa", "", 8)
pdf.set_xy(left_x+2, ry+6)
pdf.multi_cell(col_w-4, 3.6,
  "・評価料(Ⅰ)の増収（月額）\n"
  "・評価料(Ⅱ)の増収（月額）※区分選択時\n"
  "・合計増収額（月額／年額）")
# 結果右
set_fill(GREEN_BG); set_draw(GREEN_BD)
pdf.rect(right_x, ry, col_w, 22, "DF")
set_text(TEAL_D); pdf.set_font("ipa", "", 9)
pdf.set_xy(right_x+2, ry+1.5); pdf.cell(col_w-4, 4, "✓ 手当原資／1人あたりベースアップ額")
set_text(GRAY); pdf.set_font("ipa", "", 8)
pdf.set_xy(right_x+2, ry+6)
pdf.multi_cell(col_w-4, 3.6,
  "・増収額から社会保険料の事業主負担増（約16.5%）を差し引いた手当原資（月額）\n"
  "・手当原資 ÷ 対象人数 ＝ 1人あたりベースアップ額")
y = ry + 22 + 2

# ===== 点数早見 =====
band("令和8年6月～の点数（早見）　※1点＝10円", TEAL)
ty = y
# (I)テーブル
def cell_row(x, w_cols, texts, h, fill=None, font=8, align=None):
    if fill: set_fill(fill)
    cx = x
    for i, (cw, t) in enumerate(zip(w_cols, texts)):
        set_draw(BORDER)
        pdf.rect(cx, y, cw, h, "DF" if fill else "D")
        set_text(SLATE); pdf.set_font("ipa", "", font)
        a = align[i] if align else "L"
        pdf.set_xy(cx+1, y+(h-3)/2)
        pdf.multi_cell(cw-2, 3, t, align=a)
        cx += cw

# 左：評価料(I)
lw = [col_w*0.5, col_w*0.25, col_w*0.25]
y = ty
cell_row(left_x, lw, ["評価料(Ⅰ)","初診","再診"], 5, HEAD_BG, 8, ["C","C","C"])
y += 5
cell_row(left_x, lw, ["2026/3/31届出済（継続的賃上げ実施）","23点","6点"], 7, None, 7.5, ["L","R","R"])
y += 7
cell_row(left_x, lw, ["それ以外","17点","4点"], 5, None, 7.5, ["L","R","R"])
# 右：評価料(II)
rw = [col_w*0.4, col_w*0.22, col_w*0.38]
y = ty
cell_row(right_x, rw, ["評価料(Ⅱ)","区分数","備考"], 5, HEAD_BG, 8, ["C","C","C"])
y += 5
cell_row(right_x, rw, ["継続的賃上げ実施","12区分","初診・再診に区分点数を加算"], 7, None, 7.5, ["L","R","L"])
y += 7
cell_row(right_x, rw, ["それ以外","8区分","外来延患者数に応じ選択"], 5, None, 7.5, ["L","R","L"])
y = ty + 17 + 2

# ===== 便利な機能 =====
band("便利な機能", TEAL)
feats = [
    ("クリア", "すべての入力欄を空欄に戻します。"),
    ("印刷 / PDF", "試算結果を印刷、またはPDFとして保存できます（選択した区分・選択肢のみ印刷）。"),
    ("計算の詳細を表示", "クリックで評価料(Ⅰ)(Ⅱ)の内訳と手当原資の計算過程を開閉できます。"),
    ("データの保存", "入力内容は自動でブラウザに保存され、次回開いたときに復元されます。"),
]
fw0 = col_w*0.5
for i,(k,v) in enumerate(feats):
    fill = HEAD_BG if i == -1 else None
    set_draw(BORDER)
    pdf.rect(12, y, 34, 5.5, "D")
    pdf.rect(46, y, CW-34, 5.5, "D")
    set_text(TEAL_D); pdf.set_font("ipa", "", 8)
    pdf.set_xy(13, y+1.1); pdf.cell(32, 3.2, k)
    set_text(GRAY); pdf.set_font("ipa", "", 8)
    pdf.set_xy(47, y+1.1); pdf.cell(CW-36, 3.2, v)
    y += 5.5
y += 2

# ===== 注意 =====
set_fill(NOTE_BG); set_draw(NOTE_BD)
note = ("ご利用上の注意：本ツールの試算結果は厚生労働省の告示・通知に基づく目安です。"
        "実際の届出・算定にあたっては、必ず最新の通知および地方厚生(支)局の指導内容をご確認ください。"
        "試算結果に基づく算定・経営判断について、本サイトは一切の責任を負いません。")
# 高さ計算のため一旦測定
pdf.set_font("ipa", "", 7.5)
pdf.rect(12, y, CW, 9, "DF")
set_text((120,53,15))
pdf.set_xy(14, y+1)
pdf.multi_cell(CW-4, 3.3, note)

pdf.output("/home/user/-/manual/manual.pdf")
print("OK: manual.pdf generated")
