#!/bin/bash

# Script para atualizar o banco de dados com as colunas que faltam
# Executa o script SQL para adicionar a coluna local_origem

echo "Atualizando banco de dados..."
sqlite3 usuarios.db < update_database.sql
echo "Atualização concluída!"
