import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  const navigate = useNavigate();

  return (
    <header className="page-heading">
      <button className="icon-button back-button" type="button" onClick={() => navigate(-1)} title="Go back" aria-label="Go back">
        <ArrowLeft size={22} />
      </button>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
};
