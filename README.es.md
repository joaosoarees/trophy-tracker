<p align="center">
  <img src="build/icon.png" width="96" alt="" />
</p>

<h1 align="center">Trophy Tracker</h1>

<p align="center">
  Mira lo que te falta en el juego de Steam que estás jugando, sin salir del juego.
</p>

<p align="center">
  <a href="https://github.com/joaosoarees/trophy-tracker/releases/latest"><img src="https://img.shields.io/github/v/release/joaosoarees/trophy-tracker?label=release" alt="Última versión" /></a>
  <a href="https://github.com/joaosoarees/trophy-tracker/actions/workflows/ci.yml"><img src="https://github.com/joaosoarees/trophy-tracker/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/joaosoarees/trophy-tracker"><img src="https://codecov.io/gh/joaosoarees/trophy-tracker/graph/badge.svg" alt="Cobertura de pruebas" /></a>
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-2b3544" alt="Windows, macOS y Linux" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/joaosoarees/trophy-tracker" alt="Licencia Apache 2.0" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.pt-BR.md">Português</a> · <strong>Español</strong> · <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <img src="docs/screenshots/unlock.gif" width="600" alt="La app cambia al juego que se abrió en Steam, muestra un logro en cuanto se desbloquea y, después, el juego terminado al 100 %." />
</p>

Steam enumera los logros que te faltan sin decir cómo conseguirlos, esconde los ocultos y reparte tu progreso en una página por juego. Trophy Tracker es una ventana estrecha que se queda al lado del juego, en un segundo monitor, y responde a la pregunta que un cazador de logros se hace una y otra vez: **¿qué falta, y cómo lo consigo?**

Es gratis, de código abierto y no tiene afiliación con Valve ni con Steam.

## Qué hace

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Sigue el juego que abres</h3>
      <p>Abre un juego en Steam y la app cambia a él por sí sola. Sin ningún juego abierto, muestra el último que jugaste. Un logro desbloqueado mientras juegas aparece solo, con cuántos quedan.</p>
      <h3>Logros ocultos, a la vista</h3>
      <p>Nombre y descripción de los logros que Steam esconde, lo raro que es cada uno y los contadores de progreso de la propia Steam, en los juegos que los tienen.</p>
      <h3>A un clic de una guía</h3>
      <p>Cada logro abre una búsqueda de cómo conseguirlo, en las guías de la comunidad de Steam, en YouTube o en Google.</p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/game.png" alt="La pantalla del juego: la cabecera con su progreso y la lista de logros pendientes, cada uno con su rareza, los enlaces a guías y las herramientas del usuario." />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/game-details.png" alt="Los detalles de un juego: tiempo jugado, última vez, el logro más raro y los que tienen contador." />
    </td>
    <td width="50%" valign="top">
      <h3>Lo que Steam no sigue, lo sigues tú</h3>
      <p>Steam no te dice qué coleccionables te faltan. Cada logro puede llevar tu propia lista, una nota, una marca de fijado y un enlace al vídeo o a la guía que sigues, guardados en tu ordenador entre una sesión y otra.</p>
      <h3>Todos los juegos, por lo que les falta</h3>
      <p>Un panel enumera lo que has jugado, ordenado por lo cerca que está cada juego del 100 %, y un juego terminado recibe la única celebración de la app.</p>
      <p><img src="docs/screenshots/dashboard.png" alt="El panel: los juegos jugados con su progreso." /></p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Varias cuentas</h3>
      <p>Añade más de una cuenta de Steam y cambia entre ellas con un clic; cada una guarda su propia clave, sus notas, listas y enlaces. La app sigue a la cuenta que tenga la sesión iniciada en Steam.</p>
      <h3>En tu idioma</h3>
      <p>Inglés, portugués de Brasil, español y francés. El idioma cambia toda la app, incluidos los nombres de los logros que envía Steam.</p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/settings.png" alt="Ajustes: dos cuentas como tarjetas, la que está en uso con su clave enmascarada." />
    </td>
  </tr>
</table>

### Con tus colores

Cinco temas: Navy, con el que empieza la app y el de las imágenes de arriba, y Dracula, Gruvbox, Solarized Light y Synthwave. Cada cuenta guarda el suyo, así que cambiar de cuenta cambia los colores con ella. Todos los temas pasan la misma comprobación de contraste.

<p>
  <img src="docs/screenshots/theme-dracula.png" width="24%" alt="La pantalla del juego en el tema Dracula: fondo gris violáceo con acento morado." />
  <img src="docs/screenshots/theme-gruvbox.png" width="24%" alt="La pantalla del juego en el tema Gruvbox: fondo oscuro cálido con acento azul grisáceo." />
  <img src="docs/screenshots/theme-solarized-light.png" width="24%" alt="La pantalla del juego en el tema Solarized Light: fondo crema con acento azul." />
  <img src="docs/screenshots/theme-synthwave.png" width="24%" alt="La pantalla del juego en el tema Synthwave: fondo morado nocturno con acento rosa." />
</p>

## Descarga

