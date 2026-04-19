/**
 * Bellestudia Pro - AI Generator
 * Offline logic to process PDF, ask Gemini, and download .bellestudia.json
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Referencias DOM ─────────────────────────────────────────────────────────
  const keyInput = document.getElementById('gemini-key');
  const btnToggleKey = document.getElementById('toggle-key-visibility');
  const dndZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('pdf-file');
  const fileInfo = document.getElementById('file-info');
  const fileNameOutput = document.getElementById('file-name');
  const fileSizeOutput = document.getElementById('file-size');
  const btnRemoveFile = document.getElementById('btn-remove-file');
  const btnGenerate = document.getElementById('btn-generate');
  const modal = document.getElementById('loading-modal');

  let currentFile = null;

  // ─── 1. Manejo de API Key (LocalStorage) ─────────────────────────────────────
  const savedKey = localStorage.getItem('bellesturiapro_gemini_key');
  if (savedKey) keyInput.value = savedKey;

  keyInput.addEventListener('change', () => {
    localStorage.setItem('bellesturiapro_gemini_key', keyInput.value.trim());
  });

  btnToggleKey.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      btnToggleKey.textContent = '🙈';
    } else {
      keyInput.type = 'password';
      btnToggleKey.textContent = '👁️';
    }
  });

  // ─── 2. Manejo de Archivos (Drag & Drop) ─────────────────────────────────────
  const preventDefs = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    dndZone.addEventListener(ev, preventDefs, false);
  });

  ['dragenter', 'dragover'].forEach(ev => dndZone.addEventListener(ev, () => dndZone.classList.add('dragover'), false));
  ['dragleave', 'drop'].forEach(ev => dndZone.addEventListener(ev, () => dndZone.classList.remove('dragover'), false));

  dndZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleFile(file);
    } else {
      showToast('Por favor, sube solo archivos PDF.', 'error');
    }
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  btnRemoveFile.addEventListener('click', (e) => {
    e.stopPropagation();
    currentFile = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    dndZone.querySelector('h3').style.display = 'block';
    dndZone.querySelector('p').style.display = 'block';
    dndZone.querySelector('.btn-secondary').style.display = 'inline-flex';
  });

  function handleFile(file) {
    if (file.size > 20 * 1024 * 1024) { // Límite razonable 20MB
      showToast('El archivo es demasiado grande (máx 20MB).', 'error');
      return;
    }
    currentFile = file;
    fileNameOutput.textContent = file.name;
    fileSizeOutput.textContent = `(${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    fileInfo.style.display = 'flex';

    dndZone.querySelector('h3').style.display = 'none';
    dndZone.querySelector('p').style.display = 'none';
    dndZone.querySelector('.btn-secondary').style.display = 'none';
  }

  // ─── 3. Utilidades ───────────────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<span>${type === 'error' ? '❌' : '✅'}</span> <span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
      t.style.animation = 'slideInRight 0.3s reverse forwards';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function generateUUID() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function updateProgress(percent, msg) {
    document.getElementById('loading-pb-fill').style.width = percent + '%';
    document.getElementById('loading-status-text').textContent = msg;
  }

  // Helper definitivo para extraer imágenes del PDF vía PDF.js
  async function extractImagesFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const extracted = [];
    const MAX_IMAGES = 15; // Reducido de 25 para evitar payloads gigantes
    try {
      const pdf = await window.pdfjsLib.getDocument({data: arrayBuffer}).promise;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if(extracted.length >= MAX_IMAGES) break; 
        const page = await pdf.getPage(pageNum);
        const ops = await page.getOperatorList();
        const pageObjs = page.objs;
        
        for (let i = 0; i < ops.fnArray.length; i++) {
          if(extracted.length >= MAX_IMAGES) break;
          const fn = ops.fnArray[i];
          const args = ops.argsArray[i];
          let imgData = null;

          if (fn === window.pdfjsLib.OPS.paintImageXObject || fn === window.pdfjsLib.OPS.paintJpegXObject) {
            const objId = args[0];
            try {
              imgData = await pageObjs.get(objId);
              if (!imgData) imgData = await page.commonObjs.get(objId);
            } catch(e) {}
          } 
          else if (fn === window.pdfjsLib.OPS.paintInlineImageXObject) {
            imgData = args[0];
          }

          if (imgData && (imgData.bitmap || imgData.data)) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = imgData.width;
              canvas.height = imgData.height;
              const ctx = canvas.getContext('2d');
              
              if (imgData.bitmap) {
                ctx.drawImage(imgData.bitmap, 0, 0);
              } else {
                const rgbaData = new Uint8ClampedArray(imgData.width * imgData.height * 4);
                if (imgData.data.length === imgData.width * imgData.height * 3) {
                  for (let j = 0, k = 0; j < imgData.data.length; j += 3, k += 4) {
                    rgbaData[k] = imgData.data[j];
                    rgbaData[k+1] = imgData.data[j+1];
                    rgbaData[k+2] = imgData.data[j+2];
                    rgbaData[k+3] = 255;
                  }
                } else {
                  rgbaData.set(imgData.data);
                }
                ctx.putImageData(new ImageData(rgbaData, imgData.width, imgData.height), 0, 0);
              }

              if (canvas.width > 20 && canvas.height > 20) {
                // Cambiado de PNG a JPEG 0.7 para ahorrar espacio masivamente
                const url = canvas.toDataURL('image/jpeg', 0.7);
                if (!extracted.includes(url)) extracted.push(url);
              }
            } catch(e) {}
          }
        }
      }
    } catch(err) {
      console.warn("Fallo extraer imágenes", err);
    }
    return extracted;
  }

  // Renderiza la página completa como una imagen para asegurar que la IA vea todo
  async function renderPageToImage(page, scale = 1.3) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.6); // Bajamos un poco más la calidad para backup de páginas
  }

  // Helper de Reintentos (Exponential Backoff) para Gemini
  async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    try {
      const resp = await fetch(url, options);
      
      // Si el error es 503 (Servicio sobrecargado) o 429 (Límite), reintentamos
      if ((resp.status === 503 || resp.status === 429) && retries > 0) {
        updateProgress(null, `Servidor ocupado (503). Reintentando en ${backoff/1000}s...`);
        await new Promise(r => setTimeout(r, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      
      return resp;
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  }

  // ─── 4. Generación con Gemini API ────────────────────────────────────────────
  btnGenerate.addEventListener('click', async () => {
    // 1. Recolección de datos inicial (Defensa total contra undefined)
    const apiKey = keyInput.value.trim();
    if (!apiKey) return showToast('Falta la API Key de Google Gemini.', 'error');
    if (!currentFile) return showToast('Sube un archivo PDF primero.', 'error');

    const selectedType = document.querySelector('input[name="act-type"]:checked')?.value || 'quiz';
    const rawCount     = document.getElementById('q-count')?.value || '10';
    const finalCount   = parseInt(rawCount) || 10;
    const selectedLang = document.getElementById('q-lang')?.value || 'Español';
    const useImages    = document.getElementById('include-images')?.checked ?? true;

    console.log('--- Iniciando Generación Bellestudia Pro ---');
    console.log('Tipo:', selectedType, 'Items:', finalCount, 'Img:', useImages);

    btnGenerate.disabled = true;
    modal.classList.add('active');
    updateProgress(10, 'Iniciando lectura de archivo...');

    try {
      const base64Data = await fileToBase64(currentFile);
      
      let extractedImages = [];
      let pageCaptures = [];

      if (useImages) {
        updateProgress(30, 'Analizando contenido visual del PDF...');
        extractedImages = await extractImagesFromPDF(currentFile);
        
        try {
          const pdf = await window.pdfjsLib.getDocument({data: await currentFile.arrayBuffer()}).promise;
          const pagesToCapture = Math.min(pdf.numPages, 10);
          for (let i = 1; i <= pagesToCapture; i++) {
            const page = await pdf.getPage(i);
            const cap = await renderPageToImage(page);
            pageCaptures.push(cap);
          }
        } catch(e) { console.error("Fallo renderizado de backup", e); }

        if (extractedImages.length > 0) {
          showToast(`He encontrado ${extractedImages.length} imágenes.`, 'success');
        }
      } else {
        updateProgress(30, 'Extracción de imágenes omitida.');
      }

      updateProgress(50, 'Consultando a la IA...');

      const modelsResp = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!modelsResp.ok) throw new Error('API Key inválida o sin acceso a modelos.');
      const modelsData = await modelsResp.json();

      let availableModels = (modelsData.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini-1.5'));

      if (availableModels.length === 0) {
        availableModels = (modelsData.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'));
      }
      if (availableModels.length === 0) throw new Error('No hay modelos compatibles encontrados.');

      const targetModel = availableModels.find(m => m.name.includes('flash'))?.name || availableModels[0].name;

      const finalPrompt = buildPrompt(selectedType, finalCount, selectedLang, useImages);
      const parts = [
        { text: finalPrompt },
        { inlineData: { mimeType: "application/pdf", data: base64Data } }
      ];

      if (extractedImages.length > 0) {
        parts.push({ text: "\n--- IMÁGENES EXTRAÍDAS ---\n" });
        extractedImages.forEach((b64, idx) => {
          parts.push({ text: `IMAGEN ID: img_${idx}` });
          parts.push({ inlineData: { mimeType: "image/jpeg", data: b64.split(',')[1] } });
        });
      }

      const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Gemini está saturado (503). Intenta desactivando "Incluir imágenes" o prueba de nuevo en unos momentos.');
        }
        throw new Error('Error en API Gemini: ' + response.status);
      }

      const responseData = await response.json();
      const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('La IA no devolvió contenido.');

      let jsonData;
      try {
        const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/);
        jsonData = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
      } catch (e) { throw new Error('Formato JSON inválido.'); }

      updateProgress(90, 'Construyendo archivo final...');

      const processItem = (obj) => {
        if (obj.image && typeof obj.image === 'string' && obj.image.startsWith('img_')) {
          const idx = parseInt(obj.image.split('_')[1]);
          if (!isNaN(idx) && extractedImages[idx]) obj.image = extractedImages[idx];
          else delete obj.image;
        }
      };
      if (jsonData.questions) jsonData.questions.forEach(processItem);
      if (jsonData.statements) jsonData.statements.forEach(processItem);
      if (jsonData.items) jsonData.items.forEach(processItem);
      if (jsonData.pairs) jsonData.pairs.forEach(processItem);

      if (['matching', 'memory', 'dragdrop'].includes(selectedType)) {
        const list = jsonData.pairs || jsonData.items || [];
        list.forEach(i => { if (!i.id) i.id = generateUUID(); });
      }

      const activity = {
        id: generateUUID(),
        type: selectedType,
        title: `IA: ${currentFile.name.replace('.pdf', '')}`,
        subject: "Bellestudia Pro",
        topic: `Generado auto. ${finalCount} ítems`,
        data: jsonData,
        createdAt: Date.now()
      };

      const blob = new Blob([JSON.stringify(activity, null, 2)], { type: 'application/json' });
      const filename = `BellestudiaPro_${selectedType}_${generateUUID().slice(0, 5)}.bellestudia.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);

      showToast('¡Éxito! Archivo descargado.', 'success');
    } catch (err) {
      console.error('Error en Generación:', err);
      showToast(err.message, 'error');
    } finally {
      modal.classList.remove('active');
      btnGenerate.disabled = false;
    }
  });

  // ─── Generador de Prompts Específicos ────────────────────────────────────────
  function buildPrompt(actType, count, lang, includeImg = true) {
    let schemaDesc = "";

    switch (actType) {
      case "quiz":
        schemaDesc = `
Un objeto JSON con la propiedad "questions" que es un array de objetos. 
Cada objeto tiene:
- "text": (string) el texto de la pregunta.
- "options": (array de EXACTAMENTE 4 strings) las opciones de respuesta.
- "correct": (número entero de 0 a 3) el índice de la respuesta correcta.
- "image": (opcional, string como "img_0") ID de la imagen relacionada.`;
        break;
      case "truefalse":
        schemaDesc = `
Un objeto JSON con la propiedad "statements" que es un array de objetos.
Cada objeto tiene:
- "text": (string) la afirmación basada en el texto.
- "correct": (booleano true o false) si es verdadera o falsa.
- "image": (opcional, string como "img_1") ID de la imagen relacionada.`;
        break;
      case "matching":
        schemaDesc = `
Un objeto JSON con la propiedad "pairs" que es un array de objetos.
Cada objeto representa un par related y tiene:
- "id": (string) un ID único corto.
- "left": (string) concepto principal.
- "right": (string) definición o pareja.
- "image": (opcional, string como "img_2") ID de la imagen para el término de la izquierda.`;
        break;
      case "memory":
        schemaDesc = `
Un objeto JSON con la propiedad "pairs" que es un array de objetos.
Cada objeto tiene:
- "id": (string) ID único.
- "front": (string) concepto corto.
- "back": (string) definición corta.
- "image": (opcional, string como "img_3") ID de la imagen para la carta.`;
        break;
      case "dragdrop":
        schemaDesc = `
Un objeto JSON con:
- "categories": (array de strings) 2 a 4 categorías.
- "items": (array de objetos). Cada objeto debe tener:
    - "category": (string) Categoría exacta.
    - "text": (string) Elemento a arrastrar.
    - "image": (opcional, string como "img_4") ID de la imagen para el elemento.`;
        break;
    }

    const imageInstruction = includeImg ? `
--- INSTRUCCIÓN DE IMÁGENES (CRITICAL) ---
Te he proporcionado imágenes extraídas del PDF con identificadores como "img_0", "img_1", etc. 
PRIORIZA EL USO DE ESTAS IMÁGENES. Si una imagen es relevante para un concepto, úsala añadiendo la propiedad "image": "img_X" al objeto de la pregunta/ítem. 
Queremos una actividad MUY VISUAL. No te limites solo a cuando sea indispensable; úsalas para motivar al estudiante.

EJEMPLO DE USO:
{ "text": "¿Qué órgano se muestra en la imagen?", "image": "img_2", "options": [...], "correct": 0 }
` : `
--- NOTA SOBRE IMÁGENES ---
NO incluyas ninguna propiedad "image" en tu respuesta JSON. Solo genera contenido textual basado en el PDF.
`;

    return `
Toma el documento PDF adjunto y crea una actividad educativa evaluativa de alta calidad.
Debes crear exactamente ${count} ítems/preguntas extraídos de los conceptos clave.
El idioma de salida debe ser estrictamente: ${lang}.

${imageInstruction}

--- FORMATO DE SALIDA ---
Devuelve ÚNICAMENTE el raw JSON (sin markdown, sin bloques \`\`\`json).
El esquema debe ser:
${schemaDesc}
`;
  }

  // ─── 6. Efecto Lluvia Matrix (Púrpura) ───────────────────────────────────────
  function initMatrixEffect() {
    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-bg';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '-3';
    canvas.style.opacity = '0.4'; // Suave y no molesto
    canvas.style.pointerEvents = 'none';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');

    // Resize handler
    const resizeObj = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeObj);
    resizeObj();

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+BELLESTUDIAPRO'.split('');
    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize);
    let drops = [];
    for (let x = 0; x < columns; x++) drops[x] = Math.random() * -100;

    // Recalcular columnas drásticamente en resize (para evitar errores si se agranda la ventana)
    window.addEventListener('resize', () => {
      columns = Math.floor(canvas.width / fontSize);
      drops = [];
      for (let x = 0; x < columns; x++) drops[x] = Math.random() * -100;
    });

    function drawMatrix() {
      // Color de desvanecimiento (coincide con el fondo #0f1115 de la app)
      ctx.fillStyle = 'rgba(15, 17, 21, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = fontSize + 'px "Courier New", monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];

        ctx.fillStyle = '#8a2be2'; // Violeta base de Bellestudia
        ctx.shadowBlur = 0;

        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // Reset aleatorio en la parte superior
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    setInterval(drawMatrix, 60);
  }

  // ─── 7. Exportación Portable ─────────────────────────────────────────────────
  const btnDownloadPortable = document.getElementById('btn-download-portable');
  if (btnDownloadPortable) {
    btnDownloadPortable.addEventListener('click', async () => {
      try {
        showToast('Preparando descarga portable...', 'info');
        
        // 1. Obtener contenidos de archivos locales
        const [cssResp, jsResp, logoResp] = await Promise.all([
          fetch('css/style.css'),
          fetch('js/app.js'),
          fetch('assets/logo.png')
        ]);

        const cssText = await cssResp.text();
        const jsText = await jsResp.text();
        const logoBlob = await logoResp.blob();
        
        const logoBase64 = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(logoBlob);
        });

        // 2. Construir el nuevo HTML
        // Clonamos el documento actual
        const htmlDoc = document.documentElement.cloneNode(true);
        
        // Limpiamos referencias externas que vamos a inyectar
        htmlDoc.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
          if (l.getAttribute('href')?.includes('css/')) l.remove();
        });
        htmlDoc.querySelectorAll('script').forEach(s => {
          if (s.getAttribute('src')?.includes('js/')) s.remove();
        });
        
        // Inyectamos CSS
        const styleTag = document.createElement('style');
        styleTag.textContent = cssText;
        htmlDoc.querySelector('head').appendChild(styleTag);
        
        // Actualizamos imágenes a Base64
        htmlDoc.querySelectorAll('img').forEach(img => {
          if (img.getAttribute('src')?.includes('logo.png')) {
            img.src = logoBase64;
          }
        });

        // Eliminamos el botón de descarga del bundle para evitar confusión
        const footerBtn = htmlDoc.querySelector('#btn-download-portable');
        if (footerBtn) footerBtn.remove();
        
        // Inyectamos JS (debe ser el último paso antes de cerrar el body)
        const scriptTag = document.createElement('script');
        // El script inyectado es el mismo app.js, que ya estará inlined
        scriptTag.textContent = jsText;
        htmlDoc.querySelector('body').appendChild(scriptTag);

        const finalHtml = '<!DOCTYPE html>\n' + htmlDoc.outerHTML;
        
        // 3. Disparar descarga
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'BellestudiaPro_Portable.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('¡App portable (un solo archivo) descargada!', 'success');
      } catch (err) {
        console.error('Error bundling app:', err);
        showToast('Debido a restricciones del navegador (file://), no puedo auto-descargarlo. Usa: BellestudiaPro_Portable.html en tu carpeta.', 'error');
      }
    });
  }

  // Inicializar la lluvia hacker
  initMatrixEffect();
});
