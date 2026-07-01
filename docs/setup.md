# Configuração detalhada

Dois caminhos: o rápido (botão) e o manual (painel Cloudflare, sem terminal).

## Caminho rápido — botão Deploy

1. No README, clique em **Deploy to Cloudflare**.
2. Autorize o GitHub e a Cloudflare. Ela cria o Worker `pageview` e o bucket
   R2 `pageview` automaticamente.
3. Defina o secret (abaixo).

## Caminho manual — painel Cloudflare

### 1. Bucket R2
`dash.cloudflare.com` → **R2 Object Storage** → **Create bucket** → nome
`pageview`.

### 2. Worker
**Workers & Pages** → **Create Worker** → nome `pageview` → **Deploy**. Depois
**Edit code**, apague tudo e cole o conteúdo de `worker/worker.js`. **Deploy**.

### 3. Binding + secret
No Worker → **Settings**:
- **Bindings → Add → R2 bucket**: Variable name `BUCKET`, bucket `pageview`.
- **Variables and Secrets → Add → Secret**: nome `UPLOAD_SECRET`, valor: a
  senha gerada pelo plugin.

## Pegar a URL e testar

Abra `https://pageview.<seu-subdominio>.workers.dev/api/health`. Deve retornar
`secretConfigured: true` e `bucketConfigured: true`.

## Troubleshooting

- **Token recusado (401):** o `UPLOAD_SECRET` do Worker é diferente do colado no
  plugin. Confira os dois.
- **Preview em branco:** abriu `/slug` sem a barra? O Worker redireciona para
  `/slug/`. Se persistir, verifique se o `index.html` subiu (aba No ar).
- **Imagem muito grande / borrada:** páginas muito altas caem para escala 1x
  e/ou PNG automaticamente. Use "Leve" para reduzir tamanho.
- **Bucket não encontrado:** o binding precisa se chamar exatamente `BUCKET`.

## Domínio próprio (opcional)

No Worker → **Settings → Domains & Routes** → adicione `preview.seudominio.com`.
Depois inclua `"https://preview.seudominio.com"` em `networkAccess.allowedDomains`
no `plugin/manifest.json` e use essa URL no plugin.
