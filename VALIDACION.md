# Estado de validación de ToneAway

## Comprobaciones ejecutadas

- Las **7 pruebas automatizadas** de `node:test` finalizaron correctamente con `tsc -p tsconfig.core.json`.
- Confirmada la convergencia de Jacobi con las frecuencias del experimento (440 y 440,7 Hz) en un sistema de cinco incógnitas.
- Comprobada la reducción de cinco tonos en una señal sintética que además contiene otras componentes y ruido.
- Comprobado que la resta de tonos no elimina el término constante (DC).
- Comprobada la detección de picos espectrales, las guardas de frecuencias cercanas y la codificación WAV.
- Ejecutado el motor contra `public/audio/entrevista_ruidosa.wav`, de **12 s a 48 kHz**. Al procesar 620,25, 800,35, 1.100,45 y 1.450,55 Hz, Jacobi convergió en **3 iteraciones**, con residuo relativo aproximado **4,45 × 10⁻¹²**. Reducciones medidas en los picos (ventana Hann): **27,57, 28,87, 38,96 y 31,72 dB**, respectivamente. Estas medidas son específicas del audio de ejemplo y no equivalen a una mejora perceptual garantizada.
- Verificada la sintaxis de los archivos TypeScript/TSX mediante el compilador TypeScript disponible.

## Comprobaciones pendientes

El entorno de construcción disponible para esta entrega no puede alcanzar el registro de npm. Por eso **no se pudo instalar React, Vite y Tailwind ni completar `npm run build` ni hacer una prueba de interacción del frontend en navegador**. La aplicación está preparada en código fuente, pero la compilación y validación integral deben ejecutarse en el equipo del usuario o en Vercel una vez instaladas las dependencias.

Para finalizar la verificación:

```bash
npm install
npm test
npm run build
npm run dev
```

En el navegador: cargar el demo, seleccionar sus cuatro picos sugeridos, atenuarlos, comparar Entrada/Procesado, verificar las estadísticas y descargar el WAV.
