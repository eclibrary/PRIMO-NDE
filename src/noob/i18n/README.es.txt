NOOB — NDE OUT OF THE BOX — versión {{VERSION}}
====================================================
El kit NDE de la Biblioteca de la Comisión Europea: funciones adicionales
para Primo NDE, listas para usar.

(Traducción al español de README.txt. Los nombres de los menús de Alma se
mantienen en inglés, tal como los muestra Alma: "Manage Customization
Package", etc.)

Funciones adicionales para su vista Primo NDE, creadas por la Biblioteca de
la Comisión Europea, de uso libre. Las instala y configura usted mismo, en
su navegador. No necesita herramientas técnicas ni un desarrollador.

QUÉ NECESITA
  - Acceso a la configuración de su vista Primo NDE en Alma
    (el lugar donde se carga el «paquete de personalización» de la vista).
  - Una versión reciente de Microsoft Edge, Google Chrome o Firefox.

QUÉ HAY EN ESTA CARPETA
  START HERE.html     el creador de paquetes, en inglés
  COMMENCER ICI.html  el mismo creador de paquetes, en francés
  EMPEZAR AQUI.html   el mismo creador de paquetes, en español — haga doble
                      clic en él para abrirlo en su navegador
                      (el resultado es el mismo sea cual sea el idioma;
                      los enlaces de arriba a la derecha permiten cambiar
                      de uno a otro)
  maker\              los archivos que necesita el creador de paquetes.
                      Mantenga esta carpeta junto a EMPEZAR AQUI.html y no
                      cambie nada en ella.
  examples\           un ejemplo de página de inicio, encabezado y pie de
                      página (homepage_en.html, header.html, footer.html) —
                      vea «SU PÁGINA DE INICIO» más abajo
  README.txt          este texto en inglés
  LISEZ-MOI.txt       este texto en francés
  LEAME.txt           este texto


INSTALAR EL KIT, ACTUALIZARLO O CAMBIAR SUS AJUSTES
---------------------------------------------------
Siempre los mismos cuatro pasos.

1. DESCARGUE SU PAQUETE DE ALMA
   En Alma, abra su vista Primo NDE (View Configuration), pestaña
   "Manage Customization Package". En "Download Package", haga clic en
   "Download" junto a "Current View Customization Package". Obtiene un
   archivo zip con el nombre de su vista, por ejemplo 44ABC_INST-MAIN.zip.
   No lo descomprima.
   PARTA SIEMPRE DE UNA DESCARGA RECIENTE. No reutilice nunca un zip antiguo
   de su carpeta Descargas: todo lo que haya cambiado en el paquete desde
   entonces (una imagen nueva, una página de inicio editada, los ajustes) se
   desharía al cargar el resultado. El creador de paquetes le avisa cuando
   el zip tiene más de un día.
   (¿La página indica "No Package Loaded"? Entonces la vista aún no tiene
   paquete: sáltese este paso y elija «Empezar sin paquete» en el paso 2.)

2. ABRA EL CREADOR DE PAQUETES
   Descomprima el kit (esta carpeta) si aún no lo ha hecho y haga doble clic
   en EMPEZAR AQUI.html. Suelte en la página el zip del paso 1.
   La página lee el zip en su navegador. No se envía nada a ninguna parte.

3. REVISE LOS AJUSTES Y HAGA CLIC EN «CREAR PAQUETE»
   - «Código de la vista» debe ser su vista, como en la dirección de Primo
     después de vid=, por ejemplo 44ABC_INST:MAIN. Se rellena a partir del
     zip cuando es posible.
   - Cada función tiene su sección. Ábrala, actívela o desactívela, adapte
     los textos. Los ajustes marcados «nuevo» se han añadido en esta versión
     del kit.
   - «Crear paquete» (abajo a la derecha) descarga un zip nuevo con el mismo
     nombre en su carpeta Descargas.

4. CARGUE EL ZIP NUEVO EN ALMA
   Misma pestaña que en el paso 1, "Manage Customization Package". En
   "Upload Package", elija el zip nuevo junto a "Customization Package" y
   haga clic en "Upload". Al cabo de unos minutos, abra su vista en Primo y
   recargue la página (Ctrl+F5).

Si algo no va bien: cargue de nuevo el zip del paso 1. Su vista vuelve
exactamente a como estaba.


CONVIENE SABER
--------------
- SUS PROPIOS ARCHIVOS SE CONSERVAN. Sus estilos (assets\css\custom.css),
  sus scripts (assets\js\custom.js), su página de inicio, encabezado, pie
  de página e imágenes se quedan exactamente como están. El creador de
  paquetes solo sustituye sus propios archivos de programa y el archivo de
  ajustes (assets/settings.js).

- COLORES. El kit usa el tema de color que elija para la vista en Alma
  (pestaña "Manage Customization Package", "Color Theme"): las barras de
  título de las ventanas, los botones, las barras de encabezado y pie de
  página y los enlaces de la página de inicio lo siguen. ¿Ha cambiado el
  tema? No hay que hacer nada aquí — recargue Primo al cabo de unos
  minutos.

- SUS ESTILOS. Ponga su propio CSS en assets\css\custom.css (el archivo
  del paquete de plantilla de Ex Libris; Primo lo carga en todas las
  páginas). El creador de paquetes nunca lo modifica, y prevalece sobre los
  estilos del kit. Ejemplo — un color propio en lugar del tema de Alma:
      :root { --ec-blue: #7a003c; --ec-on-blue: #fff; }
  (--ec-blue = el color principal, --ec-on-blue = el texto sobre él.)
  (También se carga un custom.css situado en la parte superior de la
  carpeta del paquete, para que los paquetes antiguos sigan funcionando;
  use uno de los dos, no ambos.)

- SUS PROPIOS SCRIPTS. Los scripts pequeños propios van en
  assets\js\custom.js (también procede de la plantilla; Primo lo carga en
  todas las páginas y el creador de paquetes nunca lo modifica). NO en la
  página de inicio, el encabezado o el pie de página: Primo quita de ellos
  los <script>. Mantenga los scripts pequeños, y recuerde que Primo dibuja
  sus páginas después de que su script haya arrancado — así que espere a
  los elementos que necesite en lugar de dar por hecho que ya están.
  Compruebe antes si el kit ya hace lo que quiere (ajustes, atributos
  data-ec-…): es más seguro.

- ¿AÚN NO TIENE PÁGINA DE INICIO, ENCABEZADO O PIE DE PÁGINA? Cuando su
  paquete no los tiene, el creador de paquetes ofrece añadir una página de
  inicio, un encabezado y un pie de página INICIALES: páginas sencillas que
  funcionan tal cual, con los textos que hay que sustituir marcados
  [YOUR …]. Nunca sustituye páginas que ya tenga.

- SU PÁGINA DE INICIO. El kit puede añadir cosas a su página de inicio (la
  parte bajo el cuadro de búsqueda): un enlace «Continuar donde lo dejó» a
  la última búsqueda del usuario, una línea «Préstamos que vencen pronto»,
  enlaces con el número de préstamos, registros guardados y búsquedas
  guardadas, y partes que solo ven los usuarios identificados, los
  invitados o quienes están en su propia red.
  (Los invitados ven las cifras de su última visita como simples
  etiquetas, con un botón «Inicie sesión para consultarlos»: las páginas
  de la cuenta solo se rellenan después de iniciar sesión.)
  examples\homepage_en.html las muestra todas, con explicaciones en el
  archivo (ábralo con el Bloc de notas; el ejemplo está en inglés). Los
  archivos de su página de inicio están en su paquete, en assets\homepage\.
  La carpeta examples también tiene un encabezado (una barra en la parte
  superior de cada página) y un pie de página: van en
  assets\header-footer\. Para cambiarlos: descomprima el paquete de Alma,
  edite o sustituya los archivos, vuelva a comprimir la carpeta y suelte ese
  zip en EMPEZAR AQUI.html como siempre — su página de inicio se conserva.
  Active «Préstamos que vencen pronto» y «Contadores de la cuenta en la
  página de inicio» en los ajustes; «Comprobación de red» para las partes
  relacionadas con la red.
  Un botón «Comprobar conexión» (también en el ejemplo) permite a los
  usuarios volver a comprobar la red, p. ej. tras activar la VPN; si no
  están en la red, explica por qué y qué hacer. Escriba esos consejos (su
  VPN, a quién contactar) en los ajustes de «Comprobación de red».

- PC DE SALA DE LECTURA. Abra Primo una vez en un PC así añadiendo
  &ec_kiosk=1 a la dirección (&ec_kiosk=0 lo desactiva). El kit borra
  entonces lo que dejó el usuario anterior y restablece la página tras un
  rato sin actividad (ajustes: «PC de sala de lectura»). Algunas partes de
  su página de inicio, encabezado o pie de página pueden mostrarse solo
  allí, u ocultarse allí — vea la sección 4 de examples\homepage_en.html.

- VENTANAS PERSONALIZADAS. Ventanas emergentes con su propio texto: añádalas
  en la sección «Ventanas personalizadas» del creador de paquetes (tantas
  como necesite). «Se abre desde» indica qué abre cada una. Escriba una
  palabra a su elección, p. ej. dialog-borrowing (letras, cifras, - y _,
  sin espacios): entonces, en su página de inicio, encabezado o pie de
  página, la abre un enlace a #dialog-borrowing —
  <a href="#dialog-borrowing">Normas de préstamo</a> — y también cualquier
  elemento que tenga dialog-borrowing como clase. Vea la sección 5 de
  examples\homepage_en.html.
  Para los más técnicos, «Se abre desde» también acepta un selector CSS,
  p. ej. a[href*="calendly.com"] — útil para enlaces a los que no puede
  dar una clase, como los enlaces del menú de NDE.
  «Código del widget» (opcional): pegue el código de inserción de un
  formulario, chat o herramienta de reservas exactamente como lo da su
  proveedor; aparece bajo el texto y se carga la primera vez que se abre la
  ventana. Este código SE EJECUTA en su Primo: pegue solo código de
  proveedores de confianza.

- PREGUNTE AL BIBLIOTECARIO (LIBANSWERS). Para bibliotecas que responden
  consultas con LibAnswers (un producto de Springshare). Sus enlaces
  «háganos una pregunta» al formulario de consulta de LibAnswers (sección
  «Pregunte al bibliotecario (LibAnswers)»): escriba el principio de su
  dirección en
  «Enlaces Pregunte al bibliotecario», p. ej.
  https://yourlibrary.libanswers.com/form?queue_id=1234. Cada uno de esos
  enlaces en su página de inicio, encabezado, pie de página o menú lleva
  entonces el nombre y el correo del usuario identificado (marque cuáles),
  otros valores que elija («Otros rellenos»: un dato de Alma, p. ej. la
  línea de dirección 2 para un campo «departamento», o un parámetro de la
  página de Primo, p. ej. query) y — con «Añadir el contexto a los
  detalles» — lo que estaba consultando (título del registro, términos de
  búsqueda, enlace). El formulario se abre rellenado, siempre que lea esos
  valores de su dirección (los formularios de LibAnswers lo hacen: use los
  nombres de campo del formulario, p. ej. pname, pemail, pdetails).
  ¿No tiene LibAnswers? Deje vacío «Enlaces Pregunte al bibliotecario»: no
  pasa nada. Otra herramienta de formularios solo funciona si su formulario
  lee los valores de su dirección de la misma manera.
  Marque «Usar ventana» para abrir el formulario en una ventana emergente:
  pegue el código de inserción del formulario en «Código del widget»
  (LibAnswers: Admin > Widgets > su formulario de consulta > embed code).
  Oculte o modifique partes con «CSS personalizado», p. ej.
  [name="pdetails"] { display: none; }

- AVISOS. Barras de mensaje de color en todas las páginas — «Cerrado el 1 de
  mayo», «Nuevo: chatee con un bibliotecario». Sección «Avisos» del creador
  de paquetes: añada tantos como necesite. Cada uno tiene su texto (por
  idioma), un lugar (encima del menú, bajo el menú, bajo la zona de
  búsqueda, o fijo en la parte inferior de la ventana), un color (color del
  tema, tres estilos predefinidos, o su propio color con el selector de
  color — el texto se vuelve negro o blanco por sí solo para que siga siendo
  legible), primer y último día opcionales y, si quiere, una × para
  cerrarlo. Un aviso cerrado sigue cerrado en ese navegador hasta que lo
  cambie.

- CONSEJOS DE BÚSQUEDA. Un recuadro entre los resultados cuando una búsqueda
  contiene ciertas palabras — p. ej. «¿Busca estadísticas? Pruebe…» tras el
  resultado 3 para cualquier búsqueda con «estadísticas». Sección «Consejos
  de búsqueda»: añada un consejo por tema, con sus palabras (una por línea;
  déjelo vacío para TODAS las búsquedas), si la búsqueda debe contener una
  de ellas o ser exactamente una de ellas, tras qué resultado aparece, su
  texto y color, y fechas opcionales. Solo se muestra en la primera página
  de resultados.

- HORARIO DE APERTURA. Rellene su horario semanal y las excepciones
  (festivos, cierres) en la sección «Horario de apertura». Su página de
  inicio, encabezado o pie de página muestran entonces el horario de hoy con
  «Abierto ahora» / «Cerrado ahora», la semana entera, o una ventana con la
  semana entera — vea la sección 6 de examples\homepage_en.html. Escriba el
  horario como 09:00-17:00, varias franjas como 09:00-12:30, 13:30-17:00;
  deje un día vacío si está cerrado.

- MOSTRAR ALGO SOLO ENTRE DOS FECHAS. Añada data-ec-from="2026-12-20" y/o
  data-ec-until="2027-01-04" a cualquier parte de su página de inicio,
  encabezado o pie de página: solo se muestra esos días. Prepare los avisos
  de vacaciones con antelación — vea la sección 7 de
  examples\homepage_en.html.

- DISTINTIVOS DE COLECCIÓN. Un distintivo en cada registro de una colección
  de Alma (p. ej. «Se puede leer desde casa»), con una (i) que lo explica.
  Sección «Distintivos de colección»: añada un distintivo por colección,
  cada uno con su texto y color.

- VERSIONES GRATUITAS (UNPAYWALL). Con la sección «Versiones gratuitas»
  activada, los registros con DOI (sobre todo artículos) reciben un enlace
  «Versión gratuita» cuando existe una copia gratuita legal — encontrada por
  Unpaywall (unpaywall.org), un servicio gratuito sin ánimo de lucro.
  Necesita un correo de contacto de su biblioteca. PRIVACIDAD: para esos
  registros, el navegador del usuario consulta unpaywall.org sobre el DOI,
  así que Unpaywall ve el DOI y la dirección de internet del usuario.
  Menciónelo en su aviso de privacidad antes de activarlo.

- ICONOS. Su página de inicio, encabezado y pie de página pueden usar
  cualquier icono de https://fonts.google.com/icons — copie el nombre del
  icono y escriba
  <span class="material-symbols-outlined">menu_book</span>

- OTRO MÓDULO PERSONALIZADO. Primo NDE solo puede ejecutar un módulo
  personalizado por vista. Si su paquete ya tiene uno que no se hizo con
  este kit, el creador de paquetes le avisa antes de sustituirlo. Si nadie
  ha desarrollado nada para su vista, lo más probable es que sea el ejemplo
  vacío de Ex Libris, y sustituirlo no es problema. Si lo hizo para usted un
  desarrollador o una empresa, pregúnteles antes.

- IDIOMAS. El kit empieza solo en inglés. Añada sus idiomas en la sección
  «Idiomas» del creador de paquetes: cada texto recibe entonces una línea
  por idioma (una línea vacía muestra el texto en inglés). Primo necesita
  además que el idioma esté activado para la vista en Alma, y NDE necesita
  un archivo de página de inicio por idioma (homepage_es.html, …).
  (El idioma del propio creador de paquetes — START HERE, COMMENCER ICI o
  EMPEZAR AQUI — no cambia nada en los idiomas de su vista.)

- UN KIT MÁS RECIENTE. Descargue el kit nuevo y repita los pasos 1 a 4. Sus
  ajustes se conservan; los ajustes nuevos aparecen marcados «nuevo», con
  valores por defecto razonables.

- COMPROBACIÓN. En Primo, pulse F12 y mire la Consola: una línea
  "[ec] settings: assets/settings.js applied" significa que se están usando
  sus ajustes.
