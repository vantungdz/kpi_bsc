// PlantUML Plugin for v-md-editor
// Renders PlantUML diagrams using PlantUML official server

function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  let r = '';
  r += encode6bit(c1 & 0x3f);
  r += encode6bit(c2 & 0x3f);
  r += encode6bit(c3 & 0x3f);
  r += encode6bit(c4 & 0x3f);
  return r;
}

function encodePlantUML(data) {
  let bytes;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }

  let r = '';
  for (let i = 0; i < bytes.length; i += 3) {
    if (i + 2 === bytes.length) {
      r += append3bytes(bytes[i], bytes[i + 1], 0);
    } else if (i + 1 === bytes.length) {
      r += append3bytes(bytes[i], 0, 0);
    } else {
      r += append3bytes(bytes[i], bytes[i + 1], bytes[i + 2]);
    }
  }
  return r;
}

function deflate(data) {
  if (typeof window !== 'undefined' && window.pako) {
    try {
      return window.pako.deflate(data, { level: 9 });
    } catch (e) {
      return data;
    }
  }
  return data;
}

export default function createPlantUMLPlugin(options = {}) {
  const serverUrl = options.serverUrl || "http://www.plantuml.com/plantuml/svg";

  return (md) => {
    const defaultRenderer = md.renderer.rules.fence;

    md.renderer.rules.fence = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const language = token.info.trim().toLowerCase();

      if (language === "plantuml") {
        const code = token.content.trim();

        try {
          const deflated = deflate(code);
          const encoded = encodePlantUML(deflated);
          const imageUrl = `${serverUrl}/~1${encoded}`;

          return `<div class="plantuml-diagram" style="margin: 20px 0; text-align: center;">
            <img src="${imageUrl}" alt="PlantUML Diagram" class="plantuml-image" style="max-width: 100%; height: auto; border: 1px solid #e8e8e8; border-radius: 4px; padding: 10px; background: white;"
              onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'plantuml-error\\' style=\\'color: red; padding: 20px; border: 1px solid red; border-radius: 4px;\\'>❌ Failed to load PlantUML diagram from server.</div>';" />
          </div>`;
        } catch (e) {
          return `<div class="plantuml-error" style="color: red; padding: 20px; border: 1px solid red; border-radius: 4px; margin: 20px 0;">
            <p><strong>❌ Failed to render PlantUML diagram</strong></p>
          </div>`;
        }
      }

      return defaultRenderer(tokens, idx, options, env, self);
    };
  };
}
