# MegaTech Cell — RNCWEB

Versão com a bancada 3D e animações originais do modelo tecnica. Sem imagens fotográficas no site público. Contato pelo WhatsApp e catálogo vinculado à API de produtos do Worker existente. Quando a API não está disponível, são exibidas categorias para consulta.

## Executar

`npm ci` e `npm run dev` para desenvolvimento; `npm run build` para gerar `dist/`, incluindo o painel administrativo. Para Cloudflare Workers, configure o comando de build `npm run build` antes de `wrangler deploy`. A configuração D1 original e o Worker foram preservados. Não publicar chaves administrativas no repositório.

Endereço, horários, prazos e preços de serviços não confirmados foram omitidos.

O template editável da página é `src/index.template.html`. O build valida os bundles CSS/JS e publica cópias em `dist/` e na raiz para compatibilidade com o deploy antigo. Preferir `npx wrangler deploy` sem `--assets .`.