Descarga el instalador de tu sistema desde la [última versión](https://github.com/joaosoarees/trophy-tracker/releases/latest):

| Sistema | Archivo                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------- |
| Windows | `Trophy-Tracker-<version>-Windows.exe`                                                          |
| macOS   | `Trophy-Tracker-<version>-macOS-arm64.dmg` (Apple Silicon) o `-macOS-x64.dmg` (Intel)           |
| Linux   | `Trophy-Tracker-<version>-Linux.AppImage` (cualquier distribución) o `-Linux-Debian-Ubuntu.deb` |

La primera vez, la app pide un idioma, tu SteamID y tu propia [clave de la Web API de Steam](https://steamcommunity.com/dev/apikey), y comprueba que los detalles de juego de tu perfil son públicos. En Windows y con el AppImage de Linux se mantiene al día por sí sola; en macOS y con el `.deb` te avisa cuando hay una versión nueva.

**Los instaladores no están firmados**, y no hay fecha para que eso cambie, así que el sistema avisa la primera vez:

- **Windows:** en el aviso de SmartScreen, elige «Más información» y luego «Ejecutar de todas formas». Si el **Control inteligente de aplicaciones** está activado (Seguridad de Windows → Control de aplicaciones y navegador), Windows puede negarse a ejecutar el instalador, sin forma de permitirlo.
- **macOS:** después del primer intento de abrir la app, ve a Ajustes del Sistema → Privacidad y seguridad y elige «Abrir igualmente».
- **Linux:** `sudo apt install ./Trophy-Tracker-<version>-Linux-Debian-Ubuntu.deb`, o haz ejecutable el AppImage (`chmod +x`) y ábrelo.

Lo que cambió en cada versión está en el [registro de cambios](CHANGELOG.md), en inglés.

## Privacidad

Trophy Tracker no tiene cuenta, ni servidor, ni telemetría. Solo se comunica con:

- **Steam** (`api.steampowered.com` y los servidores de imágenes de Steam), con la clave de la Web API y el SteamID que le das, para leer tus juegos y logros;
- **GitHub** (`api.github.com` y `github.com`), para buscar una versión más nueva y, en Windows y con el AppImage de Linux, descargarla.

Tus claves, notas, listas y enlaces se guardan solo en tu ordenador, en `%APPDATA%\trophy-tracker` (Windows), `~/Library/Application Support/trophy-tracker` (macOS) o `~/.config/trophy-tracker` (Linux). Una clave guardada no se vuelve a mostrar, solo sus cuatro últimos caracteres. Los errores se escriben en un archivo de registro local y nunca se envían a ningún sitio.

## Cómo está hecho

Electron, React y TypeScript, con el cuidado que una herramienta pequeña rara vez recibe:

- **Probado donde decide algo.** Más de 1600 pruebas cubren la lógica que lee Steam, guarda tus datos y actualiza la app. Se ejecutan en Windows, macOS y Linux en cada envío, y la insignia de arriba dice cuánto de esa lógica cubren.
- **La interfaz la audita un script, no la memoria.** `pnpm audit:ui` maneja la app compilada contra un sustituto de Steam: recorre la configuración inicial, cada pantalla y los flujos que ninguna imagen suelta muestra (un juego que empieza, un logro desbloqueado, Steam fuera de servicio), y comprueba la accesibilidad con axe, el foco de teclado, el estado al pasar el puntero y el desbordamiento. Las imágenes de esta página salen del mismo sustituto.
- **Un catálogo de componentes.** `pnpm storybook` muestra cada pieza por separado, en todos sus estados, en los cuatro idiomas, en los cinco temas y en los dos anchos para los que está hecha la ventana.
- **Tus archivos no se pierden por un fallo.** Cada uno se escribe entero antes de sustituir al anterior, y un archivo que no se puede leer se guarda aparte, nunca se sobrescribe.
- **Las versiones se construyen solas.** Una etiqueta de versión hace que GitHub Actions construya y pruebe los instaladores en los tres sistemas y los publique con sus notas.
- **Un sistema de diseño por escrito** ([DESIGN.md](DESIGN.md)) y las razones de las decisiones que no son evidentes ([docs/DECISIONS.md](docs/DECISIONS.md)).

## Desarrollo

```bash
corepack enable   # una vez; da la versión de pnpm fijada en package.json
pnpm install
pnpm dev          # la app, con recarga
```

El proyecto solo se instala con pnpm. En WSL o en un Linux mínimo, Electron necesita además `sudo apt install libnss3 libnspr4 libasound2t64`.

```bash
pnpm test && pnpm lint && pnpm typecheck
pnpm audit:ui      # la auditoría de la interfaz
pnpm storybook     # el catálogo de componentes
pnpm dist          # instaladores del sistema en el que estás, en dist/
pnpm screenshots   # las imágenes de esta página
```

Cómo se organiza el código y las reglas que sigue cada cambio están en [CLAUDE.md](CLAUDE.md); las reglas de cada área, y cómo funcionan las versiones y la auditoría, en [docs/](docs). El código, los comentarios y la documentación del repositorio están en inglés.

## Licencia

[Apache 2.0](LICENSE)
