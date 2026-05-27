// 外来・在宅ベースアップ評価料 シミュレータ（無床診療所向け）
// クライアントサイドのみで動作。入力データは外部送信しません。

const POINT_YEN = 10;

const REV1_POINTS = {
  newPatient:    6,
  repeatPatient: 2,
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
const num1 = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });

function $(id) { return document.getElementById(id); }
function radioVal(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function readInputs() {
  return {
    m1New: Math.max(0, Number($('m1-new').value || 0)),
    m1Rep: Math.max(0, Number($('m1-rep').value || 0)),
    m2New: Math.max(0, Number($('m2-new').value || 0)),
    m2Rep: Math.max(0, Number($('m2-rep').value || 0)),
    m3New: Math.max(0, Number($('m3-new').value || 0)),
    m3Rep: Math.max(0, Number($('m3-rep').value || 0)),
    revType:     radioVal('rev-type')     || '1-only',
    startTiming: radioVal('start-timing') || 'existing',
    salaryTotal: Math.max(0, Number($('salary-total').value || 0)),
    raiseRate:   Math.max(0, Number($('raise-rate').value || 0)),
    welfareRate: Math.max(0, Number($('welfare-rate').value || 0)),
    staffCount:  Math.max(1, Number($('staff-count').value || 1)),
  };
}

function calculate(input) {
  // 3か月平均
  const avgNew = (input.m1New + input.m2New + input.m3New) / 3;
  const avgRep = (input.m1Rep + input.m2Rep + input.m3Rep) / 3;

  // 評価料(Ⅰ) 月額
  const rev1NewMonthly = avgNew * REV1_POINTS.newPatient    * POINT_YEN;
  const rev1RepMonthly = avgRep * REV1_POINTS.repeatPatient * POINT_YEN;
  const rev1Monthly = rev1NewMonthly + rev1RepMonthly;
  const rev1Yearly  = rev1Monthly * 12;

  // 必要賃金改善額
  const requiredYearly  = input.salaryTotal * (input.raiseRate / 100);
  const requiredMonthly = requiredYearly / 12;

  // 月間外来延患者数
  const monthlyPatients = avgNew + avgRep;

  // (Ⅱ) 区分判定
  let tier = null;
  let rawTierPoints = 0;
  let tierPointsCeil = 0;
  let shortageMonthly = Math.max(0, requiredMonthly - rev1Monthly);

  if (input.revType === '1-and-2' && monthlyPatients > 0 && shortageMonthly > 0) {
    rawTierPoints  = shortageMonthly / (POINT_YEN * monthlyPatients);
    tierPointsCeil = Math.ceil(rawTierPoints);
    tier = REV2_TIERS.find(t => t.points >= tierPointsCeil) || null;
  }

  // 評価料(Ⅱ) 月額
  const rev2Monthly = (input.revType === '1-and-2' && tier)
    ? monthlyPatients * tier.points * POINT_YEN
    : 0;

  // 月間想定増収額（合計）
  const totalMonthly = rev1Monthly + rev2Monthly;
  const totalYearly  = totalMonthly * 12;

  // 手当原資（社保事業主負担増を控除）
  const welfareRatio = input.welfareRate / 100;
  const allowanceMonthly = totalMonthly / (1 + welfareRatio);
  const welfareCost      = totalMonthly - allowanceMonthly;
  const allowancePerStaff = allowanceMonthly / input.staffCount;

  return {
    input,
    avgNew, avgRep,
    rev1NewMonthly, rev1RepMonthly,
    rev1Monthly, rev1Yearly,
    requiredYearly, requiredMonthly,
    monthlyPatients,
    shortageMonthly,
    rawTierPoints, tierPointsCeil, tier,
    rev2Monthly,
    totalMonthly, totalYearly,
    welfareCost, allowanceMonthly, allowancePerStaff,
  };
}

function render(r) {
  // 3か月平均
  $('avg-new').textContent = num1.format(r.avgNew);
  $('avg-rep').textContent = num1.format(r.avgRep);

  // 増収額
  $('r-rev1-monthly').textContent = yen.format(Math.round(r.rev1Monthly));
  $('r-rev2-monthly').textContent = yen.format(Math.round(r.rev2Monthly));
  $('r-total-monthly').textContent = yen.format(Math.round(r.totalMonthly));
  $('r-total-yearly').textContent  = yen.format(Math.round(r.totalYearly));

  // (Ⅱ) バッジと行の表示制御
  const row2 = $('row-rev2-monthly');
  const badge = $('r-tier-badge');
  if (r.input.revType === '1-and-2') {
    row2.classList.remove('opacity-40');
    if (r.tier) {
      badge.textContent = `区分 ${r.tier.key}（${r.tier.points}点）`;
      badge.classList.remove('hidden');
    } else if (r.shortageMonthly <= 0) {
      badge.textContent = '(Ⅰ)のみで充足';
      badge.classList.remove('hidden');
    } else {
      badge.textContent = `要 ${r.tierPointsCeil}点 / 範囲外`;
      badge.classList.remove('hidden');
    }
  } else {
    row2.classList.add('opacity-40');
    badge.classList.add('hidden');
  }

  // 手当額
  $('r-allow-base').textContent  = yen.format(Math.round(r.totalMonthly));
  $('r-welfare').textContent     = '− ' + yen.format(Math.round(r.welfareCost));
  $('r-allowance').textContent   = yen.format(Math.round(r.allowanceMonthly));
  $('r-allowance-per').textContent = yen.format(Math.round(r.allowancePerStaff)) + ' / 月';

  // (Ⅰ) 内訳
  const rows = [
    ['初診', REV1_POINTS.newPatient,    r.avgNew, r.rev1NewMonthly],
    ['再診', REV1_POINTS.repeatPatient, r.avgRep, r.rev1RepMonthly],
  ];
  $('rev1-breakdown').innerHTML = rows.map(([label, pt, cnt, monthly]) => `
    <tr>
      <td class="px-3 py-2">${label}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${pt}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num1.format(cnt)}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(monthly))}</td>
    </tr>
  `).join('') + `
    <tr class="bg-slate-50 font-medium">
      <td class="px-3 py-2" colspan="3">月額合計</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(r.rev1Monthly))}</td>
    </tr>`;

  // (Ⅱ) 計算過程
  const stepsEl = $('rev2-steps');
  if (r.input.revType !== '1-and-2') {
    stepsEl.innerHTML = '<li class="text-slate-400">「評価料(Ⅰ) + (Ⅱ)」を選択するとここに表示されます</li>';
  } else if (r.monthlyPatients === 0) {
    stepsEl.innerHTML = '<li class="text-slate-400">月間延患者数が0のため判定できません</li>';
  } else {
    const tierLabel = r.tier
      ? `${r.tier.key}（${r.tier.points}点）`
      : (r.shortageMonthly <= 0 ? '不要（(Ⅰ)のみで充足）' : '範囲外（要 ' + r.tierPointsCeil + '点超）');
    const steps = [
      `必要賃金改善額（月額）：${num.format(r.input.salaryTotal)} 円 × ${r.input.raiseRate}% ÷ 12 = <span class="font-mono">${num.format(Math.round(r.requiredMonthly))} 円</span>`,
      `評価料(Ⅰ) 月額：<span class="font-mono">${num.format(Math.round(r.rev1Monthly))} 円</span>`,
      `不足額（月額）：<span class="font-mono">${num.format(Math.round(r.shortageMonthly))} 円</span>`,
      `月間外来延患者数：${num1.format(r.avgNew)} + ${num1.format(r.avgRep)} = <span class="font-mono">${num1.format(r.monthlyPatients)} 人</span>`,
      `1患者あたり必要点数：${num.format(Math.round(r.shortageMonthly))} ÷ (10 × ${num1.format(r.monthlyPatients)}) = <span class="font-mono">${r.rawTierPoints.toFixed(3)} 点</span>`,
      `小数点以下切り上げ：<span class="font-mono">${r.tierPointsCeil} 点</span> → 該当区分：<span class="font-mono font-semibold text-brand-700">${tierLabel}</span>`,
    ];
    stepsEl.innerHTML = steps.map((s, i) => `
      <li class="flex gap-2">
        <span class="mt-0.5 grid h-5 w-5 flex-none place-content-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800">${i + 1}</span>
        <span>${s}</span>
      </li>
    `).join('');
  }
}

function onCalc() {
  const input = readInputs();
  const result = calculate(input);
  render(result);
  if (window.innerWidth < 1024) {
    $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function onReset() {
  setTimeout(() => {
    onCalc();
  }, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  $('calc-btn').addEventListener('click', onCalc);
  $('reset-btn').addEventListener('click', onReset);
  $('print-btn').addEventListener('click', () => window.print());

  // 入力変更で即時再計算
  document.getElementById('sim-form').addEventListener('input', onCalc);
  document.getElementById('sim-form').addEventListener('change', onCalc);
  $('staff-count').addEventListener('input', onCalc);

  // Enterで再計算
  $('sim-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      onCalc();
    }
  });

  // 初期表示
  onCalc();
});
