import React, { useState } from 'react';
import { 
  Plus, RefreshCw, Trash2, CheckCircle2, Server, FileText, 
  Tv, Film, Clapperboard, Calendar, Edit2, Check, X, AlertTriangle, ArrowRight,
  Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { Playlist } from '../types';

interface PlaylistsScreenProps {
  playlists: Playlist[];
  activePlaylistId: string;
  onSelectPlaylist: (id: string) => void;
  onOpenAddPlaylist: () => void;
  onRefreshPlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, newName: string) => void;
  refreshingId?: string | null;
}

export const PlaylistsScreen: React.FC<PlaylistsScreenProps> = ({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onOpenAddPlaylist,
  onRefreshPlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  refreshingId
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedDiagnosticsId, setExpandedDiagnosticsId] = useState<string | null>(null);

  const startRename = (p: Playlist) => {
    setEditingId(p.id);
    setRenameText(p.name);
  };

  const saveRename = (id: string) => {
    if (renameText.trim()) {
      onRenamePlaylist(id, renameText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
            Minhas Listas
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Gerencie múltiplas contas Xtream Codes e listas M3U/M3U8
          </p>
        </div>

        {/* + Adicionar lista button */}
        <button
          type="button"
          onClick={onOpenAddPlaylist}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-3 px-5 rounded-2xl text-sm shadow-xl shadow-orange-950/40 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar lista</span>
        </button>
      </div>

      {/* Playlists List */}
      {playlists.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-neutral-800 rounded-3xl bg-neutral-900/30 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 flex items-center justify-center mx-auto text-neutral-500">
            <Server className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-200 font-['Outfit']">
              Nenhuma lista cadastrada
            </h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">
              O FoxStream é um catálogo do seu próprio conteúdo. Adicione sua URL M3U ou credenciais Xtream Codes para carregar seus canais, filmes e séries.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddPlaylist}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl text-xs shadow-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Primeira Lista</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {playlists.map((playlist) => {
            const isActive = playlist.id === activePlaylistId;
            const isRefreshing = refreshingId === playlist.id;

            return (
              <div
                key={playlist.id}
                className={`p-5 rounded-3xl border transition-all ${
                  isActive
                    ? 'bg-neutral-900/90 border-orange-500/60 shadow-lg shadow-orange-950/20'
                    : 'bg-[#12141c]/80 border-neutral-800/80 hover:border-neutral-700/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info Left */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                        playlist.type === 'xtream'
                          ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}
                    >
                      {playlist.type === 'xtream' ? (
                        <Server className="w-6 h-6" />
                      ) : (
                        <FileText className="w-6 h-6" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {editingId === playlist.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameText}
                              onChange={(e) => setRenameText(e.target.value)}
                              className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveRename(playlist.id)}
                              className="p-1 rounded bg-emerald-500/20 text-emerald-400"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded bg-neutral-800 text-neutral-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white font-['Outfit'] truncate">
                              {playlist.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => startRename(playlist)}
                              title="Renomear"
                              className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {isActive ? 'Ativa' : 'Pronta'}
                        </span>
                      </div>

                      {/* Type & Date */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-1">
                        <span className="font-semibold text-neutral-300">
                          {playlist.type === 'xtream' ? 'Xtream / XC API' : 'M3U Playlist'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3 text-neutral-500" />
                          Atualizado em {new Date(playlist.lastUpdated).toLocaleDateString()} {new Date(playlist.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Content Stats Pill Row */}
                      <div className="flex items-center gap-2 mt-2 text-[11px]">
                        <span className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 px-2 py-0.5 rounded-md text-neutral-300">
                          <Tv className="w-3 h-3 text-orange-400" />
                          {playlist.stats.liveCount} canais
                        </span>
                        <span className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 px-2 py-0.5 rounded-md text-neutral-300">
                          <Film className="w-3 h-3 text-amber-400" />
                          {playlist.stats.movieCount} filmes
                        </span>
                        <span className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 px-2 py-0.5 rounded-md text-neutral-300">
                          <Clapperboard className="w-3 h-3 text-rose-400" />
                          {playlist.stats.seriesCount} séries
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Select as Active */}
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onSelectPlaylist(playlist.id)}
                        className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selecionar</span>
                      </button>
                    )}

                    {/* Refresh Playlist */}
                    <button
                      type="button"
                      onClick={() => onRefreshPlaylist(playlist)}
                      disabled={isRefreshing}
                      title="Atualizar lista"
                      className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
                    </button>

                    {/* Delete Playlist */}
                    {confirmDeleteId === playlist.id ? (
                      <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-800/80 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => onDeletePlaylist(playlist.id)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 text-neutral-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(playlist.id)}
                        title="Remover lista"
                        className="p-2.5 rounded-xl bg-neutral-900 hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-900/50 text-neutral-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
