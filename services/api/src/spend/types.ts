export interface SpendStatus {
  capUsd: number;
  spentUsd: number;
  reservedUsd: number;
  remainingUsd: number;
  /** Next UTC midnight. */
  resetsAt: string;
}

export interface Reservation {
  id: string;
  amountUsd: number;
}

/**
 * Daily spend cap with reserve-then-settle (PLAN.md §3.6 rule 7): reserve the worst-case
 * cost before calling a paid API, then replace it with the actual cost. Concurrent calls
 * can therefore never overshoot the cap.
 */
export interface SpendStore {
  status(): Promise<SpendStatus>;
  /** Returns null when the reservation would exceed today's remaining budget. */
  reserve(amountUsd: number): Promise<Reservation | null>;
  settle(reservation: Reservation, actualUsd: number): Promise<void>;
  release(reservation: Reservation): Promise<void>;
}
