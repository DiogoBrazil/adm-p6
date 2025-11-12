import psycopg2
import psycopg2.extras


def excluir_processo(db_manager, processo_id: str):
    """Soft delete: marca processo/procedimento como inativo.

    Returns: dict(success: bool, error?: str)
    """
    try:
        conn = db_manager.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
            UPDATE processos_procedimentos
            SET ativo = FALSE
            WHERE id = %s
            """,
            (processo_id,),
        )
        conn.commit()
        conn.close()
        if cursor.rowcount == 0:
            return {"success": False, "error": "Processo/Procedimento não encontrado"}
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

