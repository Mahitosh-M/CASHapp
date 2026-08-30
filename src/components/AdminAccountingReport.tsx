import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Combine,
  PackagePlus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCashHistoryMonth, getFriendlyCashError, getShopCash } from '../services/cashService';
import type { ShopId } from '../types';
import {
  buildCashAccountingReport,
  buildCashFlowAllocations,
  type CashAccountingReport
} from '../utils/accounting';
import { formatMoney } from '../utils/cash';
import { getHistoryMonth, getHistoryMonthBounds, getHistoryMonthKey, getHistoryMonthLabel } from '../utils/historyMonths';
import { SHOP_OPTIONS, getShopName } from '../utils/shops';
import { ExpenseCategoryIcon } from './ExpenseCategoryIcon';

const currentMonth = getHistoryMonth(new Date());
const currentMonthKey = getHistoryMonthKey(currentMonth);
const currentYear = currentMonth.year;
type ReportPeriod = 'month' | 'year';
type ReportStatement = 'profit-loss' | 'cash-flow';

const CASH_FLOW_COLORS: Record<string, string> = {
  purchases: '#d8a2dc',
  emi: '#f472b6',
  salary: '#4ade80',
  fuel: '#facc15',
  electricity: '#60a5fa',
  rent: '#c084fc',
  transport: '#fb7185',
  supplies: '#2dd4bf',
  taxes: '#fb923c',
  other: '#94a3b8',
  'transfers-out': '#38bdf8',
  'adjustments-out': '#ef4444'
};

const parseMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12
    ? { year, month: month - 1 }
    : currentMonth;
};

