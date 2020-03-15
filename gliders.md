# Regles pour les Freoles/Gliders
Les Freoles/Gliders sont un peuple qui vit sur des navires volants. Leurs techniques de navigation s'apparrentent a celles de la voile.
Les Gliders savent remonter le vent avec leurs navires et peuvent donc se deplacer beaucoup plus aisement sur la carte que les Hordiers.

  * Freoles
    * Les pouvoirs Freoles sont bases sur le vent.
    * Le but des Freoles est d'assister la Horde sans pour autant pouvoir la transporter.
    * Les Freoles ont des navires rapides qui sont capables de "remonter" le vent.
    * Les Freoles peuvent fournir de la main d'oeuvre ou des "infrastructures"/"equipements" a la horde pour l'aider a progresser

Dans cette "extension" du jeu, je propose de pouvoir interpreter le plateau et de changer le mode de deplacement des navires volants.

> Un splendide navire fréole, un cinq-mâts toutes voiles dehors, avait surgi du fond de l’horizon. En huit secondes, il fut sur nous. Avec de part et d’autre de la coque en suspension, giflant l’herbe, une nuée de vélichars et d’ailes de parapentes qui se croisaient haut par-dessus la mâture. Je ne sais ni comment il nous vit, ni comment il freina. Je sais simplement qu’il passa à dix pas de moi et qu’il laboura parmi la horde, sans toucher personne. Lorsque la terre a cessé de se tordre, ils ont relevé les ailerons latéraux, rétracté les socs et laissé la coque s’immobiliser en douceur. Le bois a mugi sur le tapis d’herbes couchées. J’ai entendu les roues des chars tractés, le claquement des ailes à l’arrêt et la toile faseyante des cerfs-volants de freinage. 
  *Damasio, Alain. La Horde du Contrevent (Sc. Fiction) (French Edition) (Kindle Locations 1386-1391). La Volte. Kindle Edition.* 

# Introduction

Le but du jeu est de remplir un ensemble de missions par chapitre. 
Les missions sont aussi variees que :
- de construire un village
- transporter du materiel
- transporter des marchandises
- explorer un lieu particulier

Pour ce faire, il faudra donc des lieux supplementaires, des tuiles terrain supplementaires pour permettre aux freoles de naviguer sur de plus longues distances. 

# Principes

## Le Vent et sa force
Les Freoles ne sont pas impactes par les des du sol (peut etre les d6 rouges?) et ils ne font face qu'aux informations liees au vent sur les tuiles **terrain**.
Les Freoles regardent donc les symboles et les valeurs des chiffres sur le bord des tuiles.
Lorsqu'un symbole correspond, le vent gagne 1 d6 par symbole. 
Le vaisseau lancera toujours 6 d6, tout comme les hordiers mais le vent aura toujours moins de d6 que vent.
Pour permettre aux Gliders d'avoir un vrai challenge, les valeurs de d6 manquant vaudront toujours la force du vent.
Ainsi, pour un vent de force 6, meme sans d6 impose par le plateau, le vent fera sur chacun de ses d6 "6".

Prenons l'exemple d'un navire en case A , un Choon(3) sur cette tuile aurait 1d6 a cause de la case F, + 1d6 de la case B + 1d6 de la case G soit 3d6.
Ces d6 obeissent aux memes regles que celles de Windwalkers. Ce sont des d6 colores, le navire devra donc faire exactement la meme valeur que ces d6. Les 3 autres valeurs que fera le vent seront des 3.

```  
sens du vent: de bas en haut
  E
N ^ S
  O
                     _____
        \\    F    //  5  \
        5\\5     3//4     6\
     G    \\__4__//    E     \
          //  1  \\         /
        6//6     2\\3     1/
   __1__//    A    \\__2__/
  /  4  \\         //  2  \
 /3     5\\5     3//1     3\
/    B    \\__4__//    D    \
\         //  6  \\         /
 \2     6//5     1\\6     4/
  \__1__//    C    \\__5__/
         \         /
          \4     2/
           \__3__/

```

