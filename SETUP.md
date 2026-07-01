# Pageview — Configuração (uma vez só, ~5 min)

Tudo pelo painel da Cloudflare, sem terminal.

## 1. Criar o bucket R2

1. Acessa `dash.cloudflare.com` → menu **R2 Object Storage**
2. Se for a primeira vez, ativa o R2 (pode pedir um cartão, mas o free tier de 10 GB não cobra nada)
3. **Create bucket** → nome: `pageview` → Create

## 2. Criar o Worker

1. Menu **Workers & Pages** → **Create** → **Create Worker**
2. Nome: `pageview` → **Deploy** (pode subir o "Hello World" mesmo)
3. Clica em **Edit code**, apaga tudo e cola o conteúdo inteiro do arquivo `worker.js`
4. **Deploy**

## 3. Conectar o bucket e o token

No Worker `pageview` → aba **Settings**:

1. **Bindings** → **Add** → **R2 bucket**
   - Variable name: `BUCKET` (exatamente assim, maiúsculo)
   - R2 bucket: `pageview`
2. **Variables and Secrets** → **Add**
   - Type: **Secret**
   - Name: `UPLOAD_SECRET` (exatamente assim)
   - Value: inventa uma senha forte e longa — esse é o token que vai no plugin
3. **Deploy** de novo se ele pedir

## 4. Pegar a URL

Na página do Worker tem a URL pública, tipo:
`https://pageview.seuusuario.workers.dev`

Abre ela no navegador — se aparecer `Pageview · OND`, tá funcionando.

## 5. Instalar o plugin no Figma

1. Figma desktop → **Plugins → Development → Import plugin from manifest…**
2. Aponta pro `manifest.json` desta pasta
3. Abre o **Pageview**, cola a Worker URL e o token (UPLOAD_SECRET) — fica salvo

## Uso

Seleciona o frame da página → Publicar preview → link no ar em
`https://pageview.seuusuario.workers.dev/nome-da-pagina`

Republicar no mesmo endereço atualiza o preview.

## Domínio próprio (opcional, depois)

No Worker → Settings → **Domains & Routes** → adiciona por exemplo
`preview.seudominio.com.br`. Aí edita no `manifest.json` a lista
`allowedDomains` incluindo `"https://preview.seudominio.com.br"` e
troca a Worker URL no plugin.

## Limites do free (Cloudflare)

- Workers: 100.000 requisições/dia — preview de cliente nunca chega perto
- R2: 10 GB de armazenamento, saída de banda gratuita
- Sem modelo de créditos, sem custo por deploy, publicações ilimitadas
