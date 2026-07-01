# Changelog

## 2.0.0

- UI reescrita como wizard de 3 passos (selecionar → configurar → publicar).
- Onboarding guiado com botão "Deploy to Cloudflare", gerador de senha e
  "Testar conexão".
- Exportação em WebP com toggle Qualidade/Tamanho e fallback para PNG.
- Repositório reorganizado (`plugin/`, `worker/`, `docs/`) com README e licença.

> Pendência: trocar `SEU-USUARIO/pageview` pelo caminho real do repositório em
> `README.md` e em `plugin/ui.html` (função `updateDeployHref`) após publicar no
> GitHub.
