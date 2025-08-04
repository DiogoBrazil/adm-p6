#!/usr/bin/env python3
"""
Script para verificar os dados que serão exibidos na tabela com a nova coluna SEI.
"""

import sqlite3

def verificar_dados_tabela():
    """Verifica os dados que serão exibidos na tabela"""
    
    conn = sqlite3.connect('usuarios.db')
    cursor = conn.cursor()
    
    print("🔍 VERIFICANDO DADOS PARA EXIBIÇÃO NA TABELA")
    print("="*60)
    
    # Buscar dados como serão exibidos na tabela
    cursor.execute("""
        SELECT 
            p.id, p.numero, p.tipo_geral, p.tipo_detalhe, p.documento_iniciador, p.processo_sei,
            COALESCE(o.nome, e.nome, 'Desconhecido') as responsavel,
            p.created_at,
            p.local_origem, 
            p.data_instauracao,
            p.status_pm,
            CASE 
                WHEN p.nome_pm_id IS NOT NULL THEN COALESCE(
                    (SELECT nome FROM operadores WHERE id = p.nome_pm_id),
                    (SELECT nome FROM encarregados WHERE id = p.nome_pm_id),
                    'Desconhecido'
                )
                ELSE NULL
            END as nome_pm,
            p.numero_portaria,
            p.numero_memorando,
            p.numero_feito,
            p.responsavel_id, 
            p.responsavel_tipo,
            COALESCE(o.posto_graduacao, e.posto_graduacao, '') as responsavel_pg,
            COALESCE(o.matricula, e.matricula, '') as responsavel_matricula,
            COALESCE(
                (SELECT posto_graduacao FROM operadores WHERE id = p.nome_pm_id),
                (SELECT posto_graduacao FROM encarregados WHERE id = p.nome_pm_id),
                ''
            ) as nome_pm_pg,
            COALESCE(
                (SELECT matricula FROM operadores WHERE id = p.nome_pm_id),
                (SELECT matricula FROM encarregados WHERE id = p.nome_pm_id),
                ''
            ) as nome_pm_matricula,
            p.numero_rgf
        FROM processos_procedimentos p
        LEFT JOIN operadores o ON p.responsavel_id = o.id
        LEFT JOIN encarregados e ON p.responsavel_id = e.id AND o.id IS NULL
        WHERE p.ativo = 1
        ORDER BY p.created_at DESC
    """)
    
    processos = cursor.fetchall()
    conn.close()
    
    if not processos:
        print("❌ Nenhum processo encontrado")
        return
    
    print(f"📋 Total de processos: {len(processos)}")
    print("-" * 60)
    
    # Simular a exibição da tabela
    print("| ANO  | NÚMERO | SEI                  | TIPO | ENCARREGADO           | PM ENVOLVIDO          | STATUS   |")
    print("|------|--------|----------------------|------|-----------------------|-----------------------|----------|")
    
    for i, processo in enumerate(processos, 1):
        # Extrair campos relevantes
        ano = "2025"  # Ano extraído da data de instauração
        numero = processo[1]  # Campo numero
        sei = processo[5] if processo[5] else "Não informado"  # processo_sei
        tipo = processo[3]  # tipo_detalhe
        
        # Encarregado completo
        responsavel_pg = processo[17] or ""
        responsavel_matricula = processo[18] or ""
        responsavel_nome = processo[6]
        encarregado = f"{responsavel_pg} {responsavel_matricula} {responsavel_nome}".strip()
        
        # PM envolvido completo
        pm_pg = processo[19] or ""
        pm_matricula = processo[20] or ""
        pm_nome = processo[11] or ""
        pm_envolvido = f"{pm_pg} {pm_matricula} {pm_nome}".strip() if pm_nome else "Não informado"
        
        # Status PM
        status_pm = processo[10] or "Não informado"
        
        # Truncar textos longos para exibição
        def truncar(texto, tamanho=20):
            return (texto[:tamanho-3] + "...") if len(texto) > tamanho else texto
        
        print(f"| {ano:4} | {truncar(numero, 6):6} | {truncar(sei, 20):20} | {truncar(tipo, 4):4} | {truncar(encarregado, 21):21} | {truncar(pm_envolvido, 21):21} | {truncar(status_pm, 8):8} |")
    
    print("-" * 60)
    
    # Mostrar detalhes do primeiro processo
    if processos:
        processo = processos[0]
        print(f"\n📄 DETALHES DO PRIMEIRO PROCESSO:")
        print(f"   ID: {processo[0]}")
        print(f"   Número: '{processo[1]}'")
        print(f"   Processo SEI: '{processo[5]}'")
        print(f"   Tipo Detalhe: '{processo[3]}'")
        print(f"   Documento Iniciador: '{processo[4]}'")
        print(f"   Responsável: '{processo[6]}'")
        print(f"   PM Envolvido: '{processo[11] or 'Não informado'}'")
        print(f"   Status PM: '{processo[10] or 'Não informado'}'")
        print(f"   RGF: '{processo[21] or 'Não informado'}'")
    
    print("\n✅ Verificação concluída!")

if __name__ == "__main__":
    verificar_dados_tabela()
