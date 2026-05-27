# Prompts de Generation des Diagrammes Mizan

Ce fichier contient les prompts a utiliser dans un outil de generation d'images pour produire des diagrammes propres et coherents avec le rapport Mizan.

Objectif general : remplacer ou accompagner les diagrammes LaTeX par des images professionnelles, lisibles, academiques et en francais.

## Style commun pour tous les diagrammes

Utiliser ce style comme base pour tous les prompts :

```text
Style visuel : diagramme technique academique, propre, minimaliste, fond blanc, formes geometriques simples, texte tres lisible, fleches nettes, alignement strict, marges regulieres, couleurs sobres inspirees de Mizan : bleu profond, vert, gris clair et accents orange. Pas d'illustration decorative, pas de personnages realistes, pas d'effet 3D, pas de gradient fort, pas de fond sombre. Le diagramme doit ressembler a une figure de memoire d'ingenierie logicielle, exportable en PNG haute resolution.

Contraintes typographiques : tous les textes doivent etre en francais, sans fautes, lisibles, avec police sans-serif professionnelle. Les boites doivent avoir assez d'espace pour le texte. Les fleches doivent indiquer clairement le sens des interactions. Format paysage 16:9 ou A4 paysage, resolution minimale 3000 px de largeur.
```

Negative prompt commun :

```text
Ne pas generer de code source, ne pas utiliser de texte flou, ne pas couper les mots, ne pas ajouter de logos inventes, ne pas ajouter de photos, ne pas mettre de decoration inutile, ne pas utiliser un style cartoon, ne pas empiler les boites, ne pas creer de chevauchement entre fleches et textes.
```

## UML 1. Diagramme de Cas d'Utilisation

Nom conseille : `diagramme_cas_utilisation_mizan.png`

Prompt :

```text
Creer un diagramme UML de cas d'utilisation pour la plateforme Mizan.

Titre : "Diagramme de cas d'utilisation de Mizan".

Systeme central : un grand cadre nomme "Mizan".

Acteurs a gauche :
1. "Etudiant"
2. "Administrateur d'ecole"

Acteur a droite :
1. "Assistant IA"

Cas d'utilisation dans le cadre Mizan :
- "Se connecter"
- "Realiser un check-in"
- "Consulter le tableau de bord"
- "Gerer objectifs et taches"
- "Dialoguer avec l'assistant"
- "Recevoir notifications"
- "Gerer les etudiants"
- "Gerer contenus academiques"
- "Publier ressources"
- "Consulter indicateurs"

Associations :
- Etudiant vers : Se connecter, Realiser un check-in, Consulter le tableau de bord, Gerer objectifs et taches, Dialoguer avec l'assistant, Recevoir notifications.
- Administrateur d'ecole vers : Se connecter, Gerer les etudiants, Gerer contenus academiques, Publier ressources, Consulter indicateurs.
- Assistant IA vers : Dialoguer avec l'assistant, Recevoir notifications.

Relations optionnelles :
- "Realiser un check-in" inclut "Consulter le tableau de bord".
- "Dialoguer avec l'assistant" utilise le contexte du tableau de bord.
- "Consulter indicateurs" agrege les check-ins.

Style UML academique : acteurs simples, cas d'utilisation sous forme d'ovales, cadre systeme clair, fleches ou lignes propres, texte en francais, aucun chevauchement.
```

## UML 2. Diagramme d'Activites du Check-in

Nom conseille : `diagramme_activites_checkin_mizan.png`

Prompt :

```text
Creer un diagramme UML d'activites pour le scenario "check-in avec analyse intelligente" dans Mizan.

Titre : "Diagramme d'activites du check-in avec analyse intelligente".

Etapes :
1. Debut
2. Connexion de l'etudiant
3. Saisie humeur, sommeil, notes et priorites
4. Validation JWT et donnees Pydantic
5. Decision : "Donnees valides ?"
   - Non : retour a la saisie avec message d'erreur
   - Oui : continuer
6. Enregistrement du check-in dans PostgreSQL
7. Construction du contexte etudiant
8. Decision : "IA configuree ?"
   - Oui : interroger l'assistant IA
   - Non : generer une reponse locale minimale
9. Afficher resume, risques et plan d'action
10. Fin

Style UML : noeud initial noir, activites sous forme de rectangles arrondis, decisions sous forme de losanges, noeud final, fleches directionnelles claires, texte en francais, fond blanc, format paysage ou vertical lisible.
```

