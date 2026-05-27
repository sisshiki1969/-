// 外来・在宅ベースアップ評価料 シミュレータ
// クライアントサイドのみで動作。入力データは外部送信しません。

const POINT_YEN = 10; // 1点=10円

// 評価料(Ⅰ) の点数
const REV1_POINTS = {
  newPatient:      6,   // 初診
  repeatPatient:   2,   // 再診
  homeVisitSingle: 28,  // 訪問診療料Ⅰ・1（同一建物居住者以外）
  homeVisitGroup:  7,   // 訪問診療料Ⅰ・2 等（同一建物居住者）
};

// 評価料(Ⅱ) 区分定義（医科診療所：イ〜チ）
const REV2_TIERS = [
  { key: 'イ', points: 1 },
  { key: 'ロ', points: 2 },
  { key: 'ハ', points: 3 },
  { key: 'ニ', points: 4 },
  { key: 'ホ', points: 5 },
  { key: 'ヘ', points: 6 },
  { key: 'ト', points: 7 },
  { key: 'チ', points: 8 },
];

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('ja-JP');

function $(id) { return document.getElementById(id); }

function readInputs() {
  return {
    facility:        $('facility-type').value,
    daysPerMonth:    Math.max(0, Number($('days-per-month').value || 0)),
    newPatients:     Math.max(0, Number($('new-patients').value || 0)),
    repeatPatients:  Math.max(0, Number($('repeat-patients').value || 0)),
    homeVisitSingle: Math.max(0, Number($('home-visit-single').value || 0)),
    homeVisitGroup:  Math.max(0, Number($('home-visit-group').value || 0)),
    salaryTotal:     Math.max(0, Number($('salary-total').value || 0)),
    raiseRatePct:    Math.max(0, Number($('raise-rate').value || 0)),
  };
}

function calculate(input) {
  const days = input.daysPerMonth;

  // 月間回数
  const monthlyCounts = {
    newPatient:      input.newPatients     * days,
    repeatPatient:   input.repeatPatients  * days,
    homeVisitSingle: input.homeVisitSingle * days,
    homeVisitGroup:  input.homeVisitGroup  * days,
  };

  // (Ⅰ) 年額算定額
  const rev1Yearly = {
    newPatient:      monthlyCounts.newPatient      * REV1_POINTS.newPatient      * POINT_YEN * 12,
    repeatPatient:   monthlyCounts.repeatPatient   * REV1_POINTS.repeatPatient   * POINT_YEN * 12,
    homeVisitSingle: monthlyCounts.homeVisitSingle * REV1_POINTS.homeVisitSingle * POINT_YEN * 12,
    homeVisitGroup:  monthlyCounts.homeVisitGroup  * REV1_POINTS.homeVisitGroup  * POINT_YEN * 12,
  };
  const rev1Total = Object.values(rev1Yearly).reduce((a, b) => a + b, 0);

  // 必要賃金改善額（年額）
  const required = input.salaryTotal * (input.raiseRatePct / 100);

  // 不足額
  const shortage = Math.max(0, required - rev1Total);

  // (Ⅱ) 区分判定
  // 月間外来在宅患者延数：(Ⅰ)算定対象の月間回数合計
  const monthlyPatients =
    monthlyCounts.newPatient +
    monthlyCounts.repeatPatient +
    monthlyCounts.homeVisitSingle +
    monthlyCounts.homeVisitGroup;

  // 判定式: 8 × (必要額 − (Ⅰ)算定額) / (10 × 月間延患者数 × 8)
  // → 月額不足を 1患者あたり点数に換算（年→月への変換は12で割る）
  // 必要額・(Ⅰ)算定額が年額なので、月額換算してから比較
  const requiredMonthly = required / 12;
  const rev1Monthly = rev1Total / 12;
  const shortageMonthly = Math.max(0, requiredMonthly - rev1Monthly);

  let rawTierPoints = 0;
  if (monthlyPatients > 0 && shortageMonthly > 0) {
    // 1患者あたり必要追加点数 = 不足額(月) / (10円 × 月間延患者数)
    rawTierPoints = shortageMonthly / (POINT_YEN * monthlyPatients);
  }
  const tierPointsCeil = Math.ceil(rawTierPoints);
  const tier = REV2_TIERS.find(t => t.points >= tierPointsCeil) || null;

  // (Ⅱ) 年額収入
  const rev2Yearly = tier
    ? monthlyPatients * tier.points * POINT_YEN * 12
    : 0;

  const totalYearly = rev1Total + rev2Yearly;
  const diff = totalYearly - required;

  return {
    input,
    monthlyCounts,
    monthlyPatients,
    rev1Yearly,
    rev1Total,
    required,
    requiredMonthly,
    rev1Monthly,
    shortage,
    shortageMonthly,
    rawTierPoints,
    tierPointsCeil,
    tier,
    rev2Yearly,
    totalYearly,
    diff,
  };
}

