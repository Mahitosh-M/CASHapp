import { CategorizedOutflowPage } from '../components/CategorizedOutflowPage';

export const EmiPage = () => (
  <CategorizedOutflowPage
    category="emi"
    title="Add EMI Payment"
    fieldLabel="EMI Details"
    placeholder="Example: Vehicle loan EMI"
    savedNotice="EMI payment added successfully."
    submitLabel="Save EMI Payment"
  />
);
