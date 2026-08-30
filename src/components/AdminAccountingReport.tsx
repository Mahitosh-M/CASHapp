import { CalendarDays, Combine, RefreshCw, Scale, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCashCategoryHistoryMonth, getFriendlyCashError, getShopCash } from '../services/cashService';
import type { ShopId } from '../types';
import { buildCashAccountingReport, type CashAccountingReport } from '../utils/accounting';
import { formatMoney } from '../utils/cash';
import { getHistoryMonth, getHistoryMonthBounds, getHistoryMonthKey, getHistoryMonthLabel } from '../utils/historyMonths';
import { SHOP_OPTIONS, getShopName } from '../utils/shops';
import { ExpenseCategoryIcon } from './ExpenseCategoryIcon';

const currentMonth = getHistoryMonth(new Date());
const currentMonthKey = getHistoryMonthKey(currentMonth);

const parseMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12
    ? { year, month: month - 1 }
    : currentMonth;
};

export const AdminAccountingReport = ({ shopId, availableBalance }: { shopId: ShopId; availableBalance: number }) => {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [combined, setCombined] = useState(false);
  const [report, setReport] = useState<CashAccountingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const reportMonth = useMemo(() => parseMonthKey(monthKey), [monthKey]);
  const reportShopIds = useMemo<ShopId[]>(
    () => combined ? SHOP_OPTIONS.map((shop) => shop.id) : [shopId],
    [combined, shopId]
  );

  const loadReport = useCallback(async () => {
    const { start, end } = getHistoryMonthBounds(reportMonth);
    const [historyGroups, summaries] = await Promise.all([
      Promise.all(reportShopIds.map(async (reportShopId) => {
        const [collections, expenses] = await Promise.all([
          getCashCategoryHistoryMonth(reportShopId, 'collections', start, end),
          getCashCategoryHistoryMonth(reportShopId, 'expenses', start, end)
        ]);
        return { collections, expenses };
      })),
      combined ? Promise.all(reportShopIds.map((reportShopId) => getShopCash(reportShopId))) : Promise.resolve([])
    ]);
    const collections = historyGroups.flatMap((group) => group.collections);
    const expenses = historyGroups.flatMap((group) => group.expenses);
    const reportBalance = combined
      ? summaries.reduce((total, summary) => total + (summary?.availableBalance ?? 0), 0)
      : availableBalance;
    return buildCashAccountingReport(collections, expenses, reportBalance);
  }, [availableBalance, combined, reportMonth, reportShopIds]);

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

  return (
    <div className="accounting-report">
      <div className="admin-report-toolbar">
        <label>
          <CalendarDays size={18} />
          <span>Month</span>
          <input type="month" value={monthKey} max={currentMonthKey} onChange={(event) => setMonthKey(event.target.value)} />
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
        <Combine size={19} /> Combined report
      </button>

      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {loading ? <div className="accounting-loading">Loading accounting report...</div> : null}

      {!loading && report ? (
        <>
          <section className="accounting-section" aria-labelledby="cash-pl-title">
            <div className="accounting-section-heading">
              <div className="accounting-heading-icon"><TrendingUp size={21} /></div>
              <div>
                <h2 id="cash-pl-title">Cash P&amp;L</h2>
                <span>{getHistoryMonthLabel(reportMonth)} / {combined ? 'ASHOKA + SMPA' : getShopName(shopId)}</span>
              </div>
            </div>
            <div className="accounting-kpi-grid">
              <div className="accounting-kpi income">
                <TrendingUp size={19} />
                <span>Collections</span>
                <strong>{formatMoney(report.collections)}</strong>
              </div>
              <div className="accounting-kpi expense">
                <TrendingDown size={19} />
                <span>Operating expenses</span>
                <strong>{formatMoney(report.expenses)}</strong>
              </div>
              <div className={`accounting-kpi net ${report.netCashResult < 0 ? 'negative' : ''}`}>
                <Scale size={19} />
                <span>Net cash result</span>
                <strong>{formatMoney(report.netCashResult)}</strong>
              </div>
            </div>
          </section>

          <section className="accounting-section" aria-labelledby="expense-breakdown-title">
            <div className="accounting-section-heading compact">
              <div>
                <h2 id="expense-breakdown-title">Expenses by category</h2>
                <span>{visibleCategories.reduce((total, category) => total + category.count, 0)} entries</span>
              </div>
            </div>
            {visibleCategories.length === 0 ? (
              <div className="accounting-empty">No expenses recorded for this month.</div>
            ) : (
              <div className="expense-analysis-list">
                {visibleCategories.map((category) => {
                  const share = report.expenses > 0 ? Math.round((category.amount / report.expenses) * 100) : 0;
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

          <section className="accounting-section" aria-labelledby="cash-balance-title">
            <div className="accounting-section-heading">
              <div className="accounting-heading-icon balance"><WalletCards size={21} /></div>
              <div>
                <h2 id="cash-balance-title">Cash balance sheet</h2>
                <span>{combined ? 'ASHOKA + SMPA current position' : `${getShopName(shopId)} current position`}</span>
              </div>
            </div>
            <div className="balance-sheet-rows">
              <div><span>Cash asset</span><strong>{formatMoney(report.cashAsset)}</strong></div>
              <div><span>Cash deficit</span><strong className={report.cashDeficit > 0 ? 'negative' : ''}>{formatMoney(report.cashDeficit)}</strong></div>
              <div className="total"><span>Net cash position</span><strong className={report.netCashPosition < 0 ? 'negative' : ''}>{formatMoney(report.netCashPosition)}</strong></div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};
