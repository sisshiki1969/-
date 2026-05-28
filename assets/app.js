// 外来・在宅ベースアップ評価料 シミュレータ（無床診療所、令和8年度改定対応）
// クライアントサイドのみで動作。入力データは外部送信しません。

const POINT_YEN = 10;
const WELFARE_RATIO = 0.165; // 法定福利費 事業主負担（健保・厚年・労災・子育拠出金等の概算）

// 評価料(Ⅰ) 点数表（令和8年6月～、賃上げ区分別）
const REV1_POINTS_TABLE = {
  standard:   { new: 17, rep: 4 },
  continuous: { new: 23, rep: 6 },
};

// 評価料(Ⅱ) 区分表（無床診療所）
const REV2_TIERS = {
  standard: [
    { id: 1, key: '区分1', new: 8,  rep: 1 },
    { id: 2, key: '区分2', new: 16, rep: 2 },
    { id: 3, key: '区分3', new: 24, rep: 3 },
    { id: 4, key: '区分4', new: 32, rep: 4 },
    { id: 5, key: '区分5', new: 40, rep: 5 },
    { id: 6, key: '区分6', new: 48, rep: 6 },
    { id: 7, key: '区分7', new: 56, rep: 7 },
    { id: 8, key: '区分8', new: 64, rep: 8 },
  ],
  continuous: [
    { id: 1,  key: '区分1',  new: 16,  rep: 2  },
    { id: 2,  key: '区分2',  new: 24,  rep: 3  },
    { id: 3,  key: '区分3',  new: 40,  rep: 5  },
    { id: 4,  key: '区分4',  new: 56,  rep: 7  },
    { id: 5,  key: '区分5',  new: 64,  rep: 8  },
    { id: 6,  key: '区分6',  new: 80,  rep: 10 },
    { id: 7,  key: '区分7',  new: 96,  rep: 12 },
    { id: 8,  key: '区分8',  new: 104, rep: 13 },
    { id: 9,  key: '区分9',  new: 120, rep: 15 },
    { id: 10, key: '区分10', new: 136, rep: 17 },
    { id: 11, key: '区分11', new: 144, rep: 18 },
    { id: 12, key: '区分12', new: 160, rep: 20 },
  ],
};

const yen  = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
const num  = new Intl.NumberFormat('ja-JP');
const num1 = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });

// 状態：手動選択された(Ⅱ)区分ID（nullなら未選択＝(Ⅱ)算定しない）
let selectedTierId = null;

const STORAGE_KEY = 'baseup-simulator-v1';

const PERSIST_NUMBER_IDS = ['m1-new', 'm1-rep', 'm2-new', 'm2-rep', 'm3-new', 'm3-rep', 'staff-count'];
const PERSIST_RADIO_NAMES = ['rev-type', 'raise-type'];

function saveState() {
  const data = { nums: {}, radios: {}, tierId: selectedTierId };
  PERSIST_NUMBER_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) data.nums[id] = el.value;
  });
  PERSIST_RADIO_NAMES.forEach(name => {
    const v = radioVal(name);
    if (v != null) data.radios[name] = v;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

function loadState() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { data = null; }
  if (!data) return;
  if (data.nums) {
    Object.entries(data.nums).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el && v != null && v !== '') el.value = v;
    });
  }
  if (data.radios) {
    Object.entries(data.radios).forEach(([name, v]) => {
      const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
      if (el) el.checked = true;
    });
  }
  if (typeof data.tierId === 'number') {
    selectedTierId = data.tierId;
  }
}

function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

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
    revType:   radioVal('rev-type')   || '1-only',
    raiseType: radioVal('raise-type') || 'standard',
    staffCount:  Math.max(1, Number($('staff-count').value || 1)),
  };
}

function getRev1Points(input) {
  return REV1_POINTS_TABLE[input.raiseType];
}

function getRev2Tiers(input) {
  return input.raiseType === 'continuous' ? REV2_TIERS.continuous : REV2_TIERS.standard;
}

