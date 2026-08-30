import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

interface AutoGrowTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  value: string;
}

export const AutoGrowTextarea = ({ value, ...props }: AutoGrowTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return <textarea ref={textareaRef} value={value} rows={2} {...props} />;
};
