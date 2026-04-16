import { WeatherSnapshot, scoreWeather } from './forecastEngine';

const WEATHER_TIMEOUT_MS = 5000;
interface OpenMeteoDaily {
  precipitation_sum?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}

interface OpenMeteoResponse {
  daily?: OpenMeteoDaily;
}

export function buildNeutralWeatherSnapshot(season: string): WeatherSnapshot {
  return {
    rainLastFiveDaysMm: 0,
    rainLastThreeDaysMm: 0,
    tempMinC: 12,
    tempMaxC: 18,
    weatherScore: 0,
    conditionLabel: 'Weather unavailable',
    weatherSummary: 'Weather data unavailable',
  };
}

export async function fetchWeatherSnapshot(season: string, lat?: number, lng?: number): Promise<WeatherSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);

  const useLat = lat ?? 43.7;
  const useLng = lng ?? -79.4;
  const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${useLat}&longitude=${useLng}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&past_days=5&forecast_days=1&timezone=auto`;

  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

    const payload = (await response.json()) as OpenMeteoResponse;
    const precipitation = payload.daily?.precipitation_sum ?? [];
    const tempMax = payload.daily?.temperature_2m_max?.[0] ?? 18;
    const tempMin = payload.daily?.temperature_2m_min?.[0] ?? 12;
    const rainLastFiveDaysMm = precipitation.reduce((sum, value) => sum + value, 0);
    const rainLastThreeDaysMm = precipitation.slice(0, 3).reduce((sum, value) => sum + value, 0);
    const scored = scoreWeather(rainLastFiveDaysMm, tempMin, tempMax, season);

    return {
      rainLastFiveDaysMm,
      rainLastThreeDaysMm,
      tempMinC: tempMin,
      tempMaxC: tempMax,
      weatherScore: scored.weatherScore,
      conditionLabel: scored.conditionLabel,
      weatherSummary: `Rain ${Math.round(rainLastFiveDaysMm)}mm in 5 days · ${Math.round(tempMax)}°C today`,
    };
  } catch {
    return {
      ...buildNeutralWeatherSnapshot(season),
      weatherScore: 0,
      conditionLabel: 'Weather unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}
