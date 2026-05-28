# instagram-count-provider-bench

> Un outil de benchmark éducatif et défensif développé dans le cadre du cursus de l'école 42. Cet outil permet de comparer l'efficacité, la fiabilité et le coût de plusieurs méthodes d'extraction de métriques publiques Instagram.

---

## 1. Objectif

L'objectif de ce projet est de concevoir un runner de benchmark robuste et extensible capable de récupérer uniquement les métriques publiques de profils Instagram cibles :
- Nombre de followers (`followers_count`)
- Nombre de followings (`following_count`)
- Nombre de posts (`posts_count`)
- Nom d'utilisateur normalisé (`username`)
- Statut d'exécution (Succès, Skipped, Rate limited, Private, etc.)

Le but final est d'aider à choisir la solution la plus stable, la moins coûteuse et la plus simple à automatiser à l'échelle, tout en respectant une démarche éthique et défensive de scraping.

---

## 2. Pourquoi comparer plusieurs providers ?

Dans le développement d'applications dépendantes de données tierces (comme Instagram), il existe trois grandes familles d'accès :
1. **Les API Officielles (Meta Graph API) :** Totalement légales et fiables, mais limitées par des contraintes d'authentification métier (comptes Creator/Business uniquement) et soumises à validation par Meta.
2. **Le Scraping Libre (Instaloader, digitalmethods) :** Gratuit et ne requiert pas de jeton d'accès, mais très sensible aux mécanismes anti-bot d'Instagram (blocages d'IP, challenges).
3. **Les wrappers d'API Privées (instagrapi, dilame) :** Permettent des requêtes avancées en émulant un client mobile, mais exposent à un très fort risque de suspension de compte ("risky").

Ce benchmark permet d'évaluer concrètement ces alternatives sur les mêmes cibles au même moment.

---

## 3. Installation

Le projet utilise **Node.js (TypeScript)** pour l'orchestration principale et **Python** pour certains adaptateurs de scraping libres.

### Prérequis
- Node.js >= 18.x
- Python >= 3.10
- Git

### Lancement du script de setup
Exécutez la commande suivante pour installer les dépendances Node, initialiser l'environnement virtuel Python `.venv` et installer les bibliothèques Python requises (`instaloader`, `instagrapi`) :

```bash
npm run setup
```

Initialisez la base de données SQLite locale :

```bash
npm run init-db
```

---

## 4. Lancer le mode gratuit (Free Mode)

Le mode gratuit permet d'exécuter le benchmark en utilisant uniquement des providers locaux gratuits et sécurisés :
- **Mock :** Un provider local déterministe hors-ligne (idéal pour tester le runner sans requêtes réseau).
- **Instaloader :** Scraping public léger sans connexion.
- **DigitalMethods Batch Scraper :** Un flow batch CSV.

Pour exécuter :
```bash
npm run bench:free
```

*Note sur DigitalMethods :* Ce provider est encapsulé en tant que module externe (vendor). Pour l'activer, vous pouvez cloner le dépôt associé grâce au script dédié :
```bash
bash scripts/vendor-digitalmethods.sh
```

---

## 5. Lancer le provider officiel Meta

Le provider Meta Graph utilise l'API Business Discovery officielle.

1. Renseignez vos identifiants dans le fichier `.env` à la racine :
   ```env
   META_ACCESS_TOKEN=votre_token_graph_api
   META_IG_USER_ID=votre_id_instagram_page_liee
   META_GRAPH_API_VERSION=v25.0
   ```
2. Lancez le benchmark :
   ```bash
  npm run bench:official
  ```

---

## 6. Importer un export IG Exporter / Selenium

Si vous utilisez l'extension Chrome IG Exporter manuellement, exportez les listes en CSV puis importez-les dans le benchmark sans piloter Instagram en navigateur automatisé :

```bash
npm run import:ig-export -- \
  --target profilefinder.ai \
  --followers exports/profilefinder.ai_followers.csv \
  --following exports/profilefinder.ai_following.csv
```

La commande accepte les formats CSV proches de Selenium (`username`, `full_name`, `is_verified`) et IG Exporter (`ID`, `Username`, `Full name`, `Profile picture url`, `Is verified`). Elle génère :
- `exports/latest-results.csv` et `exports/latest-results.json`
- `reports/provider-comparison.md`
- un résumé `exports/<target>_ig_exporter_summary_<timestamp>.json`
- si followers et following sont fournis, deux listes de comparaison : comptes suivis qui ne suivent pas en retour, et followers non suivis en retour.

Le provider correspondant s'appelle `ig_exporter_manual`.

### Export GraphQL façon extension

Le projet contient aussi un script expérimental qui reproduit la pagination observée dans l'extension installée localement : résolution du `profilePage_<id>`, puis requêtes GraphQL par pages de 50 avec `end_cursor`.

```bash
npm run export:extension-graphql -- profilefinder.ai --mode following --delay 15
npm run export:extension-graphql -- profilefinder.ai --mode followers --delay 15
```

Pour `profilefinder.ai`, l'export complet mesuré le 26/05/2026 a produit :
- `256 / 256` followings en 6 pages
- `3326` followers accessibles en 71 pages, pour un compteur public annoncé à `3329`

Les quelques unités d'écart peuvent arriver lorsque le compteur public Instagram est désynchronisé de l'edge GraphQL accessible, ou lorsque certains comptes ne sont plus retournés dans la pagination. Le script s'arrête uniquement quand `has_next_page=false`.

Pour plusieurs demandes, préparez un fichier avec une cible par ligne :

```bash
npm run export:extension-graphql -- \
  --targets-file data/export-targets.txt \
  --mode both \
  --delay 15 \
  --resume
```

Le script réutilise la même session Chrome, écrit des checkpoints `.partial.json`, et peut reprendre après une interruption avec `--resume`. Voir `docs/dev-handoff.md` pour l'architecture queue/worker recommandée.

Pour un aperçu webapp rapide, sans export complet :

```bash
npm run preview:extension-graphql -- profilefinder.ai
```

Cette commande récupère seulement 6 followers et 6 followings. Elle sert à afficher une preview immédiate avec le reste flouté, puis à lancer l'export complet en arrière-plan uniquement si l'utilisateur confirme.

---

## 7. Importer l'export officiel Instagram

Pour votre propre compte, la méthode la plus complète consiste à demander l'archive officielle Instagram, puis à l'importer une fois le `.zip` extrait localement. Elle contient normalement les fichiers JSON `followers_1.json` et `following.json`.

```bash
npm run import:instagram-data -- \
  --target profilefinder.ai \
  --path ~/Downloads/instagram-profilefinder-ai-2026-05-26
```

La commande parcourt récursivement le dossier, déduplique les usernames, met à jour `latest-results`, génère le rapport, et produit les listes de comparaison. C'est la voie recommandée pour obtenir l'intégralité d'un compte qui vous appartient, sans automatiser de navigation Instagram.

Le provider correspondant s'appelle `instagram_data_export`.

---

## 8. Mode démo reproductible

Pour une soutenance, vous pouvez générer un export Instagram local simulé aux volumes du profil d'exemple, puis le faire passer dans le même pipeline d'import :

```bash
npm run demo:instagram-data -- \
  --target profilefinder.ai \
  --followers 3329 \
  --following 256 \
  --mutual 180
```

Ce mode ne scrape pas Instagram. Il crée une fixture JSON au format de l'export officiel, l'importe immédiatement, puis génère les mêmes sorties que le cas réel : `latest-results`, rapport Markdown, et listes de comparaison.

---

## 9. Lancer les providers expérimentaux (Risky Mode)

> [!WARNING]
> Ces providers utilisent des API privées d'Instagram en émulant des comportements d'application. Ils ne doivent être testés qu'avec des comptes de test ("throwaway accounts").

1. Activez les providers risqués et renseignez un compte de test dans le fichier `.env` :
   ```env
   ENABLE_RISKY_PROVIDERS=true
   IG_USERNAME=votre_compte_test_instagram
   ```
   Ajoutez le mot de passe uniquement dans votre `.env` local, jamais dans un fichier commité.
2. Exécutez :
   ```bash
   npm run bench:risky
   ```

---

## 10. Pourquoi les providers privés sont risqués ?

L'utilisation d'API privées (comme celle émulée par `instagrapi` ou `instagram-private-api`) enfreint directement les Conditions d'Utilisation d'Instagram. 
- Instagram détecte les signatures d'appels non standards et les empreintes TLS suspectes.
- Le compte utilisé pour s'authentifier peut subir des défis de vérification ("Challenge/Captcha") ou une suspension définitive.
- En production, cette méthode est instable et nécessite une maintenance continue.

---

## 11. Pourquoi on ne fait pas de bypass/proxy/CAPTCHA ?

Ce projet applique une philosophie de **développement défensif et éducatif** :
- **Pas de contournement agressif :** Nous respectons un délai d'attente configurable (ex: 5 secondes via `REQUEST_DELAY_MS`) entre chaque requête pour éviter les surcharges.
- **Transparence et Sécurité :** Pas de rotation automatique d'IP ou de contournement de CAPTCHA, qui s'apparentent à des pratiques malveillantes.
- Si un rate limit survient, l'outil l'enregistre proprement en tant que statut `rate_limited` et continue calmement ou s'arrête, sans forcer.

---

## 12. Comment lire le rapport ?

À chaque exécution de benchmark, trois fichiers de sortie sont générés ou mis à jour :
1. **Console Table :** Un tableau synthétique affiché dans le terminal.
2. **Fichiers Exports :** `exports/latest-results.csv` et `exports/latest-results.json`.
3. **Rapport détaillé :** `reports/provider-comparison.md`.

Le rapport Markdown affiche :
- Le taux de succès global par provider.
- Le temps de réponse moyen.
- La détection de différences de métriques (si Instaloader renvoie des chiffres différents de l'API Meta pour le même compte).
- Une recommandation générée automatiquement.

---

## 13. Résultats attendus

Après un run gratuit, vous devriez obtenir une sortie terminal semblable à celle-ci :

```text
Running providers:
- mock: enabled
- instaloader: enabled
- digitalmethods_batch: skipped unless vendor installed
- meta_graph: skipped, missing env
- instagrapi_experimental: skipped, risky disabled
- dilame_private_api_experimental: skipped, risky disabled

Results:
---------------------------------------------------------------------------------------------------------
Provider                 | Username        | Followers    | Following    | Posts    | Status       | Duration
---------------------------------------------------------------------------------------------------------
mock                     | nike            | 480112       | 1686         | 306      | success      | 0ms
instaloader              | nike            | 269000000    | 120          | 1100     | success      | 1540ms
---------------------------------------------------------------------------------------------------------
```

---

## 14. Limites connues
- **Rate limiting public :** L'adresse IP locale peut rapidement être bloquée par Instagram (code 429) si vous exécutez le benchmark trop souvent ou sans délai suffisant.
- **Comptes Privés :** Les comptes configurés comme privés retourneront logiquement un statut `private` sans valeur de followers/posts (sauf si le compte de test utilisé y est abonné).

---

## 15. Prochaine étape recommandée

Pour industrialiser la collecte de ces métriques de manière stable et pérenne :
1. Privilégier le **Meta Graph API** pour tous les profils de type Business ou Creator.
2. Utiliser un **système de cache avec TTL** (Time to Live) de 12 à 24 heures pour limiter les requêtes en temps réel.
3. Pour les profils personnels publics ne pouvant pas utiliser l'API officielle, utiliser un adaptateur **Instaloader** s'appuyant sur un service de proxies résidentiels à rotation lente.
