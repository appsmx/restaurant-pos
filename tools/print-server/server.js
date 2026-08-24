/**
 * POS Print Server — Mariscos Quiroa
 * 
 * Mini servidor local que recibe tickets del POS web y los manda
 * a la impresora correcta según el destino (COCINA, BARRA, CAJA).
 * 
 * Uso:
 *   1. Configurar impresoras en config.json
 *   2. npm install
 *   3. npm start
 *   4. En el POS, habilitar impresión apuntando a http://localhost:9100
 * 
 * Endpoints:
 *   POST /print          — imprimir ticket (body: { destination, html })
 *   GET  /status         — verificar que el server está corriendo
 *   GET  /printers       — listar impresoras del sistema
 *   GET  /config         — ver configuración actual
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// ==================== CONFIG ====================

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const PORT = config.port || 9100;

// ==================== PRINTER UTILITIES ====================

/**
 * Listar impresoras disponibles en el sistema
 */
function listPrinters() {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    let cmd;

    if (platform === 'win32') {
      cmd = 'wmic printer get name';
    } else if (platform === 'darwin') {
      cmd = 'lpstat -p -d';
    } else {
      cmd = 'lpstat -p -d 2>/dev/null || echo "No printers found"';
    }

    exec(cmd, (err, stdout) => {
      if (err) return resolve([]);
      
      if (platform === 'win32') {
        const printers = stdout.split('\n')
          .map(line => line.trim())
          .filter(line => line && line !== 'Name');
        resolve(printers);
      } else {
        const printers = stdout.split('\n')
          .filter(line => line.includes('printer'))
          .map(line => {
            const match = line.match(/printer\s+(\S+)/);
            return match ? match[1] : null;
          })
          .filter(Boolean);
        resolve(printers);
      }
    });
  });
}

/**
 * Imprimir HTML como ticket en la impresora especificada
 * Genera un archivo temporal y lo manda a imprimir
 */
async function printHTML(html, printerName) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `pos-ticket-${Date.now()}.html`);
  
  // Escribir HTML a archivo temporal
  fs.writeFileSync(tmpFile, html, 'utf-8');
  
  const platform = os.platform();

  return new Promise((resolve, reject) => {
    let cmd;

    if (platform === 'win32') {
      // Windows: usar el comando de impresión del sistema
      if (printerName) {
        cmd = `rundll32 mshtml.dll,PrintHTML "${tmpFile}" /p:"${printerName}"`;
      } else {
        cmd = `rundll32 mshtml.dll,PrintHTML "${tmpFile}"`;
      }
    } else if (platform === 'darwin') {
      // macOS
      if (printerName) {
        cmd = `lp -d "${printerName}" "${tmpFile}"`;
      } else {
        cmd = `lp "${tmpFile}"`;
      }
    } else {
      // Linux
      if (printerName) {
        cmd = `lp -d "${printerName}" "${tmpFile}"`;
      } else {
        cmd = `lp "${tmpFile}"`;
      }
    }

    exec(cmd, (err, stdout, stderr) => {
      // Limpiar archivo temporal después de 5 segundos
      setTimeout(() => {
        try { fs.unlinkSync(tmpFile); } catch {}
      }, 5000);

      if (err) {
        console.error(`❌ Error imprimiendo en ${printerName || 'default'}:`, err.message);
        reject(new Error(`Error de impresión: ${err.message}`));
      } else {
        console.log(`✅ Impreso en ${printerName || 'impresora predeterminada'}`);
        resolve({ success: true, printer: printerName || 'default' });
      }
    });
  });
}

// ==================== SERVER ====================

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// GET /status — health check
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'POS Print Server',
    version: '1.0.0',
    platform: os.platform(),
    hostname: os.hostname(),
    uptime: process.uptime(),
    config: {
      COCINA: config.printers.COCINA.name || '(predeterminada)',
      BARRA: config.printers.BARRA.name || '(predeterminada)',
      CAJA: config.printers.CAJA.name || '(predeterminada)',
    },
  });
});

// GET /printers — listar impresoras del sistema
app.get('/printers', async (req, res) => {
  const printers = await listPrinters();
  res.json({ printers, tip: 'Copia el nombre exacto de la impresora a config.json' });
});

// GET /config — ver configuración
app.get('/config', (req, res) => {
  // Recargar config en caso de que se haya editado
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  res.json(config.printers);
});

// POST /print — imprimir un ticket
app.post('/print', async (req, res) => {
  const { destination, html, ticketNumber } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'Se requiere el campo "html" con el contenido del ticket' });
  }

  // Determinar impresora según destino
  const dest = (destination || 'CAJA').toUpperCase();
  const printerConfig = config.printers[dest];
  
  if (!printerConfig) {
    return res.status(400).json({ error: `Destino desconocido: ${dest}. Usa COCINA, BARRA o CAJA` });
  }

  const printerName = printerConfig.name || null; // null = predeterminada

  try {
    const result = await printHTML(html, printerName);
    console.log(`🖨️  Ticket #${ticketNumber || '?'} → ${dest} (${printerName || 'default'})`);
    res.json({ success: true, destination: dest, printer: printerName || 'default' });
  } catch (err) {
    res.status(500).json({ error: err.message, destination: dest });
  }
});

// ==================== START ====================

// Si se pasa --list-printers, solo listar y salir
if (process.argv.includes('--list-printers')) {
  listPrinters().then((printers) => {
    console.log('\n🖨️  Impresoras disponibles en este equipo:\n');
    if (printers.length === 0) {
      console.log('  (No se encontraron impresoras)');
    } else {
      printers.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    }
    console.log('\n📝 Copia el nombre exacto a config.json en el campo "name" del destino deseado.\n');
    process.exit(0);
  });
} else {
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     🖨️  POS Print Server — Mariscos Quiroa      ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Corriendo en: http://localhost:${PORT}`);
    console.log('');
    console.log('  Destinos configurados:');
    console.log(`    🍳 COCINA → ${config.printers.COCINA.name || '(impresora predeterminada)'}`);
    console.log(`    🍺 BARRA  → ${config.printers.BARRA.name || '(impresora predeterminada)'}`);
    console.log(`    🧾 CAJA   → ${config.printers.CAJA.name || '(impresora predeterminada)'}`);
    console.log('');
    console.log('  Comandos útiles:');
    console.log('    node server.js --list-printers   Ver impresoras disponibles');
    console.log('    Editar config.json               Cambiar asignación de impresoras');
    console.log('');
    console.log('  Esperando tickets del POS...');
    console.log('');
  });
}
