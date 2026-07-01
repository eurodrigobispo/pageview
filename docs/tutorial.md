# Tutorial do Pageview

Guia completo, em texto, do zero até publicar seu primeiro preview.

## O que você vai precisar

- **Figma desktop** (o import de plugin em desenvolvimento só existe no app de
  computador).
- Uma conta na **Cloudflare** (grátis).

## Como funciona (a ideia em 30 segundos)

Você seleciona o frame de uma página no Figma. O plugin exporta a imagem —
inteira, ou fatiada automaticamente por seções quando a página é comprida —,
monta uma página HTML responsiva e publica no **seu** Cloudflare Worker. O
resultado fica num link público tipo `https://seu-worker.workers.dev/home`.

O backend é seu: o Worker guarda os previews num bucket R2 (o armazenamento de
arquivos da Cloudflare). Ninguém além de você publica ali, porque toda
publicação exige um token secreto.

---

## Passo 1 — Suba o backend (1 clique)

Clique no botão abaixo. Ele lê a configuração do repositório e cria, **na sua
conta Cloudflare**, o Worker e o bucket R2 automaticamente:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/eurodrigobispo/pageview)

Autorize o GitHub e a Cloudflare quando ele pedir. Ao final, você terá um Worker
no ar numa URL parecida com `https://pageview.seu-usuario.workers.dev`.

> Prefere fazer na mão, sem o botão? O caminho manual completo está em
> [setup.md](setup.md).

## Passo 2 — Defina o token (UPLOAD_SECRET)

Por segurança, o botão **não** cria o token sozinho — esse é o único passo
manual. No Worker que acabou de nascer:

**Settings → Variables and Secrets → Add** → tipo **Secret**, nome exatamente
**`UPLOAD_SECRET`**, e no valor cole uma senha longa.

Dica: abra o plugin e use o botão **Gerar** — ele cria uma senha forte pra você
copiar e colar aqui.

## Passo 3 — Instale o plugin no Figma

No Figma desktop: **Plugins → Development → Import plugin from manifest…** e
aponte para o arquivo `plugin/manifest.json` deste projeto.

## Passo 4 — Conecte

Abra o **Pageview**. Na tela inicial, preencha:

- **Worker URL:** a URL do seu Worker (ex.: `https://pageview.seu-usuario.workers.dev`).
- **Token:** o mesmo `UPLOAD_SECRET` que você definiu no Passo 2.

Clique em **Testar conexão**. Se estiver tudo certo, o plugin destrava o fluxo
de publicação. (Se der erro, veja o [troubleshooting](setup.md#troubleshooting).)

---

## Publicando um preview

1. **Selecione** o frame da página no canvas. O plugin mostra nome, dimensões e
   quantas seções detectou.
2. **Ajuste** o endereço (o final do link), a qualidade e a tarja:
   - **Endereço:** vira o final da URL (`.../liso-supremo`). Ele já sugere um a
     partir do nome do frame.
   - **Qualidade / tamanho:** veja abaixo.
   - **Tarja "visualização da versão desktop":** uma faixa fina no topo do
     preview avisando que é uma prévia. Deixe marcada ou não, como preferir.
3. **Publicar.** Em alguns segundos o link está no ar. **Copiar link** e mandar
   pro cliente.

Publicar de novo no mesmo endereço **atualiza** o preview — o link continua o
mesmo.

## Qualidade: "Nítido" vs "Leve"

- **Nítido:** imagens em alta resolução (2×). Melhor pra telas retina e detalhes
  finos; arquivos um pouco maiores.
- **Leve:** resolução um pouco menor e compressão WebP mais forte. Links mais
  leves, que abrem mais rápido — ótimo pra mandar no WhatsApp ou pra clientes em
  conexões lentas.

Nos dois casos, se a página for muito alta e estourar o limite do navegador na
conversão, o plugin usa PNG automaticamente, sem você precisar fazer nada.

## Gerenciando os previews no ar

No topo do plugin, o botão **No ar (N)** abre a lista de tudo que você já
publicou, com data e tamanho. Dali você abre um preview ou clica em **Tirar do
ar** (com uma confirmação) pra remover.

---

## Dúvidas e problemas

O [guia de setup detalhado](setup.md) tem o caminho manual (sem o botão), a
seção de **troubleshooting** (token recusado, preview em branco, imagem muito
grande) e como usar um **domínio próprio** no lugar do `workers.dev`.
