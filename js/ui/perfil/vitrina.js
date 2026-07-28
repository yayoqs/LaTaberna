/* ================================================================
   LaTaberna - PubPOS — PERFIL SUBMÓDULO (ES6)
   Archivo: js/ui/perfil/vitrina.js
   Versión: 1.0.0
   Propósito: Renderizado del modo vitrina (avatar RPG, accesorios, insignias).
   ================================================================ */

export function renderModoVitrina(usuario, extras) {
  const vitrina = document.getElementById('modoVitrinaPerfil');
  if (!vitrina) return;

  const apodo = extras.apodo || usuario.nombre;
  const nivel = extras.nivel || 1;
  const racha = extras.racha || 0;
  const xp = extras.xp || 0;
  const xpSiguiente = extras.xpSiguiente || 1000;
  const accesorios = extras.accesorios || { mano: '🍺', aura: '' };
  const clubes = extras.clubes || [];
  const actividad = extras.actividad || [];
  const insigniasDestacadas = extras.insigniasDestacadas || extras.insignias || [];

  vitrina.innerHTML = `
    <div class="taberna-hero">
      <div class="avatar-rpg-marco">
        <div class="glow-ring"></div>
        <div class="marco-circulo"><span class="sprite">🧙‍♀️</span></div>
      </div>
      <div class="titulo-rango">"${apodo}"</div>
      <div class="racha-badge">🔥 ${racha} días de racha</div>
      <div class="xp-bar-wrap">
        <div class="xp-bar-labels"><span>Experiencia</span><strong>${xp} / ${xpSiguiente} XP</strong></div>
        <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${Math.min(100, (xp / xpSiguiente) * 100)}%"></div></div>
        <div class="xp-restante">Te faltan ${xpSiguiente - xp} XP para nivel ${nivel + 1}</div>
      </div>
    </div>

    <div class="seccion">
      <h3>🎒 Accesorios equipables</h3>
      <p class="desc">Ganados en eventos y clubes. Toca para equipar.</p>
      <div class="accesorio-fila-titulo">Objeto en mano</div>
      <div class="skin-fila fila-mano-perfil">
        <div class="skin-slot ${accesorios.mano === '🍺' ? 'equipado' : ''}" data-emoji="🍺">🍺${accesorios.mano === '🍺' ? '<span class="check">✓</span>' : ''}</div>
        <div class="skin-slot ${accesorios.mano === '🃏' ? 'equipado' : ''}" data-emoji="🃏">🃏${accesorios.mano === '🃏' ? '<span class="check">✓</span>' : ''}</div>
        <div class="skin-slot ${accesorios.mano === '♟️' ? 'equipado' : ''}" data-emoji="♟️">♟️${accesorios.mano === '♟️' ? '<span class="check">✓</span>' : ''}</div>
      </div>
    </div>

    <div class="seccion">
      <h3>🏅 Insignias destacadas</h3>
      <div class="insignias-destacadas">${insigniasDestacadas.slice(0, 4).map(i => `<div class="insignia-destacada">${i}</div>`).join('')}</div>
    </div>

    <div class="seccion">
      <h3>🎲 Clubes</h3>
      ${clubes.length ? clubes.map(c => `<div class="club-mini">${c.icono || '🎲'} <span>${c.nombre}</span><span style="margin-left:auto;font-size:10px;color:var(--color-accent);">${c.evento || ''}</span></div>`).join('') : '<p class="desc">Únete a eventos para aparecer aquí.</p>'}
    </div>

    <div class="seccion">
      <h3>🕓 Actividad reciente</h3>
      ${actividad.length ? actividad.map(a => `<div class="actividad-vitrina"><span class="punto-v"></span><span>${a.texto}</span></div>`).join('') : '<p class="desc">Sin actividad reciente.</p>'}
    </div>
  `;

  // Listeners de accesorios
  vitrina.querySelectorAll('.fila-mano-perfil .skin-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      vitrina.querySelectorAll('.fila-mano-perfil .skin-slot').forEach(s => {
        s.classList.remove('equipado');
        s.querySelector('.check')?.remove();
      });
      slot.classList.add('equipado');
      const check = document.createElement('span');
      check.className = 'check';
      check.textContent = '✓';
      slot.appendChild(check);
    });
  });
}