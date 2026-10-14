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

## ✅ Status de Compilação
- **TypeScript / React**: Compilado com 0 erros (`compile_applet`).
- **Linter & Type Checking**: 100% aprovado (`tsc --noEmit`).
- **Kotlin Structure**: Balanceamento sintático `{}` verificado e validado.
