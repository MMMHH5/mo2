"use client";

import { useState, useEffect, useCallback } from 'react';
import { api, getErrorMessage } from './api';

export function useFetchData<T>(url: string | null) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(!!url);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(url);
            setData(res.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [url]);

    useEffect(() => {
        let active = true;
        const run = async () => {
            if (!url) return;
            try {
                const res = await api.get(url);
                if (active) setData(res.data);
            } catch (err) {
                if (active) setError(getErrorMessage(err));
            } finally {
                if (active) setLoading(false);
            }
        };
        run();
        return () => {
            active = false;
        };
    }, [url]);

    return { data, loading, error, refetch: fetchData };
}