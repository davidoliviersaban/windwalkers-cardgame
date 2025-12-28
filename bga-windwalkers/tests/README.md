# Tests Unitaires - Windwalkers

## Description

Ce répertoire contient les tests unitaires pour valider la logique de matching des dés dans le jeu Windwalkers.

## Fichiers de tests

- **DiceMatchingTest.php** : Tests pour les fonctions de comptage et matching des dés
  - `countFaceOccurrences()` : Compte les occurrences de chaque face avec filtres optionnels
  - `matchAndConsumeDice()` : Match les dés de défi avec les dés du joueur et consomme ceux utilisés

## Installation

### Prérequis

- PHP 7.4+
- PHPUnit 9+

### Installation de PHPUnit

```bash
cd /Users/dsaban/git/perso/windwalkers-cardgame/bga-windwalkers
composer require --dev phpunit/phpunit ^9
```

Si composer n'est pas installé:

```bash
# macOS
brew install composer

# puis
composer install
```

## Exécution des tests

### Tous les tests

```bash
cd /Users/dsaban/git/perso/windwalkers-cardgame/bga-windwalkers
php vendor/bin/phpunit
```

### Tests spécifiques

```bash
# Tester countFaceOccurrences
php vendor/bin/phpunit --filter "countFaceOccurrences"

# Tester matchAndConsumeDice
php vendor/bin/phpunit --filter "matchAndConsumeDice"

# Tester la consommation séquentielle (greens → whites → blacks)
php vendor/bin/phpunit --filter "SequentialConsumption"
```

### Avec coverage (couverture de code)

```bash
php vendor/bin/phpunit --coverage-html coverage/
```

## Cas de tests

### countFaceOccurrences

- ✅ Liste vide
- ✅ Toutes les faces (1-6)
- ✅ Faces dupliquées
- ✅ Filtrage par type (green, white, black, blue)
- ✅ Filtrage par propriétaire (player, challenge)

### matchAndConsumeDice

- ✅ Match parfait (tous les dés correspondent)
- ✅ Match partiel (certains dés manquent)
- ✅ Pas de match (aucun dé ne correspond)
- ✅ Défi vide (aucun dé de défi)
- ✅ Consommation multiple (plusieurs faces)
- ✅ Valeurs invalides (0, 7, etc.)
- ✅ Zéro disponible

### Consommation séquentielle (règle: pas de réutilisation)

- ✅ Greens → Whites → Blacks (en ordre)
- ✅ Éviter la réutilisation de dés (un dé consommé par les greens ne peut pas être utilisé par les whites)
- ✅ Toutes les faces requises

## Résultats attendus

Tous les tests doivent passer (OK):

```
DiceMatchingTest::testCountFaceOccurrences_EmptyDiceList ... OK
DiceMatchingTest::testCountFaceOccurrences_AllFaces ... OK
... (33 tests total)
```

## Structure des données de test

### Dice array

```php
[
    'dice_value' => 1,           // 1-6
    'dice_type' => 'green',      // green, white, black, blue
    'dice_owner' => 'challenge'  // player, challenge
]
```

### Counts array

```php
[
    1 => 2,  // 2 dés de face 1
    2 => 1,  // 1 dé de face 2
    3 => 0,  // 0 dés de face 3
    ...
]
```

## Logique testée

La logique de confrontation consomme les dés dans cet ordre:

1. **Greens (terrains)** : Les dés du joueur sont consommés pour matcher les dés verts du défi
2. **Whites (vent)** : Les dés restants du joueur sont consommés pour matcher le force du vent
3. **Blacks (destin)** : Les dés finalement restants sont consommés pour matcher les dés noirs du défi

**Règle cruciale** : Un dé consommé à une étape ne peut pas être réutilisé aux étapes suivantes.

## Exemples de scénarios

### Scénario 1 : Pas assez de dés

```
Défi: 2x face 1 (green), 2x face 1 (white), 2x face 1 (black)
Joueur: 3x face 1

Résultat:
- Greens: 2 matchés (2 dés consommés) → OK
- Whites: 1 disponible (1 match, besoin 2) → ÉCHEC
- Blacks: 0 disponible → ÉCHEC
```

### Scénario 2 : Mix de faces

```
Défi: 2x face 1 (green), 1x face 2 (white), 1x face 3 (black)
Joueur: 2x face 1, 2x face 2, 2x face 3

Résultat:
- Greens: 2x face 1 consommés → OK
- Whites: 1x face 2 consommé → OK
- Blacks: 1x face 3 consommé → OK
```

## Contribution

Pour ajouter de nouveaux tests:

1. Ajouter une fonction `testXxx()` dans `DiceMatchingTest.php`
2. Exécuter `php vendor/bin/phpunit` pour vérifier
3. Commiter les nouveaux tests
