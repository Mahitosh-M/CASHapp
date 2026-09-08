import { useCallback, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MonthlyHistorySections } from '../components/MonthlyHistorySections';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { getCashHistoryMonth, getCashPreviousHistoryDates, getShopCash } from '../services/cashService';
import { getShopName } from '../utils/shops';

export const HistoryPage = () => {
  const { currentShopId, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const loadMonth = useCallback((start: Date, end: Date) => {
    if (!currentShopId) return Promise.resolve([]);
    return getCashHistoryMonth(currentShopId, start, end);
  }, [currentShopId]);

  const loadPreviousDates = useCallback((before: Date) => {
    if (!currentShopId) return Promise.resolve([]);
    return getCashPreviousHistoryDates(currentShopId, before);
  }, [currentShopId]);

  const editTransfer = useCallback((transferId: string) => {
    navigate(`/transfer/${transferId}/edit`, {
      state: { returnTo: location.pathname }
    });
  }, [location.pathname, navigate]);

  const editExpense = useCallback((expenseId: string) => {
    navigate(`/expense/${expenseId}/edit`, { state: { returnTo: location.pathname } });
  }, [location.pathname, navigate]);
  const downloadRange = async () => {
    if (!currentShopId || from > to) return;
    const [items, summary] = await Promise.all([getCashHistoryMonth(currentShopId, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)), getShopCash(currentShopId)]);
    const pdf = new jsPDF(); let balance = summary?.availableBalance ?? 0; let y = 48;
    pdf.setFillColor(30, 64, 175); pdf.rect(0, 0, 210, 20, 'F'); pdf.setTextColor(255,255,255); pdf.setFontSize(18); pdf.text(`${getShopName(currentShopId)} CASH HISTORY`, 14, 13);
    pdf.setTextColor(40,40,60); pdf.setFontSize(11); pdf.text(`${from} to ${to}`, 14, 28); pdf.setFillColor(238,242,255); pdf.rect(14,33,182,9,'F'); pdf.setFontSize(10); pdf.text('DETAILS',16,39); pdf.text('INCOMING',105,39); pdf.text('OUTGOING',137,39); pdf.text('BALANCE',170,39);
    const rows = items.map((item) => { const incoming = ['collection','transfer-in','adjustment-in'].includes(item.kind); const row = { item, incoming, balance }; balance -= incoming ? item.amount : -item.amount; return row; });
    rows.forEach(({item,incoming,balance}) => { pdf.setTextColor(45,45,60); pdf.text(item.title.slice(0,42),16,y); pdf.setTextColor(22,130,70); pdf.text(incoming ? `Rs ${item.amount.toFixed(2)}` : '-',105,y); pdf.setTextColor(185,28,28); pdf.text(!incoming ? `Rs ${item.amount.toFixed(2)}` : '-',137,y); pdf.setTextColor(balance >= 0 ? 22 : 185,balance >= 0 ? 130 : 28,balance >= 0 ? 70 : 28); pdf.text(`Rs ${balance.toFixed(2)}`,170,y); y += 8; if (y > 280) { pdf.addPage(); y = 20; } });
    pdf.save(`${getShopName(currentShopId)}-${from}-to-${to}.pdf`);
  };

  return (
    <div className="page history-page">
      <PageHeader title="History" subtitle="Cash activity by month" />
      <section className="history-export"><div className="history-export-dates"><label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div><button className="history-download-button" type="button" aria-label="Download PDF" title="Download PDF" onClick={() => void downloadRange()} disabled={!currentShopId || from > to}><Download size={19} /></button></section>
      <MonthlyHistorySections
        queryKey={currentShopId || 'none'}
        emptyText="No cash activity found."
        loadMonth={loadMonth}
        loadPreviousDates={loadPreviousDates}
        onEditTransfer={editTransfer}
        onEditExpense={profile?.role === 'Admin' ? editExpense : undefined}
        shopName={currentShopId ? getShopName(currentShopId) : 'SHOP'}
        showPdfButtons={false}
      />
    </div>
  );
};