## 1. Diagramme de Contexte Systeme C4 Niveau 1

Nom conseille : `diagramme_c4_contexte_mizan.png`

Prompt :

```text
Creer un diagramme de contexte systeme C4 niveau 1 pour la plateforme Mizan.

Titre du diagramme : "Diagramme de contexte systeme C4 - Niveau 1".

Au centre, placer une grande boite principale :
"Mizan"
"Plateforme de suivi et d'accompagnement etudiant"

A gauche de Mizan, placer deux acteurs humains :
1. "Etudiant"
2. "Administrateur"

A droite de Mizan, placer trois systemes externes :
1. "Mistral IA"
2. "Cloudinary"
3. "AWS"

Relations a afficher :
- Etudiant -> Mizan : "Application web/mobile HTTPS"
- Administrateur -> Mizan : "Console d'administration HTTPS"
- Mizan -> Mistral IA : "Prompts, analyse, assistance intelligente"
- Mizan -> Cloudinary : "Stockage des photos et medias"
- Mizan -> AWS : "Hebergement, deploiement, logs"

Disposition : Mizan au centre, acteurs humains a gauche, systemes externes a droite, fleches directionnelles propres. Utiliser des boites arrondies legerement, bordures bleues pour les acteurs, bordure verte pour le systeme Mizan, bordure orange pour les systemes externes. Fond blanc, style C4 professionnel, tres lisible.
```

## 2. Diagramme de Conteneurs C4 Niveau 2

Nom conseille : `diagramme_c4_conteneurs_mizan.png`

Prompt :

```text
Creer un diagramme de conteneurs C4 niveau 2 pour la plateforme Mizan.

Titre : "Diagramme de conteneurs C4 - Niveau 2".

Conteneurs internes a afficher :
1. "Application Web" avec sous-texte "Next.js / React / TypeScript"
2. "Application Mobile" avec sous-texte "Expo React Native / TypeScript"
3. "API Back-end" avec sous-texte "FastAPI / Python"
4. "Base de donnees" avec sous-texte "PostgreSQL"

Systemes externes :
1. "Mistral IA"
2. "Cloudinary"

Relations :
- Application Web -> API Back-end : "HTTP/JSON"
- Application Mobile -> API Back-end : "HTTP/JSON"
- API Back-end -> Base de donnees : "SQLAlchemy / SQL"
- API Back-end -> Mistral IA : "Texte, voix, recommandations"
- API Back-end -> Cloudinary : "Upload et gestion des medias"

Disposition recommandee : Application Web et Application Mobile a gauche, API Back-end au centre, PostgreSQL a droite, Mistral IA au-dessus de l'API, Cloudinary au-dessous de l'API. Utiliser une forme cylindrique pour PostgreSQL. Diagramme technique clair, fond blanc, fleches sans chevauchement.
```

## 3. Diagramme de Composants Back-end C4 Niveau 3

Nom conseille : `diagramme_c4_composants_backend.png`

Prompt :

