import { useEffect, useState } from 'react';
import { getCurrentPlan, resolveDashboardPlan, type RentalFlowPlan } from './plans';

export function useRentalFlowPlan(): { plan: RentalFlowPlan; loading: boolean } {
  const [plan, setPlan] = useState<RentalFlowPlan>(() => getCurrentPlan());
  const [loading, setLoading] = useState(!import.meta.env.DEV);

  useEffect(() => {
    let mounted = true;

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
