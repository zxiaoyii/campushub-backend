import { useState } from 'react';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';
import type { Resource } from '@contract';
import styles from './App.module.css';

export function App() {
  const [userId, setUserId] = useState('user-456');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <h1>CampusHub</h1>
        <label className={styles.user}>
          <span>Student id</span>
          <input
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
            }}
          />
        </label>
      </header>

      <main className={styles.main}>
        <ResourceList
          selectedResourceId={selected?.id ?? null}
          onSelect={setSelected}
        />

        <div className={styles.split}>
          <BookingForm
            resource={selected}
            userId={userId}
            onBooked={() => {
              setRefreshToken((token) => token + 1);
            }}
          />
          <UserReservations userId={userId} refreshToken={refreshToken} />
        </div>
      </main>
    </div>
  );
}
