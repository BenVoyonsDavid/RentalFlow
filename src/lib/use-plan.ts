import { useEffect, useState } from 'react';
import { resolveDashboardPlan, type RentalFlowPlan } from './plans';

export function useRentalFlowPlan(): { plan: RentalFlowPlan; loading: boolean } {
  const [plan, setPlan] = useState<RentalFlowPlan>(import.meta.env.DEV ? 'PRO' : 'FREE');
  const [loading, setLoading] = useState(!import.meta.env.DEV);

  useEffect(() => {
    let mounted = true;
    if (import.meta.env.DEV) return () => { mounted = false; };

    void resolveDashboardPlan()
      .then((resolved) => {
        if (mounted) setPlan(resolved);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return { plan, loading };
}
