\LoadClass[a4paper,12pt]{article}

%--------------------- Packages ------------------------

\RequirePackage[provide=*,french]{babel}
\RequirePackage[utf8]{inputenc}
\RequirePackage[T1]{fontenc}
\RequirePackage[section]{placeins}
\RequirePackage{mathtools}
\RequirePackage{float}
\RequirePackage{graphicx}
\RequirePackage[justification=centering]{caption}
\RequirePackage{subcaption}
\RequirePackage{wallpaper}
\RequirePackage{nomencl}
\RequirePackage{fancyhdr}
\RequirePackage{url}
\RequirePackage{xcolor}
\RequirePackage[hidelinks]{hyperref}
\RequirePackage[left=2.5cm,right=2.5cm,top=2cm,bottom=3.5cm]{geometry}

%-------------------- Informations sur le rapport ----------------------

\newcommand{\rapportUE}{Conception Orientée Objet en Java}
\newcommand{\rapportSujet}{Rapport de mini-projet}
\newcommand{\rapportTitre}{Titre du projet}
\newcommand{\rapportEnseignant}{Prof. de Module}
\newcommand{\rapportEleves}{}

\newcommand{\rapportAnnee}{2025 / 2026}
\newcommand{\rapportDateSoutenance}{.. / .. / ....}

\newcommand{\UE}[1]{\renewcommand{\rapportUE}{#1}}
\newcommand{\sujet}[1]{\renewcommand{\rapportSujet}{#1}}
\newcommand{\titre}[1]{\renewcommand{\rapportTitre}{#1}}
\newcommand{\enseignant}[1]{\renewcommand{\rapportEnseignant}{#1}}
\newcommand{\eleves}[1]{\renewcommand{\rapportEleves}{#1}}
\newcommand{\anneeuniversitaire}[1]{\renewcommand{\rapportAnnee}{#1}}
\newcommand{\soutenance}[1]{\renewcommand{\rapportDateSoutenance}{#1}}

\newcommand{\fairemarges}{
\makenomenclature
\pagestyle{fancy}
\fancyhf{}
\fancyheadoffset{1cm}
\setlength{\headheight}{2cm}
\lhead{\nouppercase{\leftmark}}
\cfoot{\thepage}
\renewcommand{\headrulewidth}{0.4pt}
}

\newcommand{\fairepagedegarde}{
\begin{titlepage}

\ThisLRCornerWallPaper{1}{logos/background.png}
    \centering
    \includegraphics[width=0.5\textwidth]{logos/enset.png}\par\vspace{1cm}
    {\scshape\ Département Mathématiques et Informatique \par}
    \vspace{1.2cm}
    {\scshape\Large \rapportUE \par}
     \vspace{0.45cm}

    \rule{\linewidth}{0.2 mm} \\[0.4 cm]
    \vspace{0.65cm}
    \IfFileExists{../Logos/MIZAN_ICON.png}{%
        \includegraphics[width=2.3cm]{../Logos/MIZAN_ICON.png}\par
        \vspace{0.45cm}
    }{%
        \vspace{0.8cm}
    }
    {\huge\bfseries \rapportTitre \par}
    \vspace{0.25cm}
    {\Large \rapportSujet \par}
    \rule{\linewidth}{0.2 mm} \\[1.2 cm]

    \begin{minipage}{0.5\textwidth}
        \begin{flushleft} \large
        \emph{\textbf{Réalisé par :}}\\
        \rapportEleves
        \end{flushleft}
    \end{minipage}
    ~
    \begin{minipage}{0.4\textwidth}
        \begin{flushright} \large
        \emph{\textbf{Encadré par :}}\\
        \rapportEnseignant\\[0.35cm]
  
        \end{flushright}
    \end{minipage}\\[2cm]

    \vfill
    {\large \textbf{Année universitaire : \rapportAnnee}\par}

\end{titlepage}
}

\newcommand{\tabledematieres}{
\tableofcontents
\newpage
}

\newcommand{\insererfigure}[4]{
\begin{figure}[ht]
\centering
\includegraphics[height=#2]{#1}
\caption{#3}
\label{fig:#4}
\end{figure}
}
