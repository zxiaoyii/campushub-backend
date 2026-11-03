import { useCallback, useEffect, useState } from 'react';
import type { Resource, ResourceType } from '@contract';
import { describeApiError, fetchResources } from '../api/campushubApi';

export type TypeFilter = ResourceType | 'ALL';

export interface ResourcesState {
  readonly resources: Resource[];
  readonly filter: TypeFilter;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly setFilter: (next: TypeFilter) => void;
}

/** Owns the resource catalogue and the type filter that reloads it. */
export function useResources(): ResourcesState {
  const [resources, setResources] = useState<Resource[]>([]);
  const [filter, setFilter] = useState<TypeFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (type: TypeFilter): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setResources(await fetchResources(type === 'ALL' ? undefined : type));
    } catch (caught: unknown) {
      setError(describeApiError(caught, 'Could not load resources.'));
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return { resources, filter, isLoading, error, setFilter };
}
