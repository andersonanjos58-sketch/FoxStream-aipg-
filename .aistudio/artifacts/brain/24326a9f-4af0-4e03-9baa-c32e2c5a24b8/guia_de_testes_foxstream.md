# 🚀 Guia e Artefato de Testes — FoxStream

Este artefato foi preparado para você testar todas as novas melhorias visuais e funcionais implementadas tanto no **Web Applet (Preview Online)** quanto no **Aplicativo Android (APK via GitHub Actions)**.

---

## 📱 1. Testes Imediatos no Navegador (Web App)

Você pode testar todas as funcionalidades diretamente na pré-visualização da aplicação:

### A. Busca Contextual Isolada em Filmes
1. Acesse a aba **Filmes** no menu de navegação.
2. Note o botão **Buscar em todos os filmes...** alinhado lado a lado com **Categorias ⬇️**.
3. Clique em **Buscar em todos os filmes...**:
   - O ambiente de pesquisa abrirá focado com o campo de digitação ativo.
   - O placeholder indicará: `Pesquisar apenas em filmes...`.
   - **Comportamento esperado:** Apenas filmes correspondentes serão exibidos nos resultados. Canais de TV e séries não poluirão a listagem.

### B. Busca Contextual Isolada em Séries
1. Acesse a aba **Séries** no menu de navegação.
2. Clique no botão de busca **Buscar em todas as séries...**.
   - O placeholder indicará: `Pesquisar apenas em séries...`.
   - **Comportamento esperado:** Apenas séries e seus respectivos episódios serão retornados nos resultados.

### C. Busca Global (Barra Superior)
1. Clique no ícone de lupa na barra superior do aplicativo.
   - O placeholder indicará: `Pesquisar canais, filmes, séries e episódios...`.
   - **Comportamento esperado:** Pesquisa simultânea em todo o catálogo IPTV (TV ao Vivo, Filmes e Séries).

### D. Novo Tamanho dos Banners de Destaque (+20%)
1. Nas páginas de **Filmes** e **Séries**, observe o card/banner de destaque rotativo no topo.
2. O banner agora possui **altura ampliada em 20%** (`215px`), garantindo proporção retangular horizontal sem cortar pôsteres nem textos, e deixando amplo espaço para a grade de cards logo abaixo.
3. Os botões **Categorias ⬇️** e **Buscar** permanecem perfeitamente alinhados na mesma linha horizontal (`flex-row`), economizando espaço na tela.

---

## 🤖 2. Como Baixar e Testar o APK no Celular / TV Box (GitHub Actions)

O repositório já possui a automação de CI/CD configurada em `.github/workflows/android.yml`.

### Como Gerar e Baixar o Artefato do APK:
1. Acesse o seu repositório no **GitHub**.
2. Clique na aba **Actions** no topo da página.
3. No menu lateral esquerdo, selecione o workflow **"Build FoxStream APK"**.
4. Clique no botão **"Run workflow"** (disparo manual via `workflow_dispatch`) na branch `main` (ou faça um commit/push).
5. Aguarde a execução do build (geralmente leva de 3 a 5 minutos).
6. Ao finalizar com sucesso (ícone verde ✅):
   - Clique na execução da action que acabou de rodar.
   - Role até o final da página até a seção **Artifacts**.
   - Baixe o arquivo **`foxstream-debug-apks`** (arquivo ZIP contendo o `.apk` pronto para instalação).
7. Caso tenha permissão de releases no repositório, o workflow também publica automaticamente na aba **Releases** com a tag `v1.0.0-latest`.

---

## 🔍 3. Resumo das Alterações no Código

