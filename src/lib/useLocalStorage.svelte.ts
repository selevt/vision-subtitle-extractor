/**
 * localStorage state hook for use in .svelte/.svelte.ts files (uses $state rune).
 * Returns an object with .value and .reset().
 * Usage: const store = useLocalStorage('key', initialValue); store.value = ...; store.reset();
 */
export function useLocalStorage<T>(key: string, initial: T, type?: 'string' | 'number' | 'json') {
	let value = $state(initial);
	// Load from localStorage if available
	const stored = localStorage.getItem(key);
	if (stored !== null) {
		try {
			if (typeof initial === 'number' || type === 'number') {
				value = parseFloat(stored) as T;
			} else if (type === 'json') {
				value = JSON.parse(stored) as T;
			} else {
				value = stored as T;
			}
		} catch {}
	}
	$effect(() => {
		if (value === null || value === undefined) {
			localStorage.removeItem(key);
		} else {
			if (type === 'json') {
				localStorage.setItem(key, JSON.stringify(value));
			} else {
				localStorage.setItem(key, value?.toString?.() ?? '');
			}
		}
	});
	return {
		get value() {
			return value;
		},
		set value(v: T) {
			value = v;
		},
		reset() {
			value = initial;
		}
	};
}
