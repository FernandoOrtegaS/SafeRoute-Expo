export type Coords = {
  latitude: number;
  longitude: number;
};

export type GeoapifySuggestion = {
  placeId: string;
  name: string;
  secondary: string;
  latitude: number;
  longitude: number;
};

type GeoapifyFeature = {
  properties?: {
    place_id?: string;
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    lat?: number;
    lon?: number;
  };
};

type GeoapifyResponse = {
  features?: GeoapifyFeature[];
};

export async function searchGeoapifyAddresses(
  text: string,
  bias?: Coords | null
): Promise<GeoapifySuggestion[]> {
  const apiKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;
  if (!apiKey) {
    throw new Error('Falta EXPO_PUBLIC_GEOAPIFY_API_KEY');
  }

  const query = text.trim();
  if (query.length < 3) return [];

  const params = new URLSearchParams({
    text: query,
    apiKey,
    limit: '6',
    lang: 'es',
    filter: 'countrycode:cl',
  });

  if (bias) {
    params.set('bias', `proximity:${bias.longitude},${bias.latitude}`);
  }

  const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('No se pudo buscar la direccion');
  }

  const data = (await response.json()) as GeoapifyResponse;

  return (data.features ?? [])
    .map((feature) => {
      const props = feature.properties;
      if (!props?.place_id || typeof props.lat !== 'number' || typeof props.lon !== 'number') {
        return null;
      }

      return {
        placeId: props.place_id,
        name: props.address_line1 || props.formatted || 'Direccion',
        secondary: props.address_line2 || props.formatted || '',
        latitude: props.lat,
        longitude: props.lon,
      };
    })
    .filter((item): item is GeoapifySuggestion => item !== null);
}
