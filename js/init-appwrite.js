/* ================================================================
   Raíz — MÓDULO: init-appwrite.js (v1.0)
   Propósito: Configura automáticamente las credenciales de Appwrite
              en localStorage si no existen. Útil para desarrollo.
   ================================================================ */
(function() {
  // Solo ejecutar si no hay credenciales previas
  if (localStorage.getItem('appwrite_habilitado') !== null) return;

  // Credenciales de desarrollo (coinciden con las usadas en las pruebas)
  var defaultEndpoint = 'https://tor.cloud.appwrite.io/v1';
  var defaultProjectId = '6a025322001f24c57d1d';
  var defaultApiKey = 'standard_806c0ecaf36fd0184112394ba9a180ec535c7c398ed85c91a1d29175cac0b8b01c6f984956d337fb17aa83ece87b444768be3d8a4f4ba8134fd62d8eb2f9237be8dc5e6ad56f50124fbc16bd7d98245dfdab278750ed59337adb764ebe41d269e2107bb7b305d66759170a00201a39b8b2ea17b6ccc24105d6233ba28c37118f';

  localStorage.setItem('appwrite_habilitado', 'true');
  localStorage.setItem('appwrite_endpoint', defaultEndpoint);
  localStorage.setItem('appwrite_project_id', defaultProjectId);
  localStorage.setItem('appwrite_api_key', defaultApiKey);

  console.log('[InitAppwrite] Credenciales de desarrollo configuradas automáticamente.');
})();