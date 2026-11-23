/* Carte OpenStreetMap de la page Contact (Leaflet, chargé seulement quand la carte approche de l'écran). */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 401, avenue du Pont Nord, Alma (Québec) G8B 5E1 — coordonnées d'Adresses Québec
const ETUDE = [48.55545496, -71.63885074];

export function initMap(el) {
  const map = L.map(el, {
    center: ETUDE,
    zoom: 16,
    scrollWheelZoom: false,
    zoomControl: false,
    attributionControl: true,
  });
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map);
  map.attributionControl.setPrefix(false);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);

  const icon = L.divIcon({
    className: 'map-pin',
    html: '<span class="map-pin__pulse"></span><span class="map-pin__dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg></span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
  L.marker(ETUDE, { icon, title: 'Notaires Alma — 401, avenue Du Pont Nord', keyboard: false }).addTo(map);

  // La molette zoome seulement après un clic sur la carte (évite de « piéger » le défilement de la page).
  map.on('click focus', () => map.scrollWheelZoom.enable());
  el.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

  // Sur grand écran, décale le repère vers la droite pour qu'il ne soit pas caché par la fiche.
  const shift = () => {
    if (window.innerWidth > 900) map.setView(ETUDE, 16, { animate: false }).panBy([-Math.min(260, el.clientWidth * 0.2), 0], { animate: false });
    else map.setView(ETUDE, 16, { animate: false });
  };
  shift();
  window.addEventListener('resize', shift);
}
