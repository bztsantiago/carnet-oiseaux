// Adaptateur Supabase : PAS ENCORE ACTIF.
// Étapes prévues (détaillées dans le README, section « Synchronisation ») :
//  1. Créer les tables lieux, balades, observations (mêmes champs que l'appli
//     + user_id), avec la sécurité par ligne (chacun ne voit que ses données).
//  2. Copier la librairie supabase-js dans vendor/ (l'appli doit rester hors ligne).
//  3. Implémenter push / pull ci-dessous avec upsert et un filtre updated_at > since.
//  4. Appeler setAdapter(createSupabaseAdapter(...)) dans app.js, après connexion
//     par lien magique.

export function createSupabaseAdapter(/* { client } */) {
  return {
    async push(/* { lieux, balades, observations } */) {
      throw new Error('Synchronisation Supabase non configurée');
    },
    async pull(/* sinceIso */) {
      throw new Error('Synchronisation Supabase non configurée');
    },
  };
}
