import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/components/repartidor/MapView.tsx';
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (typeof search === 'string') {
    if (!source.includes(search)) throw new Error(`No se encontró el bloque requerido: ${label}`);
    source = source.replace(search, replacement);
    return;
  }
  if (!search.test(source)) throw new Error(`No se encontró el patrón requerido: ${label}`);
  source = source.replace(search, replacement);
}

if (source.includes('LoadScript, GoogleMap')) {
  replaceRequired(
    'import { LoadScript, GoogleMap, Marker, Polyline, InfoWindow } from "@react-google-maps/api";',
    'import { useJsApiLoader, GoogleMap, Marker, Polyline, InfoWindow } from "@react-google-maps/api";',
    'importación del cargador de Google Maps',
  );
}

if (!source.includes('function directDistanceKm')) {
  replaceRequired(
    'function getInitialLocation(): Promise<GeolocationPosition> {',
    `function directDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function asLiteral(point: google.maps.LatLng | google.maps.LatLngLiteral) {
  if (typeof (point as google.maps.LatLng).lat === "function") {
    const value = point as google.maps.LatLng;
    return { lat: value.lat(), lng: value.lng() };
  }
  return point as google.maps.LatLngLiteral;
}

function getInitialLocation(): Promise<GeolocationPosition> {`,
    'utilidades de ruta',
  );
}

if (!source.includes('isLoaded: mapsLoaded')) {
  replaceRequired(
    '  const hasActiveDeliveries = deliveries.length > 0;',
    `  const hasActiveDeliveries = deliveries.length > 0;
  const { isLoaded: mapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: "domiu-rider-google-map",
    googleMapsApiKey: API_KEY || "missing-google-maps-key",
    libraries: mapLibraries,
  });`,
    'estado del cargador de Google Maps',
  );
}

source = source.replace(
  `  useEffect(() => {
    if (!window.google?.maps) return;
    geocoderRef.current = new google.maps.Geocoder();
    directionsServiceRef.current = new google.maps.DirectionsService();
  }, [hasActiveDeliveries]);`,
  `  useEffect(() => {
    if (!mapsLoaded || !window.google?.maps) return;
    geocoderRef.current = new window.google.maps.Geocoder();
    directionsServiceRef.current = new window.google.maps.DirectionsService();
  }, [mapsLoaded, hasActiveDeliveries]);`,
);

source = source.replace(
  '    if (!window.google?.maps || !geocoderRef.current || deliveries.length === 0) return;',
  '    if (!mapsLoaded || !window.google?.maps || !geocoderRef.current || deliveries.length === 0) return;',
);
source = source.replace(
  `          if (d.direccion_origen && !coords.has(\`pickup_\${d.id}\`)) {
            const res = await geocoder.geocode({ address: d.direccion_origen });
            if (res.results[0]?.geometry?.location) {
              coords.set(\`pickup_\${d.id}\`, { pickup: res.results[0].geometry.location });
            }
          }
          if (d.direccion && !coords.has(\`drop_\${d.id}\`)) {
            const res = await geocoder.geocode({ address: d.direccion });
            if (res.results[0]?.geometry?.location) {
              const existing = coords.get(\`drop_\${d.id}\`) || {};
              coords.set(\`drop_\${d.id}\`, { ...existing, drop: res.results[0].geometry.location });
            }
          }`,
  `          const pickupKey = \`pickup_\${d.id}\`;
          const dropKey = \`drop_\${d.id}\`;
          if (!coords.has(pickupKey)) {
            if (Number.isFinite(Number(d.pickupLat)) && Number.isFinite(Number(d.pickupLng))) {
              coords.set(pickupKey, { pickup: new window.google.maps.LatLng(Number(d.pickupLat), Number(d.pickupLng)) });
            } else if (d.direccion_origen) {
              const res = await geocoder.geocode({ address: d.direccion_origen });
              if (res.results[0]?.geometry?.location) coords.set(pickupKey, { pickup: res.results[0].geometry.location });
            }
          }
          if (!coords.has(dropKey)) {
            if (Number.isFinite(Number(d.dropLat)) && Number.isFinite(Number(d.dropLng))) {
              coords.set(dropKey, { drop: new window.google.maps.LatLng(Number(d.dropLat), Number(d.dropLng)) });
            } else if (d.direccion) {
              const res = await geocoder.geocode({ address: d.direccion });
              if (res.results[0]?.geometry?.location) coords.set(dropKey, { drop: res.results[0].geometry.location });
            }
          }`,
);
source = source.replace('  }, [deliveries, deliveryCoords]);', '  }, [mapsLoaded, deliveries, deliveryCoords]);');

source = source.replace(
  '    if (!position || !window.google?.maps || !directionsServiceRef.current || geocoding) return;',
  '    if (!mapsLoaded || !position || !window.google?.maps || !directionsServiceRef.current || geocoding) return;',
);