function calculate(input) {
  // 3か月平均
  const avgNew = (input.m1New + input.m2New + input.m3New) / 3;
  const avgRep = (input.m1Rep + input.m2Rep + input.m3Rep) / 3;

  // (Ⅰ) 月額
  const pt1 = getRev1Points(input);
  const rev1NewMonthly = avgNew * pt1.new * POINT_YEN;
  const rev1RepMonthly = avgRep * pt1.rep * POINT_YEN;
  const rev1Monthly = rev1NewMonthly + rev1RepMonthly;

  // (Ⅱ) 各区分の試算
  const tiers = getRev2Tiers(input);
  const tierEvals = tiers.map(t => {
    const monthly = (avgNew * t.new + avgRep * t.rep) * POINT_YEN;
    return { ...t, monthly };
  });

  // ユーザー選択した区分（(Ⅰ)+(Ⅱ)選択時のみ有効）
  let useTier = null;
  if (input.revType === '1-and-2' && selectedTierId !== null) {
    useTier = tierEvals.find(t => t.id === selectedTierId) || null;
  }

  const rev2Monthly = useTier ? useTier.monthly : 0;

  // 合計
  const totalMonthly = rev1Monthly + rev2Monthly;
  const totalYearly  = totalMonthly * 12;

  // 手当原資（社保事業主負担増を控除）
  const allowanceMonthly = totalMonthly / (1 + WELFARE_RATIO);
  const welfareCost      = totalMonthly - allowanceMonthly;
  const allowancePerStaff = allowanceMonthly / input.staffCount;

  return {
    input, avgNew, avgRep,
    pt1, tiers, tierEvals, useTier,
    rev1NewMonthly, rev1RepMonthly, rev1Monthly,
    rev2Monthly,
    totalMonthly, totalYearly,
    welfareCost, allowanceMonthly, allowancePerStaff,
  };
}

function renderTierTable(r) {
  const wrap = $('tier-table-wrap');
  const section = $('tier-selector');
  const enabled = r.input.revType === '1-and-2';

  // (Ⅰ)のみのときは区分選択セクションを印刷対象から除外
  section.classList.toggle('no-print', !enabled);

  if (!enabled) {
    wrap.innerHTML = `<div class="rounded-md bg-slate-50 p-4 text-center text-sm text-slate-500">
      「評価料(Ⅰ) + (Ⅱ) を算定」を選択すると、区分を選択できます。
    </div>`;
    return;
  }

  const rows = r.tierEvals.map(t => {
    const isSelected = r.useTier && r.useTier.id === t.id;
    const rowCls = isSelected
      ? 'tier-row-selected bg-brand-100 ring-2 ring-brand-600'
      : 'bg-white hover:bg-slate-50';
    const yearly = t.monthly * 12;

    return `<tr data-tier-id="${t.id}" class="cursor-pointer ${rowCls} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        ${isSelected ? '<span class="mr-1 text-brand-700">●</span>' : '<span class="mr-1 text-slate-300">○</span>'}
        ${t.key}
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${t.new}点</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${t.rep}点</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${num.format(Math.round(t.monthly))}</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-500">${num.format(Math.round(yearly))}</td>
    </tr>`;
  }).join('');

  const clearRow = `
    <tr data-tier-id="0" class="cursor-pointer transition ${r.useTier ? 'bg-white hover:bg-slate-50' : 'tier-row-selected bg-brand-100 ring-2 ring-brand-600'}">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        ${!r.useTier ? '<span class="mr-1 text-brand-700">●</span>' : '<span class="mr-1 text-slate-300">○</span>'}
        (Ⅱ) を算定しない
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">―</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">―</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">0</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">0</td>
    </tr>`;

  wrap.innerHTML = `
    <table class="w-full min-w-[600px] border-separate border-spacing-0 text-sm">
      <thead>
        <tr class="text-xs text-slate-500">
          <th class="rounded-tl-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium">区分</th>
          <th class="border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">初診点数</th>
          <th class="border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">再診点数</th>
          <th class="border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">(Ⅱ)月額(円)</th>
          <th class="rounded-tr-lg border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">(Ⅱ)年額(円)</th>
        </tr>
      </thead>
      <tbody>${clearRow}${rows}</tbody>
    </table>`;

  wrap.querySelectorAll('tr[data-tier-id]').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = Number(tr.dataset.tierId);
      selectedTierId = id === 0 ? null : id;
      onCalc();
    });
  });
}

