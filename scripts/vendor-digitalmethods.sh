#!/usr/bin/env bash

set -e

echo "=== Cloner le dépôt digitalmethods ==="

mkdir -p vendor

if [ -d "vendor/instagram-batch-scrape" ]; then
    echo "Le répertoire vendor/instagram-batch-scrape existe déjà. Mise à jour..."
    cd vendor/instagram-batch-scrape
    git pull
else
    echo "Clonage du dépôt..."
    git clone https://github.com/digitalmethodsinitiative/instagram-batch-scrape vendor/instagram-batch-scrape
fi

echo "=== digitalmethods cloné avec succès ==="
