# SWDE Water Consumption

Cette intégration externe permet d’afficher dans Gladys l’**index du compteur**, la **consommation de la période** et la **moyenne quotidienne** d’un compteur desservi par la SWDE. Chaque indicateur est historisé afin d’être utilisable dans les tableaux de bord et les graphiques Gladys.

> L’Espace client SWDE permet de consulter l’historique des consommations après authentification, mais la SWDE ne documente pas d’API publique destinée à l’automatisation. L’intégration ne collecte donc jamais de mot de passe SWDE et ne pilote pas le portail web. [1]

| Indicateur Gladys          | Unité  | Description                                                            |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| Index du compteur          | m³     | Valeur cumulée relevée sur le compteur.                                |
| Consommation de la période | m³     | Volume consommé sur la période de référence.                           |
| Moyenne quotidienne        | L/jour | Calculée à partir de la consommation de période et du nombre de jours. |

## Installation et ajout du compteur

Installez l’intégration depuis le catalogue Gladys, puis ouvrez son onglet **Configuration**. Choisissez un identifiant local stable pour le compteur, par exemple les derniers chiffres de son numéro de série, et donnez-lui un nom lisible. N’utilisez pas votre numéro de client SWDE : il n’est ni nécessaire ni souhaitable pour l’intégration.

Après l’enregistrement, ouvrez l’onglet **Découverte** de l’intégration et ajoutez le compteur proposé. Les trois capteurs apparaissent alors sur le tableau de bord et dans l’historique des états de Gladys.

## Saisie manuelle recommandée pour un compte particulier

Sélectionnez **Relevés manuels du compteur** lorsque vous consultez votre index dans l’Espace client SWDE ou directement sur le compteur. Saisissez l’index en m³, la consommation associée à votre période de référence et le nombre de jours de cette période. Enregistrez la configuration à chaque nouveau relevé : Gladys publie alors les nouvelles valeurs et recalcule la moyenne quotidienne.

Cette méthode est la plus fiable pour un compte particulier car elle ne dépend d’aucune interface privée non documentée. La page officielle de la SWDE confirme que l’historique des consommations est disponible depuis l’Espace client. [1]

## Source JSON autorisée

Sélectionnez **Point d’accès JSON autorisé** uniquement lorsque vous disposez d’une interface contractuelle ou explicitement documentée, par exemple un service easyCONSO, un export agréé ou votre propre passerelle. Renseignez l’URL HTTPS du point d’accès et, si nécessaire, un jeton d’accès. Le jeton est enregistré dans un champ secret Gladys et est transmis dans l’en-tête `Authorization: Bearer …`.

Le point d’accès doit répondre à une requête `GET` avec un objet JSON direct ou enveloppé dans une propriété `data`. Il doit contenir `total_m3` et/ou `period_m3`. `period_days` est facultatif mais nécessaire au calcul de la moyenne quotidienne. Les formes camelCase sont aussi acceptées.

```json
{
  "total_m3": 245.7,
  "period_m3": 9.0,
  "period_days": 30,
  "reading_at": "2026-08-22T09:00:00Z"
}
```

| Champ         | Obligatoire                     | Règle                                                             |
| ------------- | ------------------------------- | ----------------------------------------------------------------- |
| `total_m3`    | Non, si `period_m3` est présent | Nombre supérieur ou égal à zéro.                                  |
| `period_m3`   | Non, si `total_m3` est présent  | Nombre supérieur ou égal à zéro.                                  |
| `period_days` | Non                             | Nombre strictement positif ; utilisé pour la moyenne quotidienne. |
| `reading_at`  | Non                             | Horodatage informatif ISO 8601.                                   |

L’intervalle de rafraîchissement par défaut est d’une heure. Choisissez un intervalle raisonnable : les relevés SWDE et les données de consommation n’évoluent généralement pas à la minute, et Gladys conserve l’historique des états. L’intégration évite en outre de republier une valeur inchangée pendant sa session en cours.

## Vérification et dépannage

Utilisez le bouton **Tester la source de données** avant d’ajouter le compteur ou après toute modification d’URL. Le résultat confirme les valeurs reconnues sans afficher de jeton. Si le test échoue, vérifiez que l’URL répond depuis l’hôte Gladys, que le jeton est valide et que la réponse respecte le schéma ci-dessus. Consultez enfin les journaux de l’intégration ; `LOG_LEVEL=debug` augmente le niveau de détail.

La solution easyCONSO de la SWDE est distincte de l’Espace client général. Elle annonce notamment des relevés automatiques et un suivi en temps réel pour les compteurs intelligents, dans un cadre de service spécifique. [2]

## Références

[1] [SWDE — Voir mon historique de consommation](https://www.swde.be/fr/voir-mon-historique-de-consommation)

[2] [SWDE easyCONSO — Optimisez la gestion de vos consommations d’eau](https://swde.easyconso.be/)
