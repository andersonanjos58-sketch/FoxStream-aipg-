import React, { useState, useRef } from 'react';
import { 
  Settings, PlaySquare, RefreshCw, Trash2, ShieldAlert, 
  Info, ExternalLink, Check, Server, HardDrive, Smartphone, Upload, Image as ImageIcon, Loader2,
  Github, GitBranch, Download, Send, Terminal, AlertCircle
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import logoImage from '../assets/images/foxstream_logo_new_1790894733124.jpg';

interface SettingsScreenProps {
  onNavigatePlaylists: () => void;
  onRefreshAll: () => void;
  onClearCache: () => void;
  onOpenAndroidSource?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onNavigatePlaylists,
  onRefreshAll,
  onClearCache,
  onOpenAndroidSource
}) => {
  const [preferredPlayer, setPreferredPlayer] = useState<'vlc' | 'chooser'>('vlc');
  const [clearedToast, setClearedToast] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GitHub Push State
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [pushMessage, setPushMessage] = useState('');

  const handlePushToGithub = async () => {
    if (!githubRepoUrl.trim()) {
      setPushStatus('error');
      setPushMessage('Por favor, digite a URL do repositório no GitHub (ex: https://github.com/usuario/foxstream.git)');
      return;
    }
    setPushStatus('pushing');
    setPushMessage('Configurando repositório remoto e enviando código...');
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: githubRepoUrl.trim(),
          token: githubToken.trim() || undefined,
          branch: githubBranch.trim() || 'main'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao subir para o GitHub');
      }
      setPushStatus('success');
      setPushMessage(data.message || 'Código enviado com sucesso para o GitHub! O GitHub Actions foi iniciado.');
    } catch (err: any) {
      setPushStatus('error');
      setPushMessage(err.message || 'Erro ao enviar para o GitHub.');
    }
  };

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('Carregando arquivo e gerando todos os ícones nativos...');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 })
        });

        const data = await res.json();
        if (res.ok) {
          setUploadStatus('success');
          setUploadMessage('Logo oficial 100% original aplicado e sincronizado com o GitHub!');
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setUploadStatus('error');
          setUploadMessage(data.error || 'Erro ao processar imagem');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadStatus('error');
      setUploadMessage(err.message || 'Falha ao ler arquivo');
    }
  };

  const handleClearCache = () => {
    onClearCache();
    setConfirmClearCache(false);
    setClearedToast(true);
    setTimeout(() => setClearedToast(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
            Configurações
          </h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Preferências de reprodução, gerenciamento de listas e termos de uso
        </p>
      </div>

      {clearedToast && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>Cache de dados temporários limpo com sucesso!</span>
        </div>
      )}

      {/* Group 1: Gestão de Listas */}
      <div className="p-5 rounded-3xl bg-[#11131b] border border-neutral-800 space-y-3">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
          Playlists e Conexões
        </h3>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onNavigatePlaylists}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-orange-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Gerenciar Listas Cadastradas</h4>
                <p className="text-[11px] text-neutral-400">Adicionar, renomear ou remover listas M3U e Xtream</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-neutral-500" />
          </button>

          <button
            type="button"
            onClick={onRefreshAll}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <div>
                <h4 className="text-xs font-bold text-white">Atualizar Todas as Playlists</h4>
                <p className="text-[11px] text-neutral-400">Re-sincronizar canais ao vivo, filmes e séries dos servidores</p>
              </div>
            </div>
          </button>

          {confirmClearCache ? (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/80">
              <div className="text-xs text-rose-200">
                <span className="font-bold">Confirmar limpeza de cache?</span>
                <p className="text-[11px] text-rose-300/80">Suas listas salvas não serão apagadas.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearCache(false)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearCache(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-neutral-900/80 hover:bg-rose-950/20 border border-neutral-800 hover:border-rose-900/40 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-rose-400 transition-colors" />
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-rose-300">Limpar Cache de Conteúdos</h4>
                  <p className="text-[11px] text-neutral-400">Libera memória removendo itens em cache temporário</p>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Group 2: Player Externo Padrão */}
      <div className="p-5 rounded-3xl bg-[#11131b] border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Player Externo (Android Intent)
          </h3>
          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-bold">
            VLC Prioritário
          </span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          O FoxStream não inclui player embutido pesado nesta versão. As transmissões são despachadas via Intent nativo diretamente para o reprodutor de sua preferência.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPreferredPlayer('vlc')}
            className={`p-3.5 rounded-2xl border text-left flex items-start justify-between transition-all ${
              preferredPlayer === 'vlc'
                ? 'bg-orange-500/10 border-orange-500 text-white shadow-md'
                : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-white">VLC for Android</span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Abre diretamente no VLC se instalado (org.videolan.vlc)
              </p>
            </div>
            {preferredPlayer === 'vlc' && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setPreferredPlayer('chooser')}
            className={`p-3.5 rounded-2xl border text-left flex items-start justify-between transition-all ${
              preferredPlayer === 'chooser'
                ? 'bg-orange-500/10 border-orange-500 text-white shadow-md'
                : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <PlaySquare className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Seletor de Apps</span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">
                Exibe o menu do Android com todos os players instalados
              </p>
            </div>
            {preferredPlayer === 'chooser' && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
          </button>
        </div>
      </div>

      {/* Group 3: Aviso Legal & Termos */}
      <div className="p-5 rounded-3xl bg-[#11131b] border border-neutral-800 space-y-3">
        <div className="flex items-center gap-2 text-amber-400">
          <ShieldAlert className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Aviso Legal & Isenção de Responsabilidade
          </h3>
        </div>

        <div className="text-xs text-neutral-400 space-y-2 leading-relaxed bg-neutral-900/60 p-4 rounded-2xl border border-neutral-800">
          <p>
            <strong>O FoxStream é apenas um organizador e gerenciador de conteúdo de mídia.</strong> O aplicativo <strong>NÃO</strong> hospeda, <strong>NÃO</strong> fornece, <strong>NÃO</strong> transmite e <strong>NÃO</strong> inclui nenhuma lista, canal de televisão, filme ou série de terceiros.
          </p>
          <p>
            Todo o conteúdo exibido é de responsabilidade estrita e exclusiva do usuário, que deve possuir o direito legal de acesso às listas M3U ou credenciais de servidor Xtream Codes inseridas.
          </p>
        </div>
      </div>

      {/* Group: Upload do Logo Oficial Original */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-orange-950/20 via-[#11131b] to-neutral-900 border border-orange-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-400">
            <ImageIcon className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Logo Oficial do Aplicativo & Ícone do Celular
            </h3>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            100% Original
          </span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          Carregue o arquivo de imagem exato (PNG ou JPG) do seu computador ou celular. O sistema usará o seu arquivo com fidelidade de 100%, sem alterações ou distorções, gerará automaticamente todos os 15 ícones do Android (todas as densidades) e fará o envio direto para o seu GitHub!
        </p>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleLogoFileSelect} 
          accept="image/png,image/jpeg,image/webp,image/jpg" 
          className="hidden" 
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <button
            type="button"
            disabled={uploadStatus === 'uploading'}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-3 px-5 rounded-2xl text-xs shadow-lg shadow-orange-950/40 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando e gerando ícones...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Selecionar Imagem Original do Logo</span>
              </>
            )}
          </button>
        </div>

        {uploadMessage && (
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
            uploadStatus === 'success' 
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' 
              : uploadStatus === 'error'
              ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
              : 'bg-orange-500/20 border border-orange-500/30 text-orange-300'
          }`}>
            {uploadStatus === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-400" />}
            {uploadStatus === 'uploading' && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-orange-400" />}
            <span>{uploadMessage}</span>
          </div>
        )}
      </div>

      {/* Group: Subir para o GitHub & Exportação do Projeto */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950/20 via-[#11131b] to-neutral-900 border border-blue-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400">
            <Github className="w-5 h-5" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Subir para o GitHub & Gerar APK (CI/CD)
            </h3>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> Branch: main
          </span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          O repositório Git local está configurado com todos os arquivos Android nativos (Kotlin & Jetpack Compose), ícones oficiais e o fluxo <strong>GitHub Actions</strong> (<code className="text-blue-300">.github/workflows/android.yml</code>) pronto para compilar o APK automaticamente na nuvem ao receber o push.
        </p>

        <div className="space-y-3 bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800">
          <div>
            <label className="block text-[11px] font-bold text-neutral-300 mb-1.5">
              URL do Repositório GitHub
            </label>
            <input
              type="text"
              placeholder="https://github.com/seu-usuario/foxstream.git"
              value={githubRepoUrl}
              onChange={(e) => setGithubRepoUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-300 mb-1.5">
              Personal Access Token (PAT) do GitHub <span className="text-neutral-500 font-normal">(Opcional se público; obrigatório se privado)</span>
            </label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <button
              type="button"
              disabled={pushStatus === 'pushing'}
              onClick={handlePushToGithub}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-5 rounded-2xl text-xs shadow-lg shadow-blue-950/40 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {pushStatus === 'pushing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Subindo para o GitHub...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Subir para o GitHub Agora (git push)</span>
                </>
              )}
            </button>

            <a
              href="/foxstream-source.zip"
              download="foxstream-source.zip"
              className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold py-3 px-4 rounded-2xl text-xs border border-neutral-700 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Baixar Projeto (.ZIP)</span>
            </a>
          </div>

          {pushMessage && (
            <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
              pushStatus === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                : pushStatus === 'error'
                ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
                : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
            }`}>
              {pushStatus === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-400" />}
              {pushStatus === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
              {pushStatus === 'pushing' && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-400" />}
              <span>{pushMessage}</span>
            </div>
          )}

          {/* Quick terminal instructions */}
          <div className="pt-2 border-t border-neutral-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono mb-1.5">
              <Terminal className="w-3.5 h-3.5 text-neutral-500" />
              <span>Ou envie manualmente pelo seu terminal:</span>
            </div>
            <pre className="text-[10px] bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/80 text-neutral-400 overflow-x-auto font-mono leading-relaxed">
{`git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git branch -M main
git push -u origin main`}
            </pre>
          </div>
        </div>
      </div>

      {/* Group 4: Informações do Aplicativo & Código Android */}
      <div className="p-5 rounded-3xl bg-[#11131b] border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-700/60 flex items-center justify-center p-0.5 shadow-md">
              <img src={logoImage} alt="FoxStream Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-['Outfit']">FoxStream</h4>
              <p className="text-[11px] text-neutral-400">Versão 1.0.0 (Build Android Kotlin + Compose)</p>
            </div>
          </div>

          <span className="text-[10px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-400 px-2.5 py-1 rounded-full">
            Release v1.0
          </span>
        </div>

        {onOpenAndroidSource && (
          <button
            type="button"
            onClick={onOpenAndroidSource}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-800/40 hover:border-emerald-700/60 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold text-white group-hover:text-emerald-300">Código Fonte Nativo Android & APK</h4>
                <p className="text-[11px] text-neutral-400">Visualizar arquivos Kotlin/Compose e instruções de build GitHub Actions</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
};
