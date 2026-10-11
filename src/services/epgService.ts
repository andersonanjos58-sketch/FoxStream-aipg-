import { LiveChannel } from '../types';

export interface EpgProgram {
  title: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  progressPercent: number; // 0 to 100
  genre: string;
  description: string;
}

export interface ChannelEpgInfo {
  currentProgram: EpgProgram;
  nextProgram: {
    title: string;
    startTime: string;
    endTime: string;
  };
}

// Predefined program templates grouped by category keywords
const PROGRAM_CATALOG = {
  sports: [
    { title: 'Futebol Ao Vivo: Pré-Jogo', durationMin: 60, genre: 'Esportes' },
    { title: 'Campeonato Nacional: Grande Clássico', durationMin: 120, genre: 'Futebol' },
    { title: 'Mesa Redonda: Debate e Análise', durationMin: 90, genre: 'Debate' },
    { title: 'Melhores Momentos da Rodada', durationMin: 60, genre: 'Gols' },
    { title: 'Fórmula 1: Classificação e Bastidores', durationMin: 90, genre: 'Automobilismo' },
    { title: 'Basquete Internacional: Temporada Regular', durationMin: 120, genre: 'Basquete' },
    { title: 'Giro Esportivo: Notícias da Semana', durationMin: 60, genre: 'Informativo' },
    { title: 'Combate e Lutas: Destaques da Noite', durationMin: 120, genre: 'Lutas' },
    { title: 'ESPN FC: Análise Tática e Transferências', durationMin: 90, genre: 'Jornalismo' },
    { title: 'Arena do Torcedor: Coletiva e Gols', durationMin: 60, genre: 'Esportes' }
  ],
  news: [
    { title: 'Jornal em Tempo Real', durationMin: 60, genre: 'Notícias' },
    { title: 'Edição das 10: Principais Acontecimentos', durationMin: 90, genre: 'Jornalismo' },
    { title: 'Giro Econômico e Mercado Financeiro', durationMin: 60, genre: 'Economia' },
    { title: 'Plantão Brasil: Ao Vivo', durationMin: 90, genre: 'Urgente' },
    { title: 'Debate Político: O Cenário Nacional', durationMin: 60, genre: 'Opinião' },
    { title: 'Notícias Internacionais e Mundo', durationMin: 60, genre: 'Internacional' },
    { title: 'Jornal da Noite: Cobertura Completa', durationMin: 90, genre: 'Jornalismo' },
    { title: 'Entrevista Exclusiva com Especialistas', durationMin: 60, genre: 'Entrevistas' }
  ],
  movies: [
    { title: 'Cine Ação: Missão Crítica', durationMin: 110, genre: 'Ação' },
    { title: 'Sessão Suspense: Sem Saída', durationMin: 105, genre: 'Suspense' },
    { title: 'Comédia de Sucesso: Rindo à Toa', durationMin: 95, genre: 'Comédia' },
    { title: 'Ficção Científica: Além da Galáxia', durationMin: 125, genre: 'Ficção' },
    { title: 'Clássicos de Ouro de Hollywood', durationMin: 120, genre: 'Clássico' },
    { title: 'Drama Premiado: A Caminho de Casa', durationMin: 115, genre: 'Drama' },
    { title: 'Super Tela: O Início do Fim', durationMin: 130, genre: 'Aventura' },
    { title: 'Noite de Cinema: Estreia Especial', durationMin: 120, genre: 'Blockbuster' }
  ],
  series: [
    { title: 'Maratona: Episódio Inédito', durationMin: 50, genre: 'Série Dramática' },
    { title: 'Arquivo Policial: Investigação Criminal', durationMin: 45, genre: 'Policial' },
    { title: 'Mistérios da Cidade: Temporada Final', durationMin: 55, genre: 'Suspense' },
    { title: 'Sitcom em Família: Risadas Sem Fim', durationMin: 30, genre: 'Comédia' },
    { title: 'Crônicas do Futuro: Capítulo 7', durationMin: 60, genre: 'Ficção' }
  ],
  kids: [
    { title: 'Aventuras no Espaço com os Bichos', durationMin: 30, genre: 'Animação' },
    { title: 'O Mundo Mágico dos Brinquedos', durationMin: 40, genre: 'Infantil' },
    { title: 'Turminha Divertida: Missão Secreta', durationMin: 30, genre: 'Desenhos' },
    { title: 'Super Heróis em Ação Kids', durationMin: 45, genre: 'Animação' },
    { title: 'Histórias Encantadas da Floresta', durationMin: 35, genre: 'Educativo' }
  ],
  documentary: [
    { title: 'Planeta Selvagem: Predadores Africanos', durationMin: 60, genre: 'Natureza' },
    { title: 'Segredos do Universo e Telescópios', durationMin: 60, genre: 'Ciência' },
    { title: 'Grandes Construções da Humanidade', durationMin: 60, genre: 'Engenharia' },
    { title: 'Mistérios da Segunda Guerra', durationMin: 90, genre: 'História' },
    { title: 'Oceanos Desconhecidos: Profundezas', durationMin: 60, genre: 'Ecologia' }
  ],
  variety: [
    { title: 'Show de Variedades e Entrevistas', durationMin: 90, genre: 'Entretenimento' },
    { title: 'Novela: Capítulo Especial', durationMin: 55, genre: 'Novela' },
    { title: 'Revista Eletrônica da Tarde', durationMin: 100, genre: 'Variedades' },
    { title: 'Culinária Prática e Sabores do Brasil', durationMin: 45, genre: 'Gastronomia' },
    { title: 'Game Show: Desafio de Perguntas', durationMin: 60, genre: 'Competição' },
    { title: 'Programa Musical: Acústico e Hits', durationMin: 75, genre: 'Música' }
  ]
};

