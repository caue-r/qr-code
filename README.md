# qr-code

simple as that

Gerador de QR code para URLs, estático, roda no GitHub Pages.

- digite a URL (o `https://` é adicionado se faltar)
- baixe em `png` ou `svg`, ou copie a imagem
- opção de colocar o ícone da mariposa no centro (usa correção de erro `H`)
- `?url=` na query já preenche o campo

## Rodar localmente

```bash
python3 -m http.server
```

## Publicar

Settings → Pages → Deploy from a branch → `main` / `(root)`.

QR gerado com [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), em `vendor/`.
