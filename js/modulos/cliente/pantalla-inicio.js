/* ================================================================
   LaTaberna - PubPOS — Módulo (ES6)
   Archivo: js/modulos/cliente/pantalla-inicio.js
   Versión: 2.0.1
   Propósito: Pantalla de inicio híbrida con triángulo de acceso.
              _asegurarVista reutiliza contenedor estático de index.html.
   ================================================================ */

import { EventBus } from '../../lib/eventBus.js';
import { Auth } from '../../auth.js';

const PantallaInicio = (() => {
  let _vista = null;
  let _intervaloEslogan = null;
  let _activada = false;

  const FRASES_ESLOGAN = [
    "Donde cada trago es una aventura",
    "Bebidas frías, misiones calientes y fuego vivo.",
    "El mejor bar para perder la sed y encontrar la noche.",
    "Cócteles que cuentan historias.",
    "Tu segunda casa, pero con mejor barra.",
    "Si no recuerdas la noche, nosotros tampoco.",
    "Aparecemos por sorpresa, te divertimos por completo.",
    "Sacia tu sed de aventura y diversión en vivo."
  ];

  let _cbLoginCorner, _cbRegistroCorner, _cbAuthRegistro;

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

    // Si ya tiene contenido, no reconstruir
    if (_vista.querySelector('.login-corner')) return;

    _vista.innerHTML = `
      <div class="login-corner" id="btnLoginCorner">
        <div class="login-corner-inner">
          <div class="login-title">Iniciar Sesión</div>
          <a href="#" class="login-subtitle" id="btnRegistroCorner">Registrarse</a>
        </div>
      </div>
      <div class="header-left">
        <i class="fa-solid fa-beer-mug-empty icono"></i>
        <div class="nombre">La Taberna</div>
        <div class="eslogan" id="eslogan-dinamico">"${FRASES_ESLOGAN[0]}"</div>
      </div>
      <div class="main-wrapper">
        <div class="vitrina-contenedor">
          <div class="vitrina-scroll vitrina-cocktails">
            <div class="vitrina-card"><i class="fa-solid fa-glass-martini-alt vitrina-icon"></i><div class="vitrina-titulo">Mojito</div><div class="vitrina-desc">Refrescante, menta y limón</div></div>
            <div class="vitrina-card"><i class="fa-solid fa-whiskey-glass vitrina-icon"></i><div class="vitrina-titulo">Piña Colada</div><div class="vitrina-desc">Dulce, cremosa y tropical</div></div>
            <div class="vitrina-card"><i class="fa-solid fa-martini-glass vitrina-icon"></i><div class="vitrina-titulo">Margarita</div><div class="vitrina-desc">Cítrica, con borde de sal</div></div>
          </div>
        </div>
        <div class="vitrina-contenedor">
          <div class="vitrina-scroll vitrina-burgers">
            <div class="vitrina-card"><i class="fa-solid fa-hamburger vitrina-icon"></i><div class="vitrina-titulo">Clásica</div><div class="vitrina-desc">Queso cheddar, cebolla caramelizada</div></div>
            <div class="vitrina-card"><i class="fa-solid fa-burger vitrina-icon"></i><div class="vitrina-titulo">BBQ</div><div class="vitrina-desc">Salsa barbacoa, aros de cebolla</div></div>
            <div class="vitrina-card"><i class="fa-solid fa-seedling vitrina-icon"></i><div class="vitrina-titulo">Veggie</div><div class="vitrina-desc">Garbanzos, palta, brotes frescos</div></div>
          </div>
        </div>
        <div class="vitrina-contenedor">
          <div class="vitrina-scroll vitrina-karaoke">
            <div class="vitrina-card"><i class="fa-solid fa-microphone-lines vitrina-icon"></i><div class="vitrina-titulo">Rock</div><div class="vitrina-desc">Viernes de clásicos en vivo</div></div>
            <div class="vitrina-card"><i class="fa-solid fa-music vitrina-icon"></i><div class="vitrina-titulo">Pop</div><div class="vitrina-desc">Éxitos actuales y coreografías</div></div>
            <div class="vitrina-card"><i class="fa-solid fa-guitar vitrina-icon"></i><div class="vitrina-titulo">Baladas</div><div class="vitrina-desc">Noches íntimas con voz y piano</div></div>
          </div>
        </div>
      </div>
    `;
  }

  function activar() {
    if (_activada) return;
    _activada = true;

    _cbLoginCorner = () => _mostrarLogin();
    _cbRegistroCorner = (e) => { e.preventDefault(); e.stopPropagation(); _mostrarRegistro(); };
    _cbAuthRegistro = () => _mostrarRegistro();

    document.getElementById('btnLoginCorner').addEventListener('click', _cbLoginCorner);
    document.getElementById('btnRegistroCorner').addEventListener('click', _cbRegistroCorner);
    EventBus.on('auth:mostrarRegistro', _cbAuthRegistro);

    _iniciarEsloganDinamico();
  }

  function limpiar() {
    if (!_activada) return;
    _activada = false;

    if (_cbLoginCorner) document.getElementById('btnLoginCorner').removeEventListener('click', _cbLoginCorner);
    if (_cbRegistroCorner) document.getElementById('btnRegistroCorner').removeEventListener('click', _cbRegistroCorner);
    if (_cbAuthRegistro) EventBus.off('auth:mostrarRegistro', _cbAuthRegistro);

    if (_intervaloEslogan) { clearInterval(_intervaloEslogan); _intervaloEslogan = null; }
  }

  function _iniciarEsloganDinamico() {
    const esloganEl = document.getElementById('eslogan-dinamico');
    if (!esloganEl) return;
    let indice = Math.floor(Math.random() * FRASES_ESLOGAN.length);
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
  }

  function _mostrarRegistro() {
    if (typeof Auth.registrarCliente === 'function') {
      Auth.mostrarLogin();
    }
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