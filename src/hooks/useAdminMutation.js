import { useRef, useState } from 'react';
import { mutationError } from '../services/adminMutations';

export function useAdminMutation() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const run = async (operation) => {
    if (lock.current) return false;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch (failure) {
      setError(mutationError(failure));
      return false;
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return { pending, error, run, clearError: () => setError(null) };
}
