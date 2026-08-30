import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Combine,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCashHistoryMonth, getFriendlyCashError } from '../services/cashService';
import type { ShopId } from '../types';
import {
  buildCashAccountingReport,
  buildCashFlowAllocations,
  type CashAccountingReport
} from '../utils/accounting';
import { formatMoney } from '../utils/cash';
import { getHistoryMonth, getHistoryMonthBounds, getHistoryMonthKey, getHistoryMonthLabel } from '../utils/historyMonths';
import { SHOP_OPTIONS, getShopName } from '../utils/shops';

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

const formatDeduction = (amount: number) => amount > 0 ? `(${formatMoney(amount)})` : formatMoney(0);

export const AdminAccountingReport = ({ shopId }: { shopId: ShopId }) => {
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
    const historyGroups = await Promise.all(
      reportShopIds.map((reportShopId) => getCashHistoryMonth(reportShopId, start, end))
    );
    const history = historyGroups.flat();
    return buildCashAccountingReport(history, { excludeTransfers: combined });
  }, [combined, reportRange, reportShopIds]);

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
      <div className="report-controls">
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
      </div>

      <div className="admin-report-statement-tabs" role="group" aria-label="Accounting statement">
        <button type="button" className={statement === 'profit-loss' ? 'selected' : ''} onClick={() => setStatement('profit-loss')}>P&amp;L</button>
        <button type="button" className={statement === 'cash-flow' ? 'selected' : ''} onClick={() => setStatement('cash-flow')}>Cash Flow</button>
      </div>

      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {loading ? <div className="accounting-loading">Loading accounting report...</div> : null}

      {!loading && report && statement === 'profit-loss' ? (
        <section className="accounting-section" aria-labelledby="cash-pl-title">
          <div className="accounting-section-heading">
            <div className="accounting-heading-icon"><TrendingUp size={21} /></div>
            <div>
              <h2 id="cash-pl-title">P&amp;L Statement</h2>
              <span>{reportRange.label} / {combined ? 'ASHOKA + SMPA' : getShopName(shopId)}</span>
            </div>
          </div>
          <div className="statement-table-shell">
            <table className="financial-statement-table profit-loss-table" aria-label="Profit and loss statement">
              <colgroup>
                <col className="statement-description-column" />
                <col className="statement-single-amount-column" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Particulars</th>
                  <th scope="col" className="statement-amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="statement-group-row"><th colSpan={2}>Operating Performance</th></tr>
                <tr>
                  <td><span className="statement-marker inflow" />Collections</td>
                  <td className="statement-amount inflow">{formatMoney(report.collections)}</td>
                </tr>
                <tr>
                  <td><span className="statement-marker outflow" />Less: Purchases (COGS)</td>
                  <td className="statement-amount outflow">{formatDeduction(report.purchases)}</td>
                </tr>
                <tr className={`statement-subtotal ${report.grossProfit < 0 ? 'negative' : ''}`}>
                  <th scope="row">Gross Profit</th>
                  <td className="statement-amount">{formatMoney(report.grossProfit)}</td>
                </tr>
                <tr>
                  <td><span className="statement-marker outflow" />Less: Operating Expenses</td>
                  <td className="statement-amount outflow">{formatDeduction(report.operatingExpenses)}</td>
                </tr>
                <tr className={`statement-result ${report.netCashResult < 0 ? 'negative' : ''}`}>
                  <th scope="row">Net Operating Result</th>
                  <td className="statement-amount">{formatMoney(report.netCashResult)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && report && statement === 'cash-flow' ? (
        <section className="accounting-section" aria-labelledby="cash-flow-title">
          <div className="accounting-section-heading">
            <div className="accounting-heading-icon cash-flow"><ArrowDownLeft size={21} /></div>
            <div>
              <h2 id="cash-flow-title">Cash Flow Statement</h2>
              <span>{reportRange.label} / {combined ? 'ASHOKA + SMPA' : getShopName(shopId)}</span>
            </div>
          </div>

          <div className="statement-table-shell">
            <table className="financial-statement-table cash-flow-statement" aria-label="Cash inflow and outflow statement">
              <colgroup>
                <col className="statement-description-column" />
                <col className="statement-flow-column" />
                <col className="statement-flow-column" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Particulars</th>
                  <th scope="col" className="statement-amount inflow"><span><ArrowDownLeft size={15} /> Cash In</span></th>
                  <th scope="col" className="statement-amount outflow"><span><ArrowUpRight size={15} /> Cash Out</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="statement-group-row"><th colSpan={3}>Operating Activities</th></tr>
                <tr>
                  <td>Collections</td>
                  <td className="statement-amount inflow">{formatMoney(report.collections)}</td>
                  <td className="statement-amount muted">-</td>
                </tr>
                <tr>
                  <td>Purchases (COGS)</td>
                  <td className="statement-amount muted">-</td>
                  <td className="statement-amount outflow">{formatMoney(report.purchases)}</td>
                </tr>
                <tr>
                  <td>Operating Expenses</td>
                  <td className="statement-amount muted">-</td>
                  <td className="statement-amount outflow">{formatMoney(report.operatingExpenses)}</td>
                </tr>
                <tr className="statement-group-row"><th colSpan={3}>Financing Activities</th></tr>
                <tr>
                  <td>EMI Payments</td>
                  <td className="statement-amount muted">-</td>
                  <td className="statement-amount outflow">{formatMoney(report.emiPayments)}</td>
                </tr>
                {!combined ? (
                  <>
                    <tr className="statement-group-row"><th colSpan={3}>Branch Transfers</th></tr>
                    <tr>
                      <td>Transfers</td>
                      <td className="statement-amount inflow">{formatMoney(report.transfersIn)}</td>
                      <td className="statement-amount outflow">{formatMoney(report.transfersOut)}</td>
                    </tr>
                  </>
                ) : null}
                <tr className="statement-group-row"><th colSpan={3}>Administrative Adjustments</th></tr>
                <tr>
                  <td>Manual Adjustments</td>
                  <td className="statement-amount inflow">{formatMoney(report.adjustmentsIn)}</td>
                  <td className="statement-amount outflow">{formatMoney(report.adjustmentsOut)}</td>
                </tr>
                <tr className="statement-total">
                  <th scope="row">Total Cash Flow</th>
                  <td className="statement-amount inflow">{formatMoney(report.cashInflows)}</td>
                  <td className="statement-amount outflow">{formatMoney(report.cashOutflows)}</td>
                </tr>
                <tr className={`statement-result ${report.netCashFlow < 0 ? 'negative' : ''}`}>
                  <th scope="row">Net Cash Flow</th>
                  <td className="statement-amount" colSpan={2}>{formatMoney(report.netCashFlow)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="report-subsection-heading">
            <div>
              <h3>Outflow Allocation</h3>
              <span>Spending by accounting category</span>
            </div>
            <strong>{cashFlowAllocations.length}</strong>
          </div>

          {cashFlowAllocations.length > 0 ? (
            <div className="cash-flow-allocation-analysis">
              <div className="cash-flow-donut-wrap">
                <div className="cash-flow-donut" style={{ background: cashFlowGradient }}>
                  <div className="cash-flow-donut-center">
                    <span>Total Outflow</span>
                    <strong>{formatMoney(report.cashOutflows)}</strong>
                    <small>{report.collections > 0 ? `${Math.round((report.cashOutflows / report.collections) * 100)}% of collections` : 'No collections'}</small>
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
        </section>
      ) : null}
    </div>
  );
};
