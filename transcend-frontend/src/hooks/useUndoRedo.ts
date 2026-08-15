import { useState, useCallback, useEffect, useRef } from 'react';
import { StateHistory, createStateHistory } from '../services/stateHistory';

export interface UseUndoRedoOptions {
  maxLevels?: number;
  onStateChange?: (state: any) => void;
  enableKeyboardShortcuts?: boolean;
}

export interface UseUndoRedoReturn<T> {
  // State management
  state: T;
  setState: (newState: T, description?: string) => void;

  // Undo/Redo operations
  undo: () => void;
  redo: () => void;

  // UI state indicators
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;

  // History inspection
  historyList: Array<{ type: 'past' | 'present' | 'future'; description?: string; timestamp: number }>;

  // History management
  clearHistory: () => void;
  reset: (initialState: T) => void;
}

/**
 * Custom hook for managing undo/redo state with keyboard shortcuts
 *
 * @param initialState - Initial state value
 * @param options - Configuration options
 * @returns Object with state management and undo/redo functions
 *
 * @example
 * const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo(
 *   { name: '', email: '' },
 *   { maxLevels: 50, enableKeyboardShortcuts: true }
 * );
 */
export const useUndoRedo = <T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn<T> => {
  const {
    maxLevels = 50,
    onStateChange,
    enableKeyboardShortcuts = true,
  } = options;

  // State management
  const historyRef = useRef<StateHistory<T>>(
    createStateHistory(initialState, maxLevels, 'Initial state')
  );

  const [currentState, setCurrentState] = useState<T>(initialState);
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState<number>(0);
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  const [historyList, setHistoryList] = useState<ReturnType<StateHistory<T>['getHistoryList']>>([]);

  // Update UI indicators when history changes
  const updateHistoryUI = useCallback(() => {
    const history = historyRef.current;
    setCanUndoState(history.canUndo());
    setCanRedoState(history.canRedo());
    setHistoryList(history.getHistoryList());
  }, []);

  // Subscribe to history changes
  useEffect(() => {
    const unsubscribe = historyRef.current.subscribe(() => {
      updateHistoryUI();
      setHistoryUpdatedAt(Date.now());
    });

    return unsubscribe;
  }, [updateHistoryUI]);

  // Set new state with optional description
  const setState = useCallback(
    (newState: T, description?: string) => {
      historyRef.current.push(newState, description);
      setCurrentState(historyRef.current.getCurrentState());

      if (onStateChange) {
        onStateChange(newState);
      }
    },
    [onStateChange]
  );

  // Undo operation
  const undo = useCallback(() => {
    const previousState = historyRef.current.undo();

    if (previousState !== null) {
      setCurrentState(previousState);

      if (onStateChange) {
        onStateChange(previousState);
      }
    }
  }, [onStateChange]);

  // Redo operation
  const redo = useCallback(() => {
    const nextState = historyRef.current.redo();

    if (nextState !== null) {
      setCurrentState(nextState);

      if (onStateChange) {
        onStateChange(nextState);
      }
    }
  }, [onStateChange]);

  // Clear history
  const clearHistory = useCallback(() => {
    historyRef.current.clear();
    updateHistoryUI();
  }, [updateHistoryUI]);

  // Reset to initial state
  const reset = useCallback(
    (newInitialState: T) => {
      historyRef.current.reset(newInitialState);
      setCurrentState(newInitialState);
      updateHistoryUI();

      if (onStateChange) {
        onStateChange(newInitialState);
      }
    },
    [onStateChange, updateHistoryUI]
  );

  // Keyboard shortcuts: Cmd+Z (undo) and Cmd+Shift+Z (redo)
  useEffect(() => {
    if (!enableKeyboardShortcuts) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      const isMetaKey = event.metaKey || event.ctrlKey;

      if (isMetaKey && event.key === 'z') {
        // Prevent default browser undo
        event.preventDefault();

        if (event.shiftKey) {
          // Cmd+Shift+Z or Ctrl+Shift+Z = Redo
          redo();
        } else {
          // Cmd+Z or Ctrl+Z = Undo
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, enableKeyboardShortcuts]);

  // Initial UI update
  useEffect(() => {
    updateHistoryUI();
  }, [updateHistoryUI]);

  return {
    state: currentState,
    setState,
    undo,
    redo,
    canUndo: canUndoState,
    canRedo: canRedoState,
    undoCount: historyRef.current.getUndoCount(),
    redoCount: historyRef.current.getRedoCount(),
    historyList,
    clearHistory,
    reset,
  };
};

/**
 * Hook specifically for managing form state with undo/redo
 *
 * @param initialFormData - Initial form data
 * @param maxLevels - Maximum undo levels (default: 50)
 * @returns Form state management with undo/redo
 */
export const useFormUndoRedo = <T extends Record<string, any>>(
  initialFormData: T,
  maxLevels: number = 50
) => {
  const {
    state: formData,
    setState: setFormData,
    undo,
    redo,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    clearHistory,
    reset,
  } = useUndoRedo(initialFormData, {
    maxLevels,
    enableKeyboardShortcuts: true,
  });

  // Convenience method to update a single form field
  const updateField = useCallback(
    (fieldName: keyof T, value: any, description?: string) => {
      const newFormData = { ...formData, [fieldName]: value };
      setFormData(newFormData, description || `Updated ${String(fieldName)}`);
    },
    [formData, setFormData]
  );

  // Batch update multiple fields
  const updateFields = useCallback(
    (updates: Partial<T>, description?: string) => {
      const newFormData = { ...formData, ...updates };
      setFormData(newFormData, description || 'Updated fields');
    },
    [formData, setFormData]
  );

  // Reset form to initial state
  const resetForm = useCallback(
    (newInitialData?: T) => {
      reset(newInitialData || initialFormData);
    },
    [reset, initialFormData]
  );

  return {
    formData,
    setFormData,
    updateField,
    updateFields,
    undo,
    redo,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    clearHistory,
    resetForm,
  };
};

/**
 * Hook for managing array state with undo/redo
 *
 * @param initialArray - Initial array state
 * @param maxLevels - Maximum undo levels (default: 50)
 * @returns Array state management with undo/redo
 */
export const useArrayUndoRedo = <T>(
  initialArray: T[] = [],
  maxLevels: number = 50
) => {
  const {
    state: array,
    setState: setArray,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    reset,
  } = useUndoRedo(initialArray, {
    maxLevels,
    enableKeyboardShortcuts: true,
  });

  // Add item to array
  const addItem = useCallback(
    (item: T, description?: string) => {
      const newArray = [...array, item];
      setArray(newArray, description || 'Added item');
    },
    [array, setArray]
  );

  // Remove item by index
  const removeItem = useCallback(
    (index: number, description?: string) => {
      const newArray = array.filter((_, i) => i !== index);
      setArray(newArray, description || `Removed item at index ${index}`);
    },
    [array, setArray]
  );

  // Update item at index
  const updateItem = useCallback(
    (index: number, item: T, description?: string) => {
      const newArray = [...array];
      newArray[index] = item;
      setArray(newArray, description || `Updated item at index ${index}`);
    },
    [array, setArray]
  );

  // Insert item at specific index
  const insertItem = useCallback(
    (index: number, item: T, description?: string) => {
      const newArray = [...array];
      newArray.splice(index, 0, item);
      setArray(newArray, description || `Inserted item at index ${index}`);
    },
    [array, setArray]
  );

  // Clear array
  const clearArray = useCallback(
    (description?: string) => {
      setArray([], description || 'Cleared array');
    },
    [setArray]
  );

  // Reset array to initial state
  const resetArray = useCallback(
    (newInitialArray?: T[]) => {
      reset(newInitialArray || initialArray);
    },
    [reset, initialArray]
  );

  return {
    array,
    setArray,
    addItem,
    removeItem,
    updateItem,
    insertItem,
    clearArray,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    resetArray,
  };
};
