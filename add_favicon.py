#!/usr/bin/env python3
"""
Script para adicionar favicon em todos os arquivos HTML
"""
import os
import re

# Linha do favicon para adicionar
FAVICON_LINE = '    <link rel="icon" type="image/x-icon" href="static/images/SJD-GESTOR.ico">\n'

def add_favicon_to_html(file_path):
    """Adiciona favicon ao arquivo HTML se ainda não existir"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verifica se já tem favicon
        if 'SJD-GESTOR.ico' in content or 'rel="icon"' in content:
            print(f"✓ Favicon já existe em: {os.path.basename(file_path)}")
            return False
        
        # Procura por <title> e adiciona o favicon logo depois
        if '<title>' in content:
            # Adiciona após a tag </title>
            content = re.sub(
                r'(</title>)\n',
                r'\1\n' + FAVICON_LINE,
                content,
                count=1
            )
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✓ Favicon adicionado em: {os.path.basename(file_path)}")
            return True
        else:
            print(f"⚠ Sem tag <title> em: {os.path.basename(file_path)}")
            return False
            
    except Exception as e:
        print(f"✗ Erro em {file_path}: {e}")
        return False

def main():
    """Processa todos os arquivos HTML na pasta web"""
    web_dir = os.path.join(os.path.dirname(__file__), 'web')
    
    if not os.path.exists(web_dir):
        print("✗ Pasta 'web' não encontrada!")
        return
    
    html_files = [f for f in os.listdir(web_dir) if f.endswith('.html')]
    
    print(f"\n🔍 Encontrados {len(html_files)} arquivos HTML\n")
    
    modified = 0
    for html_file in sorted(html_files):
        file_path = os.path.join(web_dir, html_file)
        if add_favicon_to_html(file_path):
            modified += 1
    
    print(f"\n✅ Processo concluído! {modified} arquivos modificados.")

if __name__ == '__main__':
    main()
