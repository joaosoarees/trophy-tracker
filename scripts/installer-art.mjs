// Draws the pictures the installers show and writes them to build/, where
// electron-builder looks for them by name:
//   installerSidebar.bmp / uninstallerSidebar.bmp  164x314, first and last page of the Windows wizard
//   installerHeader.bmp                            150x57, top right of its other pages
//   background.png / background@2x.png             540x380, the window of the macOS disk image
//
//   pnpm installer:art
//
// The pictures are committed; run this only after changing them. Electron
// does the drawing, so no image tool has to be installed. There is no text in
// them: the wizard writes its own, in the language of the system.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow, nativeImage } from 'electron';

// The palette of DESIGN.md.
const NIGHT_NAVY = '#171a21';
const ICON_NAVY = '#22344a';
const SIGNAL_BLUE = '#66c0f4';
const HAIRLINE_SLATE = '#2b3544';
const INK_NAVY = '#0b1722';
// Finder writes the names under the icons in black or in white, after the
// system's appearance and not after this picture: the tray they sit on has
// to carry both.
const TRAY_STEEL = '#5f7389';

/** The trophy of the app icon (Lucide's outline), on its 24 px grid. */
const trophy = (stroke, width, opacity = 1) => `
  <g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/>
    <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/>
    <path d="M18 9h1.5a1 1 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/>
    <path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>
  </g>`;

const field = (width, height) => `
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ICON_NAVY}"/>
      <stop offset="1" stop-color="${NIGHT_NAVY}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#field)"/>`;

/** The app icon's tile, `size` px wide, with its top left corner at x, y. */
const tile = (x, y, size) => `
  <g transform="translate(${x} ${y})">
    <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${NIGHT_NAVY}" stroke="${SIGNAL_BLUE}" stroke-opacity="0.3"/>
    <g transform="translate(${size * 0.2} ${size * 0.2}) scale(${(size * 0.6) / 24})">${trophy(SIGNAL_BLUE, 1.7)}</g>
  </g>`;

const svg = (width, height, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

// One trophy far larger than the page, running off its edges, behind the
// icon at reading size: the same mark twice, once as the place and once as
// the name.
const sidebar = svg(
  164,
  314,
  `${field(164, 314)}
   <g transform="translate(18 96) scale(11.5)">${trophy(SIGNAL_BLUE, 0.55, 0.22)}</g>
   ${tile(22, 26, 44)}
   <rect x="163" width="1" height="314" fill="${HAIRLINE_SLATE}"/>`,
);

const header = svg(
  150,
  57,
  `${field(150, 57)}
   <g transform="translate(-22 -26) scale(4.6)">${trophy(SIGNAL_BLUE, 0.6, 0.22)}</g>
   ${tile(100, 10, 37)}`,
);

// The app on the left, Applications on the right (the places are set in
// electron-builder.yml), and the way from one to the other between them.
const diskImage = svg(
  540,
  380,
  `${field(540, 380)}
   <rect x="50" y="105" width="440" height="180" rx="18" fill="${TRAY_STEEL}"/>
   <g fill="none" stroke="${INK_NAVY}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
     <path d="M236 190h68"/>
     <path d="M286 172l18 18-18 18"/>
   </g>`,
);

let canvasPage;

/**
 * Draws an SVG at `scale` times its size and answers the picture. The page
 * paints it on a canvas and hands the result back, which works in a window
 * that is never shown.
 */
async function draw(source, width, height, scale = 1) {
  if (!canvasPage) {
    canvasPage = new BrowserWindow({ show: false });
    await canvasPage.loadURL('about:blank');
  }
  const dataUrl = await canvasPage.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = ${width * scale};
        canvas.height = ${height * scale};
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('the picture could not be drawn'));
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(source)});
    })`);
  return nativeImage.createFromDataURL(dataUrl);
}

/** The wizard only reads bitmaps: 24 bits a pixel, rows from the bottom up. */
function toBmp(image) {
  const { width, height } = image.getSize();
  const pixels = image.toBitmap();
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const file = Buffer.alloc(54 + rowSize * height);
  file.write('BM');
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(width, 18);
  file.writeInt32LE(height, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      // Both sides keep a pixel as blue, green, red.
      pixels.copy(
        file,
        row + x * 3,
        (y * width + x) * 4,
        (y * width + x) * 4 + 3,
      );
    }
  }
  return file;
}

// Electron only reports being ready once this file has finished loading, so
// the work cannot wait for it at the top level.
async function main() {
  const out = (name) => join('build', name);
  const side = await draw(sidebar, 164, 314);
  writeFileSync(out('installerSidebar.bmp'), toBmp(side));
  writeFileSync(out('uninstallerSidebar.bmp'), toBmp(side));
  writeFileSync(out('installerHeader.bmp'), toBmp(await draw(header, 150, 57)));
  writeFileSync(
    out('background.png'),
    (await draw(diskImage, 540, 380)).toPNG(),
  );
  writeFileSync(
    out('background@2x.png'),
    (await draw(diskImage, 540, 380, 2)).toPNG(),
  );
  // What a person looks at to judge them; the wizard's own are bitmaps.
  if (process.env.INSTALLER_ART_PREVIEW) {
    const preview = (name) => join(process.env.INSTALLER_ART_PREVIEW, name);
    writeFileSync(
      preview('sidebar.png'),
      (await draw(sidebar, 164, 314, 3)).toPNG(),
    );
    writeFileSync(
      preview('header.png'),
      (await draw(header, 150, 57, 3)).toPNG(),
    );
  }
}

void app
  .whenReady()
  .then(main)
  .finally(() => app.quit());