function buildFormula(pt1, pt2, tierKey) {
  const pt1Span = `<span class="text-base font-bold text-slate-900">${pt1}</span><span class="text-xs text-slate-500">点（Ⅰ）</span>`;
  if (pt2 == null) {
    return `${pt1Span} <span class="text-slate-400">＝</span> <span class="text-lg font-bold text-emerald-700">${pt1}</span><span class="text-xs text-slate-500">点</span>`;
  }
  const pt2Span = `<span class="text-base font-bold text-brand-700">${pt2}</span><span class="text-xs text-slate-500">点（Ⅱ ${tierKey}）</span>`;
  const total = pt1 + pt2;
  return `${pt1Span} <span class="text-slate-400">＋</span> ${pt2Span} <span class="text-slate-400">＝</span> <span class="text-lg font-bold text-emerald-700">${total}</span><span class="text-xs text-slate-500">点</span>`;
}

function render(r) {
  // 3か月平均
  $('avg-new').textContent = num1.format(r.avgNew);
  $('avg-rep').textContent = num1.format(r.avgRep);

  // 適用点数（式形式）
  $('r-formula-new').innerHTML = buildFormula(r.pt1.new, r.useTier ? r.useTier.new : null, r.useTier ? r.useTier.key : null);
  $('r-formula-rep').innerHTML = buildFormula(r.pt1.rep, r.useTier ? r.useTier.rep : null, r.useTier ? r.useTier.key : null);
  $('r-formula-new').classList.remove('text-slate-400');
  $('r-formula-rep').classList.remove('text-slate-400');

  // 増収額
  $('r-rev1-monthly').textContent = yen.format(Math.round(r.rev1Monthly));
  $('r-rev2-monthly').textContent = yen.format(Math.round(r.rev2Monthly));
  $('r-total-monthly').textContent = yen.format(Math.round(r.totalMonthly));
  $('r-total-yearly').textContent  = yen.format(Math.round(r.totalYearly));

  const row2 = $('row-rev2-monthly');
  if (r.input.revType === '1-and-2') row2.classList.remove('opacity-40');
  else row2.classList.add('opacity-40');

  // 手当額
  $('r-allow-base').textContent  = yen.format(Math.round(r.totalMonthly));
  $('r-welfare').textContent     = '− ' + yen.format(Math.round(r.welfareCost));
  $('r-allowance').textContent   = yen.format(Math.round(r.allowanceMonthly));
  $('r-allowance-yearly').textContent = yen.format(Math.round(r.allowanceMonthly * 12));
  $('r-allowance-per').textContent = yen.format(Math.round(r.allowancePerStaff));
  $('r-allowance-per-yearly').textContent = yen.format(Math.round(r.allowancePerStaff * 12));
  $('r-staff-display').textContent = num.format(r.input.staffCount);

  // (Ⅰ) 内訳
  const rows = [
    ['初診', r.pt1.new, r.avgNew, r.rev1NewMonthly],
    ['再診', r.pt1.rep, r.avgRep, r.rev1RepMonthly],
  ];
  $('rev1-breakdown').innerHTML = rows.map(([label, pt, cnt, monthly]) => `
    <tr>
      <td class="px-3 py-2">${label}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${pt}点</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num1.format(cnt)}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(monthly))}</td>
    </tr>
  `).join('') + `
    <tr class="bg-slate-50 font-medium">
      <td class="px-3 py-2" colspan="3">月額合計</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(r.rev1Monthly))}</td>
    </tr>`;

  // (Ⅱ) 内訳
  const tierLabelEl = $('rev2-tier-label');
  const rev2Body    = $('rev2-breakdown');
  $('rev2-card').classList.toggle('no-print', !r.useTier);
  if (r.useTier) {
    tierLabelEl.textContent = `／ ${r.useTier.key}`;
    const r2NewMonthly = r.avgNew * r.useTier.new * POINT_YEN;
    const r2RepMonthly = r.avgRep * r.useTier.rep * POINT_YEN;
    const r2Rows = [
      ['初診', r.useTier.new, r.avgNew, r2NewMonthly],
      ['再診', r.useTier.rep, r.avgRep, r2RepMonthly],
    ];
    rev2Body.innerHTML = r2Rows.map(([label, pt, cnt, monthly]) => `
      <tr>
        <td class="px-3 py-2">${label}</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${pt}点</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${num1.format(cnt)}</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(monthly))}</td>
      </tr>
    `).join('') + `
      <tr class="bg-slate-50 font-medium">
        <td class="px-3 py-2" colspan="3">月額合計</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(r.rev2Monthly))}</td>
      </tr>`;
  } else {
    tierLabelEl.textContent = '';
    const msg = r.input.revType === '1-and-2'
      ? '左の区分テーブルから区分を選択してください'
      : '「(Ⅰ)+(Ⅱ)を算定」を選択し区分を選ぶと表示されます';
    rev2Body.innerHTML = `<tr><td class="px-3 py-2" colspan="4"><span class="text-slate-400">${msg}</span></td></tr>`;
  }

  // 手当原資計算過程
  const steps = [
    `月間想定増収額 (Ⅰ+Ⅱ)：<span class="font-mono">${num.format(Math.round(r.totalMonthly))} 円</span>`,
    `事業主負担の社会保険料増（16.5%）：<span class="font-mono">${num.format(Math.round(r.welfareCost))} 円</span>`,
    `手当原資（月額）：${num.format(Math.round(r.totalMonthly))} ÷ 1.165 ＝ <span class="font-mono font-semibold text-emerald-700">${num.format(Math.round(r.allowanceMonthly))} 円</span>`,
    `1人あたりベースアップ額（月額）：${num.format(Math.round(r.allowanceMonthly))} ÷ ${r.input.staffCount} 人 ＝ <span class="font-mono font-semibold text-emerald-700">${num.format(Math.round(r.allowancePerStaff))} 円/月</span>`,
  ];
  $('allow-steps').innerHTML = steps.map((s, i) => `
    <li class="flex gap-2">
      <span class="mt-0.5 grid h-5 w-5 flex-none place-content-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800">${i + 1}</span>
      <span>${s}</span>
    </li>`).join('');

  renderTierTable(r);
}

function onCalc() {
  const input = readInputs();
  const result = calculate(input);
  render(result);
  saveState();
}

function onReset() {
  selectedTierId = null;
  clearState();
  // type="reset" でフォームがデフォルト値に戻るのを待ってから再計算
  setTimeout(() => onCalc(), 0);
}

document.addEventListener('DOMContentLoaded', () => {
  $('calc-btn').addEventListener('click', onCalc);
  $('reset-btn').addEventListener('click', onReset);
  $('print-btn').addEventListener('click', () => window.print());

  // 数値入力欄ごとに input/change を直接リッスン
  ['m1-new', 'm1-rep', 'm2-new', 'm2-rep', 'm3-new', 'm3-rep', 'staff-count'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input',  onCalc);
    el.addEventListener('change', onCalc);
  });

  // ラジオ変更時は手動選択をクリアして再計算
  document.querySelectorAll('input[name="rev-type"], input[name="raise-type"]')
    .forEach(el => el.addEventListener('change', () => { selectedTierId = null; onCalc(); }));

  // Enterで再計算
  $('sim-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      onCalc();
    }
  });

  loadState();
  onCalc();
});
