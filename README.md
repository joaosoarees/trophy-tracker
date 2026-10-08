# Conquistas da Steam

App desktop (Electron + React) que mostra, para o jogo aberto na Steam, as conquistas que faltam, as ocultas reveladas, contadores de progresso e atalhos para guias. Roda no WSL (janela via WSLg) e conversa com o cliente Steam do Windows.

## Preparar

```bash
sudo apt install libnss3 libnspr4 libasound2t64   # bibliotecas que o Electron precisa
npm install
```

## Usar

```bash
npm run dev     # desenvolvimento, com recarga
npm run build && npm start
npm test
```

Na primeira execução o app pede o SteamID, uma chave da Web API (https://steamcommunity.com/dev/apikey) e confere a privacidade do perfil. A configuração fica em `~/.config/steam-trophy-tracker/`.
