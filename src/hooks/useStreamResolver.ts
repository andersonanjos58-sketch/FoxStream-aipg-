import { useState, useEffect, useCallback, useRef } from 'react';
import { StreamSource } from '../types';
import { StreamResolverService } from '../services/streamResolver';

export type StreamVerificationState = 'IDLE' | 'LOADING' | 'IS_AVAILABLE' | 'UNAVAILABLE';

export interface UseStreamResolverParams {
  tmdbId?: number | string;
  title?: string;
  year?: number | string;
  type?: 'movie' | 'series' | 'live';
  autoResolve?: boolean;
}

export interface UseStreamResolverResult {
  state: StreamVerificationState;
  stream: StreamSource | null;
  allStreams: StreamSource[];
  isAvailable: boolean;
  isLoading: boolean;
  isUnavailable: boolean;
  matchType?: 'tmdb_id' | 'title_year' | 'stremio_addon';
  resolve: (overrideParams?: Partial<UseStreamResolverParams>) => Promise<StreamSource | null>;
}

export function useStreamResolver(params?: UseStreamResolverParams): UseStreamResolverResult {
  const [state, setState] = useState<StreamVerificationState>('IDLE');
  const [stream, setStream] = useState<StreamSource | null>(null);
  const [allStreams, setAllStreams] = useState<StreamSource[]>([]);
  const [matchType, setMatchType] = useState<'tmdb_id' | 'title_year' | 'stremio_addon' | undefined>();

  const currentParamsRef = useRef(params);
  currentParamsRef.current = params;

  const resolve = useCallback(
    async (overrideParams?: Partial<UseStreamResolverParams>): Promise<StreamSource | null> => {
      const activeParams = { ...currentParamsRef.current, ...overrideParams };
      const { tmdbId, title, year, type } = activeParams;

      if (!tmdbId && !title) {
        setState('UNAVAILABLE');
        setStream(null);
        setAllStreams([]);
        return null;
      }

      setState('LOADING');

      try {
        const result = await StreamResolverService.resolveStream({
          tmdbId,
          title,
          year,
          type,
        });

        if (result.matched && result.stream) {
          setStream(result.stream);
          setAllStreams(result.allStreams || [result.stream]);
          setMatchType(result.matchType);
          setState('IS_AVAILABLE');
          return result.stream;
        } else {
          setStream(null);
          setAllStreams([]);
          setMatchType(undefined);
          setState('UNAVAILABLE');
          return null;
        }
      } catch (err) {
        console.warn('[useStreamResolver] Error resolving stream:', err);
        setStream(null);
        setAllStreams([]);
        setState('UNAVAILABLE');
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (params?.autoResolve !== false && (params?.tmdbId || params?.title)) {
      resolve();
    } else if (!params?.tmdbId && !params?.title) {
      setState('IDLE');
      setStream(null);
      setAllStreams([]);
    }
  }, [params?.tmdbId, params?.title, params?.year, params?.type, params?.autoResolve, resolve]);

  return {
    state,
    stream,
    allStreams,
    isAvailable: state === 'IS_AVAILABLE',
    isLoading: state === 'LOADING',
    isUnavailable: state === 'UNAVAILABLE',
    matchType,
    resolve,
  };
}
