import { useEffect, type ReactNode } from 'react';

export function WithGrayBackground({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.style.backgroundColor = 'hsl(var(--background))';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  return <>{children}</>;
}
