# Pageview

Publique frames do Figma como páginas de preview no ar — hospedadas no seu
próprio Cloudflare Worker + R2. Um plugin, um link, sem servidor pra manter.

![Pageview](docs/screenshots/plugin.png)

## Como funciona

Você seleciona o frame de uma página no Figma; o plugin exporta a imagem
(inteira ou fatiada por seções), monta um HTML responsivo e publica no seu
Worker. O preview fica em `https://seu-worker.workers.dev/nome-da-pagina`.

## Instalação

### 1. Suba o backend (1 clique)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/eurodrigobispo/pageview)

O botão cria o Worker e o bucket R2 na sua conta Cloudflare automaticamente.

### 2. Defina o token

Por segurança, o secret não é criado pelo botão. No Worker recém-criado:
**Settings → Variables and Secrets → Add** → tipo **Secret**, nome
**`UPLOAD_SECRET`**, valor: uma senha longa (o plugin gera uma pra você).

### 3. Instale o plugin no Figma

Figma desktop → **Plugins → Development → Import plugin from manifest…** →
aponte para `plugin/manifest.json`.

### 4. Conecte

Abra o Pageview, cole a Worker URL e o `UPLOAD_SECRET`, clique **Testar
conexão**. Pronto.

> Prefere o passo-a-passo detalhado (ou sem o botão)? Veja [docs/setup.md](docs/setup.md).

## Uso

1. Selecione o frame da página no canvas.
2. Ajuste o endereço, a qualidade (Nítido/Leve) e a tarja.
3. **Publicar** → link no ar. Republicar no mesmo endereço atualiza o preview.

## Limites (free tier Cloudflare)

- Workers: 100.000 requisições/dia.
- R2: 10 GB de armazenamento, saída de banda gratuita.
- Publicações ilimitadas, sem custo por deploy.

## Licença

MIT — veja [LICENSE](LICENSE).