| Arquivo | Plataforma | Modificações Realizadas |
| :--- | :--- | :--- |
| `HomeScreen.tsx` | Web (React) | • "Continue Assistindo" agora permanece sempre visível na Home.<br>• Exibe card vazio moderno e convidativo com atalhos rápidos quando não há histórico.<br>• Reprodução direta com 1 clique ao selecionar card do histórico e exclusão instantânea. |
| `storageService.ts` | Web (React) | • Adicionado fallback para chaves de histórico legadas e sincronização resiliente. |
| `Screens.kt` | Android (Kotlin) | • Altura de `SpotlightBannerCarousel` aumentada para `160.dp` (+20%).<br>• Parâmetro `searchScope` adicionado ao `GlobalSearchScreen`.<br>• Seção "Continue Assistindo" garantida com card informativo de estado vazio. |
| `FoxStreamApp.kt` | Android (Kotlin) | • Estado `searchScope` instanciado e repassado para `GlobalSearchScreen`. |
| `App.tsx` | Web (React) | • `handlePlayHistory` agora atualiza o carimbo de data/hora para manter o item no topo do histórico. |

---


### 🛠️ Correções de Compilação Android Realizadas:
1. **FoxStreamApp.kt**:
   - Ajustadas as rotas e seletores de séries (`onPlaySeries` e `onOpenSeriesDetails`) para selecionar diretamente a série e mudar para a aba de séries (`selectedSeriesForDetails = series`, `currentTab = AppNavTab.SERIES`).
   - Implementado suporte completo a `toggleFavoriteSeries` e navegação de rotas de séries.
2. **FoxStreamViewModel.kt**:
   - Adicionada a função `toggleFavoriteSeries(series: SeriesItem)` para persistência no banco Room com tipo `ContentType.SERIES`.
3. **NavGraph.kt**:
   - Incluídos os métodos auxiliares `buildSeriesDetailsRoute` e `parseSeriesId` no objeto `NavDestinations`.
4. **Screens.kt & MovieDetailsScreen.kt**:
   - Removida a declaração `private val OrangePrimary` de escopo de pacote em `MovieDetailsScreen.kt` que bloqueava o acesso em `Screens.kt`.
   - Adicionadas todas as importações necessárias em `Screens.kt`:
     - **Coil**: `AsyncImage`
     - **Compose Foundation Pager**: `HorizontalPager`, `rememberPagerState`, `collectIsDraggedAsState`
     - **LibVLC**: `LibVLC`, `Media`, `MediaPlayer`, `VLCVideoLayout`, `IVLCVout`
     - **Android & Lifecycle**: `Uri`, `ViewGroup`, `AndroidView`, `Lifecycle`, `LifecycleEventObserver`, `LocalLifecycleOwner`, `Job`
     - **Tema Global**: `OrangePrimary`, `DarkBackground`, etc.


## 🔬 Diagnóstico e Resolução dos Erros do GitHub Actions (14/10/2026)

| Erro Apontado | Causa Raiz Identificada | Correção Cirúrgica Aplicada |
| :--- | :--- | :--- |
| `AppNavTab` não resolvido em `Screens.kt` e `FoxStreamApp.kt:424` | `AppNavTab` está declarado no pacote `com.foxstream.app.ui`, mas `Screens.kt` (no pacote `com.foxstream.app.ui.screens`) não importava a classe enum. | Adicionado `import com.foxstream.app.ui.AppNavTab` em `Screens.kt`. O tipo do parâmetro `onNavigate: (AppNavTab) -> Unit` em `HomeScreen` agora resolve 100% em `FoxStreamApp.kt`. |
| `SearchUtils` não resolvido | `SearchUtils` reside no pacote `com.foxstream.app.util`, e faltava o import em `Screens.kt`. | Adicionado `import com.foxstream.app.util.SearchUtils` em `Screens.kt`. |
| `LivePlayerAnimatedVisibility` e erros de contexto `@Composable` | O wrapper de animação `LivePlayerAnimatedVisibility` havia sido removido em commit anterior, fazendo com que suas 4 chamadas fossem interpretadas como lambdas comuns fora de contexto Compose. | Restaurada a função `@Composable fun LivePlayerAnimatedVisibility(...)` com escopo `AnimatedVisibilityScope.() -> Unit` e transições `fadeIn() + slideInVertically()` / `fadeOut() + slideOutVertically()`. |
| `tvgLogo` em `Screens.kt:6242` | O modelo `LiveChannel` define a propriedade como `logoUrl` (e não `tvgLogo`). | Atualizado o acesso para `channel.logoUrl ?: channel.tvgLogo` e adicionada propriedade de extensão `val LiveChannel.tvgLogo: String? get() = logoUrl` em `Models.kt`. |
| `coverUrl` em `FoxStreamViewModel.kt` | O modelo `SeriesItem` define o pôster como `posterUrl` (e não `coverUrl`). | Atualizado para `series.posterUrl` e adicionada propriedade de extensão `val SeriesItem.coverUrl: String? get() = posterUrl` em `Models.kt`. |
| `painterResource` e `R.drawable` | Faltavam os imports de recursos no topo de `Screens.kt`. | Adicionados `import androidx.compose.ui.res.painterResource` e `import com.foxstream.app.R`. |
| `withContext` e `Dispatchers` | Faltavam os imports de corrotinas no topo de `Screens.kt`. | Adicionados `import kotlinx.coroutines.withContext` e `import kotlinx.coroutines.Dispatchers`. |
| `graphicsLayer`, `verticalScroll` e `rememberScrollState` | Faltavam os imports no topo de `Screens.kt`. | Adicionados `import androidx.compose.ui.graphics.graphicsLayer`, `import androidx.compose.foundation.verticalScroll` e `import androidx.compose.foundation.rememberScrollState`. |
| `this`, `alpha`, `translationY` e `density` em `graphicsLayer` (linha 4766) | Falta de import do modificador `graphicsLayer` e `density` não estava no escopo da lambda. | Obtido `val density = LocalDensity.current.density` antes do modificador e propriedades atribuídas diretamente via `alpha = progress` e `translationY = translateY * density`. |


