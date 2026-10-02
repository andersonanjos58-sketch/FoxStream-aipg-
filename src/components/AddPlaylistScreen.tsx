import React, { useState } from 'react';
import { 
  FileText, Server, Upload, Link2, CheckCircle2, AlertCircle, 
  Loader2, ArrowRight, ShieldCheck, Sparkles, X, Tv, Film, Clapperboard, Layers
} from 'lucide-react';
import { Playlist, PlaylistType } from '../types';
import { parseM3U, isHtmlContent, validateM3UContent, ParseResult } from '../services/m3uParser';
import { XtreamClient, XtreamConnectionResult } from '../services/xtreamClient';
import { StorageService } from '../services/storageService';

// The 6 connection options explicitly requested by the user
export type MethodChoice = 
  | 'm3u' 
  | 'metodo3' 
  | 'xc_api' 
  | 'xtream' 
  | 'xtream_codes' 
  | 'xstream_account';

interface AddPlaylistScreenProps {
  onSuccess: (playlist: Playlist) => void;
  onCancel: () => void;
}

export const AddPlaylistScreen: React.FC<AddPlaylistScreenProps> = ({ onSuccess, onCancel }) => {
  const [selectedMethod, setSelectedMethod] = useState<MethodChoice>('m3u');

  // M3U form state
  const [m3uSubTab, setM3uSubTab] = useState<'url' | 'file'>('url');
  const [playlistName, setPlaylistName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Xtream Codes / XC API form state
  const [xtreamName, setXtreamName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Processing & testing states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<XtreamConnectionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ playlist: Playlist; parsed: ParseResult } | null>(null);

  // All 5 Xtream aliases use the exact same logic
  const isXtreamMethod = selectedMethod !== 'm3u';

  const methodOptions: { id: MethodChoice; label: string; badge: string; isXtream: boolean }[] = [
    { id: 'm3u', label: 'M3U / M3U8', badge: 'Arquivo ou URL', isXtream: false },
    { id: 'metodo3', label: 'MÉTODO 3', badge: 'Xtream / XC', isXtream: true },
    { id: 'xc_api', label: 'XC API', badge: 'Xtream / XC', isXtream: true },
    { id: 'xtream', label: 'XTREAM', badge: 'Xtream / XC', isXtream: true },
    { id: 'xtream_codes', label: 'XTREAM CODES', badge: 'Xtream / XC', isXtream: true },
    { id: 'xstream_account', label: 'XSTREAM ACCOUNT', badge: 'Xtream / XC', isXtream: true },
  ];

  // Test Xtream Connection
  const handleTestConnection = async () => {
    setTestResult(null);
    setIsTesting(true);
    setStatusMessage('Testando autenticação com o servidor...');

    try {
      const client = new XtreamClient({
        serverUrl,
        username,
        password
      });

      const res = await client.testConnection();
      setTestResult(res);
      setStatusMessage(null);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Não foi possível conectar: ${err.message || 'Erro desconhecido'}`
      });
      setStatusMessage(null);
    } finally {
      setIsTesting(false);
    }
  };

  // Handle M3U File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (!playlistName) {
      setPlaylistName(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  // Submit M3U Playlist
  const handleSaveM3U = async () => {
    setErrorMessage(null);
    const name = playlistName.trim() || 'Minha Playlist M3U';
    setIsSaving(true);
    setStatusMessage('Processando e classificando conteúdos...');

    try {
      const playlistId = `m3u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let rawM3U = '';

      if (m3uSubTab === 'file') {
        if (!fileContent) {
          throw new Error('Por favor, selecione um arquivo M3U do armazenamento.');
        }
        rawM3U = fileContent;
      } else {
        const inputUrl = m3uUrl.trim();
        if (!inputUrl) {
          throw new Error('Por favor, informe a URL da playlist M3U/M3U8.');
        }

        if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
          throw new Error('A URL da playlist deve começar com http:// ou https://');
        }

        setStatusMessage('Baixando playlist M3U...');
        
        let fetchSuccess = false;
        let lastStatus = '';

        // Try proxy first (safe against CORS, preserves full query params)
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(inputUrl)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            rawM3U = await res.text();
            fetchSuccess = true;
          } else {
            lastStatus = `HTTP ${res.status}`;
          }
        } catch (e: any) {
          lastStatus = e.message || 'Erro no proxy';
        }

        // Fallback: direct fetch
        if (!fetchSuccess) {
          try {
            const directRes = await fetch(inputUrl);
            if (directRes.ok) {
              rawM3U = await directRes.text();
              fetchSuccess = true;
            } else {
              lastStatus = `HTTP ${directRes.status}`;
            }
          } catch (e: any) {
            lastStatus = e.message || 'Falha de conexão';
          }
        }

        if (!fetchSuccess || !rawM3U) {
          throw new Error(`Não foi possível obter a playlist (${lastStatus}). Verifique se o link está acessível.`);
        }
      }

      // Check if received content is HTML (Cloudflare bot check, 404/500 HTML page, login portal)
      if (isHtmlContent(rawM3U)) {
        throw new Error('A URL não retornou uma playlist M3U válida. O servidor retornou uma página HTML em vez da lista de canais (verifique se a lista está ativa, se o usuário e senha na URL estão corretos ou se o link expirou).');
      }

      // Validate M3U structure
      const validation = validateM3UContent(rawM3U);
      if (!validation.valid) {
        throw new Error(validation.error || 'A URL não retornou uma playlist M3U válida.');
      }

      setStatusMessage('Separando TV ao Vivo, Filmes e Séries...');
      const parsed = parseM3U(rawM3U, playlistId, (p) => {
        setParseProgress(`Linhas analisadas: ${p.processedLines}`);
      });

      if (parsed.totalParsed === 0) {
        throw new Error('A URL não retornou uma playlist M3U válida. Nenhum conteúdo de transmissão ou mídia foi identificado no arquivo.');
      }

      const newPlaylist: Playlist = {
        id: playlistId,
        name,
        type: 'm3u',
        url: m3uSubTab === 'url' ? m3uUrl.trim() : undefined,
        lastUpdated: new Date().toISOString(),
        status: 'active',
        stats: {
          liveCount: parsed.channels.length,
          movieCount: parsed.movies.length,
          seriesCount: parsed.series.length,
          otherCount: parsed.others.length,
        },
        diagnostics: parsed.diagnostics
      };

      // Save playlist and content cache
      StorageService.savePlaylist(newPlaylist);
      await StorageService.saveContentCache(playlistId, {
        channels: parsed.channels,
        movies: parsed.movies,
        series: parsed.series,
        others: parsed.others
      });

      // Show diagnostic summary view
      setImportResult({
        playlist: newPlaylist,
        parsed
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Verifique o formato da lista.');
    } finally {
      setIsSaving(false);
      setStatusMessage(null);
      setParseProgress(null);
    }
  };

  // Submit Xtream Codes Playlist
  const handleSaveXtream = async () => {
    setErrorMessage(null);
    const name = xtreamName.trim() || 'Servidor Xtream';
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha Servidor, Usuário e Senha.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('Autenticando e obtendo catálogo da API Xtream...');

    try {
      const client = new XtreamClient({
        serverUrl,
        username,
        password
      });

      // Test connection first
      const auth = await client.testConnection();
      if (!auth.success) {
        throw new Error(auth.message);
      }

      const playlistId = `xtream_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      setStatusMessage('Buscando Canais ao Vivo...');
      const liveRes = await client.getLiveContent(playlistId);

      setStatusMessage('Buscando Filmes (VOD)...');
      const vodRes = await client.getVodContent(playlistId);

      setStatusMessage('Buscando Séries e Temporadas...');
      const seriesRes = await client.getSeriesContent(playlistId);

      const diagnostics = [
        'Conexão com Xtream Codes API estabelecida com sucesso.',
        `Canais ao Vivo importados: ${liveRes.channels.length}`,
        `Filmes (VOD) importados: ${vodRes.movies.length}`,
        `Séries importadas: ${seriesRes.series.length}`
      ];

      const newPlaylist: Playlist = {
        id: playlistId,
        name,
        type: 'xtream',
        serverUrl: client.normalizeUrl(serverUrl),
        username: username.trim(),
        password: password.trim(),
        lastUpdated: new Date().toISOString(),
        status: 'active',
        stats: {
          liveCount: liveRes.channels.length,
          movieCount: vodRes.movies.length,
          seriesCount: seriesRes.series.length,
          otherCount: 0
        },
        diagnostics
      };

      StorageService.savePlaylist(newPlaylist);
      await StorageService.saveContentCache(playlistId, {
        channels: liveRes.channels,
        movies: vodRes.movies,
        series: seriesRes.series,
        others: []
      });

      setImportResult({
        playlist: newPlaylist,
        parsed: {
          channels: liveRes.channels,
          movies: vodRes.movies,
          series: seriesRes.series,
          others: [],
          totalParsed: liveRes.channels.length + vodRes.movies.length + seriesRes.series.length,
          stats: {
            liveCount: liveRes.channels.length,
            movieCount: vodRes.movies.length,
            seriesCount: seriesRes.series.length,
            otherCount: 0
          },
          diagnostics
        }
      });
    } catch (err: any) {
      setErrorMessage(`Erro ao conectar Xtream API: ${err.message}`);
    } finally {
      setIsSaving(false);
      setStatusMessage(null);
    }
  };

  // Quick Demo / Test Playlist Loader (Using Open Source & Public Domain Media - Blender Foundation / Big Buck Bunny / Tears of Steel / Open Streams)
  const handleLoadDemo = async () => {
    setIsSaving(true);
    setStatusMessage('Carregando lista de demonstração pública (Blender Foundation / Creative Commons)...');

    try {
      const demoM3U = `#EXTM3U
#EXTINF:-1 tvg-id="CANAL1" tvg-name="Big Buck Bunny Live" tvg-logo="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300" group-title="TV AO VIVO - Variedades",Big Buck Bunny TV 24h
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4

#EXTINF:-1 tvg-id="CANAL2" tvg-name="Elephants Dream Live" tvg-logo="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300" group-title="TV AO VIVO - Cinema",Elephants Dream TV
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4

#EXTINF:-1 tvg-id="CANAL3" tvg-name="Sintel Live" tvg-logo="https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=300" group-title="TV AO VIVO - Animação",Sintel HD
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4

#EXTINF:-1 tvg-id="FILME1" tvg-logo="https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=300" group-title="FILMES - Ficção Científica",Tears of Steel (2012)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4

#EXTINF:-1 tvg-id="FILME2" tvg-logo="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300" group-title="FILMES - Natureza & Ação",For Bigger Blazes (2020)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4

#EXTINF:-1 tvg-id="FILME3" tvg-logo="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300" group-title="FILMES - Tecnologia",Subaru Outback Adventure (2021)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4

#EXTINF:-1 tvg-id="SERIE1" tvg-logo="https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=300" group-title="SÉRIES - Aventura",Cosmos Odyssey S01E01
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4

#EXTINF:-1 tvg-id="SERIE2" tvg-logo="https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=300" group-title="SÉRIES - Aventura",Cosmos Odyssey S01E02
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4

#EXTINF:-1 tvg-id="SERIE3" tvg-logo="https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=300" group-title="SÉRIES - Aventura",Cosmos Odyssey S02E01
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4
`;

      const playlistId = `demo_${Date.now()}`;
      const parsed = parseM3U(demoM3U, playlistId);

      const demoPlaylist: Playlist = {
        id: playlistId,
        name: 'Lista de Demonstração (Open Source)',
        type: 'm3u',
        lastUpdated: new Date().toISOString(),
        status: 'active',
        stats: {
          liveCount: parsed.channels.length,
          movieCount: parsed.movies.length,
          seriesCount: parsed.series.length,
          otherCount: parsed.others.length
        },
        diagnostics: parsed.diagnostics
      };

      StorageService.savePlaylist(demoPlaylist);
      await StorageService.saveContentCache(playlistId, {
        channels: parsed.channels,
        movies: parsed.movies,
        series: parsed.series,
        others: parsed.others
      });

      setImportResult({
        playlist: demoPlaylist,
        parsed
      });
    } catch (err: any) {
      setErrorMessage(`Erro: ${err.message}`);
    } finally {
      setIsSaving(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-[#11131b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#0d0f17]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-500">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit']">
                Adicionar Lista IPTV
              </h2>
              <p className="text-[11px] text-neutral-400">
                Forneça suas credenciais ou arquivo M3U/M3U8
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        {importResult ? (
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white font-['Outfit']">
                Playlist Importada com Sucesso!
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                <span className="text-neutral-200 font-semibold">{importResult.playlist.name}</span> foi validada e separada rigorosamente em categorias reais.
              </p>
            </div>

            {/* Stats Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-orange-400 mb-1.5">
                  <Tv className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">TV ao Vivo</span>
                </div>
                <div className="text-2xl font-black text-white font-['Outfit']">
                  {importResult.parsed.stats.liveCount}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">canais ao vivo</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1.5">
                  <Film className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Filmes</span>
                </div>
                <div className="text-2xl font-black text-white font-['Outfit']">
                  {importResult.parsed.stats.movieCount}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">títulos VOD</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-rose-400 mb-1.5">
                  <Clapperboard className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Séries</span>
                </div>
                <div className="text-2xl font-black text-white font-['Outfit']">
                  {importResult.parsed.stats.seriesCount}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">séries agrupadas</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-indigo-400 mb-1.5">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Outros</span>
                </div>
                <div className="text-2xl font-black text-white font-['Outfit']">
                  {importResult.parsed.stats.otherCount}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">isolados com segurança</div>
              </div>
            </div>

            {/* Diagnostic Logs Panel */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                Relatório de Diagnóstico da Importação
              </span>
              <div className="bg-neutral-950 border border-neutral-800/90 rounded-2xl p-4 text-[12px] font-mono text-neutral-300 space-y-1.5 max-h-48 overflow-y-auto">
                {importResult.parsed.diagnostics.map((diag, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-orange-500 select-none">›</span>
                    <span className={diag.startsWith('Aviso') ? 'text-amber-300' : 'text-neutral-300'}>
                      {diag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => onSuccess(importResult.playlist)}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-xl shadow-orange-950/40 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
              >
                <span>Acessar Catálogo da Playlist</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportResult(null);
                  setPlaylistName('');
                  setM3uUrl('');
                  setFileContent(null);
                  setFileName(null);
                }}
                className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Adicionar Outra Lista
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="p-1 text-rose-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

          {/* Method Selection Bar (The 6 options requested) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2.5">
              Método de Conexão:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {methodOptions.map((opt) => {
                const isSelected = selectedMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedMethod(opt.id);
                      setTestResult(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500 text-white shadow-md shadow-orange-950/30'
                        : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      {opt.isXtream ? (
                        <Server className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-neutral-500'}`} />
                      ) : (
                        <FileText className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-neutral-500'}`} />
                      )}
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm shadow-orange-400 animate-pulse" />
                      )}
                    </div>
                    <div className="text-xs font-bold leading-tight font-['Outfit']">
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      {opt.badge}
                    </div>
                  </button>
                );
              })}
            </div>
            {isXtreamMethod && (
              <p className="text-[11px] text-neutral-400 mt-2 bg-neutral-900/80 p-2.5 rounded-xl border border-neutral-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Conectando via autenticação <strong>Xtream Codes / XC API</strong> oficial com categorização direta.
                </span>
              </p>
            )}
          </div>

          {/* Form Content Based on Method */}
          {!isXtreamMethod ? (
            /* ================= M3U / M3U8 FORM ================= */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Nome da Playlist:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Minha Lista IPTV"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Sub-tabs: URL vs File */}
              <div>
                <div className="flex rounded-xl bg-neutral-900 p-1 border border-neutral-800 mb-3">
                  <button
                    type="button"
                    onClick={() => setM3uSubTab('url')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      m3uSubTab === 'url'
                        ? 'bg-neutral-800 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>URL M3U / M3U8</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setM3uSubTab('file')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      m3uSubTab === 'file'
                        ? 'bg-neutral-800 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Arquivo do Dispositivo</span>
                  </button>
                </div>

                {m3uSubTab === 'url' ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Link / URL da Playlist (M3U ou M3U8):
                    </label>
                    <input
                      type="url"
                      placeholder="http://servidor.exemplo.com/get.php?username=..."
                      value={m3uUrl}
                      onChange={(e) => setM3uUrl(e.target.value)}
                      className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Compatível com links M3U com parâmetros tvg-name, tvg-logo e group-title.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Selecione o arquivo .m3u ou .m3u8:
                    </label>
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-800 hover:border-orange-500/50 bg-neutral-900/50 rounded-2xl cursor-pointer transition-colors text-center">
                      <Upload className="w-8 h-8 text-neutral-500 mb-2" />
                      <span className="text-xs font-medium text-neutral-300">
                        {fileName ? fileName : 'Toque para escolher arquivo M3U do armazenamento'}
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-1">
                        Formatos suportados: .m3u, .m3u8, .txt
                      </span>
                      <input
                        type="file"
                        accept=".m3u,.m3u8,.txt,audio/x-mpegurl"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= XTREAM / XC API FORM ================= */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Nome da Lista:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Minha Conta Xtream"
                  value={xtreamName}
                  onChange={(e) => setXtreamName(e.target.value)}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Servidor / URL:
                </label>
                <input
                  type="text"
                  placeholder="http://servidor.exemplo.com:8080 ou servidor.exemplo.com:8080"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors font-mono"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Pode ser informado com ou sem <code>http://</code> ou <code>https://</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Usuário:
                  </label>
                  <input
                    type="text"
                    placeholder="usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Senha:
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Test Connection Button & Result Banner */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !serverUrl || !username || !password}
                  className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-neutral-700 text-neutral-200 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors w-full sm:w-auto"
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                  )}
                  <span>Testar Conexão</span>
                </button>

                {testResult && (
                  <div
                    className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold">{testResult.message}</span>
                      {testResult.authData?.user_info?.exp_date && (
                        <p className="text-[10px] opacity-80 mt-0.5">
                          Expiração: {new Date(parseInt(testResult.authData.user_info.exp_date, 10) * 1000).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading & Status display */}
          {isSaving && (
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin shrink-0 text-orange-400" />
              <div>
                <p className="font-semibold">{statusMessage || 'Processando lista...'}</p>
                {parseProgress && <p className="text-[10px] text-neutral-400 mt-0.5">{parseProgress}</p>}
              </div>
            </div>
          )}

          {/* Demonstration Helper Notice */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Deseja testar sem lista agora?</span>
            </div>
            <button
              type="button"
              onClick={handleLoadDemo}
              disabled={isSaving}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 underline shrink-0 cursor-pointer"
            >
              Carregar Lista Teste (Domínio Público)
            </button>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="p-4 sm:p-6 border-t border-neutral-800 bg-[#0d0f17] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white text-xs font-medium transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={isXtreamMethod ? handleSaveXtream : handleSaveM3U}
            disabled={isSaving}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-lg shadow-orange-950/40 active:scale-95 transition-all"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            <span>Salvar e Sincronizar Conteúdo</span>
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