export const AdminAccountingReport = ({ shopId, availableBalance }: { shopId: ShopId; availableBalance: number }) => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [statement, setStatement] = useState<ReportStatement>('cash-flow');
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [year, setYear] = useState(currentYear);
  const [combined, setCombined] = useState(false);
  const [report, setReport] = useState<CashAccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const reportMonth = useMemo(() => parseMonthKey(monthKey), [monthKey]);
  const reportRange = useMemo(() => period === 'month'
    ? { ...getHistoryMonthBounds(reportMonth), label: getHistoryMonthLabel(reportMonth) }
    : {
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1),
        label: `${year} FULL YEAR`
      }, [period, reportMonth, year]);
  const yearOptions = useMemo(
    () => Array.from({ length: 10 }, (_, index) => currentYear - index),
    []
  );
  const reportShopIds = useMemo<ShopId[]>(
    () => combined ? SHOP_OPTIONS.map((shop) => shop.id) : [shopId],
    [combined, shopId]
  );

  const loadReport = useCallback(async () => {
    const { start, end } = reportRange;
    const [historyGroups, summaries] = await Promise.all([
      Promise.all(reportShopIds.map((reportShopId) => getCashHistoryMonth(reportShopId, start, end))),
      combined ? Promise.all(reportShopIds.map((reportShopId) => getShopCash(reportShopId))) : Promise.resolve([])
    ]);
    const history = historyGroups.flat();
    const collections = history.filter((item) => item.kind === 'collection');
    const expenses = history.filter((item) => item.kind === 'expense');
    const reportBalance = combined
      ? summaries.reduce((total, summary) => total + (summary?.availableBalance ?? 0), 0)
      : availableBalance;
    return buildCashAccountingReport(collections, expenses, reportBalance, history, { excludeTransfers: combined });
  }, [availableBalance, combined, reportRange, reportShopIds]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    void loadReport()
      .then((nextReport) => {
        if (active) setReport(nextReport);
      })
      .catch((loadError) => {
        if (active) {
          setReport(null);
          setError(getFriendlyCashError(loadError, 'history'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadReport, reloadToken]);

  const visibleCategories = report?.expenseCategories.filter((category) => category.amount > 0) ?? [];
  const cashFlowAllocations = useMemo(
    () => report ? buildCashFlowAllocations(report) : [],
    [report]
  );
  const cashFlowGradient = useMemo(() => {
    if (!report || report.cashOutflows <= 0 || cashFlowAllocations.length === 0) return '#263246';
    let offset = 0;
    const stops = cashFlowAllocations.map((allocation) => {
      const start = offset;
      offset += (allocation.amount / report.cashOutflows) * 100;
      return `${CASH_FLOW_COLORS[allocation.key] ?? '#94a3b8'} ${start}% ${offset}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [cashFlowAllocations, report]);

  return (
    <div className="accounting-report">
      <div className="admin-report-period-tabs" role="group" aria-label="Report period">
        <button type="button" className={period === 'month' ? 'selected' : ''} onClick={() => setPeriod('month')}>Month</button>
        <button type="button" className={period === 'year' ? 'selected' : ''} onClick={() => setPeriod('year')}>Year</button>
      </div>
      <div className="admin-report-toolbar">
        <label>
          <CalendarDays size={18} />
          <span>{period === 'month' ? 'Month' : 'Year'}</span>
          {period === 'month' ? (
            <input type="month" value={monthKey} max={currentMonthKey} onChange={(event) => setMonthKey(event.target.value)} />
          ) : (
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          )}
        </label>
        <button className="icon-button" type="button" onClick={() => setReloadToken((current) => current + 1)} disabled={loading} title="Refresh report" aria-label="Refresh report">
          <RefreshCw size={19} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <button
        className={`combined-report-button ${combined ? 'selected' : ''}`}
        type="button"
        aria-pressed={combined}
        onClick={() => setCombined((current) => !current)}
      >
        <Combine size={19} /> Combined Report
      </button>

      <div className="admin-report-statement-tabs" role="group" aria-label="Accounting statement">
        <button type="button" className={statement === 'profit-loss' ? 'selected' : ''} onClick={() => setStatement('profit-loss')}>P&amp;L</button>
        <button type="button" className={statement === 'cash-flow' ? 'selected' : ''} onClick={() => setStatement('cash-flow')}>CASH FLOW ANALYSIS</button>
      </div>

      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {loading ? <div className="accounting-loading">Loading accounting report...</div> : null}

      {!loading && report && statement === 'profit-loss' ? (
        <>
          <section className="accounting-section" aria-labelledby="cash-pl-title">
            <div className="accounting-section-heading">
              <div className="accounting-heading-icon"><TrendingUp size={21} /></div>
              <div>
                <h2 id="cash-pl-title">P&amp;L Statement</h2>
                <span>{reportRange.label} / {combined ? 'ASHOKA + SMPA' : getShopName(shopId)}</span>
              </div>
            </div>
            <div className="accounting-kpi-grid">
              <div className="accounting-kpi income">
                <TrendingUp size={19} />
                <span>Collections</span>
                <strong>{formatMoney(report.collections)}</strong>
              </div>
              <div className="accounting-kpi purchases">
                <PackagePlus size={19} />
                <span>Purchases (COGS)</span>
                <strong>{formatMoney(report.purchases)}</strong>
              </div>
              <div className={`accounting-kpi gross ${report.grossProfit < 0 ? 'negative' : ''}`}>
                <TrendingUp size={19} />
                <span>Gross Profit</span>
                <strong>{formatMoney(report.grossProfit)}</strong>
              </div>
              <div className="accounting-kpi expense">
                <TrendingDown size={19} />
                <span>Operating Expenses</span>
                <strong>{formatMoney(report.operatingExpenses)}</strong>
              </div>
              <div className={`accounting-kpi net ${report.netCashResult < 0 ? 'negative' : ''}`}>
                <Scale size={19} />
                <span>Net Operating Result</span>
                <strong>{formatMoney(report.netCashResult)}</strong>
              </div>
            </div>
          </section>

          <section className="accounting-section" aria-labelledby="expense-breakdown-title">
            <div className="accounting-section-heading compact">
              <div>
                <h2 id="expense-breakdown-title">Expenses by Category</h2>
                <span>{visibleCategories.reduce((total, category) => total + category.count, 0)} Entries</span>
              </div>
            </div>
            {visibleCategories.length === 0 ? (
              <div className="accounting-empty">No Operating Expenses Recorded for This Period.</div>
            ) : (
              <div className="expense-analysis-list">
                {visibleCategories.map((category) => {
                  const share = report.operatingExpenses > 0 ? Math.round((category.amount / report.operatingExpenses) * 100) : 0;
                  return (
                    <div className="expense-analysis-row" key={category.category}>
                      <div className="expense-analysis-icon"><ExpenseCategoryIcon category={category.category} size={20} /></div>
                      <div className="expense-analysis-copy">
                        <div><strong>{category.label}</strong><span>{share}%</span></div>
                        <div className="expense-share-track"><span style={{ width: `${share}%` }} /></div>
                      </div>
                      <strong className="expense-analysis-amount">{formatMoney(category.amount)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      {!loading && report && statement === 'cash-flow' ? (
        <>
          <section className="accounting-section" aria-labelledby="cash-flow-title">
            <div className="accounting-section-heading">
              <div className="accounting-heading-icon cash-flow"><ArrowDownLeft size={21} /></div>
              <div>
                <h2 id="cash-flow-title">Cash Flow Analysis</h2>
                <span>{reportRange.label} / {combined ? 'ASHOKA + SMPA' : getShopName(shopId)}</span>
              </div>
            </div>

            <div className="accounting-kpi-grid">
              <div className="accounting-kpi income">
                <ArrowDownLeft size={19} />
                <span>Cash Inflows</span>
                <strong>{formatMoney(report.cashInflows)}</strong>
              </div>
              <div className="accounting-kpi expense">
                <ArrowUpRight size={19} />
                <span>Cash Outflows</span>
                <strong>{formatMoney(report.cashOutflows)}</strong>
              </div>
              <div className={`accounting-kpi gross ${report.netCashFlow < 0 ? 'negative' : ''}`}>
                <Scale size={19} />
                <span>Net Cash Flow</span>
                <strong>{formatMoney(report.netCashFlow)}</strong>
              </div>
            </div>

            {cashFlowAllocations.length > 0 ? (
              <div className="cash-flow-allocation-analysis">
                <div className="cash-flow-donut-wrap">
                  <div className="cash-flow-donut" style={{ background: cashFlowGradient }}>
                    <div className="cash-flow-donut-center">
                      <span>Cash Outflows</span>
                      <strong>{formatMoney(report.cashOutflows)}</strong>
                      <small>From {formatMoney(report.collections)} Collections</small>
                    </div>
                  </div>
                </div>
                <div className="cash-flow-allocation-list">
                  {cashFlowAllocations.map((allocation) => (
                    <div className="cash-flow-allocation-row" key={allocation.key}>
                      <span className="cash-flow-swatch" style={{ background: CASH_FLOW_COLORS[allocation.key] ?? '#94a3b8' }} />
                      <div>
                        <strong>{allocation.label}</strong>
                        <span>{allocation.shareOfOutflows}% of Spending | {allocation.shareOfCollections}% of Collections</span>
                      </div>
                      <strong>{formatMoney(allocation.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="accounting-empty">No Cash Outflows Recorded for This Period.</div>
            )}

            <div className="cash-flow-groups">
              <div className="cash-flow-group inflow">
                <h3><ArrowDownLeft size={18} /> Cash Inflows</h3>
                <div><span>Collections</span><strong>{formatMoney(report.collections)}</strong></div>
                <div><span>Transfers In</span><strong>{formatMoney(report.transfersIn)}</strong></div>
                <div><span>Admin Additions</span><strong>{formatMoney(report.adjustmentsIn)}</strong></div>
                <div className="total"><span>Total Cash Inflows</span><strong>{formatMoney(report.cashInflows)}</strong></div>
              </div>
              <div className="cash-flow-group outflow">
                <h3><ArrowUpRight size={18} /> Cash Outflows</h3>
                <div><span>Purchases (COGS)</span><strong>{formatMoney(report.purchases)}</strong></div>
                <div><span>Operating Expenses</span><strong>{formatMoney(report.operatingExpenses)}</strong></div>
                <div className="emi-row"><span>EMI Payments</span><strong>{formatMoney(report.emiPayments)}</strong></div>
                <div><span>Transfers Out</span><strong>{formatMoney(report.transfersOut)}</strong></div>
                <div><span>Admin Deductions</span><strong>{formatMoney(report.adjustmentsOut)}</strong></div>
                <div className="total"><span>Total Cash Outflows</span><strong>{formatMoney(report.cashOutflows)}</strong></div>
              </div>
            </div>

          </section>

          <section className="accounting-section" aria-labelledby="cash-position-title">
            <div className="accounting-section-heading">
              <div className="accounting-heading-icon balance"><WalletCards size={21} /></div>
              <div>
                <h2 id="cash-position-title">Current Cash Position</h2>
                <span>{combined ? 'ASHOKA + SMPA' : getShopName(shopId)}</span>
              </div>
            </div>
            <div className="balance-sheet-rows">
              <div><span>Cash Asset</span><strong>{formatMoney(report.cashAsset)}</strong></div>
              <div><span>Cash Deficit</span><strong className={report.cashDeficit > 0 ? 'negative' : ''}>{formatMoney(report.cashDeficit)}</strong></div>
              <div className="total"><span>Net Cash Position</span><strong className={report.netCashPosition < 0 ? 'negative' : ''}>{formatMoney(report.netCashPosition)}</strong></div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};
