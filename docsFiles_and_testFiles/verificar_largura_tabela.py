#!/usr/bin/env python3
"""
Verificar alterações na largura da tabela e colunas
"""

def verificar_alteracoes():
    print("🔍 Verificando alterações na largura da tabela...")
    
    # Verificar container principal no CSS
    dashboard_path = "/home/diogo/DEV/aulas/test-eel/web/static/css/dashboard.css"
    with open(dashboard_path, 'r', encoding='utf-8') as f:
        dashboard_content = f.read()
    
    if 'max-width: 1400px' in dashboard_content:
        print("✅ Container principal aumentado para 1400px")
    else:
        print("❌ Container principal NÃO foi alterado")
    
    # Verificar largura mínima da tabela no CSS
    users_path = "/home/diogo/DEV/aulas/test-eel/web/static/css/users.css"
    with open(users_path, 'r', encoding='utf-8') as f:
        users_content = f.read()
    
    if 'min-width: 1200px' in users_content:
        print("✅ Largura mínima da tabela aumentada para 1200px")
    else:
        print("❌ Largura mínima da tabela NÃO foi alterada")
    
    # Verificar larguras das colunas no HTML
    html_path = "/home/diogo/DEV/aulas/test-eel/web/procedure_list.html"
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Calcular total das larguras
    larguras = []
    import re
    width_matches = re.findall(r'width="(\d+)%"', html_content)
    
    if width_matches:
        larguras = [int(w) for w in width_matches]
        total = sum(larguras)
        print(f"\n📊 Distribuição das larguras das colunas:")
        colunas = ["Tipo", "Ano", "Número", "Origem", "SEI", "Encarregado", "PM Envolvido", "Tipo de Envolvimento", "Ações"]
        for i, (coluna, largura) in enumerate(zip(colunas, larguras)):
            print(f"   {coluna}: {largura}%")
        print(f"\n📐 Total das larguras: {total}%")
        
        # Verificar se Encarregado e PM Envolvido foram aumentados
        if len(larguras) >= 7:
            encarregado_width = larguras[5]  # Índice 5 = Encarregado
            pm_envolvido_width = larguras[6]  # Índice 6 = PM Envolvido
            
            if encarregado_width == 25:
                print("✅ Coluna 'Encarregado' aumentada para 25%")
            else:
                print(f"❌ Coluna 'Encarregado' está com {encarregado_width}% (esperado: 25%)")
            
            if pm_envolvido_width == 25:
                print("✅ Coluna 'PM Envolvido' aumentada para 25%")
            else:
                print(f"❌ Coluna 'PM Envolvido' está com {pm_envolvido_width}% (esperado: 25%)")
    else:
        print("❌ Não foi possível encontrar as larguras das colunas")
    
    print("\n" + "="*60)
    print("✅ Verificação concluída!")

if __name__ == "__main__":
    verificar_alteracoes()
