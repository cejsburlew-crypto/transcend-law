/**
 * State History Service
 * Manages undo/redo state snapshots with configurable max levels
 * Supports deep cloning for immutable state management
 */

export interface StateSnapshot<T> {
  state: T;
  timestamp: number;
  description?: string;
}

export interface HistoryState<T> {
  past: StateSnapshot<T>[];
  present: StateSnapshot<T>;
  future: StateSnapshot<T>[];
}

export class StateHistory<T> {
  private maxLevels: number;
  private history: HistoryState<T>;
  private listeners: ((state: HistoryState<T>) => void)[] = [];

  constructor(initialState: T, maxLevels: number = 50, description?: string) {
    this.maxLevels = maxLevels;
    this.history = {
      past: [],
      present: {
        state: this.deepClone(initialState),
        timestamp: Date.now(),
        description: description || 'Initial state',
      },
      future: [],
    };
  }

  /**
   * Deep clone object to prevent mutations
   */
  private deepClone(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (obj instanceof Array) {
      return obj.map((item) => this.deepClone(item)) as any;
    }

    if (obj instanceof Object) {
      const clonedObj = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }

    return obj;
  }

  /**
   * Push new state to history
   */
  push(newState: T, description?: string): void {
    // Add current state to past
    this.history.past.push(this.history.present);

    // Trim past if exceeds max levels
    if (this.history.past.length > this.maxLevels) {
      this.history.past.shift();
    }

    // Set new present
    this.history.present = {
      state: this.deepClone(newState),
      timestamp: Date.now(),
      description: description || 'State update',
    };

    // Clear future when new state is pushed
    this.history.future = [];

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Undo to previous state
   */
  undo(): T | null {
    if (this.history.past.length === 0) {
      return null;
    }

    // Move present to future
    this.history.future.unshift(this.history.present);

    // Move past to present
    this.history.present = this.history.past.pop()!;

    // Notify listeners
    this.notifyListeners();

    return this.history.present.state;
  }

  /**
   * Redo to next state
   */
  redo(): T | null {
    if (this.history.future.length === 0) {
      return null;
    }

    // Move present to past
    this.history.past.push(this.history.present);

    // Move future to present
    this.history.present = this.history.future.shift()!;

    // Notify listeners
    this.notifyListeners();

    return this.history.present.state;
  }

  /**
   * Get current state
   */
  getCurrentState(): T {
    return this.deepClone(this.history.present.state);
  }

  /**
   * Get current state without cloning
   */
  getCurrentStateRef(): T {
    return this.history.present.state;
  }

  /**
   * Get full history state
   */
  getHistory(): HistoryState<T> {
    return this.history;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.history.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.history.future.length > 0;
  }

  /**
   * Get count of available undo levels
   */
  getUndoCount(): number {
    return this.history.past.length;
  }

  /**
   * Get count of available redo levels
   */
  getRedoCount(): number {
    return this.history.future.length;
  }

  /**
   * Get history as readable list with descriptions
   */
  getHistoryList(): Array<{ type: 'past' | 'present' | 'future'; description?: string; timestamp: number }> {
    const list: Array<{ type: 'past' | 'present' | 'future'; description?: string; timestamp: number }> = [];

    // Past states (oldest first)
    this.history.past.forEach((snapshot) => {
      list.push({
        type: 'past',
        description: snapshot.description,
        timestamp: snapshot.timestamp,
      });
    });

    // Present state
    list.push({
      type: 'present',
      description: this.history.present.description,
      timestamp: this.history.present.timestamp,
    });

    // Future states
    this.history.future.forEach((snapshot) => {
      list.push({
        type: 'future',
        description: snapshot.description,
        timestamp: snapshot.timestamp,
      });
    });

    return list;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = {
      past: [],
      present: this.history.present,
      future: [],
    };
    this.notifyListeners();
  }

  /**
   * Reset to initial state and clear history
   */
  reset(initialState: T): void {
    this.history = {
      past: [],
      present: {
        state: this.deepClone(initialState),
        timestamp: Date.now(),
        description: 'Initial state',
      },
      future: [],
    };
    this.notifyListeners();
  }

  /**
   * Subscribe to history changes
   */
  subscribe(listener: (state: HistoryState<T>) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.history);
    });
  }

  /**
   * Get serialized history state (for debugging/logging)
   */
  serialize(): {
    pastCount: number;
    presentDescription?: string;
    futureCount: number;
  } {
    return {
      pastCount: this.history.past.length,
      presentDescription: this.history.present.description,
      futureCount: this.history.future.length,
    };
  }
}

/**
 * Create a new state history instance
 */
export const createStateHistory = <T>(
  initialState: T,
  maxLevels?: number,
  description?: string
): StateHistory<T> => {
  return new StateHistory(initialState, maxLevels, description);
};