```text
Creer un diagramme de composants C4 niveau 3 pour le back-end de Mizan.

Titre : "Diagramme de composants du back-end - C4 Niveau 3".

Composants a afficher dans le conteneur "API Back-end FastAPI" :
1. "Routes API"
2. "Schemas Pydantic"
3. "Services metier"
4. "Modeles SQLAlchemy"
5. "Securite JWT / roles"
6. "Base de donnees PostgreSQL"
7. "Services IA et voix"
8. "Fichiers Cloudinary"

Relations :
- Routes API -> Schemas Pydantic : "validation entree/sortie"
- Schemas Pydantic -> Services metier : "donnees validees"
- Services metier -> Modeles SQLAlchemy : "regles metier"
- Modeles SQLAlchemy -> Base de donnees PostgreSQL : "persistance"
- Routes API -> Securite JWT / roles : "controle d'acces"
- Services metier -> Services IA et voix : "analyse et recommandations"
- Services metier -> Fichiers Cloudinary : "stockage medias"

Mettre "API Back-end FastAPI" comme grand cadre englobant les composants internes. Utiliser un style clair de diagramme d'architecture logicielle, boites alignees, fleches propres, texte en francais, fond blanc.
```

## 4. Diagramme de Code C4 Niveau 4 du Module Check-in

Nom conseille : `diagramme_c4_code_checkin.png`

Prompt :

```text
Creer un diagramme de code C4 niveau 4 pour le module check-in de la plateforme Mizan.

Titre : "Diagramme de code C4 - Module Check-in".

Afficher les fichiers/classes/fonctions principales sous forme de boites techniques :

1. "routes/checkins.py"
   - POST /checkins
   - GET /history

2. "schemas/checkin.py"
   - MorningCheckinCreate
   - EveningCheckinCreate

3. "services/checkin_service.py"
   - create_morning_checkin()
   - create_evening_checkin()
   - get_checkin_history()

4. "services/context_builder.py"
   - build_agent_context()

5. "services/agent_service.py"
   - generate_advanced_ritual_report()
   - chat_with_agent()

6. "models/checkin.py"
   - MorningCheckin
   - EveningCheckin

Relations :
- routes/checkins.py -> schemas/checkin.py : "valide la requete"
- schemas/checkin.py -> services/checkin_service.py : "transmet les donnees"
- services/checkin_service.py -> models/checkin.py : "sauvegarde les check-ins"
- services/checkin_service.py -> services/context_builder.py : "prepare le contexte"
- services/context_builder.py -> services/agent_service.py : "envoie contexte et reponses"

Style : diagramme technique de code, boites rectangulaires avec en-tete fonce, texte lisible, fleches directionnelles, pas de decoration. Format paysage.
```

## 5. Diagramme de Classes UML Simplifie

Nom conseille : `uml-class.png`

Autre nom accepte par le rapport : `diagramme_classes_mizan.png`

Prompt :

```text
Creer un diagramme de classes UML simplifie pour le domaine Mizan.

Titre : "Diagramme de classes simplifie du domaine Mizan".

Classes a afficher avec attributs principaux :

Classe User :
- id
- email
- role
- school_id

Classe Student :
- id
- user_id
- class_id
- first_name
- cne

Classe School :
- id
- name
- verification_status

Classe Class :
- id
- name
- promotion_id
- academic_year

Classe Checkin :
- id
- student_id
- mood_score
- notes
- created_at

Classe Goal :
- id
- student_id
- title
- status

Classe Task :
- id
- student_id
- title
- status

Classe ModeSession :
- id
- student_id
- mode
- started_at

Classe AcademicContent :
- id
- student_id
- subject
- date
- type

Classe AgentRun :
- id
- student_id
- action
- confidence
- created_at

Classe Notification :
- id
- student_id
- title
- message
- is_read

Classe Resource :
- id
- title
- category
- mood_min
- mood_max

Relations et cardinalites :
- User 1 -- 1 Student
- School 1 -- N Class
- Class 1 -- N Student
- Student 1 -- N Checkin
- Student 1 -- N Goal
- Student 1 -- N Task
- Student 1 -- N ModeSession
- Student 1 -- N AcademicContent
- Student 1 -- N AgentRun
- AgentRun 1 -- N Notification
- Resource peut etre proposee a Student selon le score d'humeur

Style UML propre : chaque classe est une boite en trois parties, nom de classe en gras, attributs listes, relations avec cardinalites visibles. Fond blanc, lignes noires ou bleu fonce, aucune decoration.
```

## 6. Diagramme de Deploiement AWS

Nom conseille : `mizan-aws.png`

