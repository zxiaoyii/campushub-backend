import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchResources } from '../api/campushubApi';
import { RESOURCE_TYPES, type Resource, type ResourceType } from '../types/api';
import { ErrorBanner } from './ErrorBanner';
import styles from './ResourceList.module.css';

export interface ResourceListProps {
  selectedResourceId: string | null;
  onSelect: (resource: Resource) => void;
}

type TypeFilter = ResourceType | 'ALL';

export function ResourceList({
  selectedResourceId,
  onSelect,
}: ResourceListProps) {
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
      const message =
        caught instanceof ApiError
          ? caught.message
          : 'Could not load resources.';
      setError(message);
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>Resources</h2>
        <div className={styles.filters}>
          {(['ALL', ...RESOURCE_TYPES] as TypeFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={option === filter ? styles.filterOn : styles.filter}
              onClick={() => {
                setFilter(option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      {error !== null && <ErrorBanner message={error} />}

      {isLoading ? (
        <p className={styles.state}>Loading resources…</p>
      ) : resources.length === 0 ? (
        <p className={styles.state}>No resources match this filter.</p>
      ) : (
        <ul className={styles.grid}>
          {resources.map((resource) => (
            <li key={resource.id}>
              <button
                type="button"
                className={
                  resource.id === selectedResourceId
                    ? styles.cardOn
                    : styles.card
                }
                disabled={!resource.isAvailable}
                onClick={() => {
                  onSelect(resource);
                }}
              >
                <span className={styles.name}>{resource.name}</span>
                <span className={styles.type}>{resource.type}</span>
                <span className={styles.location}>{resource.location}</span>
                {!resource.isAvailable && (
                  <span className={styles.unavailable}>Unavailable</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
