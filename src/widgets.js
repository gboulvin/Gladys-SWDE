// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+).
//
// The `water_consumption` widget shows the three meter values as live tiles,
// the daily-average history, the state of the data source and a refresh
// button. The content is declarative: the core renders it with its own theme.
// -----------------------------------------------------------------------------

import {
  createLogger,
  WIDGET_CHART_INTERVALS,
  WIDGET_CHART_TYPES,
  WIDGET_COLORS,
} from '@gladysassistant/integration-sdk';
import { waterMeter } from './devices/waterMeter.js';

const logger = createLogger({ name: 'widgets' });

// Widget key, as declared in the manifest `widgets` field.
export const WATER_CONSUMPTION_WIDGET = 'water_consumption';

// Keys of the `button` actions the content declares.
const ACTIONS = { REFRESH: 'refresh' };

// The history window of the chart, from the widget `period` setting.
const CHART_INTERVALS = {
  month: WIDGET_CHART_INTERVALS.LAST_MONTH,
  quarter: WIDGET_CHART_INTERVALS.LAST_THREE_MONTHS,
  year: WIDGET_CHART_INTERVALS.LAST_YEAR,
};

const LOCALES = { en: 'en-GB', fr: 'fr-BE', de: 'de-BE', es: 'es-ES' };

const SOURCE_LABELS = {
  manual: {
    en: 'Manual readings',
    fr: 'Relevés manuels',
    de: 'Manuelle Ablesung',
    es: 'Lecturas manuales',
  },
  api: {
    en: 'JSON endpoint',
    fr: 'Point d’accès JSON',
    de: 'JSON-Endpunkt',
    es: 'Punto de acceso JSON',
  },
};

function formatDate(iso, language) {
  if (!iso) {
    return { en: 'Never', fr: 'Jamais', de: 'Nie', es: 'Nunca' };
  }
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: process.env.TZ || undefined,
  }).format(new Date(iso));
}

function sourceStatus({ error, readAt }) {
  if (error) {
    return {
      value: {
        en: 'Read failed',
        fr: 'Lecture en échec',
        de: 'Abruf fehlgeschlagen',
        es: 'Lectura fallida',
      },
      color: WIDGET_COLORS.DANGER,
    };
  }
  if (!readAt) {
    return {
      value: { en: 'Waiting', fr: 'En attente', de: 'Ausstehend', es: 'En espera' },
      color: WIDGET_COLORS.NEUTRAL,
    };
  }
  return {
    value: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
    color: WIDGET_COLORS.SUCCESS,
  };
}

function thresholdStatus(config, { alertActive }) {
  if (!(config.daily_alert_liters > 0)) {
    return {
      value: { en: 'Disabled', fr: 'Désactivée', de: 'Deaktiviert', es: 'Desactivada' },
      color: WIDGET_COLORS.NEUTRAL,
    };
  }
  const limit = `${config.daily_alert_liters} L`;
  return alertActive
    ? {
        value: {
          en: `Above ${limit}`,
          fr: `Au-dessus de ${limit}`,
          de: `Über ${limit}`,
          es: `Por encima de ${limit}`,
        },
        color: WIDGET_COLORS.WARNING,
      }
    : {
        value: {
          en: `Below ${limit}`,
          fr: `Sous ${limit}`,
          de: `Unter ${limit}`,
          es: `Por debajo de ${limit}`,
        },
        color: WIDGET_COLORS.SUCCESS,
      };
}

export const WIDGETS = {
  [WATER_CONSUMPTION_WIDGET]: {
    async get(gladys, { settings = {}, language, config }) {
      logger.debug(`onWidgetGet <- ${WATER_CONSUMPTION_WIDGET}`);
      const features = waterMeter.featureExternalIds(gladys, config);
      const snapshot = waterMeter.snapshot(gladys, config);
      return {
        // The tiles and the chart are live; the status rows follow the reads,
        // which nudge the widget (refreshWidgets): the TTL is a safety net.
        ttl_seconds: 900,
        components: [
          {
            type: 'value',
            label: { en: 'Index', fr: 'Index', de: 'Zählerstand', es: 'Índice' },
            icon: 'droplet',
            device_feature: features.total,
          },
          {
            type: 'value',
            label: { en: 'Period', fr: 'Période', de: 'Zeitraum', es: 'Periodo' },
            icon: 'calendar',
            device_feature: features.period,
          },
          {
            type: 'value',
            label: {
              en: 'Daily average',
              fr: 'Moyenne / jour',
              de: 'Tagesmittel',
              es: 'Media diaria',
            },
            icon: 'activity',
            device_feature: features.daily,
            ...(snapshot.alertActive ? { color: WIDGET_COLORS.WARNING } : {}),
          },
          {
            type: 'chart',
            title: {
              en: 'Daily average (L)',
              fr: 'Moyenne quotidienne (L)',
              de: 'Tagesmittel (L)',
              es: 'Media diaria (L)',
            },
            chart_type: WIDGET_CHART_TYPES.STEPLINE,
            device_features: [features.daily],
            interval: CHART_INTERVALS[settings.period] ?? CHART_INTERVALS.quarter,
          },
          {
            type: 'status',
            items: [
              {
                label: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
                icon: 'database',
                value: SOURCE_LABELS[config.source_type],
                color: WIDGET_COLORS.NEUTRAL,
              },
              {
                label: {
                  en: 'Data source',
                  fr: 'Source de données',
                  de: 'Datenquelle',
                  es: 'Fuente de datos',
                },
                icon: 'wifi',
                ...sourceStatus(snapshot),
              },
              {
                label: {
                  en: 'Last read',
                  fr: 'Dernière lecture',
                  de: 'Letzter Abruf',
                  es: 'Última lectura',
                },
                icon: 'clock',
                value: formatDate(snapshot.readAt, language),
                color: WIDGET_COLORS.NEUTRAL,
              },
              {
                label: {
                  en: 'Daily alert',
                  fr: 'Alerte quotidienne',
                  de: 'Tagesalarm',
                  es: 'Alerta diaria',
                },
                icon: 'bell',
                ...thresholdStatus(config, snapshot),
              },
            ],
          },
          {
            type: 'button',
            label: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
            icon: 'refresh-cw',
            style: 'secondary',
            action: { key: ACTIONS.REFRESH },
          },
        ],
      };
    },

    // After a successful action the core drops the cached content and every
    // open dashboard refetches it: no nudge needed.
    async action(gladys, { actionKey, config }) {
      logger.info(`onWidgetAction <- ${WATER_CONSUMPTION_WIDGET}.${actionKey}`);
      if (actionKey === ACTIONS.REFRESH) {
        await waterMeter.onPoll(gladys, config);
        return {
          en: 'Water consumption refreshed.',
          fr: 'Consommation d’eau actualisée.',
          de: 'Wasserverbrauch aktualisiert.',
          es: 'Consumo de agua actualizado.',
        };
      }
      // Throwing acks the action as failed: the message reaches the user.
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },
};

/**
 * Ask the core to re-pull every widget now (after a read, a config update or
 * a reconnection). Fire-and-forget, rate-limited core-side.
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
