# Guide utilisateur — WhatsApp et agent IA dans l'espace interne

Pour l'équipe de l'agence. Chaque écran n'apparaît qu'aux rôles autorisés (matrice modifiable dans « Rôles & permissions »).

## Première connexion (direction)

La double authentification est obligatoire pour la direction : à la première connexion, la page « Sécurité du compte » s'ouvre. Scannez le code QR avec Google Authenticator ou Microsoft Authenticator, saisissez le code à 6 chiffres. Ensuite, chaque connexion demande le mot de passe puis ce code. Téléphone perdu : demandez une réinitialisation à un administrateur.

Activez les notifications du navigateur depuis la cloche (en haut à droite) pour être prévenu des urgences et transferts même dans un autre onglet.

## Au quotidien (conseillers)

- **Conversations** : les conversations transférées par l'IA (pastille dans le menu). « Prendre la main » pour répondre ; « Rendre à l'IA » une fois traité ; « Résoudre » à la fin. Hors fenêtre de 24h, seul un template approuvé peut être envoyé.
- **Copilote** : l'IA propose un brouillon ; validez, corrigez ou rejetez. Une correction améliore la base de connaissances.
- **Tâches & alertes** : reçus à valider (comptabilité), rappels, documents.
- **Contacts** : fiche de chaque contact (étape, qualification, consentement marketing, historique). Pour un nouveau consentement donné en agence, cochez la case et indiquez la preuve (où, comment). « Retirer du marketing » si le client le demande.

## Pilotage (direction, responsable)

- **Tableau de bord WhatsApp** : conversations, prospects, transferts en attente, inscriptions issues de WhatsApp, courbes, classement des conseillers, alertes en tête.
- **Statistiques** : entonnoirs par source et par programme, motifs de transfert, questions sans réponse, performance des templates et campagnes.
- **Coûts Meta & Claude** : coût réel par catégorie, template, campagne, modèle et conversation ; coût par inscription ; plafond mensuel Claude.
- **Rapport quotidien** : chaque soir à 19h (heure et contenu réglables dans « Paramètres WhatsApp »), dans la cloche et par e-mail.

## Campagnes (marketing, responsable)

1. **Nouvelle campagne** → 4 étapes : segment (filtres, « Compter les contacts »), template, planification et test A/B, récapitulatif avec coût estimé → « Enregistrer en brouillon ».
2. **Soumettre** : le responsable est notifié.
3. Le responsable **valide** (l'envoi part à l'heure prévue, entre 9h et 21h, jamais le vendredi 12h-14h) ou **refuse** avec un motif.
4. Envoi progressif par lots ; **Arrêt d'urgence** disponible à tout moment.
5. **Rapport** : livrés, lus, réponses, inscriptions générées, désinscriptions, coût par inscription, liste des contacts ayant répondu (export CSV pour les conseillers).

Seuls les contacts ayant donné leur consentement marketing sont visés ; un « STOP » reçu pendant la campagne retire immédiatement le contact.

**Importer des contacts** (page Contacts → Importer) : fichier CSV avec au minimum les colonnes « téléphone » et « consentement » (oui / non). Sans preuve de consentement, mettez « non ».

## Qualité de l'IA (direction)

- **Journal & audit IA → Audit qualité hebdomadaire** : chaque lundi, 20 conversations tirées au hasard. Notez l'exactitude et le ton (1 à 5), le transfert, et cochez « Info inventée » si l'IA a inventé une information (la direction est alertée).
- **Logs IA** : chaque réponse de l'IA avec les outils appelés, la durée et le coût ; filtre « Réponses à corriger ».
- **Journal d'audit** : qui a modifié quoi (réglages, prompts, templates, déclencheurs, campagnes, utilisateurs, rôles, données), avec l'avant/après. Export CSV.

## Données personnelles

Sur la fiche d'un contact (droit d'accès / d'effacement) : « Exporter les données » (fichier JSON) et « Supprimer les données WhatsApp ». Le dossier de voyage n'est pas touché. Les durées de conservation se règlent dans « Paramètres WhatsApp ».
