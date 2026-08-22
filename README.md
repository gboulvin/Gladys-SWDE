# Gladys SWDE — consommation d’eau

**Gladys SWDE** est une intégration externe pour [Gladys Assistant](https://gladysassistant.com) qui publie trois indicateurs historisés d’un compteur d’eau : l’index en m³, la consommation de la période et la moyenne quotidienne en litres. Le projet est fondé sur le [template JavaScript officiel](https://github.com/GladysAssistant/integration-template-js) et utilise [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

> L’Espace client SWDE donne accès à l’historique des consommations après connexion, mais aucune API publique d’automatisation n’est documentée. L’intégration ne demande donc jamais de mot de passe SWDE et n’automatise pas le portail client. [1]

| Mode de donnée            | Cas d’usage                                             | Informations configurées                                    | Risque de confidentialité                        |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| **Relevés manuels**       | Compte particulier et historique SWDE                   | Index, consommation de la période, nombre de jours          | Aucun identifiant SWDE n’est transmis.           |
| **Source JSON autorisée** | easyCONSO, export contractuel ou passerelle personnelle | URL, jeton Bearer facultatif, identifiant local du compteur | Le jeton est stocké dans un champ secret Gladys. |

## Fonctionnement

L’intégration publie un seul appareil **Compteur SWDE**, présentant trois capteurs en lecture seule. Les identifiants externes sont construits avec `gladys.externalIds` à partir de l’identifiant local stable du compteur. Les valeurs sont interrogées à l’intervalle configuré ; elles ne sont publiées dans Gladys que lorsqu’elles changent, afin de conserver un historique utile.

| Capteur                    | Unité  | Source                           |
| -------------------------- | ------ | -------------------------------- |
| Index du compteur          | m³     | `total_m3` ou relevé manuel      |
| Consommation de la période | m³     | `period_m3` ou relevé manuel     |
| Moyenne quotidienne        | L/jour | `period_m3 × 1000 / period_days` |

Le client JSON accepte une réponse directe ou enveloppée dans `data` et reconnaît notamment les variantes `totalM3`, `index_m3`, `periodM3` et `consumption_m3`. Les nombres doivent être positifs ou nuls ; il faut fournir au moins l’index ou la consommation de période.

```json
{
  "total_m3": 245.7,
  "period_m3": 9.0,
  "period_days": 30,
  "reading_at": "2026-08-22T09:00:00Z"
}
```

La documentation utilisateur détaillée est disponible en [français](./docs/fr.md) et en [anglais](./docs/en.md).

## Développement local

Installez les dépendances puis exécutez les contrôles de qualité.

```bash
npm ci
npm test
npm run lint
npm run format:check
```

Pour démarrer l’intégration contre une instance Gladys de développement, définissez les variables injectées automatiquement en production par Gladys :

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="swde-water-consumption" \
LOG_LEVEL=debug \
npm start
```

Les tests couvrent la normalisation des paramètres, les relevés manuels, l’authentification Bearer pour une source JSON, la validation de réponses et la publication des trois états Gladys.

## Publication dans le catalogue Gladys

Le manifeste requiert Gladys `>=4.86.0` et déclare la catégorie `environment`. Avant une première publication, ajoutez le sujet GitHub `gladys-assistant-integration`, vérifiez l’image de couverture et exécutez le validateur du catalogue.

```bash
npx github:GladysAssistant/integration-store .
```

Le workflow **Release** prépare automatiquement une version depuis l’onglet **Actions** : il synchronise les numéros de version, crée le tag et publie une image multi-architecture sur GitHub Container Registry. La valeur `docker_image` du manifeste doit rester cohérente avec la version publiée.

## Limites connues

La solution easyCONSO de la SWDE, qui annonce des relevés automatiques et un suivi en temps réel pour des compteurs intelligents, est un service distinct de l’Espace client général. [2] Tant qu’une API SWDE publique n’est pas documentée, la saisie manuelle ou un point d’accès explicitement autorisé demeure le seul comportement pris en charge par ce projet.

## Références

[1] [SWDE — Voir mon historique de consommation](https://www.swde.be/fr/voir-mon-historique-de-consommation)

[2] [SWDE easyCONSO — Optimisez la gestion de vos consommations d’eau](https://swde.easyconso.be/)

## Licence

[Apache-2.0](./LICENSE)
