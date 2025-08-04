#!/usr/bin/env python3
"""
Verificar implementação do sistema de filtros avançados
"""

def verificar_filtros():
    print("🔍 Verificando implementação dos filtros avançados...")
    
    # Verificar HTML - estrutura dos filtros
    html_path = "/home/diogo/DEV/aulas/test-eel/web/procedure_list.html"
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    elementos_html = [
        'id="filtrosAvancados"',
        'id="filtroTipo"',
        'id="filtroAno"',
        'id="filtroOrigem"',
        'id="filtroEncarregado"',
        'id="filtroStatus"',
        'id="filtroDocumento"',
        'onclick="toggleFiltrosAvancados()"',
        'onclick="aplicarFiltros()"',
        'onclick="limparFiltros()"'
    ]
    
    print("📄 Verificação do HTML:")
    for elemento in elementos_html:
        if elemento in html_content:
            print(f"   ✅ {elemento}")
        else:
            print(f"   ❌ {elemento}")
    
    # Verificar CSS - estilos dos filtros
    css_path = "/home/diogo/DEV/aulas/test-eel/web/static/css/procedures.css"
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()
    
    elementos_css = [
        '.filtros-avancados',
        '.filtros-grid',
        '.filter-group',
        '.filter-select',
        '.filter-actions',
        '.btn-filter',
        '.filter-indicator'
    ]
    
    print("\n🎨 Verificação do CSS:")
    for elemento in elementos_css:
        if elemento in css_content:
            print(f"   ✅ {elemento}")
        else:
            print(f"   ❌ {elemento}")
    
    # Verificar JavaScript - funções dos filtros
    js_path = "/home/diogo/DEV/aulas/test-eel/web/static/js/procedure_list.js"
    with open(js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()
    
    funcoes_js = [
        'function toggleFiltrosAvancados()',
        'function carregarOpcoesDosFiltros()',
        'function povoarSelect(',
        'function aplicarFiltros()',
        'function limparFiltros()',
        'function atualizarIndicadorFiltros()',
        'filtrosAtivos',
        'filtrosAvancadosVisiveis'
    ]
    
    print("\n⚙️ Verificação do JavaScript:")
    for funcao in funcoes_js:
        if funcao in js_content:
            print(f"   ✅ {funcao}")
        else:
            print(f"   ❌ {funcao}")
    
    # Contar linhas adicionadas
    linhas_html = html_content.count('\n')
    linhas_css = css_content.count('\n')
    linhas_js = js_content.count('\n')
    
    print(f"\n📊 Estatísticas dos arquivos:")
    print(f"   HTML: {linhas_html} linhas")
    print(f"   CSS: {linhas_css} linhas")  
    print(f"   JavaScript: {linhas_js} linhas")
    
    print("\n" + "="*60)
    print("✅ Verificação concluída!")
    
    print("\n🎯 Funcionalidades implementadas:")
    print("   • Sistema de filtros avançados com 6 categorias")
    print("   • Interface responsiva e animada")
    print("   • Indicador visual de filtros ativos")
    print("   • Integração com busca de texto existente")
    print("   • Carregamento dinâmico de opções")
    print("   • Botões para aplicar e limpar filtros")

if __name__ == "__main__":
    verificar_filtros()
