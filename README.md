# ⚔️ COREINVADERS — Mobile Legends Community Platform

Plataforma comunitaria para Mobile Legends Bang Bang (Gestión de Torneos, Fixtures, Chat en Vivo, Noticias, Registro al Clan y Panel de Administración).

---

## 🚀 Despliegue en GitHub Pages con Base de Datos Gratuita en Google Sheets

Tu proyecto está organizado para correr con el **Frontend en GitHub Pages** (alojamiento gratuito) y el **Backend/Base de Datos en Google Apps Script + Google Sheets** (100% gratuito).

### Estructura de Archivos

- `index.html`: Estructura HTML estándar del sitio.
- `styles.css`: Estilos visuales gamer cyberpunk.
- `script.js`: Lógica del cliente y conexión con la API de Google Sheets.
- `code.gs`: Backend y API REST que corre dentro de Google Apps Script.

---

### Paso 1: Configurar la Base de Datos en Google Apps Script

1. Entra a **[script.google.com](https://script.google.com/)** e inicia sesión con tu cuenta de Google.
2. Haz clic en **Nuevo proyecto**.
3. Nómbralo como quieras (ej. `CoreInvaders Backend`).
4. En el archivo `Código.gs`, borra todo y pega el contenido completo de tu archivo `code.gs`.
5. Haz clic en el icono de **Guardar** (Ctrl + S).

---

### Paso 2: Publicar tu API de Google Sheets

1. En la esquina superior derecha del editor de Google Apps Script, haz clic en el botón azul **Implementar (Deploy)** > **Nueva implementación**.
2. Haz clic en el icono del engranaje ⚙️ (Seleccionar tipo) y elige **Aplicación web**.
3. Completa los campos:
   - **Descripción**: `API CoreInvaders v1`
   - **Ejecutar como**: **Yo** (`tu-cuenta@gmail.com`)
   - **Quién tiene acceso**: **Cualquier persona (Anyone)** *(Importante para que tu página en GitHub pueda leer y guardar datos).*
4. Haz clic en **Implementar**.
5. Si Google te pide autorizar permisos, haz clic en **Revisar permisos**, selecciona tu cuenta de Google, haz clic en *Opciones avanzadas (Advanced)* y luego en *Ir a CoreInvaders (No seguro)* para conceder los accesos a Google Sheets.
6. Al finalizar, copia la **URL de la aplicación web** (la que termina en `/exec`).

---

### Paso 3: Vincular tu Frontend (`script.js`)

Tu archivo `script.js` ya quedó enlazado a tu Google Sheet (`1LK2p4mbVwyKordcH3REhMtPWdtioah2jujVi5jafqwU`) con tu URL pública:
```javascript
const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbz4PPN-SJGuzwzVLr7iShBe3jZyXp1V--Ws0P-XRJStjwC2hLLmtz0z70l9-dpyxtaA/exec";
```

---

### Paso 4: Subir a GitHub y Activar GitHub Pages

1. Sube tu carpeta a un nuevo repositorio en GitHub:
   - Puedes usar **GitHub Desktop**, la terminal `git`, o arrastrar los archivos directamente en la web de GitHub.
   - Archivos necesarios en la raíz de tu repositorio: `index.html`, `styles.css`, `script.js`, `README.md`.
2. En tu repositorio en GitHub, ve a **Settings** (Ajustes) > pestaña **Pages** (en el menú lateral izquierdo).
3. En la sección **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: Selecciona `main` (o `master`) y la carpeta `/ (root)`.
   - Haz clic en **Save**.
4. En un par de minutos, GitHub te dará tu enlace en vivo (ej. `https://tu-usuario.github.io/codeinvaders/`).

¡Listo! Tu página web estará funcionando en GitHub Pages con su base de datos gratuita en Google Sheets.