// Simple pseudo-random hash generator based on channel identifier and seed
function getSeedHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

/**
 * Returns dynamic, consistent, and realistic EPG program data for any channel at the current time
 */
export function getChannelEpg(channel: LiveChannel, now: Date = new Date()): ChannelEpgInfo {
  const channelName = (channel.name || '').toUpperCase();
  const channelCat = (channel.category || '').toUpperCase();

  // Determine category group
  let catalog = PROGRAM_CATALOG.variety;
  if (
    channelCat.includes('SPORT') || channelCat.includes('ESPORT') || channelCat.includes('FUTEBOL') ||
    channelName.includes('ESPN') || channelName.includes('SPORTV') || channelName.includes('PREMIERE') || channelName.includes('DAZN')
  ) {
    catalog = PROGRAM_CATALOG.sports;
  } else if (
    channelCat.includes('NOTIC') || channelCat.includes('NEWS') || channelCat.includes('JOURNAL') ||
    channelName.includes('CNN') || channelName.includes('GLOBONEWS') || channelName.includes('BANDNEWS') || channelName.includes('RECORD NEWS')
  ) {
    catalog = PROGRAM_CATALOG.news;
  } else if (
    channelCat.includes('FILM') || channelCat.includes('MOVIE') || channelCat.includes('CINEMA') ||
    channelName.includes('TELECINE') || channelName.includes('HBO') || channelName.includes('MEGAPIX') || channelName.includes('MAX')
  ) {
    catalog = PROGRAM_CATALOG.movies;
  } else if (
    channelCat.includes('SERIE') || channelCat.includes('SERIES') || channelName.includes('WARNER') || channelName.includes('AXN')
  ) {
    catalog = PROGRAM_CATALOG.series;
  } else if (
    channelCat.includes('KID') || channelCat.includes('INFANT') || channelCat.includes('DESENHO') ||
    channelName.includes('CARTOON') || channelName.includes('NICK') || channelName.includes('DISNEY') || channelName.includes('GLOOB')
  ) {
    catalog = PROGRAM_CATALOG.kids;
  } else if (
    channelCat.includes('DOC') || channelCat.includes('DISCOVERY') || channelCat.includes('HISTOR') || channelCat.includes('GEO') ||
    channelName.includes('DISCOVERY') || channelName.includes('HISTORY') || channelName.includes('NAT GEO') || channelName.includes('ANIMAL')
  ) {
    catalog = PROGRAM_CATALOG.documentary;
  }

  // Current time variables
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);

  // Derive unique deterministic offset for this channel
  const channelHash = getSeedHash(channel.id || channel.name || 'default');
  
  // Program block calculations (usually ~60 to 90 min slots)
  const slotLengthMinutes = 75; // average program window
  const slotIndex = Math.floor((currentMinutesFromMidnight + (channelHash % 60)) / slotLengthMinutes);
  
  // Select program from catalog
  const progIndex = (slotIndex + (channelHash % 17) + dayOfYear) % catalog.length;
  const nextProgIndex = (progIndex + 1) % catalog.length;

  const currentDef = catalog[progIndex];
  const nextDef = catalog[nextProgIndex];

  // Calculate start & end times based on slot
  const slotStartMinutes = slotIndex * slotLengthMinutes - (channelHash % 60);
  const normalizedStart = ((slotStartMinutes % 1440) + 1440) % 1440;
  const normalizedEnd = (normalizedStart + currentDef.durationMin) % 1440;

  // Format HH:mm helper
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Calculate progress
  let elapsedMinutes = currentMinutesFromMidnight - normalizedStart;
  if (elapsedMinutes < 0) elapsedMinutes += 1440;
  const progressPercent = Math.min(100, Math.max(5, Math.round((elapsedMinutes / currentDef.durationMin) * 100)));

  const startTimeStr = formatTime(normalizedStart);
  const endTimeStr = formatTime(normalizedEnd);

  const nextStartTimeStr = endTimeStr;
  const nextEndTimeStr = formatTime((normalizedEnd + nextDef.durationMin) % 1440);

  // If specific channel has known title overrides
  let title = currentDef.title;
  if (channelName.includes('GLOBO') && catalog === PROGRAM_CATALOG.variety) {
    const hour = now.getHours();
    if (hour >= 20 && hour < 22) title = 'Novela das 9: Emoções do Capítulo';
    else if (hour >= 12 && hour < 14) title = 'Jornal Local / Globo Esporte';
    else if (hour >= 14 && hour < 16) title = 'Sessão da Tarde: O Grande Desafio';
  } else if (channelName.includes('SBT')) {
    title = 'Programa Silvio Santos & Variedades';
  } else if (channelName.includes('RECORD')) {
    title = 'Balanço Geral / Jornal da Record';
  }

  return {
    currentProgram: {
      title,
      startTime: startTimeStr,
      endTime: endTimeStr,
      progressPercent,
      genre: currentDef.genre,
      description: `Transmissão ao vivo de ${title} no canal ${channel.name}.`
    },
    nextProgram: {
      title: nextDef.title,
      startTime: nextStartTimeStr,
      endTime: nextEndTimeStr
    }
  };
}
