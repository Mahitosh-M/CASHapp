import { CategorizedOutflowPage } from '../components/CategorizedOutflowPage';

export const PurchasePage = () => (
  <CategorizedOutflowPage
    category="purchases"
    title="Add Purchase"
    fieldLabel="Purchase Details"
    placeholder="Example: Stock purchased from supplier"
    savedNotice="Purchase added successfully."
    submitLabel="Save Purchase"
  />
);
