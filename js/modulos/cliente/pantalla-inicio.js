/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/pantalla-inicio.js
   Versión: 2.1.7
   Propósito: Pantalla de inicio con triángulo neón, cabecera,
             vitrinas con imagen, títulos de sección y modal expansivo.
             Adaptado a Auth v2.0.1: registro solo vía modal de Auth.
   ================================================================ */

import { Auth } from '../../auth.js';

const PantallaInicio = (() => {
  let _vista = null;
  let _intervaloEslogan = null;
  let _activada = false;

  const FRASES_ESLOGAN = [
    "Bebidas frías, misiones calientes.",
    "El mejor bar para perder la sed.",
    "Cócteles que cuentan historias.",
    "Sacia tu sed de aventura."
  ];

  let _cbLoginCorner, _cbModalClose, _cbModalAction;
  let _cbCerrarModalLogin = null;
  let _modalCards = [];

  function _asegurarVista() {
    if (_vista) return;

    let main = document.getElementById('view-inicio');
    if (!main) {
      main = document.createElement('main');
      main.id = 'view-inicio';
      main.className = 'view';
      document.body.appendChild(main);
    }

    _vista = main;

    if (_vista.querySelector('.login-corner')) return;

    _vista.innerHTML = `
      <div class="login-corner" id="btnLoginCorner">
        <div class="login-corner-inner">
          <div class="login-title">Iniciar Sesión</div>
          <a href="javascript:void(0)" class="login-subtitle" id="btnRegistroCorner">Registrarse</a>
        </div>
      </div>

      <header class="header-block">
        <div class="icono-marco">
          <i class="fa-solid fa-beer-mug-empty"></i>
        </div>
        <div class="nombre">La Taberna</div>
        <div class="eslogan" id="eslogan-dinamico">"${FRASES_ESLOGAN[0]}"</div>
      </header>

      <section class="main-wrapper">

        <div class="vitrina-contenedor vitrina-cocktails">
          <div class="vitrina-titulo-seccion">🍸 Cócteles de la casa</div>
          <div class="vitrina-scroll">

            <div class="vitrina-card"
                 style="background-image: url('https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80');"
                 data-title="Fuego Valirio"
                 data-ingredientes="Gin · Jalapeño · Licor verde de la casa"
                 data-tag="2x1 hoy"
                 data-color="var(--neon-purple)"
                 data-img="https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&q=80"
                 data-lore="Extraído de los sótanos de la alquimia. Destilado con botánicos seleccionados y un sutil toque punzante de jalapeño que despierta los sentidos.">
              <span class="vitrina-tag">2x1 hoy</span>
              <div class="vitrina-texto">
                <div class="vitrina-titulo">Fuego Valirio</div>
                <div class="vitrina-desc">Gin, jalapeño y destello verde</div>
              </div>
            </div>

            <div class="vitrina-card"
                 style="background-image: url('https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500&q=80');"
                 data-title="Abismo Negro"
                 data-ingredientes="Whisky ahumado · Mora silvestre · Carbón activo"
                 data-tag="Místico"
                 data-color="var(--neon-purple)"
                 data-img="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500&q=80"
                 data-lore="Una mezcla densa y oscura como las noches sin luna en el bosque viejo. El humo del whisky escocés colisiona con el dulzor ácido de las moras maceradas.">
              <div class="vitrina-texto">
                <div class="vitrina-titulo">Abismo Negro</div>
                <div class="vitrina-desc">Whisky ahumado y licor de mora</div>
              </div>
            </div>

          </div>
        </div>

        <div class="vitrina-contenedor vitrina-burgers">
          <div class="vitrina-titulo-seccion">🔥 Los Preferidos del Asador</div>
          <div class="vitrina-scroll">

            <div class="vitrina-card"
                 style="background-image: url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80');"
                 data-title="La Forja"
                 data-ingredientes="250g Ternera · Cheddar maduro · Pan de carbón"
                 data-tag="Top ventas"
                 data-color="var(--neon-orange)"
                 data-img="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80"
                 data-lore="Forjada directamente sobre fuego vivo. Carne seleccionada con costra de sellado perfecta, inundada en queso cheddar fundido que emula el oro líquido de las herrerías.">
              <span class="vitrina-tag">Top ventas</span>
              <div class="vitrina-texto">
                <div class="vitrina-titulo">La Forja</div>
                <div class="vitrina-desc">Doble carne premium y cheddar fundido</div>
              </div>
            </div>

            <div class="vitrina-card"
                 style="background-image: url('https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80');"
                 data-title="Humo & Acero"
                 data-ingredientes="Costillar ahumado · BBQ artesanal de bourbon"
                 data-tag="Ahumado"
                 data-color="var(--neon-orange)"
                 data-img="https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80"
                 data-lore="Madera de manzano y doce horas de paciencia en el ahumador. La carne se desprende del hueso con el roce del acero. Bañada en una densa salsa barbacoa reducida con bourbon de barril americano.">
              <div class="vitrina-texto">
                <div class="vitrina-titulo">Humo & Acero</div>
                <div class="vitrina-desc">Tocino crujiente con BBQ artesanal</div>
              </div>
            </div>

          </div>
        </div>

        <div class="vitrina-contenedor vitrina-karaoke">
          <div class="vitrina-titulo-seccion">🎤 Entretención y Eventos</div>
          <div class="vitrina-scroll">

            <div class="vitrina-card"
                 style="background-image: url('https://images.unsplash.com/photo-1516280440502-861053b92787?w=500&q=80');"
                 data-title="Grito de Guerra"
                 data-ingredientes="Escenario libre · Micrófono abierto · Sonido valvular"
                 data-tag="Viernes"
                 data-color="var(--neon-indigo)"
                 data-img="https://images.unsplash.com/photo-1516280440502-861053b92787?w=500&q=80"
                 data-lore="La noche donde los clanes se reúnen a medir el poder de sus gargantas. No es solo cantar, es liberar el estrés acumulado de la semana bajo los focos de La Taberna.">
              <span class="vitrina-tag">Viernes</span>
              <div class="vitrina-texto">
                <div class="vitrina-titulo">Grito de Guerra</div>
                <div class="vitrina-desc">Clásicos del rock pesado en vivo</div>
              </div>
            </div>

            <div class="vitrina-card"
                 style="background-image: url('https://images.unsplash.com/photo-1470229722913-7c092fb1380f?w=500&q=80');"
                 data-title="Torneo de Clanes"
                 data-ingredientes="Trivia interactiva · Tablero de honor · Rondas gratis"
                 data-tag="Próximamente"
                 data-color="var(--neon-indigo)"
                 data-img="https://images.unsplash.com/photo-1470229722913-7c092fb1380f?w=500&q=80"
                 data-lore="Pon a prueba la agilidad mental de tu equipo. Desafíos estratégicos de cultura popular, ciencia de código y mitología de taberna. El clan dominante de la noche no paga su consumo.">
              <div class="vitrina-texto">
                <div class="vitrina-titulo">Torneo de Clanes</div>
                <div class="vitrina-desc">Trivia estratégica de comunidad</div>
              </div>
            </div>

          </div>
        </div>

      </section>
    `;

    _crearModalPortal();
  }

  function _crearModalPortal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modalPortal';
    modal.innerHTML = `
      <div class="modal-altar">
        <div class="modal-img-frame" id="modalImg">
          <span class="modal-badge" id="modalBadge"></span>
        </div>
        <div class="modal-body">
          <div class="modal-header-line">
            <h2 class="modal-titulo" id="modalTitulo"></h2>
            <span class="modal-ingredientes" id="modalIngredientes"></span>
          </div>
          <p class="modal-lore" id="modalLore"></p>
          <button class="modal-btn-action" id="modalActionBtn">Invocar con tu Cuenta</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function activar() {
    if (_activada) return;
    _activada = true;

    _cbLoginCorner = () => _mostrarLogin();

    document.getElementById('btnLoginCorner').addEventListener('click', _cbLoginCorner);
    // El enlace Registrarse del triángulo no tiene acción.
    // El registro se realiza desde el modal de Auth v2.0.1.

    _iniciarEsloganDinamico();
    _conectarModalPortal();
  }

  function limpiar() {
    if (!_activada) return;
    _activada = false;

    if (_cbLoginCorner) {
      document.getElementById('btnLoginCorner').removeEventListener('click', _cbLoginCorner);
    }

    if (_cbCerrarModalLogin) {
      const btnCerrar = document.getElementById('btnCerrarModalLogin');
      if (btnCerrar) btnCerrar.removeEventListener('click', _cbCerrarModalLogin);
      _cbCerrarModalLogin = null;
    }

    if (_intervaloEslogan) { clearInterval(_intervaloEslogan); _intervaloEslogan = null; }

    _desconectarModalPortal();
  }

  function _conectarModalPortal() {
    const modal = document.getElementById('modalPortal');
    const mImg = document.getElementById('modalImg');
    const mBadge = document.getElementById('modalBadge');
    const mTitulo = document.getElementById('modalTitulo');
    const mIngredientes = document.getElementById('modalIngredientes');
    const mLore = document.getElementById('modalLore');
    const mActionBtn = document.getElementById('modalActionBtn');

    _modalCards = document.querySelectorAll('.vitrina-card');

    _modalCards.forEach(card => {
      card.addEventListener('click', () => {
        const title = card.getAttribute('data-title');
        const ingredients = card.getAttribute('data-ingredientes');
        const lore = card.getAttribute('data-lore');
        const img = card.getAttribute('data-img');
        const tag = card.getAttribute('data-tag') || 'Disponible';
        const color = card.getAttribute('data-color') || 'var(--neon-amber)';

        mTitulo.textContent = title;
        mIngredientes.textContent = ingredients;
        mLore.textContent = lore;
        mImg.style.backgroundImage = `url('${img}')`;
        mBadge.textContent = tag;
        mBadge.style.backgroundColor = color;
        mBadge.style.color = color === 'var(--neon-orange)' ? '#000' : '#fff';

        if (card.closest('.vitrina-karaoke')) {
          mActionBtn.textContent = "Reservar Espacio en el Clan";
        } else {
          mActionBtn.textContent = "Invocar con tu Cuenta";
        }

        modal.classList.add('active');
      });
    });

    _cbModalClose = (e) => {
      if (e.target === modal) modal.classList.remove('active');
    };
    modal.addEventListener('click', _cbModalClose);

    _cbModalAction = () => {
      modal.classList.remove('active');
      _mostrarLogin();
    };
    mActionBtn.addEventListener('click', _cbModalAction);
  }

  function _desconectarModalPortal() {
    const modal = document.getElementById('modalPortal');
    if (_modalCards.length) {
      _modalCards.forEach(card => { card.replaceWith(card.cloneNode(true)); });
      _modalCards = [];
    }
    if (modal) {
      if (_cbModalClose) modal.removeEventListener('click', _cbModalClose);
      const mActionBtn = document.getElementById('modalActionBtn');
      if (mActionBtn && _cbModalAction) mActionBtn.removeEventListener('click', _cbModalAction);
    }
  }

  function _iniciarEsloganDinamico() {
    const esloganEl = document.getElementById('eslogan-dinamico');
    if (!esloganEl) return;
    let indice = 0;
    _intervaloEslogan = setInterval(() => {
      esloganEl.style.opacity = '0';
      setTimeout(() => {
        indice = (indice + 1) % FRASES_ESLOGAN.length;
        esloganEl.textContent = `"${FRASES_ESLOGAN[indice]}"`;
        esloganEl.style.opacity = '1';
      }, 400);
    }, 6000);
  }

  function _mostrarLogin() {
    if (typeof Auth.mostrarLogin === 'function') Auth.mostrarLogin();

    if (_cbCerrarModalLogin) {
      const btnCerrarPrev = document.getElementById('btnCerrarModalLogin');
      if (btnCerrarPrev) btnCerrarPrev.removeEventListener('click', _cbCerrarModalLogin);
    }

    _cbCerrarModalLogin = function() {
      setTimeout(() => { PantallaInicio.mostrar(); }, 100);
    };

    setTimeout(() => {
      const btnCerrar = document.getElementById('btnCerrarModalLogin');
      if (btnCerrar) {
        btnCerrar.addEventListener('click', _cbCerrarModalLogin);
      }
    }, 100);
  }

  function mostrar() {
    _asegurarVista();
    activar();
    _vista.classList.add('active');
  }

  function ocultar() {
    if (_vista) _vista.classList.remove('active');
    limpiar();
  }

  return { mostrar, ocultar };
})();

export { PantallaInicio };