function render(result) {
  // サマリー
  $('r-required').textContent = yen.format(result.required);
  $('r-rev1').textContent     = yen.format(result.rev1Total);
  $('r-shortage').textContent = yen.format(result.shortage);
  $('r-rev-total').textContent = yen.format(result.totalYearly);

  const diffEl = $('r-diff');
  diffEl.textContent = (result.diff >= 0 ? '+ ' : '− ') + yen.format(Math.abs(result.diff));
  diffEl.classList.remove('text-emerald-600', 'text-rose-600', 'text-slate-900');
  diffEl.classList.add(result.diff >= 0 ? 'text-emerald-600' : 'text-rose-600');

  // 区分
  if (result.tier) {
    $('r-tier-label').textContent  = result.tier.key;
    $('r-tier-points').textContent = `（${result.tier.points}点/人）`;
    $('r-tier-note').textContent   = result.diff >= 0
      ? `この区分で算定すると、必要賃金改善額を充足できる見込みです。`
      : `この区分でも年額 ${yen.format(Math.abs(result.diff))} 不足する見込みです。患者数・対象職員給与・改善率の見直しをご検討ください。`;
  } else if (result.shortageMonthly <= 0) {
    $('r-tier-label').textContent  = '不要';
    $('r-tier-points').textContent = `（(Ⅰ)のみで充足）`;
    $('r-tier-note').textContent   = '評価料(Ⅰ)の算定額が必要賃金改善額を上回るため、(Ⅱ)算定は必要ありません。';
  } else {
    $('r-tier-label').textContent  = '範囲外';
    $('r-tier-points').textContent = `（要 ${result.tierPointsCeil}点超）`;
    $('r-tier-note').textContent   = `必要な区分点数（${result.tierPointsCeil}点）が最大区分「チ（8点）」を超過しています。賃金改善目標率・対象職員給与の見直しが必要です。`;
  }

  $('result-status').textContent = '試算済み';
  $('result-status').className = 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700';

  // (Ⅰ)内訳テーブル
  const rows = [
    ['初診', REV1_POINTS.newPatient,      result.monthlyCounts.newPatient,      result.rev1Yearly.newPatient],
    ['再診', REV1_POINTS.repeatPatient,   result.monthlyCounts.repeatPatient,   result.rev1Yearly.repeatPatient],
    ['訪問診療料Ⅰ・1', REV1_POINTS.homeVisitSingle, result.monthlyCounts.homeVisitSingle, result.rev1Yearly.homeVisitSingle],
    ['訪問診療料Ⅰ・2 等', REV1_POINTS.homeVisitGroup, result.monthlyCounts.homeVisitGroup,  result.rev1Yearly.homeVisitGroup],
  ];

  $('rev1-breakdown').innerHTML = rows.map(([label, pt, cnt, yearly]) => `
    <tr>
      <td class="px-3 py-2">${label}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${pt}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(cnt)}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(yearly)}</td>
    </tr>
  `).join('') + `
    <tr class="bg-slate-50 font-medium">
      <td class="px-3 py-2" colspan="3">合計（(Ⅰ)年額）</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(result.rev1Total)}</td>
    </tr>`;

  // (Ⅱ) 計算過程
  const steps = [
    `必要賃金改善額（月額）：${num.format(result.input.salaryTotal)} 円 × ${result.input.raiseRatePct}% ÷ 12 = <span class="font-mono">${num.format(Math.round(result.requiredMonthly))} 円</span>`,
    `評価料(Ⅰ) 月額算定額：<span class="font-mono">${num.format(Math.round(result.rev1Monthly))} 円</span>`,
    `不足額（月額）：${num.format(Math.round(result.requiredMonthly))} − ${num.format(Math.round(result.rev1Monthly))} = <span class="font-mono">${num.format(Math.round(result.shortageMonthly))} 円</span>`,
    `月間外来・在宅延患者数：<span class="font-mono">${num.format(result.monthlyPatients)} 人</span>`,
    `1患者あたり必要点数：${num.format(Math.round(result.shortageMonthly))} ÷ (10 × ${num.format(result.monthlyPatients)}) = <span class="font-mono">${result.rawTierPoints.toFixed(3)} 点</span>`,
    `小数点以下切り上げ：<span class="font-mono">${result.tierPointsCeil} 点</span> → 該当区分：<span class="font-mono font-semibold text-brand-700">${result.tier ? result.tier.key + '（' + result.tier.points + '点）' : '対象なし'}</span>`,
  ];
  $('rev2-steps').innerHTML = steps.map((s, i) => `
    <li class="flex gap-2">
      <span class="mt-0.5 grid h-5 w-5 flex-none place-content-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800">${i + 1}</span>
      <span>${s}</span>
    </li>
  `).join('');
}

function onCalc() {
  const input = readInputs();
  const result = calculate(input);
  render(result);
  // 結果へスクロール（モバイル時のみ）
  if (window.innerWidth < 1024) {
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function onReset() {
  // フォームリセット後に表示初期化
  setTimeout(() => {
    ['r-required', 'r-rev1', 'r-shortage', 'r-rev-total'].forEach(id => $(id).textContent = '― 円');
    $('r-diff').textContent = '― 円';
    $('r-diff').className = 'font-mono text-base font-semibold tabular-nums';
    $('r-tier-label').textContent = '―';
    $('r-tier-points').textContent = '―';
    $('r-tier-note').textContent = '入力後「試算する」を押してください。';
    $('result-status').textContent = '未計算';
    $('result-status').className = 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600';
    $('rev1-breakdown').innerHTML = '<tr><td class="px-3 py-2" colspan="4"><span class="text-slate-400">試算後に表示されます</span></td></tr>';
    $('rev2-steps').innerHTML = '<li class="text-slate-400">試算後に表示されます</li>';
  }, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  $('calc-btn').addEventListener('click', onCalc);
  $('reset-btn').addEventListener('click', onReset);
  $('print-btn').addEventListener('click', () => window.print());

  // 入力欄でEnterキー押下時も計算
  $('sim-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      onCalc();
    }
  });

  // 初回表示で計算実行（デフォルト値で結果を見せる）
  onCalc();
});
