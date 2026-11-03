import { RESOURCE_TYPES, type Resource } from '@contract';
import { useResources, type TypeFilter } from '../hooks/useResources';
import { ErrorBanner } from './ErrorBanner';
import styles from './ResourceList.module.css';

export interface ResourceListProps {
  selectedResourceId: string | null;
  onSelect: (resource: Resource) => void;
}

export function ResourceList({
  selectedResourceId,
  onSelect,
}: ResourceListProps) {
  const { resources, filter, isLoading, error, setFilter } = useResources();

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
