/**
 * Pantalla de Inicio Híbrida (v1.1.0)
 * Vista pública que no requiere autenticación.
 *
 * @module PantallaInicio
 * @version 1.1.0
 *
 * Rediseño con triángulo de acceso neón, cabecera izquierda
 * y vitrinas deslizables decorativas con eslogan dinámico.
 */
const PantallaInicio = (() => {
  let _vista = null;
  let _intervaloEslogan = null;

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

  function render() {
    if (_vista) return _vista;

    _vista = document.createElement('main');
    _vista.id = 'view-inicio';
    _vista.className = 'view';
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

    document.body.appendChild(_vista);

    document.getElementById('btnLoginCorner').addEventListener('click', _mostrarLogin);
    document.getElementById('btnRegistroCorner').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _mostrarRegistro();
    });

    _iniciarEsloganDinamico();

    return _vista;
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
    if (typeof window.Auth !== 'undefined' && typeof window.Auth.mostrarLogin === 'function') {
      window.Auth.mostrarLogin();
    } else {
      alert('Sistema de autenticación no disponible.');
    }
  }

  function _mostrarRegistro() {
    if (typeof window.Auth !== 'undefined' && typeof window.Auth.registrarCliente === 'function') {
      // Redirigir al flujo de registro del sistema
      window.Auth.mostrarLogin?.();
    } else {
      alert('Registro no disponible en este momento.');
    }
  }

  function mostrar() {
    if (_vista) {
      _vista.classList.add('active');
      if (!_intervaloEslogan) _iniciarEsloganDinamico();
    }
  }

  function ocultar() {
    if (_vista) {
      _vista.classList.remove('active');
    }
    if (_intervaloEslogan) {
      clearInterval(_intervaloEslogan);
      _intervaloEslogan = null;
    }
  }

  return { render, mostrar, ocultar };
})();

export { PantallaInicio };