Autre nom accepte par le rapport : `diagramme_deploiement_aws_mizan.png`

Prompt :

```text
Creer un diagramme de deploiement AWS pour la plateforme Mizan.

Titre : "Diagramme de deploiement AWS de Mizan".

Elements a afficher :
1. "Utilisateur" a gauche
2. "CloudFront" en entree publique
3. "Application Load Balancer"
4. "ECS Fargate - Front-end"
5. "ECS Fargate - Back-end"
6. "RDS PostgreSQL"
7. "ECR - Images Docker"
8. "Secrets Manager"
9. "GitHub Actions"

Relations :
- Utilisateur -> CloudFront : "HTTPS"
- CloudFront -> Application Load Balancer : "routage"
- Application Load Balancer -> ECS Fargate Front-end : "pages web"
- Application Load Balancer -> ECS Fargate Back-end : "routes API"
- ECS Fargate Back-end -> RDS PostgreSQL : "SQL prive"
- ECR -> ECS Fargate Front-end : "image Docker"
- ECR -> ECS Fargate Back-end : "image Docker"
- Secrets Manager -> ECS Fargate Back-end : "secrets applicatifs"
- GitHub Actions -> ECR : "build et push images"
- GitHub Actions -> Terraform/AWS : "deploiement infrastructure"

Disposition : flux de gauche vers droite, zone publique en haut, zone applicative au centre, base de donnees privee en bas, pipeline CI/CD sur le cote. Utiliser icones simples ou boites nommees, pas besoin de logos AWS officiels si l'outil ne les gere pas. Diagramme clair, professionnel, lisible en impression.
```

## 7. Diagramme de Sequence du Check-in avec Analyse IA

Nom conseille : `diagramme_sequence_checkin_ia.png`

Prompt :

```text
Creer un diagramme de sequence UML pour le scenario "check-in avec analyse intelligente" dans Mizan.

Titre : "Diagramme de sequence du check-in avec analyse intelligente".

Participants, de gauche a droite :
1. "Etudiant"
2. "Front-end Web/Mobile"
3. "API FastAPI"
4. "Base PostgreSQL"
5. "Service Contexte"
6. "Assistant IA"

Messages :
1. Etudiant -> Front-end Web/Mobile : "Saisir humeur, sommeil, notes"
2. Front-end Web/Mobile -> API FastAPI : "POST /checkins"
3. API FastAPI -> API FastAPI : "Valider JWT et donnees Pydantic"
4. API FastAPI -> Base PostgreSQL : "Enregistrer le check-in"
5. Base PostgreSQL -> API FastAPI : "Check-in sauvegarde"
6. API FastAPI -> Service Contexte : "Construire contexte etudiant"
7. Service Contexte -> Base PostgreSQL : "Lire cours, examens, projets, objectifs"
8. Base PostgreSQL -> Service Contexte : "Retourner donnees utiles"
9. Service Contexte -> Assistant IA : "Envoyer contexte + reponses"
10. Assistant IA -> Service Contexte : "Resume, risques, plan d'action"
11. Service Contexte -> API FastAPI : "Retour structure"
12. API FastAPI -> Front-end Web/Mobile : "Rapport personnalise"
13. Front-end Web/Mobile -> Etudiant : "Afficher conseil et plan d'action"

Style UML sequence : lignes de vie verticales, fleches horizontales, retours en pointille, activation optionnelle. Texte en francais, grande lisibilite, fond blanc, format paysage large.
```

## 8. Diagramme de Flux Fonctionnel du Tableau de Bord

Nom conseille : `diagramme_flux_dashboard_mizan.png`

Prompt :

