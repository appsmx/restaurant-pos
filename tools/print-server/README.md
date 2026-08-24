# 🖨️ POS Print Server — Mariscos Quiroa

Servidor local que recibe tickets del POS y los envía automáticamente a la impresora correcta (cocina, barra o caja).

## Instalación (una sola vez)

```bash
cd tools/print-server
npm install
```

## Configuración

### 1. Ver impresoras disponibles

```bash
node server.js --list-printers
```

Esto mostrará algo como:
```
🖨️  Impresoras disponibles:
  1. EPSON_TM-T20III
  2. Star_TSP143
  3. POS-80C-USB
```

### 2. Editar config.json

Pon el nombre **exacto** de cada impresora en el campo `name`:

```json
{
  "port": 9100,
  "printers": {
    "COCINA": {
      "name": "EPSON_TM-T20III"
    },
    "BARRA": {
      "name": "Star_TSP143"
    },
    "CAJA": {
      "name": "POS-80C-USB"
    }
  }
}
```

> Si dejas `"name": ""`, usará la impresora predeterminada del sistema.

### 3. Iniciar el servidor

```bash
npm start
```

Verás:
```
╔══════════════════════════════════════════════════╗
║     🖨️  POS Print Server — Mariscos Quiroa      ║
╚══════════════════════════════════════════════════╝

  Corriendo en: http://localhost:9100

  Destinos configurados:
    🍳 COCINA → EPSON_TM-T20III
    🍺 BARRA  → Star_TSP143
    🧾 CAJA   → POS-80C-USB
```

## Uso desde el POS

El POS enviará automáticamente los tickets al print server cuando esté habilitado. Solo necesitas que el servidor esté corriendo en la misma PC o red local.

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/status` | Verificar que está corriendo |
| GET | `/printers` | Ver impresoras del sistema |
| GET | `/config` | Ver configuración actual |
| POST | `/print` | Enviar ticket a imprimir |

### Ejemplo de POST /print

```json
{
  "destination": "COCINA",
  "ticketNumber": 42,
  "html": "<html>...contenido del ticket...</html>"
}
```

## Ejecución automática al encender la PC

### Windows
1. Crear un acceso directo a `start-print-server.bat`
2. Mover el acceso directo a: `C:\Users\TU_USUARIO\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

### macOS/Linux
Agregar a crontab:
```bash
@reboot cd /ruta/a/tools/print-server && node server.js
```

## Troubleshooting

| Problema | Solución |
|----------|----------|
| "No se encontraron impresoras" | Verifica que la impresora esté conectada y encendida |
| "Error de impresión" | Verifica el nombre exacto en config.json |
| El POS no conecta | Verifica que el server esté corriendo y en el mismo equipo/red |
| Sale diálogo de impresión | Normal en macOS — en Windows debería ser directo |