## La direction du vent
Dans Gliders, la direction du vent sera d'une importance capitale. En effet, les voiliers obeissent a des regles pour naviguer et il y a des directions plus faciles que d'autres.
Il y a 4 directions de vents dans Gliders: bon pre, grand largue, vent arriere et vent debout.
Plus bas, les exemples seront tous pris selon la case A et un navire se dirigeant vers la case C.
- **Bon Pre** correspond a un vent a 30 degres par rapport a la direction de votre navire. Pour aller de A vers C, un vent bon pre correspond aux vents de force 6 et 2.
- **Grand Largue** est un vent a 60 degres par rapport a la direction de votre navire. Pour aller de A vers C, un vent grand largue correspond aux vents de force 3 et 5. 
- **Vent Arriere** est un vent qui est dans la direction de votre navire. Pour aller de A vers C, un vent arriere correspond au vent force 4.
- **Vent Debout** correspond a un vent de face et donc oppose a la direction de votre navire. Pour aller de A vers C, vent debout correspond au vent de force 1.

La direction du vent est capitale car elle influera sur la difficulte de naviguer. Cela sera represente par des bonus ou des penalites de deplacement.
- **Bon Pre** reduira la difficulte du vent a affronte de 1 en force (il peut y avoir des vents ressentis de force 0)
<<<<<<< HEAD
- **Grand Largue** le vent a 1 d6 noir
- **Vent Arriere** le vent a 2 d6 noir
=======
- **Grand Largue** n'a aucun effet 
- **Vent Arriere** le vent a un d6 noir
>>>>>>> dd984fa... First printable version of cards for Gliders -> testing soon
- **Vent Debout** le vent a +1 en force (il peut y avoir des vents ressentis de force 7)

## L'Exploration
Au cours de la partie, votre navire va se deplacer sur le plateau afin d'accomplir certaines missions.
Pour ce faire, vous avez a votre disposition la puissace de vos voiles et moteurs ; cependant il faudra faire face parfois des vents complexes avec sagesse et puissance.
D'un point de vue "roleplay", vos voiles seront representees par les d6 que vous lancerez et l'investissement des moteurs se fera a travers le carburant que vous depenserez pour ajuster vos d6.

Un navire s'arrete quand il le desire ou quand il n'a plus de carburant. Si vous devez vous arreter pendant que vous affrontez un vent, vous perdrez une piece d'equipement ou une partie de votre cargaison.

Lorsqu'un navire se pose, il recupere tout son carburant et passe son tour. Sinon, le navire avance et joue tant qu'il le peut/le veut.
<<<<<<< HEAD

Un vaisseau qui n'a pas la capacite de passer un vent puissant doit jeter un element en soute pour avoir le droit d'affronter le vent.
=======
>>>>>>> dd984fa... First printable version of cards for Gliders -> testing soon

# Capacites possible du Navire
Un navire commence avec une certaine capacite de soute et de capacite deplacement.
Un navire est limite par:
 - la force du vent qu'il peut franchir
 - le nombre d'elements qu'il peut transporter
 - le nombre de deplacements qu'il pourra effectuer
 - la faciliter a passer certains vents
 - la quantite d'energie du navire
 
 ## Plateau du Navire
 Sur le plateau du navire, il apparait des espaces representant la soute, les capacites du navire ainsi que sa reserve de carburant.
 Un navire a aussi un emplacement pour sa carte mission.
 
 En debut de partie, le navire aura une soute pleine de denrees sans pouvoir particulier.
 
 
 # Les equipements du Navire
 Tous les equipements/personnes du navire sont stockes dans la soute.
 
 Les cartes **equipement** representent:
 - Un capitaine/amiral
 - Des ameliorations
 - Des personnages
 - Des denrees
 - Du materiel de construction
 
 Les cartes **equipement** ont un titre, une image, une description un pouvoir passif et un pouvoir actif.
 
Le navire commence avec 9 points de carburants et 4 places en soute.

# Les Missions
Le navire doit effectuer 2 missions par chapitre pendant que la Horde traverse la carte.
Ces 2 missions doivent etre remplies pour que le chapitre s'acheve avec succes. Si la horde echoue a traverser ou que vous echouez a remplir vos 2 missions, la partie se termine et vous comptez vos points.

En debut de partie, piochez 3 missions et choisissez en au moins une.
Une nouvelle mission peut etre piochee chaque fois que votre vaisseau se rend en ville.
Vous ne pouvez pas avoir plus de 3 missions en main.

Lorsque vous decidez d'effectuer une mission ou que l'une d'elle s'active, posez la mission devant vous et faites les actions necessaires.
Rajoutez alors en ville autant d'equipements que le niveau de la mission.
Une fois accomplie votre mission, rajoutez une carte equipement en ville.

En fin de chapitre, chaque mission remplie rapporte autant de points que son grade. Les missions grade 1 rapportent donc 1 point, les 2 rapportent 2 points et les 3 rapportent 3 points.


