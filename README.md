# Carnet ornitho

Application web installable (PWA) pour noter ses observations d'oiseaux pendant les balades.
Elle fonctionne entièrement hors ligne : les données restent sur le téléphone (IndexedDB),
et l'appli elle-même est gardée en cache par un service worker.

Toutes les données sont enregistrées **en minuscules et sans accents**
(`js/domain/normalize.js`), y compris ce qu'on tape dans l'appli.

## Écrans

| Onglet | Rôle |
|---|---|
| Balade | Démarrer une balade, puis noter les espèces : pastilles d'espèces probables (selon le lieu et la saison), recherche avec autocomplétion, bouton « Entendu », annulation |
| Historique | Toutes les balades ; dans une balade : corriger un nom, basculer vu / entendu, supprimer, ajouter une espèce oubliée |
| Lieux | Lieux connus et ajout d'un nouveau lieu (un lieu peut aussi être créé en démarrant une balade) |
| Exporter | Fichier `.xlsx` de toutes les balades, une ligne par observation, à télécharger ou partager |

Au premier lancement, les 73 balades et 1 027 observations historiques (`data/seed.json`) sont importées.

## Tester sur l'ordinateur

```bash
node tools/serve.mjs
```

Puis ouvrir http://localhost:8787 dans Chrome (le mode téléphone des outils de développement aide).

## Installer sur un téléphone Android

Le service worker exige une adresse en **HTTPS**. Le plus simple : GitHub Pages (gratuit).

1. Créer un dépôt GitHub et y envoyer ce dossier.
2. Dans le dépôt : Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvrir l'adresse donnée (`https://<compte>.github.io/<depot>/`) dans Chrome sur le téléphone.
4. Menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »).
5. Ouvrir l'appli une fois avec du réseau : ensuite, elle marche sans.

Les données ne sont **que** sur le téléphone : exporter régulièrement en Excel sert de sauvegarde.
Désinstaller l'appli ou effacer les données de Chrome pour ce site les supprime.

## Publier une mise à jour

1. Modifier les fichiers.
2. Augmenter `VERSION` dans `sw.js` (ex. `v1` → `v2`), sinon les téléphones gardent l'ancienne version.
3. Si un fichier a été ajouté ou supprimé : `node tools/check-assets.mjs` vérifie la liste mise en cache.
4. Envoyer sur GitHub. À la prochaine ouverture en ligne, l'appli propose « Recharger ».

Pour régénérer les données initiales depuis un CSV `date,lieu,pays,espece,entendu` :
`node tools/build-seed.mjs data/source/observations_nettoyees.csv`, puis augmenter `SEED_VERSION`
dans `js/db/seed.js` (seules les lignes « seed-… » sont réécrites).

## Organisation du code

```
index.html, manifest.webmanifest, sw.js   coquille, installation, hors ligne
css/app.css                               interface (thème clair / sombre)
data/seed.json                            observations historiques
js/app.js, js/router.js                   démarrage, navigation par #ancre
js/db/        idb.js (schéma + migrations), repo.js (lecture/écriture), seed.js (import)
js/domain/    normalize.js, models.js (champs, pays → continent), species.js (suggestions)
js/screens/   un fichier par écran
js/ui/        composants (panneau d'ajout rapide, ligne d'observation, champs de lieu)
js/lib/       xlsx-writer.js (fichier Excel sans librairie externe)
js/services/  export-xlsx.js, stats.js, sync/
tools/        serve, build-seed, check-assets
```

### Modèle de données

- **lieux** : `nom`, `pays`, `continent`
- **balades** : `date` (AAAA-MM-JJ), `lieu`, `pays`, `continent`, `debut`, `fin`
- **observations** : `baladeId`, `espece`, `nomScientifique`, `remarques`, `heure`

Chaque enregistrement a aussi `id` (UUID créé sur l'appareil), `createdAt`, `updatedAt`,
`deletedAt` (suppression douce) et `syncedAt`, prévus pour la synchronisation.

## Évolutions prévues

### Statistiques

`js/services/stats.js` contient déjà des fonctions pures (accumulation des espèces,
fréquence, diversité par mois, bilan par lieu), avec les mêmes définitions que le tableau de bord.
Il suffira d'ajouter un écran `js/screens/stats.js`, une route dans `app.js` et un onglet.

### Synchronisation Supabase

`js/services/sync/sync.js` gère déjà la file d'envoi (lignes dont `updatedAt > syncedAt`),
la récupération depuis la dernière synchro et la fusion « la modification la plus récente l'emporte »
(`repo.mergeRemote`). Il reste à :

1. Créer dans Supabase les tables `lieux`, `balades`, `observations` avec les mêmes colonnes
   (en snake_case) plus `user_id uuid default auth.uid()`, et activer la Row Level Security
   avec une règle `user_id = auth.uid()`.
2. Copier `supabase-js` dans `vendor/` (pas de chargement en ligne : l'appli doit rester hors ligne).
3. Écrire `push` (upsert par `id`) et `pull` (`updated_at > since`) dans `sync/supabase.js`.
4. Ajouter un écran de connexion par lien magique, puis `setAdapter(...)` et un appel à
   `syncNow()` au retour du réseau (`window.addEventListener('online', …)`).