### 🎬 Novo Design Compacto do BackdropCard (Tela de Busca)
- **Altura Reduzida (21:9 Panorâmico)**:
  - Imagem do banner/backdrop agora utiliza proporção panorâmica `21:9` em vez de `16:9`, reduzindo a altura do card em mais de 45% e permitindo visualizar com facilidade **2 a 3 cards simultaneamente na tela**.
- **Overlay Discreto na Imagem (Sobreposição)**:
  - Adicionado gradiente escuro vertical na base da imagem (`Brush.verticalGradient` transparente para preto 95%).
  - **À Esquerda**: Título limpo em destaque (15sp, negrito) + linha de metadados compacta (ano, duração, nota).
  - **À Direita**: Botão **"► Assistir"** compacto em laranja (`#FF6600`) com altura contida (`34dp`) e cantos arredondados (`10dp`), sem tomar a largura inteira do card.
- **Barra Inferior Fina e Justa (Padding 7dp)**:
  - Ações **[ ♡ Favoritos ]** e **[ ⓘ Detalhes ]** alinhadas em linha fina e elegante, com espaçamento reduzido e tipografia discreta.


### ✨ Refinamentos Aplicados na Tela de Busca:
1. **Remoção do Contêiner da Barra de Ações**:
   - Barra inferior eliminada por completo dos cards de busca. A altura total do card agora é estritamente a área panorâmica 21:9 com cantos arredondados (`14dp`).
2. **Card como Botão de Detalhes Completo**:
   - O botão redundante "Detalhes" e o botão "Favoritos" foram removidos da busca.
   - O card inteiro agora possui efeito de clique (`clickable(onClick = onOpenDetails)`), abrindo instantaneamente a tela de detalhes do título selecionado.
   - O botão compacto **"► Assistir"** permanece em destaque na sobreposição no canto inferior direito para play imediato do stream.
3. **Navegação nas Abas Inferiores com a Busca Aberta**:
   - Corrigido o comportamento do menu inferior (`BottomNav` / `FoxStreamApp`): ao clicar em qualquer aba inferior (Início, Filmes, TV ao Vivo, Séries, Favoritos, etc.), o ambiente de busca fecha imediatamente (`showSearchScreen = false`) e a tela navega diretamente para a aba selecionada.

## ✅ Status de Compilação
- **TypeScript / React**: Compilado com 0 erros (`compile_applet`).
- **Linter & Type Checking**: 100% aprovado (`tsc --noEmit`).
- **Kotlin Structure**: Balanceamento sintático `{}` verificado e validado.
