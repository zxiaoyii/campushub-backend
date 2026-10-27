import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <span>{message}</span>
      {onDismiss !== undefined && (
        <button type="button" className={styles.dismiss} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
