# ToneAway

**Prototipo funcional de atenuación de interferencias tonales estables en grabaciones de voz, basado en el método iterativo de Jacobi.** Interfaz en español. Todo el audio se procesa localmente en el navegador.

## Arranque rápido (Windows / macOS / Linux)

Requisitos: Node.js 20 o superior, npm, un navegador moderno (Chrome, Edge o Firefox) e internet únicamente para la instalación de dependencias y el despliegue.

```bash
npm install
npm run dev
```

Abrir la dirección local que muestra Vite, normalmente **http://localhost:5173**. Puedes usar el botón **Usar grabación de ejemplo** y luego seleccionar los picos sugeridos, o subir un WAV/MP3 existente que contenga tonos no deseados.

Para compilar y previsualizar la versión de producción:

```bash
npm run build
npm run preview
```

Para ejecutar las pruebas numéricas automatizadas (sin dependencias adicionales aparte de TypeScript):

```bash
npm run test:core
```

## Despliegue en Vercel

1. Subir esta carpeta a un repositorio Git (por ejemplo, GitHub). No subir `node_modules` ni `dist`.
2. En [Vercel](https://vercel.com/new), elegir **Add New Project** e importar el repositorio.
3. Framework: **Vite**. Build command: `npm run build`. Output directory: `dist` (ya incluidos en `vercel.json`).
4. Pulsar **Deploy**. No requiere variables de entorno, claves API, cuenta de audio ni base de datos.

También puede usarse Vercel CLI desde una terminal con sesión iniciada (`npm install -g vercel`, luego `vercel --prod`), una vez instaladas las dependencias y verificada la compilación local.

## Cómo se utiliza

1. **Cargar un audio.** Se acepta audio decodificable por el navegador, recomendado WAV/MP3. El demo incluido es una grabación de voz sintética **ya contaminada** con cuatro tonos. La aplicación jamás agrega interferencia al audio.
2. **Elegir frecuencias.** Haz clic sobre el espectro, pulsa un pico sugerido o introduce una frecuencia precisa. Los chips permiten editarla o eliminarla. Admite **1–6 tonos**.
3. **Atenuar.** El Worker construye las ecuaciones normales de la base seno/coseno y las resuelve **por Jacobi**. Sustrae las sinusoides estimadas, no el término constante.
4. **Comparar.** Usa Entrada/Procesado con un único reproductor que conserva la posición al alternar. Observa el espectro calculado de cada señal con una escala fija.
5. **Descargar.** Exporta audio procesado mono a WAV PCM de 16 bits. Los indicadores de convergencia y cambios espectrales se derivan del cómputo real.

## Grabación incluida

`public/audio/entrevista_ruidosa.wav` contiene **12 segundos** de voz en español sintetizada previamente con eSpeak y contaminada **fuera de ToneAway** con cuatro tonos estables: **620,25 Hz; 800,35 Hz; 1.100,45 Hz; 1.450,55 Hz**. Esto permite ensayar la demostración sin depender del micrófono del auditorio. Se recomienda sustituirla por una grabación propia más natural antes de una presentación importante si se desea mayor realismo vocal.

El archivo puede recrearse opcionalmente con `python scripts/create_demo.py` si se dispone de **eSpeak** y **ffmpeg**. La aplicación no necesita estas herramientas; son únicamente para preparar el WAV de demostración.

Las sugerencias del espectro son estimaciones automáticas que **no identifican por sí solas cuáles sonidos son indeseados**. La decisión de seleccionarlos corresponde al usuario.

## Base numérica y límites

Modelo para la señal observada `y` y frecuencias seleccionadas `f_j`:

```text
V = [1, cos(2πf₁t), sin(2πf₁t), ..., cos(2πfₚt), sin(2πfₚt)]
G = VᵀV                 (normalizado por el número de muestras)
b = Vᵀy                 (normalizado por el número de muestras)
Jacobi: cᵢ(k+1) = (bᵢ − Σⱼ≠ᵢ Gᵢⱼ cⱼ(k)) / Gᵢᵢ
parada: ||b − Gc||₂ / max(||b||₂, 10⁻¹⁵) ≤ 10⁻⁸
señal procesada = y − Σⱼ[ Aⱼ cos(2πfⱼt) + Bⱼ sin(2πfⱼt) ]
```

- **No se utiliza ningún solver directo** de sistemas lineales, ni librerías para sustituir a Jacobi. La FFT radix-2 se utiliza solamente para el espectro y la sugerencia de frecuencias, nunca para ajustar los coeficientes.
- Se normalizan las ecuaciones normales por N para mejorar el escalado numérico; no cambia su solución.
- Se permite hasta seis frecuencias entre 20 Hz y el menor de 20 kHz o Nyquist, con guardas contra duplicados/columnas demasiado próximas, límite de 2.000 iteraciones, detección de divergencia y reporte explícito de no convergencia. La convergencia de Jacobi no está garantizada para toda selección.
- **Modelo de tono estacionario:** la frecuencia, amplitud y fase se suponen aproximadamente constantes durante la grabación. No elimina ruido de banda ancha, tonos que deriven con el tiempo, ni necesariamente sonidos legítimos de la voz en las mismas frecuencias.
- Se mezclan canales de entrada a **mono**, conservando la frecuencia de muestreo real (no se fuerza 4 kHz). El prototipo acepta una duración entre 0,75 y 30 segundos y archivos de hasta 45 MB. La FFT utiliza un máximo de ~10,9 s de audio a 48 kHz para el análisis del espectro, con ventana Hann y relleno de ceros.
- Los valores de “cambio medio en picos” son `nivel después − nivel antes` (en dB) medidos cerca de los tonos seleccionados, con condiciones espectrales idénticas. No son medidas de calidad perceptual, inteligibilidad ni recuperación exacta de la voz.
- El tiempo del solver mostrado pertenece a **esta ejecución en el dispositivo del usuario**. No es una reproducción de los cronometrajes realizados en MATLAB ni demuestra superioridad universal de Jacobi.
- El código es un **prototipo de aplicación de conocimiento científico**. La investigación original usó dos frecuencias y condiciones específicas: estas extensiones requieren validación adicional para cualquier afirmación de rendimiento general.

## Estructura del repositorio

```text
src/
  audio/         decoder, FFT/spectrum, encoder WAV
  numerical/     construcción de G y b, Jacobi, sustracción, pipeline
  workers/       procesamiento fuera del hilo principal
  components/    espectro interactivo, waveform, reproducción A/B
  types/         contratos de mensajes y diagnósticos
  App.tsx        flujo y estado de ToneAway
  styles.css     diseño adaptable a desktop/móvil
public/audio/    ejemplo contaminado preparado de antemano
tests/           pruebas independientes del motor
```

## Verificación

- `npm run test:core` comprueba convergencia para la matriz con **440 y 440,7 Hz**, atenuación de cinco sinusoides, preservación del término DC, validación de frecuencias, identificación FFT y escritura WAV.
- La grabación del demo también se comprobó ejecutando el motor: las cuatro frecuencias seleccionadas se detectaron y los cuatro picos espectrales disminuyeron.
- Antes de presentar: ejecutar `npm install`, `npm run build`, cargar el ejemplo, comprobar el sonido en los altavoces del auditorio y guardar un respaldo local de la app.