const routeBlock = /    async function calcRoutes\(\) \{[\s\S]*?\n    \}\n\n    calcRoutes\(\);/;
replaceRequired(
  routeBlock,
  `    async function calcRoutes() {
      const results: RouteData[] = [];
      let lastFailure = "";

      for (const d of deliveries) {
        const pickupKey = \`pickup_\${d.id}\`;
        const dropKey = \`drop_\${d.id}\`;
        const pickup = deliveryCoords.get(pickupKey)?.pickup;
        const drop = deliveryCoords.get(dropKey)?.drop;
        if (!drop) continue;

        const origin: google.maps.LatLng | google.maps.LatLngLiteral = pickup || position;
        const destination: google.maps.LatLng | google.maps.LatLngLiteral = drop;

        try {
          const response = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            directionsServiceRef.current!.route(
              {
                origin,
                destination,
                travelMode: window.google.maps.TravelMode.DRIVING,
                drivingOptions: {
                  departureTime: new Date(),
                  trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
                },
              },
              (result, status) => {
                if (status === "OK" && result) resolve(result);
                else reject(new Error(String(status)));
              },
            );
          });

          const leg = response.routes[0]?.legs?.[0];
          if (!leg) continue;
          results.push({
            legs: response.routes[0].legs,
            path: response.routes[0].overview_path || [],
            distance: leg.distance?.text || "",
            duration: leg.duration_in_traffic?.text || leg.duration?.text || "",
          });
        } catch (routeError) {
          lastFailure = routeError instanceof Error ? routeError.message : "Ruta no disponible";
          const from = asLiteral(origin);
          const to = asLiteral(destination);
          const km = directDistanceKm(from, to);
          const estimatedMinutes = Math.max(2, Math.round((km / 24) * 60));
          results.push({
            legs: [],
            path: [new window.google.maps.LatLng(from.lat, from.lng), new window.google.maps.LatLng(to.lat, to.lng)],
            distance: \`\${km.toFixed(1)} km aprox.\`,
            duration: \`\${estimatedMinutes} min aprox.\`,
          });
        }
      }

      setRoutes(results);
      if (results.length > 0) {
        setEta(results[0].duration || "Ruta lista");
        setDistance(results[0].distance || "Distancia disponible");
        setError(lastFailure ? "Google no entregó la ruta vial; mostramos una aproximación temporal." : "");
      } else {
        setEta("Ruta no disponible");
        setDistance("Revisa las direcciones");
        setError("No fue posible ubicar el origen o el destino. Verifica las direcciones del pedido.");
      }
    }

    calcRoutes();`,
  'cálculo robusto de rutas',
);
source = source.replace(
  '  }, [position, deliveries, deliveryCoords, geocoding, routes.length]);',
  '  }, [mapsLoaded, position, deliveries, deliveryCoords, geocoding, routes.length]);',
);

source = source.replace(
  `  useEffect(() => {
    if (!mapRef.current || !position) return;
    const bounds = new google.maps.LatLngBounds();`,
  `  useEffect(() => {
    if (!mapsLoaded || !window.google?.maps || !mapRef.current || !position) return;
    const bounds = new window.google.maps.LatLngBounds();`,
);
source = source.replace('  }, [deliveries, deliveryCoords, position]);', '  }, [mapsLoaded, deliveries, deliveryCoords, position]);');

source = source.replace(/\n  const riderIcon = \{[\s\S]*?\n  \};\n/, '\n');

if (!source.includes('Google Maps no está configurado')) {
  replaceRequired(
    `  return (
    <div className="relative w-full h-full bg-[#0F172A]">
      {/* Google Map */}`,
    `  if (!API_KEY) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F172A] min-h-[400px]">
        <div className="text-center px-6">
          <AlertTriangle size={40} className="text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-200 mb-2">Google Maps no está configurado</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en Vercel.</p>
        </div>
      </div>
    );
  }

  if (mapsLoadError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F172A] min-h-[400px]">
        <div className="text-center px-6">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-200 mb-2">No se pudo cargar Google Maps</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">Revisa la clave, la facturación y las restricciones del dominio.</p>
        </div>
      </div>
    );
  }

  if (!mapsLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F172A] min-h-[400px]">
        <div className="text-center px-6">
          <div className="w-8 h-8 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0F172A]">
      {/* Google Map */}`,
    'estados controlados del mapa',
  );
}

source = source.replace('      <LoadScript googleMapsApiKey={API_KEY} libraries={mapLibraries}>\n', '');
source = source.replace('      </LoadScript>\n', '');
source = source.replace('className="absolute bottom-0 left-0 right-0 z-40 p-4 pb-6"', 'className="absolute bottom-16 left-0 right-0 z-40 p-3"');
source = source.replace('{eta || "Calculando..."}', '{eta || (geocoding ? "Ubicando..." : "Preparando ruta...")}');

writeFileSync(path, source, 'utf8');
console.log('Carga segura y cálculo robusto de Google Maps aplicados.');
