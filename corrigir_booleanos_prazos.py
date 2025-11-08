#!/usr/bin/env python3
import re

arquivo = 'prazos_andamentos_manager.py'

with open(arquivo, 'r', encoding='utf-8') as f:
    conteudo = f.read()

# Backup
with open(arquivo + '.before_boolean_fix', 'w', encoding='utf-8') as f:
    f.write(conteudo)

# Substituir ativo = 0 e ativo = 1
conteudo = re.sub(r'\bativo\s*=\s*0\b', 'ativo = FALSE', conteudo)
conteudo = re.sub(r'\bativo\s*=\s*1\b', 'ativo = TRUE', conteudo)

with open(arquivo, 'w', encoding='utf-8') as f:
    f.write(conteudo)

print("✅ prazos_andamentos_manager.py corrigido!")