```text
Creer un diagramme de flux fonctionnel pour le tableau de bord etudiant de Mizan.

Titre : "Flux fonctionnel du tableau de bord etudiant".

Sources de donnees a gauche :
- Check-ins matin/soir
- Objectifs et taches
- Modes de travail
- Examens et projets
- Notifications
- Ressources de bien-etre

Au centre :
"API FastAPI"
"Agregation et validation des donnees"

Puis :
"Service Analytics"
"Calcul des indicateurs"

A droite :
"Tableau de bord etudiant"
avec les blocs :
- Humeur et sommeil
- Priorites du jour
- Objectifs en cours
- Echeances proches
- Recommandations

Relations :
- Chaque source de donnees -> API FastAPI
- API FastAPI -> Service Analytics
- Service Analytics -> Tableau de bord etudiant
- Assistant IA -> Recommandations

Style : diagramme de flux horizontal, clair, academique, boites par categorie, fleches simples, couleurs sobres Mizan, texte lisible en francais.
```

## 9. Diagramme de Flux Administrateur

Nom conseille : `diagramme_flux_administration_mizan.png`

Prompt :

```text
Creer un diagramme de flux pour le parcours administrateur de Mizan.

Titre : "Flux de gestion administrative dans Mizan".

Acteur principal :
"Administrateur d'ecole"

Etapes du flux :
1. Connexion a l'espace administrateur
2. Gestion de l'ecole
3. Creation des filieres
4. Creation des promotions
5. Creation des classes
6. Ajout ou import CSV des etudiants
7. Ajout des emplois du temps, examens et projets
8. Publication des ressources
9. Consultation des indicateurs analytiques

Ajouter des validations :
- Verification des droits administrateur
- Validation des fichiers CSV
- Controle du rattachement classe/etudiant
- Scoping par etablissement

Disposition : flux vertical ou horizontal avec etapes numerotees, decisions sous forme de losanges pour les validations, fleches claires. Style professionnel, fond blanc, texte en francais, pas de decoration.
```

## 10. Prompts pour Captures ou Maquettes d'Interfaces

Ces prompts peuvent servir si l'outil doit generer des images de type "screen" pour les annexes.

### Dashboard etudiant

Nom conseille : `screen_dashboard_etudiant.png`

```text
Generer une maquette d'interface web pour le tableau de bord etudiant de Mizan. Interface moderne, claire, en francais, fond blanc, accents bleu profond et vert. Afficher une barre laterale avec Dashboard, Check-in, Objectifs, Taches, Modes, Historique, Notifications, Assistant. Dans la zone principale, afficher cartes compactes : humeur du jour, heures de sommeil, objectifs en cours, echeances proches, dernier conseil de l'assistant, progression hebdomadaire. Style application SaaS sobre, pas de hero marketing, pas de decoration inutile.
```

### Check-in mobile

Nom conseille : `screen_checkin_mobile.png`

```text
Generer une maquette mobile de l'ecran check-in matinal de Mizan. Format smartphone vertical. Interface en francais, design propre et rassurant. Elements visibles : titre "Check-in du matin", selecteur d'humeur, saisie du sommeil, champ notes courtes, priorites du jour, bouton principal "Enregistrer". Couleurs sobres bleu, vert, gris clair. Les controles doivent etre grands et faciles a toucher. Pas d'illustration decorative.
```

### Espace administrateur

Nom conseille : `screen_admin_classes.png`

```text
Generer une maquette web de l'espace administrateur Mizan pour la gestion des classes. Interface professionnelle en francais. Barre laterale admin, en-tete "Gestion des classes", tableau avec colonnes Classe, Promotion, Annee, Etudiants, Actions. Boutons Ajouter, Import CSV, Voir contenu. Ajouter un petit panneau de statistiques : nombre d'etudiants, examens proches, ressources publiees. Style sobre, dense, lisible, adapte a une utilisation administrative.
```

## Conseils d'utilisation dans le rapport LaTeX

Apres generation, placer les images dans :

```text
rapport/figures/
```

Puis les inserer dans `main.tex` avec :

```latex
\begin{figure}[H]
\centering
\includegraphics[width=0.95\textwidth]{figures/diagramme_c4_contexte_mizan.png}
\caption{Diagramme de contexte systeme C4 niveau 1}
\end{figure}
```

Recommandation : conserver les memes titres et captions que dans le rapport pour que la liste des figures reste propre.
